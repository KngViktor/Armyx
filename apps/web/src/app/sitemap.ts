import type { MetadataRoute } from 'next';
import { NAV } from '@/lib/nav';
import { getContent } from '@/lib/content';

export const dynamic = 'force-static';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const c = await getContent();
  const paths = new Set<string>(['/', '/privacy', '/accessibility', '/verify']);
  for (const n of NAV) {
    paths.add(n.href);
    n.groups?.forEach((g) => g.links.forEach((l) => !l.href.includes('#') && !l.href.startsWith('/portal') && paths.add(l.href)));
  }
  c.news.forEach((n) => paths.add(`/news/${n.slug}`));
  c.welfare.forEach((w) => paths.add(`/welfare/${w.slug}`));
  return [...paths].map((p) => ({ url: site + p, changeFrequency: p.startsWith('/news') ? 'daily' : 'weekly' }));
}
