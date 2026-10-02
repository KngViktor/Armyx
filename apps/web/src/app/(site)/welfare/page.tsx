import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AREA_ICONS } from '@/lib/welfare';
import { getContent } from '@/lib/content';
import { PageHero } from '@/components/site/PageHero';

export const dynamic = 'force-static';
export const metadata = { title: 'Welfare & Services', description: 'Healthcare, pension and housing services for serving personnel, veterans and families.' };

export default async function WelfarePage() {
  const { welfare } = await getContent();
  return (
    <>
      <PageHero title="Welfare & services" intro="Caring for those who serve, those who have served, and their families." eyebrow="Welfare" crumbs={[{ label: 'Welfare & Services' }]} image="/images/soldier-truck.jpg" />
      <section className="container-x grid gap-6 py-16 lg:grid-cols-3">
        {welfare.map((w) => (
          <Link key={w.slug} href={`/welfare/${w.slug}`} className="card group flex flex-col p-6 hover:border-gold-500">
            <h2 className="text-2xl font-bold group-hover:underline">{w.title}</h2>
            <p className="mt-2 text-muted">{w.intro}</p>
            <ul className="mt-5 flex-1 space-y-2">
              {w.services.map((s) => {
                const Icon = AREA_ICONS[s.area];
                return <li key={s.title} className="flex gap-2 text-sm"><Icon aria-hidden className="h-4 w-4 shrink-0 text-olive-600" />{s.title}</li>;
              })}
            </ul>
            <span className="mt-6 inline-flex items-center gap-1 font-semibold text-olive-700">View services <ArrowRight aria-hidden className="h-4 w-4" /></span>
          </Link>
        ))}
      </section>
    </>
  );
}
