import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  ADMIN_ROLES, adminUserSchema, applicantFilterSchema, bulkScreeningSchema, bulkStatusSchema, emailSchema, exerciseSchema,
  exportSchema, passwordSchema, screeningCentreSchema, DOCUMENT_TYPES,
} from '@armyx/shared';
import { ZodPipe } from '../common/zod.pipe';
import { Admin, CurrentPrincipal } from '../common/auth.guard';
import { RateLimit } from '../common/rate-limit';
import { Principal, SessionService } from '../common/session.service';
import { clientIp, userAgent } from '../common/http';
import { AuditService } from '../infra/audit.service';
import { CaptchaService } from '../infra/captcha.service';
import { AdminAuthService } from './admin-auth.service';
import { AdminService } from './admin.service';
import { ApplicantsService } from './applicants.service';

const actor = (p: Principal) => ({ id: p.id, email: p.email!, role: p.role! });
const meta = (req: Request) => ({ ip: clientIp(req), userAgent: userAgent(req) });

const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128), totp: z.string().regex(/^\d{6}$/).optional(), captchaToken: z.string().optional() });
const setupSchema = z.object({ setupToken: z.string().min(20).max(100) });
const enableSchema = setupSchema.extend({ code: z.string().regex(/^\d{6}$/) });
const inviteAcceptSchema = z.object({ token: z.string().min(20).max(100), password: passwordSchema });

// ================================================================= auth
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly svc: AdminAuthService, private readonly sessions: SessionService, private readonly captcha: CaptchaService) {}

  @Post('login')
  @HttpCode(200)
  @RateLimit({ name: 'adm-login-ip', by: 'ip', limit: 10, windowSec: 600 }, { name: 'adm-login-acct', by: 'body:email', limit: 5, windowSec: 900 })
  async login(@Body(new ZodPipe(loginSchema)) b: z.infer<typeof loginSchema>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.captcha.verify(b.captchaToken, clientIp(req));
    return this.svc.login(b.email, b.password, b.totp, res, clientIp(req), userAgent(req));
  }

  @Post('mfa/setup')
  @HttpCode(200)
  @RateLimit({ name: 'adm-mfa', by: 'ip', limit: 10, windowSec: 600 })
  mfaSetup(@Body(new ZodPipe(setupSchema)) b: z.infer<typeof setupSchema>) {
    return this.svc.mfaSetup(b.setupToken);
  }

  @Post('mfa/enable')
  @HttpCode(200)
  @RateLimit({ name: 'adm-mfa', by: 'ip', limit: 10, windowSec: 600 })
  mfaEnable(@Body(new ZodPipe(enableSchema)) b: z.infer<typeof enableSchema>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.svc.mfaEnable(b.setupToken, b.code, res, clientIp(req), userAgent(req));
  }

  @Post('accept-invite')
  @HttpCode(200)
  @RateLimit({ name: 'adm-invite', by: 'ip', limit: 10, windowSec: 3600 })
  accept(@Body(new ZodPipe(inviteAcceptSchema)) b: z.infer<typeof inviteAcceptSchema>) {
    return this.svc.acceptInvite(b.token, b.password);
  }

  @Get('me')
  @Admin()
  me(@CurrentPrincipal() p: Principal) {
    return { id: p.id, email: p.email, role: p.role };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.sessions.destroy(req, res, 'admin');
    return { ok: true };
  }
}

// ================================================================= applicants
@Controller('admin/applicants')
@Admin('recruitment_officer', 'reviewer', 'viewer')
export class AdminApplicantsController {
  constructor(private readonly svc: ApplicantsService, private readonly audit: AuditService) {}

  @Get()
  search(@Query(new ZodPipe(applicantFilterSchema)) f: z.infer<typeof applicantFilterSchema>) {
    return this.svc.search(f);
  }

  /** Full personal data — viewers are excluded and every access is audited. */
  @Get(':id')
  @Admin('recruitment_officer', 'reviewer')
  async detail(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: Principal, @Req() req: Request) {
    const d = await this.svc.detail(id);
    await this.audit.log(actor(p), { action: 'applicant.view', entityType: 'application', entityId: id, ...meta(req) });
    return d;
  }

