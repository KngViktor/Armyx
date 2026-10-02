import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export function PageHero({
  title, intro, eyebrow, image = '/images/parade-line.jpg', crumbs = [],
}: { title: string; intro?: string; eyebrow?: string; image?: string; crumbs?: { label: string; href?: string }[] }) {
  return (
    <section className="relative isolate overflow-hidden bg-olive-900 text-white">
      <Image src={image} alt="" fill priority sizes="100vw" className="-z-10 object-cover opacity-35" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-olive-950 via-olive-900/85 to-olive-900/30" />
      <div className="container-x py-14 sm:py-20">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-khaki-100">
            <li><Link href="/" className="hover:underline">Home</Link></li>
            {crumbs.map((c) => (
              <li key={c.label} className="flex items-center gap-1">
                <ChevronRight aria-hidden className="h-4 w-4" />
                {c.href ? <Link href={c.href} className="hover:underline">{c.label}</Link> : <span aria-current="page">{c.label}</span>}
              </li>
            ))}
          </ol>
        </nav>
        {eyebrow && <p className="mt-6 text-xs font-semibold tracking-[0.2em] text-gold-300 uppercase">{eyebrow}</p>}
        <h1 className="mt-3 max-w-3xl font-serif text-3xl font-bold text-white sm:text-5xl">{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-base text-khaki-100 sm:text-lg">{intro}</p>}
      </div>
      <div className="h-1 bg-gold-500" />
    </section>
  );
}

export function SectionHeading({ eyebrow, title, intro, align = 'left' }: { eyebrow?: string; title: string; intro?: string; align?: 'left' | 'center' }) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{title}</h2>
      {intro && <p className="mt-3 text-muted">{intro}</p>}
    </div>
  );
}
