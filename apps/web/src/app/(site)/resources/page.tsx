import Link from 'next/link';
import { getContent } from '@/lib/content';
import { PageHero } from '@/components/site/PageHero';
import { DocTable } from '@/components/resources/DocTable';

export const dynamic = 'force-static';
export const metadata = { title: 'Downloads Library', description: 'Forms, publications and reports of the Nigerian Army.' };

export default async function ResourcesPage() {
  const { downloads } = await getContent();
  return (
    <>
      <PageHero title="Downloads library" intro="Official forms, publications and reports." eyebrow="Resources" crumbs={[{ label: 'Resources' }]} />
      <section className="container-x grid gap-10 py-16 lg:grid-cols-12">
        <div className="lg:col-span-9"><DocTable items={downloads} categories={{ forms: 'Forms', publications: 'Publications', reports: 'Reports' }} /></div>
        <nav aria-label="Resources" className="lg:col-span-3">
          <ul className="card divide-y divide-olive-100">
            <li><Link className="block p-4 font-semibold text-olive-800" href="/resources" aria-current="page">Downloads</Link></li>
            <li><Link className="block p-4 hover:bg-olive-50" href="/resources/tenders">Tenders & procurement</Link></li>
            <li><Link className="block p-4 hover:bg-olive-50" href="/resources/policies">Policies</Link></li>
          </ul>
        </nav>
      </section>
    </>
  );
}
