import { getContent } from '@/lib/content';
import { PageHero } from '@/components/site/PageHero';
import { InstitutionDirectory } from '@/components/join/InstitutionDirectory';

export const dynamic = 'force-static';
export const metadata = { title: 'Training Institutions', description: 'Directory of Nigerian Army training institutions.' };

export default async function InstitutionsPage() {
  const { institutions } = await getContent();
  return (
    <>
      <PageHero title="Training institutions" intro="Where Nigerian Army officers and soldiers are trained." eyebrow="Join the Army" crumbs={[{ label: 'Join the Army', href: '/join' }, { label: 'Training Institutions' }]} image="/images/recruits-helmets.jpg" />
      <section className="container-x py-16"><InstitutionDirectory items={institutions} /></section>
    </>
  );
}
