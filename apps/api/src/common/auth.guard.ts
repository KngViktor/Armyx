import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AdminRole } from '@armyx/shared';
import { Principal, SessionService } from './session.service';

interface AuthMeta {
  kind: 'applicant' | 'admin';
  roles?: AdminRole[];
}
const KEY = 'auth-meta';

/** Route requires a logged-in, verified applicant. */
export const Applicant = () => SetMetadata(KEY, { kind: 'applicant' } satisfies AuthMeta);
/** Route requires an admin session; optionally restricted to roles. Super Admin always passes. */
export const Admin = (...roles: AdminRole[]) => SetMetadata(KEY, { kind: 'admin', roles } satisfies AuthMeta);

export const CurrentPrincipal = createParamDecorator((_: unknown, ctx: ExecutionContext) =>
  ctx.switchToHttp().getRequest<Request & { principal?: Principal }>().principal,
);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly sessions: SessionService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<AuthMeta>(KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!meta) return true;
    const req = ctx.switchToHttp().getRequest<Request & { principal?: Principal }>();
    const p = await this.sessions.load(req, meta.kind);
    if (!p) throw new UnauthorizedException('Please sign in to continue');
    if (meta.kind === 'admin' && meta.roles?.length && p.role !== 'super_admin' && !meta.roles.includes(p.role!)) {
      throw new ForbiddenException('Your role does not permit this action');
    }
    req.principal = p;
    return true;
  }
}
