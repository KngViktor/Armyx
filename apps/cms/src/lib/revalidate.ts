/**
 * Publishing pipeline: when an editor saves content we
 *   1. ask the web app to re-render its static pages (on-demand ISR), then
 *   2. purge the Cloudflare cache so the CDN fetches the fresh HTML.
 * Calls are debounced so a burst of edits triggers a single rebuild.
 */
let timer: ReturnType<typeof setTimeout> | undefined;

async function run() {
  const url = process.env.WEB_REVALIDATE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (url && secret) {
    try {
      const headers: Record<string, string> = { 'x-revalidate-secret': secret };
      // Lets the call through Vercel Deployment Protection when the website is a protected preview.
      if (process.env.WEB_PROTECTION_BYPASS) headers['x-vercel-protection-bypass'] = process.env.WEB_PROTECTION_BYPASS;
      const r = await fetch(url, { method: 'POST', headers, signal: AbortSignal.timeout(15_000) });
      console.info(`[revalidate] web responded ${r.status}`);
    } catch (e) {
      console.error('[revalidate] web revalidation failed', (e as Error).message);
    }
  }
  const zone = process.env.CLOUDFLARE_ZONE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (zone && token) {
    try {
      // Purge HTML only; hashed static assets are immutable and stay cached.
      const prefixes = (process.env.CLOUDFLARE_PURGE_PREFIXES ?? '').split(',').filter(Boolean);
      await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(prefixes.length ? { prefixes } : { purge_everything: true }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      console.error('[revalidate] Cloudflare purge failed', (e as Error).message);
    }
  }
}

export function scheduleRevalidate() {
  clearTimeout(timer);
  timer = setTimeout(run, 5_000);
}

export const revalidateHooks = {
  afterChange: [() => scheduleRevalidate()],
  afterDelete: [() => scheduleRevalidate()],
};
