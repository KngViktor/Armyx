import type { Request } from 'express';

/**
 * Real client IP. In production every request arrives through Cloudflare and
 * the ingress only accepts Cloudflare source ranges, so CF-Connecting-IP is
 * trustworthy. Otherwise fall back to Express' proxy-aware req.ip.
 */
export function clientIp(req: Request): string {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf) return cf;
  return req.ip ?? req.socket.remoteAddress ?? '0.0.0.0';
}

export function userAgent(req: Request): string {
  return String(req.headers['user-agent'] ?? '').slice(0, 300);
}
