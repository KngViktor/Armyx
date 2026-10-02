import { PageHero } from '@/components/site/PageHero';

export const dynamic = 'force-static';
export const metadata = { title: 'Privacy Notice', description: 'How the Nigerian Army processes personal data under the Nigeria Data Protection Act 2023.' };

const SECTIONS: [string, string[]][] = [
  ['Who we are', ['The Nigerian Army, Army Headquarters, Abuja, is the data controller for personal data processed through this website and the recruitment portal. Our Data Protection Officer can be contacted at dpo@army.mil.ng.']],
  ['What we collect', ['Recruitment portal: name, contact details, date of birth, NIN, state of origin and LGA, education, physical details, next of kin, and uploaded documents. Contact form: your name, email, optional phone number and message. Technical data: hashed IP addresses and security logs.']],
  ['Why and on what lawful basis', ['We process recruitment data to assess eligibility and run the recruitment exercise, based on your consent and on the performance of a task carried out in the public interest (NDPA 2023, s.25). Contact data is processed to respond to your enquiry.']],
  ['How we protect it', ['Data is encrypted in transit (TLS) and at rest. Sensitive fields are additionally encrypted at application level. Access is limited by role, protected by two-factor authentication, and every administrative access is recorded in a tamper-evident audit log. Uploaded documents are only accessible via short-lived signed links.']],
  ['How long we keep it', ['Unsuccessful applications are retained for 24 months after the exercise closes, then deleted or anonymised. Unsubmitted drafts are deleted 90 days after the exercise closes. Successful applicants’ data becomes part of their service record.']],
  ['Who we share it with', ['We do not sell personal data. Data may be shared with government agencies for identity and background verification (e.g. NIMC), and with service providers (hosting, SMS and email delivery) under data processing agreements.']],
  ['Your rights', ['You have the right to be informed, to access, rectify and erase your data, to restrict or object to processing, to data portability, and to withdraw consent (NDPA 2023, Part VI). To exercise them contact the DPO. You may also complain to the Nigeria Data Protection Commission (NDPC).']],
];

export default function PrivacyPage() {
  return (
    <>
      <PageHero title="Privacy notice" intro="How we process personal data in line with the Nigeria Data Protection Act 2023." crumbs={[{ label: 'Privacy' }]} />
      <section className="container-x max-w-3xl py-16">
        {SECTIONS.map(([h, ps]) => (
          <div key={h} className="prose-army mb-8">
            <h2 className="mb-3 text-2xl font-bold">{h}</h2>
            {ps.map((p) => <p key={p}>{p}</p>)}
          </div>
        ))}
        <p className="text-sm text-muted">Version 2026-01. This notice must be reviewed by the Army’s DPO before publication.</p>
      </section>
    </>
  );
}
