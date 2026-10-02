'use client';
/**
 * Sticky header with the official crest and an accessible mega menu.
 * Desktop: menus open on hover or keyboard (Enter/Space/ArrowDown), close on
 * Escape or focus leaving. Mobile/tablet: full-height drawer with accordions.
 */
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Menu, Phone, X, ShieldCheck, ArrowRight } from 'lucide-react';
import { NAV } from '@/lib/nav';

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [mobileSection, setMobileSection] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setOpen(null);
    setMobile(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(null);
        setMobile(false);
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobile ? 'hidden' : '';
  }, [mobile]);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const hover = (label: string | null) => {
    clearTimeout(closeTimer.current);
    if (label === null) closeTimer.current = setTimeout(() => setOpen(null), 120);
    else setOpen(label);
  };

  return (
    <>
      {/* Utility bar */}
      <div className="bg-olive-950 text-xs text-khaki-100">
        <div className="container-x flex h-9 items-center justify-between gap-4">
          <p className="flex items-center gap-1.5 truncate">
            <ShieldCheck aria-hidden className="h-3.5 w-3.5 text-gold-500" />
            <span className="truncate">Official website of the Nigerian Army</span>
          </p>
          <div className="flex shrink-0 items-center gap-4">
            <a href="tel:193" className="hidden items-center gap-1 hover:text-white sm:flex">
              <Phone aria-hidden className="h-3.5 w-3.5" /> Emergency: <strong className="text-gold-300">193</strong>
            </a>
            <Link href="/portal/login" className="hover:text-white">Applicant login</Link>
          </div>
        </div>
      </div>

      <header className={`sticky top-0 z-50 border-b border-olive-800 bg-olive-800 text-white transition-shadow ${scrolled ? 'shadow-lg' : ''}`}>
        <div className="container-x flex h-18 items-center justify-between gap-4 py-2">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Nigerian Army — home">
            <Image src="/images/crest.png" alt="" width={52} height={52} priority className="h-12 w-12 shrink-0 rounded-full ring-2 ring-gold-500/60" />
            <span className="min-w-0 leading-tight">
              <span className="block font-serif text-lg font-bold tracking-wide sm:text-xl">NIGERIAN ARMY</span>
              <span className="block truncate text-[11px] tracking-[0.2em] text-gold-300 uppercase">Victory is from God alone</span>
            </span>
          </Link>

          <nav ref={navRef} aria-label="Main" className="hidden xl:block" onMouseLeave={() => hover(null)}>
            <ul className="flex items-center gap-1">
              {NAV.filter((i) => i.href !== '/').map((item) => (
                <li key={item.label} className="relative" onMouseEnter={() => item.groups && hover(item.label)}>
                  {item.groups ? (
                    <button
                      type="button"
                      aria-expanded={open === item.label}
                      aria-controls={`mega-${item.label}`}
                      onClick={() => setOpen(open === item.label ? null : item.label)}
                      onKeyDown={(e) => e.key === 'ArrowDown' && setOpen(item.label)}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap hover:bg-white/10 ${isActive(item.href) ? 'text-gold-300' : ''}`}
                    >
                      {item.label}
                      <ChevronDown aria-hidden className={`h-4 w-4 transition-transform ${open === item.label ? 'rotate-180' : ''}`} />
                    </button>
                  ) : (
                    <Link
                      href={item.href}
                      aria-current={isActive(item.href) ? 'page' : undefined}
                      className={`block rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap hover:bg-white/10 ${isActive(item.href) ? 'text-gold-300' : ''}`}
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            {NAV.filter((i) => i.groups).map((item) => (
              <div
                key={item.label}
                id={`mega-${item.label}`}
                hidden={open !== item.label}
                onMouseEnter={() => hover(item.label)}
                onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOpen(null)}
                className="absolute inset-x-0 top-full border-t-4 border-gold-500 bg-white text-ink shadow-2xl"
              >
                <div className="container-x grid grid-cols-12 gap-8 py-8">
                  <div className="col-span-3">
                    <p className="eyebrow">{item.label}</p>
                    <Link href={item.href} className="mt-3 inline-flex items-center gap-2 font-serif text-2xl font-semibold text-olive-900 hover:underline">
                      Overview <ArrowRight aria-hidden className="h-5 w-5" />
                    </Link>
                  </div>
                  <div className={`${item.feature ? 'col-span-6' : 'col-span-9'} grid grid-cols-2 gap-6`}>
                    {item.groups!.map((g) => (
                      <div key={g.title}>
                        <p className="mb-2 text-xs font-semibold tracking-widest text-muted uppercase">{g.title}</p>
                        <ul className="space-y-1">
                          {g.links.map((l) => (
                            <li key={l.href}>
                              <Link href={l.href} className="group block rounded-md p-2 hover:bg-olive-50">
                                <span className="font-semibold text-olive-800 group-hover:underline">{l.label}</span>
                                {l.description && <span className="block text-sm text-muted">{l.description}</span>}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  {item.feature && (
                    <Link href={item.feature.href} className="group relative col-span-3 overflow-hidden rounded-xl">
                      <Image src={item.feature.image} alt="" fill sizes="300px" className="object-cover transition-transform group-hover:scale-105" />
                      <span className="absolute inset-0 bg-gradient-to-t from-olive-950/95 via-olive-950/40 to-transparent" />
                      <span className="relative flex h-full min-h-48 flex-col justify-end p-5 text-white">
                        <span className="font-serif text-lg font-semibold">{item.feature.title}</span>
                        <span className="mt-1 text-sm text-khaki-100">{item.feature.text}</span>
                        <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-gold-300">{item.feature.cta} <ArrowRight aria-hidden className="h-4 w-4" /></span>
                      </span>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/portal" className="btn-gold hidden whitespace-nowrap sm:inline-flex">Apply Now</Link>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-white/10 xl:hidden"
              aria-expanded={mobile}
              aria-controls="mobile-nav"
              aria-label={mobile ? 'Close menu' : 'Open menu'}
              onClick={() => setMobile(!mobile)}
            >
              {mobile ? <X aria-hidden /> : <Menu aria-hidden />}
            </button>
          </div>
        </div>

        {/* Mobile / tablet drawer */}
        <div id="mobile-nav" hidden={!mobile} className="fixed inset-x-0 top-[calc(4.5rem+2.25rem)] bottom-0 overflow-y-auto bg-olive-900 xl:hidden">
          <nav aria-label="Mobile" className="container-x py-4">
            <ul className="divide-y divide-white/10">
              {NAV.map((item) => (
                <li key={item.label}>
                  {item.groups ? (
                    <>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between py-4 text-left text-base font-semibold"
                        aria-expanded={mobileSection === item.label}
                        onClick={() => setMobileSection(mobileSection === item.label ? null : item.label)}
                      >
                        {item.label}
                        <ChevronDown aria-hidden className={`h-5 w-5 transition-transform ${mobileSection === item.label ? 'rotate-180' : ''}`} />
                      </button>
                      <ul hidden={mobileSection !== item.label} className="pb-4">
                        <li><Link href={item.href} className="block rounded py-2 pl-3 text-gold-300">Overview</Link></li>
                        {item.groups.flatMap((g) => g.links).map((l) => (
                          <li key={l.href}><Link href={l.href} className="block rounded py-2 pl-3 text-khaki-100 hover:text-white">{l.label}</Link></li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <Link href={item.href} className="block py-4 text-base font-semibold">{item.label}</Link>
                  )}
                </li>
              ))}
            </ul>
            <Link href="/portal" className="btn-gold mt-6 w-full">Apply Now — it&apos;s free</Link>
          </nav>
        </div>
      </header>
    </>
  );
}
