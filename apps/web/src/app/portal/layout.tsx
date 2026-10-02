import type { Metadata } from 'next';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { QueueBanner } from '@/components/ui/QueueBanner';

export const metadata: Metadata = { title: { default: 'Recruitment Portal', template: '%s | Recruitment Portal' }, robots: { index: false } };

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div className="border-b border-olive-100 bg-sand">
        <div className="container-x flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
          <p className="font-serif text-lg font-semibold text-olive-900">Online Recruitment Portal</p>
          <p className="text-muted">Recruitment is <strong className="text-olive-900">free</strong>. Never pay anyone.</p>
        </div>
      </div>
      <main id="main" className="flex-1 bg-olive-50/40">{children}</main>
      <QueueBanner />
      <Footer />
    </>
  );
}
