import { getContent } from '@/lib/content';
import { PageHero } from '@/components/site/PageHero';
import { OrgChart } from '@/components/about/OrgChart';

export const dynamic = 'force-static';
export const metadata = { title: 'Organisation', description: 'Interactive organisation chart of the Nigerian Army.' };

export default async function OrganisationPage() {
  const { orgChart } = await getContent();
  return (
    <>
      <PageHero title="Organisation" intro="Select a formation to expand or collapse its subordinate units." eyebrow="Structure" crumbs={[{ label: 'About Us', href: '/about' }, { label: 'Organisation' }]} image="/images/armoured-vehicle.jpg" />
      <section className="container-x overflow-x-auto py-16"><OrgChart root={orgChart} /></section>
    </>
  );
}
