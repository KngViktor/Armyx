/**
 * Admin authentication. Two-factor authentication (TOTP) is MANDATORY for all
 * admin accounts: the first successful password login forces enrolment.
 * Admin sessions are short (30 min idle) and use a separate SameSite=Strict cookie.
 */
import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseService } from '../infra/database.service';
import { CryptoService } from '../infra/crypto.service';
import { RedisService } from '../infra/redis.service';
import { AuditService } from '../infra/audit.service';
import { SessionService } from '../common/session.service';
import { dummyVerify, hashPassword, verifyPassword } from '../common/passwords';
import { AuthService } from '../auth/auth.service';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly crypto: CryptoService,
    private readonly redis: RedisService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  async login(email: string, password: string, totp: string | undefined, res: Response, ip: string, ua: string) {
    const [a] = await this.db.write(
      `SELECT id, email, role, password_hash, totp_enabled, totp_secret_enc, active, locked_until FROM admin_users WHERE email = $1`,
      [email],
    );
    if (!a || !a.password_hash || !a.active) {
      await dummyVerify(password);
      await this.audit.log(null, { action: 'admin.login_failed', details: { email }, ip, userAgent: ua });
      throw new UnauthorizedException('Incorrect email or password');
    }
    if (a.locked_until && a.locked_until > new Date()) throw new ForbiddenException('Account locked. Contact a Super Admin.');
    if (!(await verifyPassword(a.password_hash, password))) {
      await this.db.write(
        `UPDATE admin_users SET failed_logins = failed_logins + 1,
           locked_until = CASE WHEN failed_logins + 1 >= 5 THEN now() + interval '30 minutes' END WHERE id = $1`,
        [a.id],
      );
      await this.audit.log({ id: a.id, email: a.email, role: a.role }, { action: 'admin.login_failed', ip, userAgent: ua });
      throw new UnauthorizedException('Incorrect email or password');
    }

    if (!a.totp_enabled) {
      // Password OK but 2FA not enrolled yet: hand out a short-lived setup token.
      const token = randomBytes(32).toString('base64url');
      await this.redis.client.set(`adm:mfasetup:${sha(token)}`, a.id, 'EX', 600);
      return { mfaSetupRequired: true, setupToken: token };
    }
    if (!totp) return { mfaRequired: true };
    await this.auth.checkTotp(a.id, this.crypto.decryptString(a.totp_secret_enc)!, totp);
    return this.finishLogin(a, res, ip, ua);
  }

  private async finishLogin(a: { id: string; email: string; role: any }, res: Response, ip: string, ua: string) {
    await this.db.write(`UPDATE admin_users SET failed_logins = 0, locked_until = NULL, last_login_at = now() WHERE id = $1`, [a.id]);
    await this.sessions.create(res, { kind: 'admin', id: a.id, email: a.email, role: a.role });
    await this.audit.log({ id: a.id, email: a.email, role: a.role }, { action: 'admin.login', ip, userAgent: ua });
    return { ok: true, admin: { id: a.id, email: a.email, role: a.role } };
  }

  private async setupTokenAdmin(token: string) {
    const id = await this.redis.client.get(`adm:mfasetup:${sha(token)}`);
    if (!id) throw new BadRequestException('Setup session expired. Sign in again.');
    return id;
  }

  async mfaSetup(token: string) {
    const id = await this.setupTokenAdmin(token);
    const [a] = await this.db.write(`SELECT email FROM admin_users WHERE id = $1`, [id]);
    return this.auth.setupTotp(id, a.email);
  }

  async mfaEnable(token: string, code: string, res: Response, ip: string, ua: string) {
    const id = await this.setupTokenAdmin(token);
    await this.auth.enableTotp(id, code, 'admin_users');
    await this.redis.client.del(`adm:mfasetup:${sha(token)}`);
    const [a] = await this.db.write(`SELECT id, email, role FROM admin_users WHERE id = $1`, [id]);
    await this.audit.log({ id: a.id, email: a.email, role: a.role }, { action: 'admin.mfa_enrolled', ip, userAgent: ua });
    return this.finishLogin(a, res, ip, ua);
  }

  /** Invited admins set their password with a one-time token (sent by email by the worker). */
  async acceptInvite(token: string, password: string) {
    const id = await this.redis.client.getdel(`adm:invite:${sha(token)}`);
    if (!id) throw new BadRequestException('Invitation link is invalid or has expired');
    await this.db.write(`UPDATE admin_users SET password_hash = $2, updated_at = now() WHERE id = $1`, [id, await hashPassword(password)]);
    return { ok: true };
  }

  async createInvite(adminId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.redis.client.set(`adm:invite:${sha(token)}`, adminId, 'EX', 72 * 3600);
    return token;
  }
}
