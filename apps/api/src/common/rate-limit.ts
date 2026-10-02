/**
 * Redis-backed rate limiting (works across all API pods).
 *
 *   @RateLimit({ name: 'login', by: 'ip', limit: 20, windowSec: 60 },
 *              { name: 'login-acct', by: 'body:email', limit: 5, windowSec: 900 })
 *
 * Each rule is a fixed window counter (atomic INCR + EXPIRE in Lua). Account-
 * level keys are hashed so no PII ends up in Redis key names. Edge rate limits
 * at Cloudflare sit in front of this as a first line of defence.
 */
import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { RedisService } from '../infra/redis.service';
import { clientIp } from './http';

export interface RateRule {
  name: string;
  /** 'ip' | 'user' (session principal) | 'body:<field>' */
  by: string;
  limit: number;
  windowSec: number;
}

const KEY = 'rate-limit-rules';
export const RateLimit = (...rules: RateRule[]) => SetMetadata(KEY, rules);

const LUA = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return {c, redis.call('TTL', KEYS[1])}
`;

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly redis: RedisService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const rules = this.reflector.getAllAndOverride<RateRule[]>(KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!rules?.length) return true;
    const req = ctx.switchToHttp().getRequest<Request & { principal?: { id: string } }>();
    const res = ctx.switchToHttp().getResponse<Response>();

    for (const rule of rules) {
      let subject: string | undefined;
      if (rule.by === 'ip') subject = clientIp(req);
      else if (rule.by === 'user') subject = req.principal?.id;
      else if (rule.by.startsWith('body:')) {
        const v = (req.body as Record<string, unknown> | undefined)?.[rule.by.slice(5)];
        if (typeof v === 'string' && v) subject = v.trim().toLowerCase();
      }
      if (!subject) continue;
      const hashed = createHash('sha256').update(subject).digest('base64url').slice(0, 22);
      const key = `rl:${rule.name}:${hashed}`;
      const [count, ttl] = (await this.redis.client.eval(LUA, 1, key, rule.windowSec)) as [number, number];
      if (count > rule.limit) {
        res.setHeader('Retry-After', String(Math.max(ttl, 1)));
        throw new HttpException(
          { message: 'Too many attempts. Please wait and try again.', retryAfter: ttl },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
    return true;
  }
}
