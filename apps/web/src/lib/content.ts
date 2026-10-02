/**
 * Build-time content access for the public website.
 *
 * Pages are statically generated: this runs during `next build` (and during
 * on-demand revalidation triggered by the CMS when an editor publishes), never
 * per visitor request. Visitors are served pre-rendered HTML from the CDN, so
 * traffic spikes never reach the CMS or any database.
 *
 * If the CMS is unreachable at build time we fall back to the bundled seed
 * content so a deployment can never ship empty pages.
 */
import { cache } from 'react';
import { seedContent, type SiteContent } from '@armyx/shared/content';

export const CONTENT_TAG = 'site-content';

export const getContent = cache(async (): Promise<SiteContent> => {
  const cms = process.env.CMS_URL;
  if (!cms) return seedContent;
  try {
    const res = await fetch(`${cms}/api/site-content`, {
      next: { tags: [CONTENT_TAG] },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`CMS responded ${res.status}`);
    const data = (await res.json()) as Partial<SiteContent>;
    // Merge so a partially populated CMS still renders every section.
    return { ...seedContent, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v && (!Array.isArray(v) || v.length))) } as SiteContent;
  } catch (e) {
    console.warn(`[content] CMS unavailable, using seed content: ${(e as Error).message}`);
    return seedContent;
  }
});

export const formatDate = (iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) =>
  new Date(iso + (iso.length === 10 ? 'T00:00:00Z' : '')).toLocaleDateString('en-NG', { ...opts, timeZone: 'Africa/Lagos' });

export const NEWS_CATEGORY_LABELS: Record<string, string> = {
  'press-release': 'Press Release',
  operations: 'Operations',
  training: 'Training',
  'civil-military': 'Civil-Military',
  welfare: 'Welfare',
  sports: 'Sports',
};
