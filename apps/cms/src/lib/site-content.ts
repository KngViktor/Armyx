/**
 * GET /api/site-content — returns the whole public website content as one
 * SiteContent JSON document. Only the web build / revalidation calls this
 * (a handful of times per publish), never end users, so it is cached briefly
 * and kept simple.
 */
import type { Endpoint, Payload } from 'payload';
import type { SiteContent } from '@armyx/shared/content';

const day = (d?: string | null) => (d ? d.slice(0, 10) : undefined);
const strip = <T extends Record<string, any>>(o: T) => {
  const { id, createdAt, updatedAt, _status, ...rest } = o;
  return rest;
};

export async function buildSiteContent(payload: Payload): Promise<Partial<SiteContent>> {
  const all = async (collection: any, sort?: string, where?: any) =>
    (await payload.find({ collection, limit: 1000, depth: 0, sort, where, pagination: false })).docs as any[];
  const [settings, news, announcements, events, gallery, leaders, ranks, institutions, faqs, downloads, tenders, welfare] = await Promise.all([
    payload.findGlobal({ slug: 'site-settings', depth: 0 }) as Promise<any>,
    all('news', '-publishedAt', { _status: { equals: 'published' } }),
    all('announcements', '-date'), all('events', 'date'), all('gallery', '-date'), all('leaders', 'order'), all('ranks', 'order'),
    all('institutions'), all('faqs', 'order'), all('downloads', '-date'), all('tenders', '-publishedAt'), all('welfare'),
  ]);
  const { orgChart, ...siteSettings } = settings ? strip(settings) : ({} as any);
  return {
    settings: settings?.mission ? (siteSettings as any) : undefined,
    orgChart,
    news: news.map((n) => ({ ...strip(n), publishedAt: day(n.publishedAt), body: (n.body ?? []).map((p: any) => p.text) })),
    announcements: announcements.map((a) => ({ ...strip(a), id: String(a.id), date: day(a.date) })),
    events: events.map((e) => ({ ...strip(e), date: day(e.date), endDate: day(e.endDate) })),
    gallery: gallery.map((g) => ({ ...strip(g), id: String(g.id), date: day(g.date) })),
    leadership: leaders.map((l) => ({ ...strip(l), bio: (l.bio ?? []).map((p: any) => p.text) })),
    ranks: ranks.map(strip) as any,
    institutions: institutions.map((i) => ({ ...strip(i), courses: (i.courses ?? []).map((c: any) => c.name) })),
    faqs: faqs.map((f) => ({ ...strip(f), id: String(f.id) })),
    downloads: downloads.filter((d) => d.category !== 'policies').map((d) => ({ ...strip(d), id: String(d.id), date: day(d.date) })),
    policies: downloads.filter((d) => d.category === 'policies').map((d) => ({ ...strip(d), id: String(d.id), date: day(d.date) })),
    tenders: tenders.map((t) => ({ ...strip(t), publishedAt: day(t.publishedAt), deadline: day(t.deadline) })),
    welfare: welfare.map((w) => ({ ...strip(w), services: (w.services ?? []).map(({ id, ...s }: any) => s) })),
  } as Partial<SiteContent>;
}

export const siteContentEndpoint: Endpoint = {
  path: '/site-content',
  method: 'get',
  handler: async (req) => {
    const body = await buildSiteContent(req.payload);
    return Response.json(body, { headers: { 'Cache-Control': 'private, max-age=10' } });
  },
};
