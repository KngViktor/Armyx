/**
 * CSV / Excel export of applicants for officers. Streams from the read
 * replica in keyset-paginated batches so even millions of rows use constant
 * memory, then uploads to object storage. CSV cells are protected against
 * formula injection.
 */
import type { Job } from 'bullmq';
import { createWriteStream, createReadStream, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { ENTRY_TYPE_LABELS, ExportJob, QUALIFICATION_LABELS, STATE_BY_CODE, STATUS_LABELS, EntryType, Qualification, ApplicationStatus } from '@armyx/shared';
import { crypto, primary, replica, s3 } from '../lib/infra';
import { env } from '../lib/env';

const HEADERS = ['Application No', 'Surname', 'First Name', 'Gender', 'Age', 'State', 'LGA', 'Qualification', 'Entry Type', 'Trade',
  'Height (cm)', 'Status', 'Submitted At', 'Screening Centre', 'Screening Date', 'Email', 'Phone'];

const safeCsv = (v: unknown) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // CSV/formula injection guard
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function processExport(job: Job<ExportJob>) {
  const { rows: [exp] } = await primary.query(`UPDATE exports SET status = 'running' WHERE id = $1 RETURNING *`, [job.data.exportId]);
  if (!exp) return { skipped: true };
  const f = exp.filter as Record<string, string>;
  const where = ['a.exercise_id = $1'];
  const params: unknown[] = [f.exerciseId];
  const add = (col: string, v?: string) => {
    if (!v) return;
    params.push(v);
    where.push(`${col} = $${params.length}`);
  };
  add('a.state_code', f.state); add('a.lga', f.lga); add('a.qualification', f.qualification);
  add('a.entry_type', f.entryType); add('a.status', f.status); add('a.gender', f.gender);

  const file = join(tmpdir(), `export-${exp.id}.${exp.format}`);
  let count = 0;
  try {
    const csv = exp.format === 'csv' ? createWriteStream(file) : null;
    const xlsx = exp.format === 'xlsx' ? new ExcelJS.stream.xlsx.WorkbookWriter({ filename: file, useStyles: true }) : null;
    const sheet = xlsx?.addWorksheet('Applicants');
    if (csv) csv.write('﻿' + HEADERS.map(safeCsv).join(',') + '\n');
    if (sheet) {
      sheet.columns = HEADERS.map((h) => ({ header: h, width: Math.max(12, h.length + 4) }));
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).commit();
    }

    let cursor: [string, string] | null = null;
    for (;;) {
      const p = [...params];
      let w = where.join(' AND ');
      if (cursor) {
        p.push(cursor[0], cursor[1]);
        w += ` AND (a.submitted_at, a.id) > ($${p.length - 1}, $${p.length})`;
      }
      const { rows } = await replica.query(
        `SELECT a.id, a.application_no, a.surname, a.first_name, a.gender, a.age, a.state_code, a.lga, a.qualification, a.entry_type, a.trade,
                a.height_cm, a.status, a.submitted_at, a.screening_date, c.name AS centre, u.email_enc, u.phone_enc
           FROM applications a JOIN users u ON u.id = a.user_id LEFT JOIN screening_centres c ON c.id = a.screening_centre_id
          WHERE ${w} ORDER BY a.submitted_at, a.id LIMIT 5000`,
        p,
      );
      if (!rows.length) break;
      for (const r of rows) {
        const values = [
          r.application_no, r.surname, r.first_name, r.gender, r.age, STATE_BY_CODE[r.state_code]?.name ?? r.state_code, r.lga,
          QUALIFICATION_LABELS[r.qualification as Qualification] ?? r.qualification, ENTRY_TYPE_LABELS[r.entry_type as EntryType] ?? r.entry_type,
          r.trade ?? '', Number(r.height_cm), STATUS_LABELS[r.status as ApplicationStatus] ?? r.status, r.submitted_at.toISOString(),
          r.centre ?? '', r.screening_date ? r.screening_date.toISOString() : '', crypto.decryptString(r.email_enc), crypto.decryptString(r.phone_enc),
        ];
        if (csv && !csv.write(values.map(safeCsv).join(',') + '\n')) await new Promise<void>((res) => csv.once('drain', () => res()));
        if (sheet) sheet.addRow(values).commit();
      }
      count += rows.length;
      const last = rows[rows.length - 1];
      cursor = [last.submitted_at.toISOString(), last.id];
      await job.updateProgress(count);
    }
    if (csv) await new Promise<void>((res, rej) => csv.end((e?: Error | null) => (e ? rej(e) : res())));
    if (xlsx) {
      sheet!.commit();
      await xlsx.commit();
    }
    const key = `exports/${exp.id}.${exp.format}`;
    const { size } = await fs.stat(file);
    await s3.send(new PutObjectCommand({
      Bucket: env.s3.bucket, Key: key, Body: createReadStream(file), ContentLength: size, ServerSideEncryption: env.s3.sse || undefined,
      ContentType: exp.format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }));
    await primary.query(`UPDATE exports SET status = 'done', s3_key = $2, row_count = $3, completed_at = now() WHERE id = $1`, [exp.id, key, count]);
    return { rows: count };
  } catch (e) {
    await primary.query(`UPDATE exports SET status = 'failed', error = $2, completed_at = now() WHERE id = $1`, [exp.id, String((e as Error).message).slice(0, 500)]);
    throw e;
  } finally {
    await fs.rm(file, { force: true });
  }
}
