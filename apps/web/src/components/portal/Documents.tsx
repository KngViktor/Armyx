'use client';
/**
 * Document uploads straight to object storage:
 *   1. client-side type/size check (fast feedback)
 *   2. API returns a presigned POST whose policy enforces type + max size
 *   3. browser uploads directly to the bucket (API pods never see the bytes)
 *   4. API confirms the object; a worker verifies the magic bytes
 */
import { useState } from 'react';
import { CheckCircle2, Clock, FileUp, Loader2, XCircle } from 'lucide-react';
import { DOCUMENT_RULES, DOCUMENT_TYPES, type DocumentType } from '@armyx/shared';
import { api, uploadToStorage } from '@/lib/api';

export interface DocInfo { type: DocumentType; status: 'pending' | 'verified' | 'rejected'; size: number; rejectReason?: string }

export function Documents({ docs, onChange }: { docs: DocInfo[]; onChange: () => void }) {
  const [progress, setProgress] = useState<Partial<Record<DocumentType, number>>>({});
  const [errors, setErrors] = useState<Partial<Record<DocumentType, string>>>({});
  const [preview, setPreview] = useState<string | null>(null);

  async function upload(type: DocumentType, file: File) {
    const rule = DOCUMENT_RULES[type];
    setErrors((e) => ({ ...e, [type]: undefined }));
    if (!rule.mimeTypes.includes(file.type)) return setErrors((e) => ({ ...e, [type]: `Only ${rule.mimeTypes.map((m) => m.split('/')[1]!.toUpperCase()).join(', ')} files are allowed.` }));
    if (file.size > rule.maxBytes) return setErrors((e) => ({ ...e, [type]: `File is too large (${Math.round(file.size / 1024)}KB). Maximum is ${Math.round(rule.maxBytes / 1024)}KB.` }));
    try {
      setProgress((p) => ({ ...p, [type]: 0 }));
      const presigned = await api('/applications/documents/presign', { body: { type, contentType: file.type, size: file.size } });
      await uploadToStorage(presigned, file, (pct) => setProgress((p) => ({ ...p, [type]: pct })));
      await api('/applications/documents/confirm', { body: { type, key: presigned.key } });
      if (type === 'passport_photo') setPreview(URL.createObjectURL(file));
      onChange();
    } catch (e) {
      setErrors((x) => ({ ...x, [type]: (e as Error).message }));
    } finally {
      setProgress((p) => ({ ...p, [type]: undefined }));
    }
  }

  return (
    <ul className="space-y-4">
      {DOCUMENT_TYPES.map((t) => {
        const rule = DOCUMENT_RULES[t];
        const d = docs.find((x) => x.type === t);
        const pct = progress[t];
        const id = `doc-${t}`;
        return (
          <li key={t} className="rounded-lg border border-olive-100 bg-white p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                {t === 'passport_photo' && preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="Your passport photograph" className="h-16 w-14 rounded object-cover" />
                ) : (
                  <FileUp aria-hidden className="mt-1 h-6 w-6 text-olive-600" />
                )}
                <div>
                  <p className="font-semibold text-olive-900">{rule.label} {rule.required && <span className="text-danger" aria-label="required">*</span>}</p>
                  <p className="text-xs text-muted">{rule.mimeTypes.map((m) => m.split('/')[1]!.toUpperCase()).join(', ')} · max {rule.maxBytes >= 1048576 ? `${rule.maxBytes / 1048576}MB` : `${rule.maxBytes / 1024}KB`}</p>
                  {d && (
                    <p className={`mt-1 flex items-center gap-1 text-sm ${d.status === 'rejected' ? 'text-danger' : d.status === 'verified' ? 'text-success' : 'text-muted'}`}>
                      {d.status === 'verified' ? <CheckCircle2 aria-hidden className="h-4 w-4" /> : d.status === 'rejected' ? <XCircle aria-hidden className="h-4 w-4" /> : <Clock aria-hidden className="h-4 w-4" />}
                      {d.status === 'verified' ? 'Uploaded and checked' : d.status === 'rejected' ? d.rejectReason ?? 'Rejected — upload again' : 'Uploaded — checking file'}
                    </p>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                <input id={id} type="file" accept={rule.mimeTypes.join(',')} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(t, f); e.target.value = ''; }} />
                <label htmlFor={id} className={`btn-outline cursor-pointer ${pct !== undefined ? 'pointer-events-none opacity-60' : ''}`}>
                  {pct !== undefined ? <><Loader2 aria-hidden className="h-4 w-4 animate-spin" />{pct}%</> : d ? 'Replace file' : 'Choose file'}
                </label>
              </div>
            </div>
            {pct !== undefined && <div className="mt-3 h-2 overflow-hidden rounded bg-olive-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${rule.label}`}><div className="h-full bg-olive-600 transition-all" style={{ width: `${pct}%` }} /></div>}
            {errors[t] && <p role="alert" className="mt-2 text-sm font-medium text-danger">{errors[t]}</p>}
          </li>
        );
      })}
    </ul>
  );
}
