import { getContent } from '@/lib/content';
import { PageHero } from '@/components/site/PageHero';
import { FaqSearch } from '@/components/join/FaqSearch';

export const dynamic = 'force-static';
export const metadata = { title: 'Frequently Asked Questions', description: 'Answers to common questions about Nigerian Army recruitment.' };

export default async function FaqPage() {
  const { faqs } = await getContent();
  return (
    <>
      <PageHero title="Frequently asked questions" intro="Search our answers about eligibility, the application process, documents and screening." eyebrow="Join the Army" crumbs={[{ label: 'Join the Army', href: '/join' }, { label: 'FAQs' }]} />
      <section className="container-x max-w-4xl py-16"><FaqSearch faqs={faqs} /></section>
    </>
  );
}
