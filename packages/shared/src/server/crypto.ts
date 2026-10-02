/**
 * Field-level encryption for personal data (NDPA 2023, s.39 "appropriate
 * technical measures"). Server-only: never import from browser code.
 *
 * Ciphertext layout: [version:1][iv:12][tag:16][ciphertext:n]
 * The version byte selects the key so keys can be rotated: new writes use the
 * current key, old rows remain readable until re-encrypted by a backfill job.
 * In production the keys are data keys unwrapped from a KMS/HSM at start-up.
 *
 * Blind indexes (HMAC-SHA256 with a separate key) allow exact-match lookups
 * (login by email, admin search by phone) without storing plaintext.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

export interface FieldCryptoOptions {
  /** Map of key version -> 32-byte key. */
  keys: Record<number, Buffer>;
  currentVersion: number;
  blindIndexKey: Buffer;
}

export class FieldCrypto {
  constructor(private readonly opts: FieldCryptoOptions) {
    for (const [v, k] of Object.entries(opts.keys)) {
      if (k.length !== 32) throw new Error(`Encryption key v${v} must be 32 bytes`);
    }
    if (!opts.keys[opts.currentVersion]) throw new Error('Current encryption key version missing');
    if (opts.blindIndexKey.length < 32) throw new Error('Blind index key must be >= 32 bytes');
  }

  /** Builds an instance from env vars: DATA_ENCRYPTION_KEYS="1:base64,2:base64", DATA_ENCRYPTION_KEY_VERSION, BLIND_INDEX_KEY. */
  static fromEnv(env: NodeJS.ProcessEnv = process.env): FieldCrypto {
    return new FieldCrypto(FieldCrypto.optionsFromEnv(env));
  }

  static optionsFromEnv(env: NodeJS.ProcessEnv = process.env): FieldCryptoOptions {
    const raw = env.DATA_ENCRYPTION_KEYS;
    if (!raw) throw new Error('DATA_ENCRYPTION_KEYS is not set');
    const keys: Record<number, Buffer> = {};
    for (const pair of raw.split(',')) {
      const [v, b64] = pair.split(':');
      keys[Number(v)] = Buffer.from(b64!, 'base64');
    }
    const currentVersion = Number(env.DATA_ENCRYPTION_KEY_VERSION ?? Math.max(...Object.keys(keys).map(Number)));
    return { keys, currentVersion, blindIndexKey: Buffer.from(env.BLIND_INDEX_KEY ?? '', 'base64') };
  }

  encrypt(plaintext: string | Buffer): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.opts.keys[this.opts.currentVersion]!, iv);
    const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return Buffer.concat([Buffer.from([this.opts.currentVersion]), iv, cipher.getAuthTag(), ct]);
  }

  decrypt(blob: Buffer): Buffer {
    const version = blob[0]!;
    const key = this.opts.keys[version];
    if (!key) throw new Error(`Unknown encryption key version ${version}`);
    const decipher = createDecipheriv('aes-256-gcm', key, blob.subarray(1, 13));
    decipher.setAuthTag(blob.subarray(13, 29));
    return Buffer.concat([decipher.update(blob.subarray(29)), decipher.final()]);
  }

  encryptJson(value: unknown): Buffer {
    return this.encrypt(JSON.stringify(value));
  }

  decryptJson<T>(blob: Buffer): T {
    return JSON.parse(this.decrypt(blob).toString('utf8')) as T;
  }

  decryptString(blob: Buffer | null | undefined): string | null {
    return blob ? this.decrypt(blob).toString('utf8') : null;
  }

  /** Deterministic keyed hash for equality lookups. Input is normalised first. */
  blindIndex(value: string): Buffer {
    return createHmac('sha256', this.opts.blindIndexKey).update(value.trim().toLowerCase()).digest();
  }
}

/** Helper for one-way hashing of IPs in logs / analytics (privacy by design). */
export const hashIp = (ip: string, salt: string): string =>
  createHmac('sha256', salt).update(ip).digest('hex').slice(0, 32);

/**
 * Signature printed (inside the QR code) on acknowledgement slips so screening
 * officers can detect forged slips. Derived from the blind-index key with a
 * distinct label (key separation), truncated to 16 base32-ish chars.
 */
export const slipSignature = (applicationNo: string, blindIndexKey: Buffer): string =>
  createHmac('sha256', createHmac('sha256', blindIndexKey).update('slip-signing-v1').digest())
    .update(applicationNo.toUpperCase())
    .digest('base64url')
    .slice(0, 16);
