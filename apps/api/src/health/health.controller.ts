import { Controller, Get, Module, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../infra/database.service';
import { RedisService } from '../infra/redis.service';

/** Kubernetes probes. Liveness never touches dependencies (avoid restart storms). */
@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService, private readonly redis: RedisService) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    try {
      await Promise.all([this.db.ping(), this.redis.client.ping()]);
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException({ status: 'unavailable' });
    }
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
