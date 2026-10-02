import type { NextConfig } from 'next';
import path from 'node:path';

/**
 * Security headers for every response. The site is statically generated, so a
 * per-request nonce is not possible; scripts are restricted to same-origin
 * plus Cloudflare Turnstile. All CMS content is rendered as text by React
 * (never as raw HTML), which is what keeps 'unsafe-inline' for Next's own
 * bootstrap script low-risk.
 */
const uploadOrigin = process.env.NEXT_PUBLIC_UPLOAD_ORIGIN ?? 'http://localhost:8333';
const isDev = process.env.NODE_ENV !== 'production';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ''} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${uploadOrigin}`,
  "font-src 'self'",
  `connect-src 'self' ${uploadOrigin} https://challenges.cloudflare.com`,
  'frame-src https://challenges.cloudflare.com https://www.openstreetmap.org https://www.youtube-nocookie.com',
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  isDev ? '' : 'upgrade-insecure-requests',
].filter(Boolean).join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ['@armyx/shared'],
  // Monorepo: trace files from the repo root so the standalone bundle includes workspace packages.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: process.env.CMS_URL ? [new URL('/**', process.env.CMS_URL)] : [],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Portal & admin shells are static, but must never be cached by shared caches with user data.
      { source: '/(portal|admin)/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=0, s-maxage=300, must-revalidate' }, { key: 'X-Robots-Tag', value: 'noindex' }] },
      { source: '/images/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, immutable' }] },
    ];
  },
  async rewrites() {
    // Local development only: in production Cloudflare / the ingress routes /api/v1 to the API service.
    return process.env.API_INTERNAL_URL ? [{ source: '/api/v1/:path*', destination: `${process.env.API_INTERNAL_URL}/api/v1/:path*` }] : [];
  },
};

export default config;
