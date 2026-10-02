import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Compass, Target } from 'lucide-react';
import { getContent } from '@/lib/content';
import { PageHero, SectionHeading } from '@/components/site/PageHero';

export const dynamic = 'force-static';
export const metadata = { title: 'About Us', description: 'History, vision, mission and core values of the Nigerian Army.' };

const LINKS = [
  { title: 'Our history', text: 'From Glover’s Hausa Force in 1863 to today.', href: '/about/history', image: '/images/parade-line.jpg' },
  { title: 'Chief of Army Staff', text: 'The professional head of the Nigerian Army.', href: '/about/leadership', image: '/images/officers-walking.jpg' },
  { title: 'Organisation', text: 'Interactive chart of the command structure.', href: '/about/organisation', image: '/images/armoured-vehicle.jpg' },
  { title: 'Ranks & insignia', text: 'Commissioned and non-commissioned ranks.', href: '/about/ranks', image: '/images/recruits-helmets.jpg' },
];

export default async function AboutPage() {
  const { settings } = await getContent();
  return (
    <>
      <PageHero title="About the Nigerian Army" intro="A professional force dedicated to defending Nigeria and supporting civil authority." eyebrow="About us" crumbs={[{ label: 'About Us' }]} image="/images/officers-walking.jpg" />
      <section id="mission" className="container-x grid scroll-mt-28 gap-6 py-16 md:grid-cols-2">
        <div className="card p-8">
          <Target aria-hidden className="h-8 w-8 text-gold-600" />
          <h2 className="mt-4 text-2xl font-bold">Mission</h2>
          <p className="mt-3 leading-7">{settings.mission}</p>
        </div>
        <div className="card p-8">
          <Compass aria-hidden className="h-8 w-8 text-gold-600" />
          <h2 className="mt-4 text-2xl font-bold">Vision</h2>
          <p className="mt-3 leading-7">{settings.vision}</p>
        </div>
      </section>
      <section className="bg-olive-900 py-16 text-white">
        <div className="container-x">
          <p className="text-xs font-semibold tracking-[0.2em] text-gold-300 uppercase">Core values</p>
          <h2 className="mt-2 text-3xl font-bold text-white">What every soldier stands for</h2>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {settings.coreValues.map((v) => (
              <li key={v.title} className="border-t-2 border-gold-500 pt-4">
                <p className="font-serif text-xl font-semibold text-white">{v.title}</p>
                <p className="mt-2 text-sm text-khaki-100">{v.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="container-x py-16">
        <SectionHeading eyebrow="Explore" title="Learn more about us" />
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="card group block overflow-hidden">
                <span className="relative block aspect-[4/3]"><Image src={l.image} alt="" fill sizes="(min-width:1024px) 25vw, 50vw" className="object-cover" /></span>
                <span className="block p-5">
                  <span className="font-serif text-lg font-semibold text-olive-900 group-hover:underline">{l.title}</span>
                  <span className="mt-1 block text-sm text-muted">{l.text}</span>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-olive-700">Read more <ArrowRight aria-hidden className="h-4 w-4" /></span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
