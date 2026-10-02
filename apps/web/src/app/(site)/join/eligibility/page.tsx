import Link from 'next/link';
import { Check } from 'lucide-react';
import { DEFAULT_RULES, ENTRY_TYPE_LABELS, ENTRY_TYPES, QUALIFICATION_LABELS } from '@armyx/shared';
import { PageHero } from '@/components/site/PageHero';
import { Alert } from '@/components/ui/Alert';

export const dynamic = 'force-static';
export const metadata = { title: 'Eligibility Requirements', description: 'Who can apply to join the Nigerian Army: age, height, education and other requirements.' };

const GENERAL = [
  'Be a Nigerian citizen by birth with a valid National Identification Number (NIN).',
  'Be medically, physically and mentally fit.',
  'Not have been convicted of any criminal offence.',
  'Possess a certificate of state of origin and a birth certificate or age declaration.',
  'Not be a member of any secret society or cult.',
];

export default function EligibilityPage() {
  return (
    <>
      <PageHero title="Eligibility requirements" intro="Make sure you qualify before you apply. The portal checks these rules automatically." eyebrow="Join the Army" crumbs={[{ label: 'Join the Army', href: '/join' }, { label: 'Eligibility' }]} />
      <section className="container-x py-16">
        <Alert tone="info" title="Requirements may change per exercise">
          The figures below are the standard requirements. The exact rules for each recruitment exercise are set by the Army and shown in the portal, which blocks applications that do not meet them.
        </Alert>
        <div className="mt-10 grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 className="text-2xl font-bold">General requirements</h2>
            <ul className="mt-5 space-y-3">
              {GENERAL.map((g) => (
                <li key={g} className="flex gap-3"><Check aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-success" />{g}</li>
              ))}
            </ul>
          </div>
          <div className="overflow-x-auto lg:col-span-7">
            <h2 className="text-2xl font-bold">By entry type</h2>
            <table className="mt-5 w-full min-w-[560px] border-collapse text-left text-sm">
              <caption className="sr-only">Eligibility requirements by entry type</caption>
              <thead>
                <tr className="bg-olive-800 text-white">
                  <th scope="col" className="p-3">Requirement</th>
                  {ENTRY_TYPES.map((t) => <th key={t} scope="col" className="p-3">{ENTRY_TYPE_LABELS[t]}</th>)}
                </tr>
              </thead>
              <tbody className="[&_tr:nth-child(even)]:bg-olive-50">
                {[
                  ['Age (years)', (t: keyof typeof DEFAULT_RULES) => `${DEFAULT_RULES[t].minAge} – ${DEFAULT_RULES[t].maxAge}`],
                  ['Minimum height (male)', (t: keyof typeof DEFAULT_RULES) => `${(DEFAULT_RULES[t].minHeightMaleCm / 100).toFixed(2)} m`],
                  ['Minimum height (female)', (t: keyof typeof DEFAULT_RULES) => `${(DEFAULT_RULES[t].minHeightFemaleCm / 100).toFixed(2)} m`],
                  ['Minimum qualification', (t: keyof typeof DEFAULT_RULES) => QUALIFICATION_LABELS[DEFAULT_RULES[t].minQualification]],
                  ['O-Level credits', (t: keyof typeof DEFAULT_RULES) => `${DEFAULT_RULES[t].minCredits} incl. English & Maths, max ${DEFAULT_RULES[t].maxSittings} sittings`],
                  ['Marital status', (t: keyof typeof DEFAULT_RULES) => (DEFAULT_RULES[t].singleOnly ? 'Single' : 'Any')],
                ].map(([label, fn]) => (
                  <tr key={label as string} className="border-b border-olive-100">
                    <th scope="row" className="p-3 font-semibold text-olive-900">{label as string}</th>
                    {ENTRY_TYPES.map((t) => <td key={t} className="p-3">{(fn as (t: keyof typeof DEFAULT_RULES) => string)(t)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted">Age is calculated as at the closing date of the exercise.</p>
          </div>
        </div>
        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/portal/register" className="btn-primary">I meet the requirements — apply</Link>
          <Link href="/join/how-to-apply" className="btn-outline">How to apply</Link>
        </div>
      </section>
    </>
  );
}
