/**
 * On-demand revalidation webhook, called by the CMS after an editor publishes.
 * Re-renders the static pages from the CMS (once), after which the CDN serves
 * the new HTML. The CMS also purges the Cloudflare cache for the site.
 */
import { revalidatePath, revalidateTag } from 'next/cache';
import { timingSafeEqual } from 'node:crypto';
import { CONTENT_TAG } from '@/lib/content';

export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET ?? '';
  const got = req.headers.get('x-revalidate-secret') ?? '';
  if (!secret || got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) {
    return Response.json({ ok: false }, { status: 401 });
  }
  revalidateTag(CONTENT_TAG, 'max');
  revalidatePath('/', 'layout');
  return Response.json({ ok: true, revalidatedAt: new Date().toISOString() });
}
