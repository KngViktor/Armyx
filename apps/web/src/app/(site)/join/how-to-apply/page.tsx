import Link from 'next/link';
import { PageHero } from '@/components/site/PageHero';
import { Alert } from '@/components/ui/Alert';

export const dynamic = 'force-static';
export const metadata = { title: 'How to Apply', description: 'Step-by-step guide to applying online to join the Nigerian Army.' };

const STEPS = [
  { t: 'Create an account', d: 'Register with your name, a valid email address and Nigerian mobile number. Choose a strong password.', link: { href: '/portal/register', label: 'Register' } },
  { t: 'Verify your email and phone', d: 'Enter the 6-digit codes sent to your email and by SMS. Codes expire after 10 minutes.' },
  { t: 'Complete the application form', d: 'Six short sections: personal details, state of origin and LGA, education, physical details, next of kin and choice of entry. Every section is saved automatically.' },
  { t: 'Upload your documents', d: 'Passport photograph (JPG/PNG, max 500KB), O-Level result, birth certificate and certificate of state of origin (PDF/JPG/PNG, max 2MB each).' },
  { t: 'Check eligibility and preview', d: 'The portal checks the eligibility rules and shows a full preview. Correct anything before you submit — you cannot edit after submission.' },
  { t: 'Submit and print your slip', d: 'You receive a unique application number immediately. Download and print your acknowledgement slip with QR code.' },
  { t: 'Track your status', d: 'Sign in at any time to see your status. Shortlisted candidates see their screening venue and date, and receive email and SMS notifications.' },
];

export default function HowToApplyPage() {
  return (
    <>
      <PageHero title="How to apply" intro="Applying takes about 20 minutes. Have your documents ready before you start." eyebrow="Join the Army" crumbs={[{ label: 'Join the Army', href: '/join' }, { label: 'How to Apply' }]} image="/images/soldier-truck.jpg" />
      <section className="container-x grid gap-10 py-16 lg:grid-cols-12">
        <ol className="space-y-6 lg:col-span-8">
          {STEPS.map((s, i) => (
            <li key={s.t} className="card flex gap-5 p-6">
              <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-olive-800 font-serif text-xl font-bold text-gold-300">{i + 1}</span>
              <div>
                <h2 className="text-xl font-semibold">{s.t}</h2>
                <p className="mt-1 text-muted">{s.d}</p>
                {s.link && <Link href={s.link.href} className="mt-3 inline-block font-semibold text-olive-700 underline">{s.link.label}</Link>}
              </div>
            </li>
          ))}
        </ol>
        <aside className="space-y-4 lg:col-span-4">
          <Alert tone="warning" title="Beware of fraudsters">Recruitment is free. Nobody can sell you a slot. Apply only on this website.</Alert>
          <Alert tone="info" title="High demand">When the portal opens, traffic is very high. If you see a queue message, keep the page open — you will be let in automatically and your progress is saved.</Alert>
          <Link href="/portal/register" className="btn-gold w-full">Start your application</Link>
        </aside>
      </section>
    </>
  );
}
