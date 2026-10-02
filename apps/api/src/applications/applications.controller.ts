import { Body, Controller, Get, HttpCode, Param, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { DOCUMENT_TYPES, DocumentType, confirmUploadSchema, presignUploadSchema, saveStepSchema, submitSchema } from '@armyx/shared';
import { ZodPipe } from '../common/zod.pipe';
import { Applicant, CurrentPrincipal } from '../common/auth.guard';
import { RateLimit } from '../common/rate-limit';
import { Principal } from '../common/session.service';
import { clientIp } from '../common/http';
import { CaptchaService } from '../infra/captcha.service';
import { ApplicationsService } from './applications.service';

@Controller('applications')
@Applicant()
export class ApplicationsController {
  constructor(private readonly apps: ApplicationsService, private readonly captcha: CaptchaService) {}

  @Get('draft')
  draft(@CurrentPrincipal() p: Principal) {
    return this.apps.getDraft(p.id);
  }

  @Put('draft')
  @RateLimit({ name: 'draft-save', by: 'user', limit: 120, windowSec: 600 })
  save(@CurrentPrincipal() p: Principal, @Body(new ZodPipe(saveStepSchema)) body: z.infer<typeof saveStepSchema>) {
    return this.apps.saveStep(p.id, body.step, body.data);
  }

  @Post('documents/presign')
  @HttpCode(200)
  @RateLimit({ name: 'doc-presign', by: 'user', limit: 40, windowSec: 3600 })
  presign(@CurrentPrincipal() p: Principal, @Body(new ZodPipe(presignUploadSchema)) b: z.infer<typeof presignUploadSchema>) {
    return this.apps.presignUpload(p.id, b.type, b.contentType, b.size);
  }

  @Post('documents/confirm')
  @HttpCode(200)
  @RateLimit({ name: 'doc-confirm', by: 'user', limit: 40, windowSec: 3600 })
  confirm(@CurrentPrincipal() p: Principal, @Body(new ZodPipe(confirmUploadSchema)) b: z.infer<typeof confirmUploadSchema>) {
    return this.apps.confirmUpload(p.id, b.type, b.key);
  }

  @Get('documents/:type/url')
  @RateLimit({ name: 'doc-url', by: 'user', limit: 60, windowSec: 600 })
  docUrl(@CurrentPrincipal() p: Principal, @Param('type', new ZodPipe(z.enum(DOCUMENT_TYPES))) type: DocumentType) {
    return this.apps.documentUrl(p.id, type);
  }

  @Post('submit')
  @HttpCode(202)
  @RateLimit({ name: 'submit-user', by: 'user', limit: 5, windowSec: 600 }, { name: 'submit-ip', by: 'ip', limit: 30, windowSec: 600 })
  async submit(@CurrentPrincipal() p: Principal, @Body(new ZodPipe(submitSchema)) b: z.infer<typeof submitSchema>, @Req() req: Request) {
    await this.captcha.verify(b.captchaToken, clientIp(req));
    return this.apps.submit(p.id, clientIp(req));
  }

  @Get('me')
  status(@CurrentPrincipal() p: Principal) {
    return this.apps.status(p.id);
  }

  @Get('me/slip')
  slip(@CurrentPrincipal() p: Principal) {
    return this.apps.slipUrl(p.id);
  }
}
