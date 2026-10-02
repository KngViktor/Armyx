/**
 * CSRF defence in depth:
 *  1. Session cookie is HttpOnly + SameSite=Lax (+ Secure in production).
 *  2. Double-submit token: a random `csrf` cookie (readable by JS) must be
 *     echoed in the `X-CSRF-Token` header on every state-changing request.
 *  3. If the browser sends an Origin header it must be an allowed origin.
 */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../config/config';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
export const CSRF_COOKIE = 'csrf';

/**
 * Express middleware: issue the CSRF cookie if absent. Skipped for public,
 * CDN-cacheable routes — a Set-Cookie header would make them uncacheable.
 */
export function csrfCookie(req: Request, res: Response, next: NextFunction) {
  if (req.path.startsWith('/api/v1/reference') || req.path.startsWith('/api/v1/health')) return next();
  if (!req.cookies?.[CSRF_COOKIE]) {
    const token = randomBytes(24).toString('base64url');
    res.cookie(CSRF_COOKIE, token, { httpOnly: false, sameSite: 'lax', secure: config().COOKIE_SECURE, path: '/' });
    req.cookies[CSRF_COOKIE] = token;
  }
  next();
}

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly origins = new Set(config().CORS_ORIGINS.split(',').map((o) => o.trim()));

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (SAFE.has(req.method)) return true;

    const origin = req.headers.origin;
    if (origin && !this.origins.has(origin)) throw new ForbiddenException('Origin not allowed');

    const cookie = req.cookies?.[CSRF_COOKIE];
    const header = req.headers['x-csrf-token'];
    if (typeof cookie !== 'string' || typeof header !== 'string' || cookie.length !== header.length ||
        !timingSafeEqual(Buffer.from(cookie), Buffer.from(header))) {
      throw new ForbiddenException('Invalid or missing CSRF token. Refresh the page and try again.');
    }
    return true;
  }
}
