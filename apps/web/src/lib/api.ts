'use client';
/**
 * Browser API client for the portal and admin console.
 *  - Same-origin requests with cookies (session is HttpOnly; JS never sees it).
 *  - Double-submit CSRF token header on every state-changing request.
 *  - Graceful degradation under load: on 503 (load shedding) or 429 the
 *    request is retried with jittered exponential backoff while a global
 *    "you are in the queue" banner is shown, instead of failing the user.
 */
const BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data: Record<string, any> = {},
  ) {
    super(message);
  }
  get fields(): Record<string, string> {
    return (this.data.fields as Record<string, string>) ?? {};
  }
}

function readCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(name + '='))
    ?.split('=')[1];
}

async function csrfToken(): Promise<string> {
  let t = readCookie('csrf');
  if (!t) {
    const r = await fetch(`${BASE}/auth/csrf`, { credentials: 'include' });
    t = (await r.json()).token ?? readCookie('csrf');
  }
  return t ?? '';
}

export type QueueEvent = { active: boolean; retryInSec?: number; attempt?: number };
const emitQueue = (detail: QueueEvent) => window.dispatchEvent(new CustomEvent<QueueEvent>('armyx:queue', { detail }));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; maxRetries?: number } = {}): Promise<T> {
  const method = opts.method ?? (opts.body === undefined ? 'GET' : 'POST');
  const maxRetries = opts.maxRetries ?? 8;
  for (let attempt = 0; ; attempt++) {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (method !== 'GET') headers['X-CSRF-Token'] = await csrfToken();
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        credentials: 'include',
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      });
    } catch {
      if (attempt >= maxRetries) throw new ApiError(0, 'Network error. Check your connection and try again.');
      await sleep(1000 * 2 ** Math.min(attempt, 4));
      continue;
    }
    const isJson = res.headers.get('content-type')?.includes('json');
    const data = isJson ? await res.json() : {};

    // 503 = shed by the API or the edge waiting room. Retry transparently (GETs and idempotent saves).
    if ((res.status === 503 || res.status === 502 || res.status === 504) && attempt < maxRetries) {
      const retryAfter = Number(res.headers.get('Retry-After')) || 2;
      const wait = Math.min(60, retryAfter * 2 ** Math.min(attempt, 3)) * (0.75 + Math.random() * 0.5);
      emitQueue({ active: true, retryInSec: Math.round(wait), attempt: attempt + 1 });
      await sleep(wait * 1000);
      continue;
    }
    emitQueue({ active: false });
    if (!res.ok) {
      const message = Array.isArray(data.message) ? data.message.join(', ') : data.message ?? `Request failed (${res.status})`;
      throw new ApiError(res.status, message, data);
    }
    return data as T;
  }
}

/** Uploads a file straight to object storage using a presigned POST from the API. */
export async function uploadToStorage(presigned: { url: string; fields: Record<string, string> }, file: File, onProgress?: (pct: number) => void) {
  const form = new FormData();
  for (const [k, v] of Object.entries(presigned.fields)) form.append(k, v);
  form.append('file', file);
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', presigned.url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new ApiError(xhr.status, 'Upload was rejected by storage. Check file type and size.')));
    xhr.onerror = () => reject(new ApiError(0, 'Upload failed. Check your connection.'));
    xhr.send(form);
  });
}
