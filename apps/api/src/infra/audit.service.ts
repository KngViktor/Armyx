/**
 * Append-only audit trail of every admin action. Written synchronously to the
 * primary (admin traffic is low and audit must not be lost). The table rejects
 * UPDATE/DELETE at the database level.
 */
import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';

export interface AuditActor {
  id: string;
  email: string;
  role: string;
}

export interface AuditEntry {
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly db: DatabaseService) {}

  async log(actor: AuditActor | null, e: AuditEntry): Promise<void> {
    await this.db.write(
      `INSERT INTO audit_logs (actor_id, actor_email, actor_role, action, entity_type, entity_id, details, ip, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [actor?.id ?? null, actor?.email ?? null, actor?.role ?? null, e.action, e.entityType ?? null, e.entityId ?? null,
       JSON.stringify(e.details ?? {}), e.ip ?? null, e.userAgent?.slice(0, 300) ?? null],
    );
  }
}
