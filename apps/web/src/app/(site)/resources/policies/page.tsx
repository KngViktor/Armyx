import { getContent } from '@/lib/content';
import { PageHero } from '@/components/site/PageHero';
import { DocTable } from '@/components/resources/DocTable';

export const dynamic = 'force-static';
export const metadata = { title: 'Policies', description: 'Nigerian Army public policies including privacy, FOI and human rights.' };

export default async function PoliciesPage() {
  const { policies } = await getContent();
  return (
    <>
      <PageHero title="Policies" intro="Public policies of the Nigerian Army." eyebrow="Resources" crumbs={[{ label: 'Resources', href: '/resources' }, { label: 'Policies' }]} />
      <section className="container-x py-16"><DocTable items={policies} /></section>
    </>
  );
}
