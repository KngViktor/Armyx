import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { InfraModule } from './infra/infra.module';
import { ReferenceModule } from './reference/reference.module';
import { AuthModule } from './auth/auth.module';
import { ApplicationsModule } from './applications/applications.module';
import { AdminModule } from './admin/admin.module';
import { ContactModule } from './contact/contact.controller';
import { HealthModule } from './health/health.controller';
import { SessionService } from './common/session.service';
import { CsrfGuard } from './common/csrf';
import { AuthGuard } from './common/auth.guard';
import { RateLimitGuard } from './common/rate-limit';
import { AllExceptionsFilter } from './common/exception.filter';
import { config } from './config/config';
import { Global } from '@nestjs/common';

@Global()
@Module({ providers: [SessionService], exports: [SessionService] })
class SessionModule {}

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: config().LOG_LEVEL,
        genReqId: (req) => (req.headers['x-request-id'] as string) || (req.headers['cf-ray'] as string) || randomUUID(),
        // Never log credentials, cookies or personal data.
        redact: {
          paths: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["x-csrf-token"]', 'res.headers["set-cookie"]', 'req.body'],
          remove: true,
        },
        autoLogging: { ignore: (req) => (req.url ?? '').includes('/health/') },
        // At 3,000 rps, one log line per successful request is ~260M lines/day of noise.
        // Successes are fully covered by Prometheus metrics, so they log at debug;
        // client errors at warn, server errors at error.
        customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'debug'),
        transport: config().NODE_ENV === 'development' ? { target: 'pino/file', options: { destination: 1 } } : undefined,
      },
    }),
    InfraModule,
    SessionModule,
    ReferenceModule,
    AuthModule,
    ApplicationsModule,
    AdminModule,
    ContactModule,
    HealthModule,
  ],
  providers: [
    // Order matters: CSRF -> authentication -> rate limits (which may key on the user).
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
