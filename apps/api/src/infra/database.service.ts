/**
 * PostgreSQL access with read/write splitting.
 *
 *  primary  -> PgBouncer (transaction pooling) -> PostgreSQL primary   (writes)
 *  replica  -> PgBouncer (transaction pooling) -> PostgreSQL replicas  (reads)
 *
 * Because PgBouncer runs in transaction mode we never rely on session state
 * (no SET, no prepared statements outside a transaction, no LISTEN).
 * Use `read()` for dashboards, searches and status lookups that tolerate a
 * little replication lag; use `write()`/`tx()` for anything that must be fresh.
 */
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { config } from '../config/config';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly primary: Pool;
  readonly replica: Pool;

  constructor() {
    const c = config();
    const common = { max: c.DB_POOL_MAX, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000, statement_timeout: 15_000 };
    this.primary = new Pool({ connectionString: c.DATABASE_URL, ...common, application_name: 'armyx-api' });
    this.replica = c.DATABASE_REPLICA_URL
      ? new Pool({ connectionString: c.DATABASE_REPLICA_URL, ...common, application_name: 'armyx-api-ro' })
      : this.primary;
  }

  async write<T extends QueryResultRow = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.primary.query<T>(sql, params)).rows;
  }

  async read<T extends QueryResultRow = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.replica.query<T>(sql, params)).rows;
  }

  async tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.primary.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  }

  async ping(): Promise<void> {
    await this.primary.query('SELECT 1');
    if (this.replica !== this.primary) await this.replica.query('SELECT 1');
  }

  async onModuleDestroy() {
    await this.primary.end();
    if (this.replica !== this.primary) await this.replica.end();
  }
}
