/**
 * One-time codes for email and phone verification.
 *  - 6 digits, valid 10 minutes, max 5 attempts, stored as SHA-256 only.
 *  - 60s resend cooldown and a daily cap per user (SMS costs money and
 *    OTP endpoints are a favourite target for SMS-pumping fraud).
 */
import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { RedisService } from '../infra/redis.service';
import { QueueService } from '../infra/queue.service';
import { config } from '../config/config';

export type OtpChannel = 'email' | 'phone';
const sha = (s: string) => createHash('sha256').update(s).digest();

@Injectable()
export class OtpService {
  private readonly log = new Logger(OtpService.name);
  /** Fixed code for automated tests/staging. Refused in production (see main.ts). */
  private readonly fixed = process.env.OTP_FIXED_CODE;

  constructor(private readonly redis: RedisService, private readonly queue: QueueService) {}

  async send(userId: string, channel: OtpChannel, purpose = 'verify'): Promise<void> {
    const r = this.redis.client;
    const cooldownKey = `otpcd:${channel}:${userId}`;
    if (!(await r.set(cooldownKey, '1', 'EX', 60, 'NX'))) {
      throw new HttpException('Please wait 60 seconds before requesting another code', HttpStatus.TOO_MANY_REQUESTS);
    }
    const dayKey = `otpday:${userId}`;
    const sent = await r.incr(dayKey);
    if (sent === 1) await r.expire(dayKey, 86_400);
    if (sent > 10) throw new HttpException('Daily limit for verification codes reached', HttpStatus.TOO_MANY_REQUESTS);

    const code = this.fixed && config().NODE_ENV !== 'production' ? this.fixed : String(randomInt(0, 1_000_000)).padStart(6, '0');
    await r.set(`otp:${purpose}:${channel}:${userId}`, JSON.stringify({ h: sha(code).toString('hex'), tries: 0 }), 'EX', 600);
    if (config().NODE_ENV === 'development') this.log.warn(`[dev] OTP for ${userId} via ${channel}: ${code}`);

    await this.queue.notify(
      { channel: channel === 'email' ? 'email' : 'sms', userId, template: 'otp', vars: { code } },
      { priority: 1, attempts: 3 },
    );
  }

  async verify(userId: string, channel: OtpChannel, code: string, purpose = 'verify'): Promise<void> {
    const key = `otp:${purpose}:${channel}:${userId}`;
    const raw = await this.redis.client.get(key);
    if (!raw) throw new BadRequestException('Code expired. Request a new one.');
    const rec = JSON.parse(raw) as { h: string; tries: number };
    if (rec.tries >= 5) {
      await this.redis.client.del(key);
      throw new BadRequestException('Too many wrong attempts. Request a new code.');
    }
    if (!timingSafeEqual(Buffer.from(rec.h, 'hex'), sha(code))) {
      rec.tries++;
      await this.redis.client.set(key, JSON.stringify(rec), 'KEEPTTL');
      throw new BadRequestException(`Incorrect code. ${5 - rec.tries} attempt(s) left.`);
    }
    await this.redis.client.del(key);
  }
}
