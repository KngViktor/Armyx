import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import type { LoginInput, RegisterInput } from '@armyx/shared';
import { DatabaseService } from '../infra/database.service';
import { CryptoService } from '../infra/crypto.service';
import { RedisService } from '../infra/redis.service';
import { QueueService } from '../infra/queue.service';
import { SessionService } from '../common/session.service';
import { dummyVerify, hashPassword, verifyPassword } from '../common/passwords';
import { newTotpSecret, otpauthUrl, verifyTotp } from '../common/totp';
import { OtpService, OtpChannel } from './otp.service';

export const CONSENT_VERSION = '2026-01';
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly crypto: CryptoService,
    private readonly redis: RedisService,
    private readonly queue: QueueService,
    private readonly sessions: SessionService,
    private readonly otp: OtpService,
  ) {}

  async register(input: RegisterInput) {
    const passwordHash = await hashPassword(input.password);
    try {
      const [row] = await this.db.write<{ id: string }>(
        `INSERT INTO users (email_hash, phone_hash, email_enc, phone_enc, surname, first_name, password_hash, consent_version, consent_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now()) RETURNING id`,
        [
          this.crypto.blindIndex(input.email), this.crypto.blindIndex(input.phone),
          this.crypto.encrypt(input.email), this.crypto.encrypt(input.phone),
          input.surname.toUpperCase(), input.firstName, passwordHash, CONSENT_VERSION,
        ],
      );
      await Promise.all([this.otp.send(row!.id, 'email'), this.otp.send(row!.id, 'phone')]);
      return { userId: row!.id, verify: ['email', 'phone'] };
    } catch (e) {
      if ((e as { code?: string }).code === '23505') {
        throw new ConflictException('An account with this email address or phone number already exists. Try signing in.');
      }
      throw e;
    }
  }

  async verifyOtp(userId: string, channel: OtpChannel, code: string) {
    await this.otp.verify(userId, channel, code);
    const col = channel === 'email' ? 'email_verified_at' : 'phone_verified_at';
    const [u] = await this.db.write<{ email_verified_at: Date | null; phone_verified_at: Date | null }>(
      `UPDATE users SET ${col} = COALESCE(${col}, now()), updated_at = now() WHERE id = $1
       RETURNING email_verified_at, phone_verified_at`,
      [userId],
    );
    if (!u) throw new BadRequestException('Account not found');
    const complete = !!u.email_verified_at && !!u.phone_verified_at;
    if (complete) await this.queue.notify({ channel: 'email', userId, template: 'welcome', vars: {} });
    return { verified: channel, complete };
  }

  async resendOtp(userId: string, channel: OtpChannel) {
    const [u] = await this.db.read(`SELECT 1 FROM users WHERE id = $1 AND erased_at IS NULL`, [userId]);
    if (u) await this.otp.send(userId, channel);
    return { sent: true };
  }

  async login(input: LoginInput, res: Response) {
    const [u] = await this.db.write<{
      id: string; password_hash: string; email_verified_at: Date | null; phone_verified_at: Date | null;
      totp_enabled: boolean; totp_secret_enc: Buffer | null; failed_logins: number; locked_until: Date | null;
      surname: string; first_name: string;
    }>(
      `SELECT id, password_hash, email_verified_at, phone_verified_at, totp_enabled, totp_secret_enc,
              failed_logins, locked_until, surname, first_name
         FROM users WHERE email_hash = $1 AND erased_at IS NULL`,
      [this.crypto.blindIndex(input.email)],
    );
    if (!u) {
      await dummyVerify(input.password);
      throw new UnauthorizedException('Incorrect email or password');
    }
    if (u.locked_until && u.locked_until > new Date()) {
      throw new ForbiddenException('Account temporarily locked after repeated failed sign-ins. Try again later or reset your password.');
    }
    if (!(await verifyPassword(u.password_hash, input.password))) {
      await this.db.write(
        `UPDATE users SET failed_logins = failed_logins + 1,
           locked_until = CASE WHEN failed_logins + 1 >= $2 THEN now() + ($3 || ' minutes')::interval END
         WHERE id = $1`,
        [u.id, MAX_FAILED, LOCK_MINUTES],
      );
      throw new UnauthorizedException('Incorrect email or password');
    }

    const pending: OtpChannel[] = [];
    if (!u.email_verified_at) pending.push('email');
    if (!u.phone_verified_at) pending.push('phone');
    if (pending.length) {
      for (const ch of pending) await this.otp.send(u.id, ch).catch(() => undefined);
      return { verificationRequired: true, userId: u.id, verify: pending };
    }

    if (u.totp_enabled) {
      if (!input.totp) return { mfaRequired: true };
      await this.checkTotp(u.id, this.crypto.decryptString(u.totp_secret_enc)!, input.totp);
    }

    if (u.failed_logins > 0) await this.db.write(`UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1`, [u.id]);
    await this.sessions.create(res, { kind: 'applicant', id: u.id });
    return { ok: true, user: { id: u.id, surname: u.surname, firstName: u.first_name } };
  }

  /** Verifies a TOTP code and blocks replay of the same code within its window. */
  async checkTotp(userId: string, secret: string, code: string) {
    const step = verifyTotp(secret, code);
    if (step === null) throw new UnauthorizedException('Invalid authentication code');
    const fresh = await this.redis.client.set(`totp:used:${userId}:${step}`, '1', 'EX', 120, 'NX');
    if (!fresh) throw new UnauthorizedException('This code has already been used. Wait for the next one.');
  }

  async me(userId: string) {
    const [u] = await this.db.read(
      `SELECT id, surname, first_name, email_enc, phone_enc, totp_enabled, created_at FROM users WHERE id = $1`,
      [userId],
    );
    if (!u) throw new UnauthorizedException();
    return {
      id: u.id, surname: u.surname, firstName: u.first_name,
      email: this.crypto.decryptString(u.email_enc), phone: this.crypto.decryptString(u.phone_enc),
      twoFactorEnabled: u.totp_enabled, createdAt: u.created_at,
    };
  }

  async setupTotp(userId: string, accountLabel: string) {
    const secret = newTotpSecret();
    await this.redis.client.set(`totp:pending:${userId}`, secret, 'EX', 600);
    const url = otpauthUrl(secret, accountLabel, 'Nigerian Army Recruitment');
    return { secret, otpauthUrl: url, qrDataUrl: await QRCode.toDataURL(url) };
  }

  async enableTotp(userId: string, code: string, table: 'users' | 'admin_users' = 'users') {
    const secret = await this.redis.client.get(`totp:pending:${userId}`);
    if (!secret) throw new BadRequestException('Setup expired, start again');
    await this.checkTotp(userId, secret, code);
    await this.db.write(`UPDATE ${table} SET totp_secret_enc = $2, totp_enabled = true, updated_at = now() WHERE id = $1`, [
      userId, this.crypto.encrypt(secret),
    ]);
    await this.redis.client.del(`totp:pending:${userId}`);
    return { enabled: true };
  }

  async disableTotp(userId: string, code: string) {
    const [u] = await this.db.write(`SELECT totp_secret_enc FROM users WHERE id = $1 AND totp_enabled`, [userId]);
    if (!u) throw new BadRequestException('Two-factor authentication is not enabled');
    await this.checkTotp(userId, this.crypto.decryptString(u.totp_secret_enc)!, code);
    await this.db.write(`UPDATE users SET totp_secret_enc = NULL, totp_enabled = false WHERE id = $1`, [userId]);
    return { enabled: false };
  }

  /** Always succeeds from the caller's point of view to avoid account enumeration. */
  async forgotPassword(email: string) {
    const [u] = await this.db.read(`SELECT id FROM users WHERE email_hash = $1 AND erased_at IS NULL`, [this.crypto.blindIndex(email)]);
    if (u) {
      const token = randomBytes(32).toString('base64url');
      const h = createHash('sha256').update(token).digest('hex');
      await this.redis.client.set(`pwreset:${h}`, u.id, 'EX', 1800);
      await this.queue.notify({ channel: 'email', userId: u.id, template: 'password_reset', vars: { token } });
    }
    return { ok: true };
  }

  async resetPassword(token: string, password: string) {
    const h = createHash('sha256').update(token).digest('hex');
    const userId = await this.redis.client.getdel(`pwreset:${h}`);
    if (!userId) throw new BadRequestException('This reset link is invalid or has expired');
    await this.db.write(`UPDATE users SET password_hash = $2, failed_logins = 0, locked_until = NULL, updated_at = now() WHERE id = $1`, [
      userId, await hashPassword(password),
    ]);
    await this.sessions.revokeAll(userId);
    return { ok: true };
  }
}
