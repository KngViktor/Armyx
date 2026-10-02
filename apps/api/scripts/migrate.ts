/**
 * Minimal, dependable SQL migration runner.
 *  - Applies db/migrations/*.sql in filename order, each in its own transaction.
 *  - A Postgres advisory lock makes concurrent runs (e.g. several pods or a
 *    Kubernetes Job retried) safe.
 *  - Must run against the PRIMARY directly (MIGRATION_DATABASE_URL), not via
 *    PgBouncer transaction pooling, because advisory locks are session-level.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

async function main() {
  const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('MIGRATION_DATABASE_URL or DATABASE_URL must be set');
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query('SELECT pg_advisory_lock(727274)');
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    const dir = join(__dirname, '..', 'db', 'migrations');
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    for (const f of files) {
      if (done.has(f)) continue;
      process.stdout.write(`Applying ${f} ... `);
      await client.query('BEGIN');
      try {
        await client.query(readFileSync(join(dir, f), 'utf8'));
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
        await client.query('COMMIT');
        console.log('ok');
      } catch (e) {
        await client.query('ROLLBACK');
        console.log('FAILED');
        throw e;
      }
    }
    console.log('Migrations up to date.');
  } finally {
    await client.query('SELECT pg_advisory_unlock(727274)');
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
