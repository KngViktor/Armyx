/**
 * Server-side sessions in Redis — API pods stay stateless and any pod can
 * serve any request. Only an opaque random id is placed in the cookie; Redis
 * stores the SHA-256 of that id, so a Redis snapshot cannot be replayed.
 */
import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { RK, type AdminRole } from '@armyx/shared';
import { RedisService } from '../infra/redis.service';
import { config } from '../config/config';

export interface Principal {
  sid: string;
  kind: 'applicant' | 'admin';
  id: string;
  email?: string;
  role?: AdminRole;
  createdAt: number;
}

const digest = (sid: string) => createHash('sha256').update(sid).digest('base64url');

@Injectable()
export class SessionService {
  private readonly c = config();
  constructor(private readonly redis: RedisService) {}

  private cookieName(kind: Principal['kind']) {
    return kind === 'admin' ? `${this.c.SESSION_COOKIE}_adm` : this.c.SESSION_COOKIE;
  }
  private ttl(kind: Principal['kind']) {
    return kind === 'admin' ? this.c.ADMIN_SESSION_TTL_SECONDS : this.c.SESSION_TTL_SECONDS;
  }

  async create(res: Response, p: Omit<Principal, 'sid' | 'createdAt'>): Promise<void> {
    const sid = randomBytes(32).toString('base64url');
    const principal: Principal = { ...p, sid: digest(sid), createdAt: Date.now() };
    const ttl = this.ttl(p.kind);
    await this.redis.client
      .multi()
      .set(RK.session(principal.sid), JSON.stringify(principal), 'EX', ttl)
      .exec();
    // Track sessions per user so password changes can revoke them all.
    await this.redis.client.sadd(RK.userSessions(p.id), principal.sid);
    await this.redis.client.expire(RK.userSessions(p.id), 7 * 24 * 3600);
    res.cookie(this.cookieName(p.kind), sid, {
      httpOnly: true,
      secure: this.c.COOKIE_SECURE,
      sameSite: p.kind === 'admin' ? 'strict' : 'lax',
      path: '/',
      maxAge: ttl * 1000,
    });
  }

  /** Loads and slides the session expiry. */
  async load(req: Request, kind: Principal['kind']): Promise<Principal | null> {
    const raw = req.cookies?.[this.cookieName(kind)];
    if (typeof raw !== 'string' || raw.length < 20 || raw.length > 100) return null;
    const key = RK.session(digest(raw));
    const json = await this.redis.client.get(key);
    if (!json) return null;
    const p = JSON.parse(json) as Principal;
    if (p.kind !== kind) return null;
    await this.redis.client.expire(key, this.ttl(kind));
    return p;
  }

  async destroy(req: Request, res: Response, kind: Principal['kind']) {
    const raw = req.cookies?.[this.cookieName(kind)];
    if (typeof raw === 'string') await this.redis.client.del(RK.session(digest(raw)));
    res.clearCookie(this.cookieName(kind), { path: '/' });
  }

  async revokeAll(userId: string) {
    const sids = await this.redis.client.smembers(RK.userSessions(userId));
    for (const sid of sids) await this.redis.client.del(RK.session(sid));
    await this.redis.client.del(RK.userSessions(userId));
  }
}
