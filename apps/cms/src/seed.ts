/**
 * Seeds the CMS with the sample content in @armyx/shared/content and creates
 * the first CMS administrator. Idempotent: skips collections that already
 * contain documents.  Run with:  pnpm --filter @armyx/cms seed
 */
import { getPayload } from 'payload';
import config from '@payload-config';
import { seedContent as c } from '@armyx/shared/content';

const payload = await getPayload({ config });
const count = async (collection: any) => (await payload.count({ collection })).totalDocs;
const many = async (collection: any, docs: any[]) => {
  if (await count(collection)) return console.log(`- ${collection}: already seeded`);
  for (const data of docs) await payload.create({ collection, data, draft: false } as any);
  console.log(`- ${collection}: ${docs.length} documents`);
};

if (!(await count('users'))) {
  await payload.create({
    collection: 'users',
    data: { email: process.env.CMS_ADMIN_EMAIL ?? 'cms-admin@army.mil.ng', password: process.env.CMS_ADMIN_PASSWORD ?? 'ChangeMe!Cms2026', name: 'CMS Administrator', role: 'admin' },
  });
  console.log('- created CMS admin user');
}
await payload.updateGlobal({ slug: 'site-settings', data: { ...c.settings, orgChart: c.orgChart } as any });
console.log('- site-settings updated');
await many('news', c.news.map((n) => ({ ...n, body: n.body.map((text) => ({ text })), _status: 'published' })));
await many('announcements', c.announcements.map(({ id, ...a }) => a));
await many('events', c.events);
await many('gallery', c.gallery.map(({ id, ...g }) => g));
await many('leaders', c.leadership.map((l, order) => ({ ...l, order, bio: l.bio.map((text) => ({ text })) })));
await many('ranks', c.ranks.map((r, order) => ({ ...r, order })));
await many('institutions', c.institutions.map((i) => ({ ...i, courses: i.courses.map((name) => ({ name })) })));
await many('faqs', c.faqs.map(({ id, ...f }, order) => ({ ...f, order })));
await many('downloads', [...c.downloads, ...c.policies].map(({ id, ...d }) => d));
await many('tenders', c.tenders);
await many('welfare', c.welfare);
console.log('CMS seed complete.');
process.exit(0);
