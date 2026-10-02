import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { RedisService } from './redis.service';
import { QueueService } from './queue.service';
import { StorageService } from './storage.service';
import { CryptoService } from './crypto.service';
import { CaptchaService } from './captcha.service';
import { AuditService } from './audit.service';

const providers = [DatabaseService, RedisService, QueueService, StorageService, CryptoService, CaptchaService, AuditService];

@Global()
@Module({ providers, exports: providers })
export class InfraModule {}
