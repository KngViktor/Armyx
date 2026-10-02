import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getContent, formatDate, NEWS_CATEGORY_LABELS } from '@/lib/content';
import { PageHero } from '@/components/site/PageHero';

export const dynamicParams = false;

export async function generateStaticParams() {
  const { news } = await getContent();
  return news.map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const n = (await getContent()).news.find((x) => x.slug === slug);
  return n ? { title: n.title, description: n.excerpt, openGraph: { images: [n.image] } } : {};
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { news } = await getContent();
  const n = news.find((x) => x.slug === slug);
  if (!n) notFound();
  const related = news.filter((x) => x.slug !== slug).slice(0, 3);
  return (
    <>
      <PageHero title={n.title} eyebrow={NEWS_CATEGORY_LABELS[n.category]} crumbs={[{ label: 'News', href: '/news' }, { label: 'Article' }]} image={n.image} />
      <article className="container-x grid gap-12 py-12 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <p className="text-sm text-muted">Published <time dateTime={n.publishedAt}>{formatDate(n.publishedAt)}</time> · Directorate of Army Public Relations</p>
          <div className="relative mt-6 aspect-video overflow-hidden rounded-xl"><Image src={n.image} alt="" fill sizes="(min-width:1024px) 66vw, 100vw" className="object-cover" /></div>
          <div className="prose-army mt-8 text-lg">
            <p className="font-medium text-olive-900">{n.excerpt}</p>
            {n.body.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <Link href="/news" className="btn-outline mt-6"><ArrowLeft aria-hidden className="h-4 w-4" /> All press releases</Link>
        </div>
        <aside className="lg:col-span-4">
          <h2 className="text-xl font-bold">More news</h2>
          <ul className="mt-4 space-y-4">
            {related.map((r) => (
              <li key={r.slug}><Link href={`/news/${r.slug}`} className="card block p-4 hover:border-gold-500"><span className="text-xs text-muted">{formatDate(r.publishedAt)}</span><span className="mt-1 block font-semibold text-olive-900">{r.title}</span></Link></li>
            ))}
          </ul>
        </aside>
      </article>
    </>
  );
}