  @Get(':id/documents/:type')
  @Admin('recruitment_officer', 'reviewer')
  async doc(@Param('id', ParseUUIDPipe) id: string, @Param('type', new ZodPipe(z.enum(DOCUMENT_TYPES))) type: string, @CurrentPrincipal() p: Principal, @Req() req: Request) {
    const r = await this.svc.documentUrl(id, type);
    await this.audit.log(actor(p), { action: 'applicant.document_view', entityType: 'application', entityId: id, details: { type }, ...meta(req) });
    return r;
  }

  @Post('bulk/status')
  @HttpCode(200)
  @Admin('recruitment_officer', 'reviewer')
  async bulkStatus(@Body(new ZodPipe(bulkStatusSchema)) b: z.infer<typeof bulkStatusSchema>, @CurrentPrincipal() p: Principal, @Req() req: Request) {
    const r = await this.svc.bulkStatus(b.ids, b.status, p.id, b.note);
    await this.audit.log(actor(p), { action: `applicant.bulk_${b.status}`, entityType: 'application', details: { ...r, ids: b.ids.slice(0, 500), note: b.note }, ...meta(req) });
    return r;
  }

  @Post('bulk/screening')
  @HttpCode(200)
  @Admin('recruitment_officer')
  async bulkScreening(@Body(new ZodPipe(bulkScreeningSchema)) b: z.infer<typeof bulkScreeningSchema>, @CurrentPrincipal() p: Principal, @Req() req: Request) {
    const r = await this.svc.bulkScreening(b.ids, b.centreId, b.screeningDate, p.id);
    await this.audit.log(actor(p), { action: 'applicant.bulk_screening', entityType: 'screening_centre', entityId: b.centreId, details: { ...r, date: b.screeningDate, ids: b.ids.slice(0, 500) }, ...meta(req) });
    return r;
  }
}

// ================================================================= exercises & centres
@Controller('admin/exercises')
@Admin('recruitment_officer', 'reviewer', 'viewer')
export class AdminExercisesController {
  constructor(private readonly svc: AdminService, private readonly audit: AuditService) {}

  @Get()
  list() {
    return this.svc.listExercises();
  }

  @Post()
  @Admin('recruitment_officer')
  async create(@Body(new ZodPipe(exerciseSchema)) b: z.infer<typeof exerciseSchema>, @CurrentPrincipal() p: Principal, @Req() req: Request) {
    const r = await this.svc.createExercise(b, p.id);
    await this.audit.log(actor(p), { action: 'exercise.create', entityType: 'exercise', entityId: r.id, details: { code: b.code }, ...meta(req) });
    return r;
  }

  @Put(':id')
  @Admin('recruitment_officer')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(exerciseSchema)) b: z.infer<typeof exerciseSchema>, @CurrentPrincipal() p: Principal, @Req() req: Request) {
    const r = await this.svc.updateExercise(id, b);
    await this.audit.log(actor(p), { action: 'exercise.update', entityType: 'exercise', entityId: id, details: { rules: b.rules, quotas: b.quotas, opensAt: b.opensAt, closesAt: b.closesAt }, ...meta(req) });
    return r;
  }

  @Post(':id/open')
  @HttpCode(200)
  @Admin('recruitment_officer')
  open(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: Principal, @Req() req: Request) {
    return this.setState(id, 'open', p, req);
  }

  @Post(':id/close')
  @HttpCode(200)
  @Admin('recruitment_officer')
  close(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: Principal, @Req() req: Request) {
    return this.setState(id, 'close', p, req);
  }

  private async setState(id: string, state: 'open' | 'close', p: Principal, req: Request) {
    const r = await this.svc.setExerciseState(id, state === 'open' ? 'open' : 'closed');
    await this.audit.log(actor(p), { action: `exercise.${state}`, entityType: 'exercise', entityId: id, ...meta(req) });
    return r;
  }

  @Get(':id/centres')
  centres(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.listCentres(id);
  }

  @Post(':id/centres')
  @Admin('recruitment_officer')
  async addCentre(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(screeningCentreSchema)) b: z.infer<typeof screeningCentreSchema>, @CurrentPrincipal() p: Principal, @Req() req: Request) {
    const r = await this.svc.createCentre(id, b);
    await this.audit.log(actor(p), { action: 'centre.create', entityType: 'screening_centre', entityId: r.id, details: b, ...meta(req) });
    return r;
  }

  @Delete('centres/:centreId')
  @Admin('recruitment_officer')
  async delCentre(@Param('centreId', ParseUUIDPipe) centreId: string, @CurrentPrincipal() p: Principal, @Req() req: Request) {
    const r = await this.svc.deleteCentre(centreId);
    await this.audit.log(actor(p), { action: 'centre.delete', entityType: 'screening_centre', entityId: centreId, ...meta(req) });
    return r;
  }
}

