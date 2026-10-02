import { Mail, MapPin, Phone, Siren } from 'lucide-react';
import { getContent } from '@/lib/content';
import { PageHero } from '@/components/site/PageHero';
import { ContactForm } from '@/components/site/ContactForm';

export const dynamic = 'force-static';
export const metadata = { title: 'Contact Us', description: 'Contact Army Headquarters: address, phone, email and emergency lines.' };

export default async function ContactPage() {
  const { settings } = await getContent();
  return (
    <>
      <PageHero title="Contact us" intro="Reach Army Headquarters, report an emergency or send us an enquiry." eyebrow="Contact" crumbs={[{ label: 'Contact Us' }]} image="/images/officers-walking.jpg" />
      <section className="container-x grid gap-10 py-16 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-xl bg-danger p-6 text-white">
            <p className="flex items-center gap-2 font-semibold"><Siren aria-hidden className="h-5 w-5" /> Emergency lines</p>
            <ul className="mt-3 space-y-2">
              {settings.emergencyLines.map((l) => (
                <li key={l.label} className="flex flex-wrap justify-between gap-2"><span>{l.label}</span><a className="font-bold underline" href={`tel:${l.number.replace(/[^\d+]/g, '')}`}>{l.number}</a></li>
              ))}
            </ul>
          </div>
          <div className="card space-y-4 p-6">
            <h2 className="text-xl font-semibold">Army Headquarters</h2>
            <p className="flex gap-3"><MapPin aria-hidden className="h-5 w-5 shrink-0 text-olive-600" />{settings.hq.address}</p>
            {settings.hq.phones.map((p) => <p key={p} className="flex gap-3"><Phone aria-hidden className="h-5 w-5 shrink-0 text-olive-600" /><a className="hover:underline" href={`tel:${p.replace(/[^\d+]/g, '')}`}>{p}</a></p>)}
            <p className="flex gap-3"><Mail aria-hidden className="h-5 w-5 shrink-0 text-olive-600" /><a className="hover:underline" href={`mailto:${settings.hq.email}`}>{settings.hq.email}</a></p>
          </div>
          <div className="overflow-hidden rounded-xl border border-olive-100">
            <iframe title="Map showing Army Headquarters, Abuja" src={settings.hq.mapEmbed} className="h-72 w-full" loading="lazy" referrerPolicy="no-referrer" />
          </div>
        </div>
        <div className="card p-6 sm:p-8 lg:col-span-7">
          <h2 className="text-2xl font-bold">Send us a message</h2>
          <p className="mt-1 mb-6 text-sm text-muted">We aim to respond within 5 working days. Messages are handled under our privacy notice.</p>
          <ContactForm />
        </div>
      </section>
    </>
  );
}
