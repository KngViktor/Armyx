import { getContent } from '@/lib/content';
import { PageHero } from '@/components/site/PageHero';
import { TenderList } from '@/components/resources/TenderList';
import { Alert } from '@/components/ui/Alert';

export const dynamic = 'force-static';
export const metadata = { title: 'Tenders & Procurement', description: 'Nigerian Army invitations to tender, deadlines and award status.' };

export default async function TendersPage() {
  const { tenders } = await getContent();
  return (
    <>
      <PageHero title="Tenders & procurement" intro="Open invitations to tender, deadlines and award status, in line with the Public Procurement Act." eyebrow="Resources" crumbs={[{ label: 'Resources', href: '/resources' }, { label: 'Tenders' }]} />
      <section className="container-x py-16">
        <Alert tone="info">Bidders must be registered on the Bureau of Public Procurement (BPP) National Database. The Army never requests payment to a personal account.</Alert>
        <div className="mt-8"><TenderList tenders={tenders} /></div>
      </section>
    </>
  );
}
