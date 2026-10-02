import { getContent } from '@/lib/content';
import { PageHero } from '@/components/site/PageHero';
import { Gallery } from '@/components/news/Gallery';

export const dynamic = 'force-static';
export const metadata = { title: 'Photo & Video Gallery', description: 'Photos and videos of Nigerian Army activities.' };

export default async function GalleryPage() {
  const { gallery } = await getContent();
  return (
    <>
      <PageHero title="Photo & video gallery" intro="Images and footage from operations, training, ceremonies and community engagement." eyebrow="Operations & News" crumbs={[{ label: 'News', href: '/news' }, { label: 'Gallery' }]} image="/images/parade-line.jpg" />
      <section className="container-x py-16"><Gallery items={gallery} /></section>
    </>
  );
}
