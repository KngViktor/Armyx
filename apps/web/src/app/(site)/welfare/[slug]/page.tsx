import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getContent } from '@/lib/content';
import { PageHero } from '@/components/site/PageHero';
import { AREA_ICONS } from '@/lib/welfare';

export const dynamicParams = false;
export async function generateStaticParams() {
  return (await getContent()).welfare.map((w) => ({ slug: w.slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const w = (await getContent()).welfare.find((x) => x.slug === slug);
  return w ? { title: `${w.title} — Welfare`, description: w.intro } : {};
}

const AREA_LABEL = { healthcare: 'Healthcare', pension: 'Pension', housing: 'Housing', education: 'Education', insurance: 'Insurance', support: 'Support' };

export default async function WelfareSectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { welfare } = await getContent();
  const w = welfare.find((x) => x.slug === slug);
  if (!w) notFound();
  return (
    <>
      <PageHero title={w.title} intro={w.intro} eyebrow="Welfare & Services" crumbs={[{ label: 'Welfare', href: '/welfare' }, { label: w.title }]} image="/images/officers-walking.jpg" />
      <section className="container-x grid gap-10 py-16 lg:grid-cols-12">
        <ul className="grid gap-5 sm:grid-cols-2 lg:col-span-8">
          {w.services.map((s) => {
            const Icon = AREA_ICONS[s.area];
            return (
              <li key={s.title} className="card p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-olive-50 text-olive-700"><Icon aria-hidden className="h-6 w-6" /></span>
                <p className="mt-3 text-xs font-semibold tracking-wide text-olive-600 uppercase">{AREA_LABEL[s.area]}</p>
                <h2 className="mt-1 text-lg font-semibold">{s.title}</h2>
                <p className="mt-2 text-sm text-muted">{s.description}</p>
                {s.contact && <p className="mt-3 text-sm"><strong>Contact:</strong> {s.contact}</p>}
              </li>
            );
          })}
        </ul>
        <aside className="lg:col-span-4">
          <nav aria-label="Welfare sections" className="card p-5">
            <p className="font-semibold">Other sections</p>
            <ul className="mt-3 space-y-2">
              {welfare.filter((x) => x.slug !== slug).map((x) => <li key={x.slug}><Link className="text-olive-700 underline" href={`/welfare/${x.slug}`}>{x.title}</Link></li>)}
            </ul>
            <Link href="/contact" className="btn-primary mt-5 w-full">Contact the welfare desk</Link>
          </nav>
        </aside>
      </section>
    </>
  );
}
