import type { Metadata, Viewport } from 'next';
import './globals.css';

const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: 'Nigerian Army — Official Website', template: '%s | Nigerian Army' },
  description: 'Official website of the Nigerian Army: news, operations, welfare, resources and the online recruitment portal. Recruitment is free.',
  openGraph: { type: 'website', siteName: 'Nigerian Army', images: ['/images/parade-line.jpg'] },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = { themeColor: '#2f3b22', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG">
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="skip-link">Skip to main content</a>
        {children}
      </body>
    </html>
  );
}
