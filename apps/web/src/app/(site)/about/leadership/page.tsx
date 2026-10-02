import Image from 'next/image';
import { getContent } from '@/lib/content';
import { PageHero } from '@/components/site/PageHero';

export const dynamic = 'force-static';
export const metadata = { title: 'Chief of Army Staff', description: 'Profile of the Chief of Army Staff of the Nigerian Army.' };

export default async function LeadershipPage() {
  const { leadership } = await getContent();
  const coas = leadership[0]!;
  return (
    <>
      <PageHero title="Chief of Army Staff" intro="The professional head of the Nigerian Army." eyebrow="Leadership" crumbs={[{ label: 'About Us', href: '/about' }, { label: 'Chief of Army Staff' }]} />
      <section className="container-x grid gap-10 py-16 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="card overflow-hidden">
            <div className="relative aspect-[4/5]"><Image src={coas.photo} alt={`${coas.rank} ${coas.name}`} fill sizes="(min-width:1024px) 33vw, 100vw" className="object-cover" /></div>
            <div className="border-t-4 border-gold-500 bg-olive-800 p-5 text-white">
              <p className="text-xs tracking-[0.2em] text-gold-300 uppercase">{coas.rank}</p>
              <p className="mt-1 font-serif text-2xl font-bold">{coas.name}</p>
              <p className="text-sm text-khaki-100">{coas.appointment}</p>
            </div>
          </div>
        </div>
        <article className="prose-army lg:col-span-8">
          <h2 className="mb-6 text-3xl font-bold">Profile</h2>
          {coas.bio.map((p, i) => <p key={i}>{p}</p>)}
        </article>
      </section>
    </>
  );
}
