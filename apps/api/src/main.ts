import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { config } from './config/config';
import { csrfCookie } from './common/csrf';
import { loadShed } from './common/load-shed';
import { metricsMiddleware, startMetricsServer } from './common/metrics';

async function bootstrap() {
  const c = config();
  if (c.NODE_ENV === 'production') {
    // Refuse to start with unsafe production settings.
    if (process.env.OTP_FIXED_CODE) throw new Error('OTP_FIXED_CODE must never be set in production');
    if (!c.COOKIE_SECURE) throw new Error('COOKIE_SECURE must be true in production');
    if (!c.TURNSTILE_SECRET) throw new Error('TURNSTILE_SECRET is required in production');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.set('trust proxy', c.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');

  // Cheapest checks first: shed load before doing any work.
  app.use(loadShed(c.MAX_INFLIGHT));
  app.use(metricsMiddleware);
  app.use(
    helmet({
      contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use(cookieParser());
  app.use(csrfCookie);
  app.useBodyParser('json', { limit: '100kb' });
  app.enableCors({
    origin: c.CORS_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id'],
    maxAge: 600,
  });
  // Default: API responses are private and never cached, unless a handler opts in.
  app.use((_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  startMetricsServer(c.METRICS_PORT);
  // Keep-alive longer than the load balancer's idle timeout to avoid 502s.
  const server = await app.listen(c.PORT, '0.0.0.0');
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
}

bootstrap();
