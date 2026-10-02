import { Body, Controller, HttpCode, Module, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { contactSchema } from '@armyx/shared';
import { hashIp } from '@armyx/shared/server';
import { ZodPipe } from '../common/zod.pipe';
import { RateLimit } from '../common/rate-limit';
import { clientIp } from '../common/http';
import { CaptchaService } from '../infra/captcha.service';
import { QueueService } from '../infra/queue.service';
import { config } from '../config/config';

/**
 * Public contact form: Turnstile CAPTCHA + honeypot + per-IP and per-email
 * rate limits. Messages are queued; a worker stores them (encrypted contact
 * details) and forwards them to the relevant desk.
 */
@Controller('contact')
export class ContactController {
  constructor(private readonly captcha: CaptchaService, private readonly queue: QueueService) {}

  @Post()
  @HttpCode(202)
  @RateLimit({ name: 'contact-ip', by: 'ip', limit: 5, windowSec: 3600 }, { name: 'contact-email', by: 'body:email', limit: 3, windowSec: 3600 })
  async submit(@Body(new ZodPipe(contactSchema)) b: z.infer<typeof contactSchema>, @Req() req: Request) {
    // Honeypot filled => silently accept and drop (don't teach bots what failed).
    if (b.website) return { received: true };
    await this.captcha.verify(b.captchaToken, clientIp(req));
    await this.queue.contact({
      name: b.name, email: b.email, phone: b.phone || undefined, subject: b.subject, message: b.message,
      ipHash: hashIp(clientIp(req), config().IP_HASH_SALT),
    });
    return { received: true };
  }
}

@Module({ controllers: [ContactController] })
export class ContactModule {}
