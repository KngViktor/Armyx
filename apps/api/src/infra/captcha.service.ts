/**
 * Cloudflare Turnstile verification for registration, login, password reset
 * and the contact form. When TURNSTILE_SECRET is not configured (local dev)
 * verification is skipped; production config validation requires it.
 */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { config } from '../config/config';

@Injectable()
export class CaptchaService {
  private readonly log = new Logger(CaptchaService.name);

  async verify(token: string | undefined, ip: string): Promise<void> {
    const secret = config().TURNSTILE_SECRET;
    if (!secret) return;
    if (!token) throw new BadRequestException('Please complete the security check');
    try {
      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: new URLSearchParams({ secret, response: token, remoteip: ip }),
        signal: AbortSignal.timeout(5000),
      });
      const body = (await res.json()) as { success: boolean };
      if (!body.success) throw new BadRequestException('Security check failed, please try again');
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      // Fail closed: if Turnstile is unreachable we cannot tell bots from people.
      this.log.error(`Turnstile verification error: ${(e as Error).message}`);
      throw new BadRequestException('Security check unavailable, please retry shortly');
    }
  }
}
