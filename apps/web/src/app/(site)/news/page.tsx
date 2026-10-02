import { getContent, NEWS_CATEGORY_LABELS } from '@/lib/content';
import { PageHero } from '@/components/site/PageHero';
import { NewsList } from '@/components/news/NewsList';

export const dynamic = 'force-static';
export const metadata = { title: 'Press Releases', description: 'Official press releases and news from the Nigerian Army.' };

export default async function NewsPage() {
  const { news } = await getContent();
  return (
    <>
      <PageHero title="Press releases" intro="Official statements, operations updates and news from the Nigerian Army." eyebrow="Operations & News" crumbs={[{ label: 'Operations & News' }]} image="/images/armoured-vehicle.jpg" />
      <section className="container-x py-16"><NewsList items={news} labels={NEWS_CATEGORY_LABELS} /></section>
    </>
  );
}
