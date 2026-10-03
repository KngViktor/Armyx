import type { Metadata, Viewport } from 'next';
import './globals.css';
import { DemoBanner } from '@/components/site/DemoBanner';

const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: 'Nigerian Army — Official Website', template: '%s | Nigerian Army' },
  description: 'Official website of the Nigerian Army: news, operations, welfare, resources and the online recruitment portal. Recruitment is free.',
  openGraph: { type: 'website', siteName: 'Nigerian Army', images: ['/images/parade-line.jpg'] },
  twitter: { card: 'summary_large_image' },
  // Demo/preview builds must never be indexed by search engines.
  ...(process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ? { robots: { index: false, follow: false } } : {}),
};

export const viewport: Viewport = { themeColor: '#2f3b22', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG">
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="skip-link">Skip to main content</a>
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}
