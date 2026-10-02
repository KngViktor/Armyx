import Image from 'next/image';
import Link from 'next/link';
import { Mail, MapPin, Phone } from 'lucide-react';
import { NAV } from '@/lib/nav';
import { getContent } from '@/lib/content';

export async function Footer() {
  const { settings } = await getContent();
  return (
    <footer className="mt-auto bg-olive-950 text-khaki-100">
      <div className="h-1 bg-gradient-to-r from-olive-700 via-gold-500 to-olive-700" />
      <div className="container-x grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="flex items-center gap-3">
            <Image src="/images/crest.png" alt="" width={56} height={56} className="h-14 w-14 rounded-full" />
            <div>
              <p className="font-serif text-xl font-bold text-white">NIGERIAN ARMY</p>
              <p className="text-xs tracking-[0.2em] text-gold-300 uppercase">{settings.motto}</p>
            </div>
          </div>
          <p className="mt-5 max-w-sm text-sm leading-6 text-khaki-100/90">{settings.mission}</p>
          <p className="mt-5 rounded-md border border-gold-500/40 bg-gold-500/10 p-3 text-sm text-gold-300">
            Recruitment is <strong>free of charge</strong>. Report anyone who asks you for money.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-5">
          {NAV.filter((n) => n.groups).slice(0, 3).map((n) => (
            <div key={n.label}>
              <p className="font-semibold text-white">{n.label}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {n.groups!.flatMap((g) => g.links).slice(0, 5).map((l) => (
                  <li key={l.href}><Link href={l.href} className="hover:text-white hover:underline">{l.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="lg:col-span-3">
          <p className="font-semibold text-white">Army Headquarters</p>
          <ul className="mt-3 space-y-3 text-sm">
            <li className="flex gap-2"><MapPin aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />{settings.hq.address}</li>
            <li className="flex gap-2"><Phone aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />{settings.hq.phones[0]}</li>
            <li className="flex gap-2"><Mail aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" /><a className="hover:underline" href={`mailto:${settings.hq.email}`}>{settings.hq.email}</a></li>
          </ul>
          <ul className="mt-5 flex flex-wrap gap-3 text-sm">
            {settings.social.map((s) => (
              <li key={s.label}><a href={s.href} rel="noopener noreferrer" target="_blank" className="rounded border border-white/20 px-2.5 py-1 hover:bg-white/10">{s.label}</a></li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-3 py-5 text-xs text-khaki-100/80 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Nigerian Army. All rights reserved.</p>
          <ul className="flex flex-wrap gap-4">
            <li><Link href="/privacy" className="hover:text-white">Privacy notice (NDPA 2023)</Link></li>
            <li><Link href="/accessibility" className="hover:text-white">Accessibility</Link></li>
            <li><Link href="/resources/policies" className="hover:text-white">Policies</Link></li>
            <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
