import { getContent } from '@/lib/content';
import { PageHero, SectionHeading } from '@/components/site/PageHero';
import { Insignia } from '@/components/about/Insignia';

export const dynamic = 'force-static';
export const metadata = { title: 'Ranks & Insignia', description: 'Ranks and insignia of officers and soldiers of the Nigerian Army.' };

export default async function RanksPage() {
  const { ranks } = await getContent();
  const groups = [
    { title: 'Commissioned officers', items: ranks.filter((r) => r.category === 'commissioned') },
    { title: 'Warrant officers, NCOs and soldiers', items: ranks.filter((r) => r.category !== 'commissioned') },
  ];
  return (
    <>
      <PageHero title="Ranks & insignia" intro="Rank structure of the Nigerian Army, from Private to General." eyebrow="Structure" crumbs={[{ label: 'About Us', href: '/about' }, { label: 'Ranks & Insignia' }]} image="/images/recruits-helmets.jpg" />
      {groups.map((g) => (
        <section key={g.title} className="container-x py-12">
          <SectionHeading title={g.title} />
          <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {g.items.map((r) => (
              <li key={r.name} className="card flex flex-col items-center p-5 text-center">
                <Insignia rank={r} />
                <p className="mt-4 font-semibold text-olive-900">{r.name}</p>
                <p className="text-sm text-muted">{r.abbreviation} · <abbr title="NATO rank code">{r.natoCode}</abbr></p>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="container-x pb-12 text-xs text-muted">Insignia shown are illustrative representations.</p>
    </>
  );
}
