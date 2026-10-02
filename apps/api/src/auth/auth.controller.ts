import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  forgotPasswordSchema, loginSchema, registerSchema, resendOtpSchema, resetPasswordSchema, totpCodeSchema, verifyOtpSchema,
} from '@armyx/shared';
import { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe';
import { RateLimit } from '../common/rate-limit';
import { Applicant, CurrentPrincipal } from '../common/auth.guard';
import { Principal, SessionService } from '../common/session.service';
import { CaptchaService } from '../infra/captcha.service';
import { clientIp } from '../common/http';
import { CSRF_COOKIE } from '../common/csrf';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly captcha: CaptchaService,
    private readonly sessions: SessionService,
  ) {}

  /** Returns the CSRF token (also set as a cookie by middleware). */
  @Get('csrf')
  csrf(@Req() req: Request) {
    return { token: req.cookies?.[CSRF_COOKIE] };
  }

  @Post('register')
  @RateLimit({ name: 'register-ip', by: 'ip', limit: 10, windowSec: 3600 })
  async register(@Body(new ZodPipe(registerSchema)) body: z.infer<typeof registerSchema>, @Req() req: Request) {
    await this.captcha.verify(body.captchaToken, clientIp(req));
    return this.auth.register(body);
  }

  @Post('otp/verify')
  @HttpCode(200)
  @RateLimit({ name: 'otp-verify-ip', by: 'ip', limit: 30, windowSec: 600 }, { name: 'otp-verify-user', by: 'body:userId', limit: 10, windowSec: 600 })
  verify(@Body(new ZodPipe(verifyOtpSchema)) body: z.infer<typeof verifyOtpSchema>) {
    return this.auth.verifyOtp(body.userId, body.channel, body.code);
  }

  @Post('otp/resend')
  @HttpCode(200)
  @RateLimit({ name: 'otp-send-ip', by: 'ip', limit: 10, windowSec: 3600 }, { name: 'otp-send-user', by: 'body:userId', limit: 6, windowSec: 3600 })
  resend(@Body(new ZodPipe(resendOtpSchema)) body: z.infer<typeof resendOtpSchema>) {
    return this.auth.resendOtp(body.userId, body.channel);
  }

  @Post('login')
  @HttpCode(200)
  @RateLimit({ name: 'login-ip', by: 'ip', limit: 30, windowSec: 300 }, { name: 'login-acct', by: 'body:email', limit: 10, windowSec: 900 })
  async login(@Body(new ZodPipe(loginSchema)) body: z.infer<typeof loginSchema>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.captcha.verify(body.captchaToken, clientIp(req));
    return this.auth.login(body, res);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.sessions.destroy(req, res, 'applicant');
    return { ok: true };
  }

  @Get('me')
  @Applicant()
  me(@CurrentPrincipal() p: Principal) {
    return this.auth.me(p.id);
  }

  @Post('2fa/setup')
  @Applicant()
  @RateLimit({ name: '2fa-setup', by: 'user', limit: 5, windowSec: 600 })
  async setup2fa(@CurrentPrincipal() p: Principal) {
    const me = await this.auth.me(p.id);
    return this.auth.setupTotp(p.id, me.email ?? p.id);
  }

  @Post('2fa/enable')
  @Applicant()
  @HttpCode(200)
  @RateLimit({ name: '2fa-verify', by: 'user', limit: 10, windowSec: 600 })
  enable2fa(@CurrentPrincipal() p: Principal, @Body(new ZodPipe(totpCodeSchema)) body: { code: string }) {
    return this.auth.enableTotp(p.id, body.code);
  }

  @Post('2fa/disable')
  @Applicant()
  @HttpCode(200)
  @RateLimit({ name: '2fa-verify', by: 'user', limit: 10, windowSec: 600 })
  disable2fa(@CurrentPrincipal() p: Principal, @Body(new ZodPipe(totpCodeSchema)) body: { code: string }) {
    return this.auth.disableTotp(p.id, body.code);
  }

  @Post('password/forgot')
  @HttpCode(200)
  @RateLimit({ name: 'pw-forgot-ip', by: 'ip', limit: 5, windowSec: 3600 }, { name: 'pw-forgot-acct', by: 'body:email', limit: 3, windowSec: 3600 })
  async forgot(@Body(new ZodPipe(forgotPasswordSchema)) body: z.infer<typeof forgotPasswordSchema>, @Req() req: Request) {
    await this.captcha.verify(body.captchaToken, clientIp(req));
    return this.auth.forgotPassword(body.email);
  }

  @Post('password/reset')
  @HttpCode(200)
  @RateLimit({ name: 'pw-reset-ip', by: 'ip', limit: 10, windowSec: 3600 })
  reset(@Body(new ZodPipe(resetPasswordSchema)) body: z.infer<typeof resetPasswordSchema>) {
    return this.auth.resetPassword(body.token, body.password);
  }
}