// ================================================================= dashboard & exports
@Controller('admin')
export class AdminMiscController {
  constructor(private readonly svc: AdminService, private readonly applicants: ApplicantsService, private readonly audit: AuditService) {}

  @Get('dashboard')
  @Admin('recruitment_officer', 'reviewer', 'viewer')
  async dashboard(@Query('exerciseId') exerciseId?: string) {
    return this.svc.dashboard(await this.applicants.exerciseId(exerciseId));
  }

  @Post('exports')
  @Admin('recruitment_officer')
  @RateLimit({ name: 'adm-export', by: 'user', limit: 10, windowSec: 3600 })
  async createExport(@Body(new ZodPipe(exportSchema)) b: z.infer<typeof exportSchema>, @CurrentPrincipal() p: Principal, @Req() req: Request) {
    const r = await this.svc.createExport(p.id, b.format, b.filter, await this.applicants.exerciseId(b.filter.exerciseId));
    await this.audit.log(actor(p), { action: 'export.create', entityType: 'export', entityId: r.id, details: { format: b.format, filter: b.filter }, ...meta(req) });
    return r;
  }

  @Get('exports')
  @Admin('recruitment_officer')
  exports(@CurrentPrincipal() p: Principal) {
    return this.svc.listExports(p.id);
  }

  @Get('exports/:id/download')
  @Admin('recruitment_officer')
  async download(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: Principal, @Req() req: Request) {
    const r = await this.svc.exportUrl(id, p.id);
    await this.audit.log(actor(p), { action: 'export.download', entityType: 'export', entityId: id, ...meta(req) });
    return r;
  }

  @Get('audit-logs')
  @Admin('super_admin')
  audit_(@Query() q: { actor?: string; action?: string; entity?: string; before?: string; limit?: string }) {
    return this.svc.auditLogs({ ...q, limit: q.limit ? Number(q.limit) : undefined });
  }

  @Get('users')
  @Admin('super_admin')
  users() {
    return this.svc.listAdmins();
  }

  @Post('users')
  @Admin('super_admin')
  async invite(@Body(new ZodPipe(adminUserSchema)) b: z.infer<typeof adminUserSchema>, @CurrentPrincipal() p: Principal, @Req() req: Request) {
    const r = await this.svc.inviteAdmin(b.email, b.fullName, b.role);
    await this.audit.log(actor(p), { action: 'admin_user.invite', entityType: 'admin_user', entityId: r.id, details: { email: b.email, role: b.role }, ...meta(req) });
    return r;
  }

  @Patch('users/:id')
  @Admin('super_admin')
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(z.object({ role: z.enum(ADMIN_ROLES).optional(), active: z.boolean().optional() }))) b: { role?: any; active?: boolean },
    @CurrentPrincipal() p: Principal, @Req() req: Request,
  ) {
    const r = await this.svc.updateAdmin(id, b, p.id);
    await this.audit.log(actor(p), { action: 'admin_user.update', entityType: 'admin_user', entityId: id, details: b, ...meta(req) });
    return r;
  }
}
