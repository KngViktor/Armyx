import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BellRing, Calendar, HeartHandshake, MapPin, Megaphone, Newspaper, PhoneCall, UserPlus } from 'lucide-react';
import { getContent, formatDate, NEWS_CATEGORY_LABELS } from '@/lib/content';
import { RecruitmentStatus } from '@/components/site/RecruitmentStatus';
import { SectionHeading } from '@/components/site/PageHero';

export const dynamic = 'force-static';

const QUICK = [
  { title: 'Join the Army', text: 'Eligibility, how to apply and the online portal.', href: '/join', Icon: UserPlus },
  { title: 'News & Operations', text: 'Press releases, galleries and events.', href: '/news', Icon: Newspaper },
  { title: 'Welfare & Services', text: 'Support for personnel, veterans and families.', href: '/welfare', Icon: HeartHandshake },
  { title: 'Contact Us', text: 'Headquarters, emergency lines and enquiries.', href: '/contact', Icon: PhoneCall },
];

export default async function HomePage() {
  const c = await getContent();
  const news = [...c.news].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const [lead, ...rest] = news;
  const today = new Date().toISOString().slice(0, 10);
  const events = c.events.filter((e) => (e.endDate ?? e.date) >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);

  return (
    <>
      {/* ------------------------------------------------ hero */}
      <section className="relative isolate overflow-hidden bg-olive-950 text-white">
        <Image src="/images/parade-line.jpg" alt="Soldiers of the Nigerian Army standing in formation at a guard of honour" fill priority sizes="100vw" className="-z-10 object-cover object-center opacity-60" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-olive-950 via-olive-950/80 to-olive-950/20" />
        <div className="container-x grid gap-10 pt-16 pb-36 sm:pt-24 lg:grid-cols-12 lg:pb-44">
          <div className="lg:col-span-7">
            <p className="inline-flex items-center gap-2 rounded-full border border-gold-500/60 bg-olive-950/60 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-gold-300 uppercase">
              Nigerian Army · Est. 1863
            </p>
            <h1 className="mt-6 font-serif text-4xl leading-tight font-bold text-white sm:text-6xl">{c.settings.heroTitle}</h1>
            <p className="mt-5 max-w-xl text-lg text-khaki-100">{c.settings.heroSubtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/join" className="btn-gold">Join the Army <ArrowRight aria-hidden className="h-4 w-4" /></Link>
              <Link href="/news" className="btn-ghost-light">Latest News</Link>
              <Link href="/contact" className="btn-ghost-light">Contact Us</Link>
            </div>
          </div>
          <div className="self-end lg:col-span-5">
            <figure className="rounded-xl border border-white/15 bg-olive-950/70 p-6 backdrop-blur">
              <p className="text-xs font-semibold tracking-[0.2em] text-gold-300 uppercase">Our mission</p>
              <blockquote className="mt-3 font-serif text-lg leading-relaxed text-white">“{c.settings.mission}”</blockquote>
              <figcaption className="mt-4 border-t border-white/10 pt-3"><RecruitmentStatus variant="inline" /></figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ quick links (overlap hero) */}
      <section aria-label="Quick links" className="relative z-10 -mt-24 lg:-mt-28">
        <div className="container-x grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK.map(({ title, text, href, Icon }) => (
            <Link key={href} href={href} className="card group flex flex-col p-6 transition hover:-translate-y-1 hover:border-gold-500">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-olive-50 text-olive-700 group-hover:bg-olive-700 group-hover:text-gold-300">
                <Icon aria-hidden className="h-6 w-6" />
              </span>
              <span className="mt-4 font-serif text-xl font-semibold text-olive-900">{title}</span>
              <span className="mt-1 flex-1 text-sm text-muted">{text}</span>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-olive-700">Explore <ArrowRight aria-hidden className="h-4 w-4 transition group-hover:translate-x-1" /></span>
            </Link>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ news strip */}
      <section aria-label="Headlines" className="mt-12 border-y border-olive-100 bg-sand">
        <div className="container-x flex items-center gap-4 py-3">
          <span className="badge shrink-0 bg-olive-800 text-white"><Megaphone aria-hidden className="mr-1 h-3.5 w-3.5" /> Latest</span>
          <ul className="flex min-w-0 gap-8 overflow-x-auto text-sm whitespace-nowrap [scrollbar-width:none]">
            {news.slice(0, 5).map((n) => (
              <li key={n.slug}><Link href={`/news/${n.slug}`} className="font-medium text-olive-900 hover:underline">{n.title}</Link></li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------ announcements + recruitment */}
      <section className="container-x grid gap-10 py-16 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <SectionHeading eyebrow="Notices" title="Latest announcements" />
          <ul className="mt-8 space-y-4">
            {c.announcements.map((a) => (
              <li key={a.id} className={`card flex gap-4 p-5 ${a.urgent ? 'border-l-4 border-l-gold-500' : ''}`}>
                <BellRing aria-hidden className={`mt-1 h-5 w-5 shrink-0 ${a.urgent ? 'text-gold-600' : 'text-olive-600'}`} />
                <div className="min-w-0">
                  <p className="text-xs text-muted"><time dateTime={a.date}>{formatDate(a.date)}</time>{a.urgent && <span className="badge ml-2 bg-gold-500 text-olive-950">Important</span>}</p>
                  <p className="mt-1 font-semibold text-olive-900">{a.href ? <Link href={a.href} className="hover:underline">{a.title}</Link> : a.title}</p>
                  <p className="mt-1 text-sm text-muted">{a.summary}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <aside className="space-y-6 lg:col-span-4">
          <RecruitmentStatus />
          <div className="card p-5">
            <p className="font-semibold text-olive-900">Emergency lines</p>
            <ul className="mt-3 space-y-2 text-sm">
              {c.settings.emergencyLines.map((l) => (
                <li key={l.label} className="flex justify-between gap-3"><span className="text-muted">{l.label}</span><a className="font-semibold whitespace-nowrap text-olive-800 hover:underline" href={`tel:${l.number.replace(/[^\d+]/g, '')}`}>{l.number}</a></li>
              ))}
            </ul>
          </div>
        </aside>
      </section>

      {/* ------------------------------------------------ news */}
      <section className="bg-olive-50/60 py-16">
        <div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading eyebrow="Operations & News" title="From the newsroom" />
            <Link href="/news" className="btn-outline">All press releases <ArrowRight aria-hidden className="h-4 w-4" /></Link>
          </div>
          {lead && (
            <div className="mt-10 grid gap-6 lg:grid-cols-12">
              <Link href={`/news/${lead.slug}`} className="card group overflow-hidden lg:col-span-7">
                <div className="relative aspect-[16/9]">
                  <Image src={lead.image} alt="" fill sizes="(min-width:1024px) 60vw, 100vw" className="object-cover transition group-hover:scale-[1.02]" />
                </div>
                <div className="p-6">
                  <p className="text-xs font-semibold tracking-wide text-olive-600 uppercase">{NEWS_CATEGORY_LABELS[lead.category]} · <time dateTime={lead.publishedAt}>{formatDate(lead.publishedAt)}</time></p>
                  <h3 className="mt-2 text-2xl font-semibold group-hover:underline">{lead.title}</h3>
                  <p className="mt-2 text-muted">{lead.excerpt}</p>
                </div>
              </Link>
              <ul className="grid gap-4 lg:col-span-5">
                {rest.slice(0, 4).map((n) => (
                  <li key={n.slug}>
                    <Link href={`/news/${n.slug}`} className="card group flex gap-4 overflow-hidden p-3">
                      <span className="relative h-24 w-32 shrink-0 overflow-hidden rounded-md">
                        <Image src={n.image} alt="" fill sizes="128px" className="object-cover" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs text-muted"><time dateTime={n.publishedAt}>{formatDate(n.publishedAt)}</time></span>
                        <span className="mt-1 line-clamp-3 block font-semibold text-olive-900 group-hover:underline">{n.title}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------ values + events */}
      <section className="container-x grid gap-12 py-16 lg:grid-cols-2">
        <div>
          <SectionHeading eyebrow="Who we are" title="Core values" intro={c.settings.vision} />
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {c.settings.coreValues.map((v, i) => (
              <li key={v.title} className="rounded-lg border border-olive-100 p-4">
                <p className="font-serif text-2xl font-bold text-gold-600" aria-hidden>{String(i + 1).padStart(2, '0')}</p>
                <p className="mt-1 font-semibold text-olive-900">{v.title}</p>
                <p className="mt-1 text-sm text-muted">{v.text}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="flex items-end justify-between gap-4">
            <SectionHeading eyebrow="Calendar" title="Upcoming events" />
            <Link href="/news/events" className="text-sm font-semibold text-olive-700 hover:underline">Full calendar</Link>
          </div>
          <ul className="mt-8 space-y-3">
            {events.map((e) => {
              const d = new Date(e.date + 'T00:00:00Z');
              return (
                <li key={e.slug} className="card flex gap-4 p-4">
                  <span className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-olive-800 text-white">
                    <span className="text-xs tracking-wide text-gold-300 uppercase">{d.toLocaleDateString('en-NG', { month: 'short', timeZone: 'UTC' })}</span>
                    <span className="font-serif text-2xl font-bold">{d.getUTCDate()}</span>
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-olive-900">{e.title}</p>
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted"><MapPin aria-hidden className="h-4 w-4" />{e.location}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted"><Calendar aria-hidden className="h-3.5 w-3.5" />{formatDate(e.date)}{e.endDate && ` – ${formatDate(e.endDate)}`}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------ CTA */}
      <section className="relative isolate overflow-hidden bg-olive-800">
        <Image src="/images/recruits-helmets.jpg" alt="" fill sizes="100vw" className="-z-10 object-cover opacity-25" />
        <div className="container-x flex flex-col items-start gap-6 py-16 text-white md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-gold-300 uppercase">Serve your nation</p>
            <h2 className="mt-2 max-w-xl text-3xl font-bold text-white sm:text-4xl">Ready to answer the call?</h2>
            <p className="mt-2 max-w-xl text-khaki-100">Check the eligibility requirements, prepare your documents and apply online. It is free.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/join/eligibility" className="btn-ghost-light">Eligibility</Link>
            <Link href="/portal/register" className="btn-gold">Apply online <ArrowRight aria-hidden className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>
    </>
  );
}
