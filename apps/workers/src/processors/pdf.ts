/**
 * Generates the printable acknowledgement slip (A4 PDF) with the applicant's
 * passport photo and a QR code. The QR encodes a signed verification URL so
 * screening officers can scan a slip and confirm it is genuine.
 */
import type { Job } from 'bullmq';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { join } from 'node:path';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { ApplicationData, ENTRY_TYPE_LABELS, PdfSlipJob, QUALIFICATION_LABELS, RK, STATE_BY_CODE } from '@armyx/shared';
import { slipSignature } from '@armyx/shared/server';
import { blindIndexKey, crypto, primary, redis, s3 } from '../lib/infra';
import { env } from '../lib/env';

const GREEN = '#2f3b22';
const GOLD = '#b8952e';

async function fetchObject(key: string): Promise<Buffer | null> {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: env.s3.bucket, Key: key }));
    return Buffer.from(await r.Body!.transformToByteArray());
  } catch {
    return null;
  }
}

export function renderSlip(a: {
  applicationNo: string; exerciseTitle: string; submittedAt: Date; data: ApplicationData; photo: Buffer | null; qr: Buffer; verifyUrl: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Acknowledgement Slip ${a.applicationNo}`, Author: 'Nigerian Army' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header band
    doc.rect(0, 0, doc.page.width, 110).fill(GREEN);
    doc.rect(0, 110, doc.page.width, 4).fill(GOLD);
    try {
      doc.image(join(__dirname, '..', '..', 'assets', 'crest.png'), 40, 18, { width: 74, height: 74 });
    } catch { /* crest optional */ }
    doc.fillColor('#ffffff').font('Times-Bold').fontSize(22).text('NIGERIAN ARMY', 130, 28);
    doc.font('Helvetica').fontSize(11).text(a.exerciseTitle.toUpperCase(), 130, 56);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(GOLD).text('APPLICATION ACKNOWLEDGEMENT SLIP', 130, 76);

    // Photo + QR
    const top = 135;
    if (a.photo) {
      try {
        doc.image(a.photo, doc.page.width - 160, top, { fit: [120, 150] });
      } catch { /* unsupported image */ }
    }
    doc.rect(doc.page.width - 160, top, 120, 150).lineWidth(1).stroke('#999');

    doc.fillColor('#000').font('Helvetica').fontSize(10).text('Application number', 40, top);
    doc.font('Courier-Bold').fontSize(20).fillColor(GREEN).text(a.applicationNo, 40, top + 14);
    doc.font('Helvetica').fontSize(9).fillColor('#444').text(`Submitted: ${a.submittedAt.toUTCString()}`, 40, top + 42);

    const d = a.data;
    const rows: [string, string][] = [
      ['Full name', `${d.personal.surname.toUpperCase()} ${d.personal.firstName} ${d.personal.middleName ?? ''}`.trim()],
      ['Gender', d.personal.gender === 'male' ? 'Male' : 'Female'],
      ['Date of birth', d.personal.dateOfBirth],
      ['State of origin / LGA', `${STATE_BY_CODE[d.origin.stateOfOrigin]?.name ?? d.origin.stateOfOrigin} / ${d.origin.lga}`],
      ['Entry type', ENTRY_TYPE_LABELS[d.entry.entryType] + (d.entry.trade ? ` — ${d.entry.trade}` : '')],
      ['Highest qualification', QUALIFICATION_LABELS[d.education.highestQualification]],
      ['Height', `${(d.physical.heightCm / 100).toFixed(2)} m`],
      ['Preferred screening state', STATE_BY_CODE[d.entry.preferredScreeningState]?.name ?? d.entry.preferredScreeningState],
      ['Next of kin', `${d.next_of_kin.fullName} (${d.next_of_kin.relationship})`],
    ];
    let y = top + 70;
    for (const [k, v] of rows) {
      doc.font('Helvetica').fontSize(9).fillColor('#555').text(k, 40, y, { width: 150 });
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#000').text(v, 190, y, { width: doc.page.width - 380 });
      y += 22;
    }

    // QR and verification
    y = Math.max(y, top + 170) + 20;
    doc.image(a.qr, 40, y, { width: 110 });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(GREEN).text('Verify this slip', 165, y + 10);
    doc.font('Helvetica').fontSize(8).fillColor('#333').text(`Scan the QR code or visit:\n${a.verifyUrl}`, 165, y + 26, { width: 330 });

    // Instructions
    y += 130;
    doc.rect(40, y, doc.page.width - 80, 1).fill(GOLD);
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(11).text('IMPORTANT INSTRUCTIONS', 40, y + 10);
    doc.font('Helvetica').fontSize(9).list(
      [
        'Print this slip and bring it with your ORIGINAL credentials to the screening venue.',
        'Your screening venue and date will be shown on the portal dashboard and sent by email/SMS.',
        'Recruitment into the Nigerian Army is FREE. Do not pay anyone for any reason.',
        'Any false declaration will lead to disqualification at any stage, even after enlistment.',
      ],
      48, y + 30, { bulletRadius: 2, paragraphGap: 4, width: doc.page.width - 100 },
    );
    doc.font('Helvetica').fontSize(7).fillColor('#777').text('Generated electronically by the Nigerian Army Recruitment Portal. No signature required.', 40, doc.page.height - 50, { align: 'center', width: doc.page.width - 80 });
    doc.end();
  });
}

export async function processPdf(job: Job<PdfSlipJob>) {
  const { rows: [a] } = await primary.query(
    `SELECT a.id, a.application_no, a.user_id, a.exercise_id, a.submitted_at, a.pii_enc, e.title,
            (SELECT s3_key FROM documents d WHERE d.user_id = a.user_id AND d.exercise_id = a.exercise_id AND d.type = 'passport_photo') AS photo_key
       FROM applications a JOIN exercises e ON e.id = a.exercise_id WHERE a.id = $1`,
    [job.data.applicationId],
  );
  if (!a) throw new Error('application not found (yet) — will retry');
  const verifyUrl = `${env.publicWebUrl}/verify?id=${encodeURIComponent(a.application_no)}&s=${slipSignature(a.application_no, blindIndexKey)}`;
  const pdf = await renderSlip({
    applicationNo: a.application_no,
    exerciseTitle: a.title,
    submittedAt: a.submitted_at,
    data: crypto.decryptJson<ApplicationData>(a.pii_enc),
    photo: a.photo_key ? await fetchObject(a.photo_key) : null,
    qr: await QRCode.toBuffer(verifyUrl, { margin: 1, width: 300, errorCorrectionLevel: 'M' }),
    verifyUrl,
  });
  const key = `slips/${a.exercise_id}/${a.application_no}.pdf`;
  await s3.send(new PutObjectCommand({ Bucket: env.s3.bucket, Key: key, Body: pdf, ContentType: 'application/pdf', ServerSideEncryption: env.s3.sse || undefined }));
  await primary.query(`UPDATE applications SET slip_key = $2 WHERE id = $1`, [a.id, key]);
  await redis.del(RK.appStatus(a.user_id, a.exercise_id));
  return { key, bytes: pdf.length };
}
