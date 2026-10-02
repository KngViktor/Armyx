import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BookOpen, ClipboardCheck, GraduationCap, HelpCircle } from 'lucide-react';
import { ENTRY_TYPE_LABELS, ENTRY_TYPES } from '@armyx/shared';
import { PageHero } from '@/components/site/PageHero';
import { RecruitmentStatus } from '@/components/site/RecruitmentStatus';
import { Alert } from '@/components/ui/Alert';

export const dynamic = 'force-static';
export const metadata = { title: 'Join the Army', description: 'Careers in the Nigerian Army: eligibility, how to apply, training institutions and FAQs.' };

const ENTRY_TEXT = {
  regular: 'Enlist as a soldier through the Recruit Intake and train at the Depot Nigerian Army, Zaria.',
  short_service: 'Graduates may be commissioned as officers through the Short Service Commission.',
  specialist: 'Tradesmen and women with skills such as driving, ICT, nursing or catering.',
};

const CARDS = [
  { title: 'Eligibility', text: 'Age, height, qualification and other requirements.', href: '/join/eligibility', Icon: ClipboardCheck },
  { title: 'How to apply', text: 'A step-by-step guide to the online portal.', href: '/join/how-to-apply', Icon: BookOpen },
  { title: 'Training institutions', text: 'Where recruits and officers are trained.', href: '/join/institutions', Icon: GraduationCap },
  { title: 'FAQs', text: 'Answers to the most common questions.', href: '/join/faqs', Icon: HelpCircle },
];

export default function JoinPage() {
  return (
    <>
      <PageHero title="Join the Nigerian Army" intro="Serve your nation with honour. Build a career with training, purpose and opportunity." eyebrow="Careers" crumbs={[{ label: 'Join the Army' }]} image="/images/recruits-helmets.jpg" />
      <section className="container-x grid gap-10 py-16 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-8">
          <Alert tone="warning" title="Recruitment is completely free">
            The Nigerian Army does not sell forms or slots. Apply only through the official portal on this website and report anyone who asks you for money.
          </Alert>
          <div>
            <h2 className="text-3xl font-bold">Ways to join</h2>
            <ul className="mt-6 grid gap-4 md:grid-cols-3">
              {ENTRY_TYPES.map((t) => (
                <li key={t} className="card border-t-4 border-t-olive-700 p-5">
                  <p className="font-serif text-lg font-semibold text-olive-900">{ENTRY_TYPE_LABELS[t]}</p>
                  <p className="mt-2 text-sm text-muted">{ENTRY_TEXT[t]}</p>
                </li>
              ))}
            </ul>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {CARDS.map(({ title, text, href, Icon }) => (
              <li key={href}>
                <Link href={href} className="card group flex gap-4 p-5 hover:border-gold-500">
                  <Icon aria-hidden className="h-8 w-8 shrink-0 text-olive-700" />
                  <span>
                    <span className="block font-semibold text-olive-900 group-hover:underline">{title}</span>
                    <span className="block text-sm text-muted">{text}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <aside className="space-y-6 lg:col-span-4">
          <RecruitmentStatus />
          <div className="card overflow-hidden">
            <div className="relative aspect-video"><Image src="/images/soldier-truck.jpg" alt="" fill sizes="400px" className="object-cover" /></div>
            <div className="p-5">
              <p className="font-semibold">Already applied?</p>
              <p className="mt-1 text-sm text-muted">Sign in to track your status, print your slip and see your screening schedule.</p>
              <Link href="/portal/login" className="btn-outline mt-4 w-full">Applicant login <ArrowRight aria-hidden className="h-4 w-4" /></Link>
            </div>
          </div>
        </aside>
      </section>
    </>
  );
}
