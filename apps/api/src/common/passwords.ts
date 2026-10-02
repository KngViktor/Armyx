/**
 * Argon2id password hashing (OWASP 2024 baseline: m=19MiB, t=2, p=1).
 * Runs on native threads so it does not block the event loop.
 */
import { hash, verify, Algorithm } from '@node-rs/argon2';

const OPTS = { algorithm: Algorithm.Argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export const hashPassword = (pw: string) => hash(pw, OPTS);

export async function verifyPassword(hashStr: string, pw: string): Promise<boolean> {
  try {
    return await verify(hashStr, pw);
  } catch {
    return false;
  }
}

/** Pre-computed hash used to equalise timing when the account does not exist (prevents user enumeration). */
let dummy: Promise<string> | undefined;
export const dummyVerify = async (pw: string) => {
  dummy ??= hashPassword('dummy-password-for-timing');
  await verifyPassword(await dummy, pw);
  return false;
};
