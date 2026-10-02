import { Suspense } from 'react';
import { PageHero } from '@/components/site/PageHero';
import { VerifySlip } from '@/components/site/VerifySlip';

export const dynamic = 'force-static';
export const metadata = { title: 'Verify an Acknowledgement Slip', description: 'Check that a recruitment acknowledgement slip is genuine.' };

export default function VerifyPage() {
  return (
    <>
      <PageHero title="Verify a slip" intro="Scan the QR code on an acknowledgement slip to confirm it was issued by the recruitment portal." crumbs={[{ label: 'Join the Army', href: '/join' }, { label: 'Verify a slip' }]} />
      <section className="container-x max-w-2xl py-16"><Suspense><VerifySlip /></Suspense></section>
    </>
  );
}
