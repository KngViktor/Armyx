/**
 * Edge waiting room — fair FIFO admission in front of the recruitment portal.
 *
 * Every new visitor takes a ticket from one of SHARDS Durable Objects ("Gate").
 * Each gate's "now serving" counter advances at ADMIT_PER_MINUTE / SHARDS, so the
 * origin sees a smooth, bounded arrival rate no matter how sharp the spike is.
 * Tickets and admissions are carried in HMAC-signed cookies, so the gate is
 * only consulted once per visitor (plus queue polls), and refreshing never
 * loses — or improves — your place.
 *
 * Browser navigations get a branded queue page that auto-refreshes; API calls
 * get 503 + Retry-After JSON which the portal client already handles.
 */
export interface Env {
  GATE: DurableObjectNamespace;
  COOKIE_SECRET: string;
  ADMIT_PER_MINUTE: string;
  SESSION_MINUTES: string;
  ENABLED: string;
  SHARDS: string;
}

const COOKIE = '__armyx_wr';

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]!);
}

interface Pass { kind: 'admit' | 'ticket'; shard: number; ticket: number; exp: number }
interface GateState { next: number; serving: number; last: number }

async function readPass(req: Request, env: Env): Promise<Pass | null> {
  const raw = req.headers.get('Cookie')?.split(/;\s*/).find((c) => c.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (!raw) return null;
  const [kind, shard, ticket, exp, sig] = raw.split('.');
  if (!kind || !shard || !ticket || !exp || !sig) return null;
  if ((await hmac(env.COOKIE_SECRET, `${kind}.${shard}.${ticket}.${exp}`)) !== sig) return null;
  if (Number(exp) < Date.now()) return null;
  return { kind: kind as Pass['kind'], shard: Number(shard), ticket: Number(ticket), exp: Number(exp) };
}

async function passCookie(env: Env, p: Pass): Promise<string> {
  const v = `${p.kind}.${p.shard}.${p.ticket}.${p.exp}`;
  return `${COOKIE}=${v}.${await hmac(env.COOKIE_SECRET, v)}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${Math.ceil((p.exp - Date.now()) / 1000)}`;
}

/**
 * Per-isolate cache of each shard's state. Queued visitors re-check their
 * place against this cached snapshot (extrapolated with the admission rate),
 * so polling never touches the Durable Object — only new arrivals do.
 */
const cache = new Map<number, { at: number; s: GateState }>();
async function shardState(env: Env, shard: number): Promise<GateState> {
  const hit = cache.get(shard);
  if (hit && Date.now() - hit.at < 2000) return hit.s;
  const s = (await (await gateStub(env, shard).fetch('https://gate/state')).json()) as GateState;
  cache.set(shard, { at: Date.now(), s });
  return s;
}
const gateStub = (env: Env, shard: number) => env.GATE.get(env.GATE.idFromName(`portal-${shard}`));
const ratePerMs = (env: Env) => Number(env.ADMIT_PER_MINUTE) / Number(env.SHARDS) / 60_000;

async function forward(req: Request, env: Env, p: Pass, sessionMs: number): Promise<Response> {
  const res = await fetch(req);
  const out = new Response(res.body, res);
  out.headers.append('Set-Cookie', await passCookie(env, { ...p, kind: 'admit', exp: Date.now() + sessionMs }));
  return out;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (env.ENABLED !== 'true') return fetch(req);
    const sessionMs = Number(env.SESSION_MINUTES) * 60_000;
    const pass = await readPass(req, env);

    // Already admitted: renew the session and pass through.
    if (pass?.kind === 'admit') return forward(req, env, pass, sessionMs);

    let ticket: Pass;
    let position: number;
    if (pass?.kind === 'ticket') {
      // Returning queued visitor: decide locally from the cached shard snapshot.
      const s = await shardState(env, pass.shard);
      const servingNow = Math.min(s.next - 1, s.serving + ratePerMs(env) * (Date.now() - s.last));
      ticket = pass;
      position = Math.max(0, Math.ceil(pass.ticket - servingNow));
    } else {
      // New arrival: take a ticket from a random shard (spreads load across Durable Objects).
      const shard = Math.floor(Math.random() * Number(env.SHARDS));
      const r = (await (await gateStub(env, shard).fetch('https://gate/ticket', { method: 'POST' })).json()) as { ticket: number; position: number };
      ticket = { kind: 'ticket', shard, ticket: r.ticket, exp: Date.now() + 6 * 3600_000 };
      position = r.position;
    }
    if (position <= 0) return forward(req, env, ticket, sessionMs);

    const etaSec = Math.ceil(position / (ratePerMs(env) * 1000));
    const retry = Math.min(30, Math.max(5, Math.round(etaSec / 4)));
    const cookie = await passCookie(env, ticket);
    if (new URL(req.url).pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ statusCode: 503, queued: true, position, etaSec, message: 'High demand. You are in the queue — retrying shortly.' }), {
        status: 503, headers: { 'Content-Type': 'application/json', 'Retry-After': String(retry), 'Set-Cookie': cookie, 'Cache-Control': 'no-store' },
      });
    }
    return new Response(page(position, etaSec, retry), {
      status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': cookie, 'Cache-Control': 'no-store', Refresh: String(retry) },
    });
  },
};

/** One gate shard: ticket dispenser + rate-limited "now serving" counter. */
export class Gate {
  private s: GateState = { next: 1, serving: 0, last: Date.now() };
  constructor(private state: DurableObjectState, private env: Env) {
    state.blockConcurrencyWhile(async () => {
      this.s = (await state.storage.get<GateState>('s')) ?? this.s;
    });
  }

  async fetch(req: Request): Promise<Response> {
    const now = Date.now();
    // Advance "now serving", never beyond the last issued ticket (no burst credit after quiet periods).
    this.s.serving = Math.min(this.s.next - 1, this.s.serving + ratePerMs(this.env) * (now - this.s.last));
    this.s.last = now;
    if (new URL(req.url).pathname === '/state') return Response.json(this.s);
    const ticket = this.s.next++;
    // Empty queue: admit immediately (and consume the slot).
    if (ticket - this.s.serving <= 1) this.s.serving = ticket;
    await this.state.storage.put('s', this.s);
    return Response.json({ ticket, position: Math.max(0, Math.ceil(ticket - this.s.serving)) });
  }
}

function page(position: number, etaSec: number, refresh: number): string {
  const mins = Math.max(1, Math.round(etaSec / 60));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nigerian Army Recruitment — you are in the queue</title>
<style>body{margin:0;font-family:Arial,sans-serif;background:#1f2817;color:#efe8d6;display:flex;min-height:100vh;align-items:center;justify-content:center}main{max-width:560px;margin:16px;background:#2f3b22;border-top:6px solid #c9a43a;border-radius:12px;padding:32px}h1{font-family:Georgia,serif;color:#fff;margin-top:0}.n{font-size:40px;color:#e3cc7f;font-weight:700}.free{background:#c9a43a;color:#141a0f;padding:12px;border-radius:8px;font-weight:700}</style></head>
<body><main aria-live="polite"><h1>You are in the queue</h1><p>Many people are applying right now. We let applicants in a few at a time so the portal stays fast.</p>
<p>Your position: <span class="n">${position.toLocaleString()}</span></p><p>Estimated wait: about ${mins} minute(s). This page refreshes every ${refresh} seconds — keep it open.</p>
<p class="free">Recruitment is FREE. The Nigerian Army never asks for money.</p></main></body></html>`;
}
