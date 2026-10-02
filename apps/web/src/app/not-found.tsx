import Link from 'next/link';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" className="container-x flex flex-1 flex-col items-center justify-center py-24 text-center">
        <p className="font-serif text-7xl font-bold text-gold-600">404</p>
        <h1 className="mt-4 text-3xl font-bold">Page not found</h1>
        <p className="mt-2 text-muted">The page you are looking for does not exist or has moved.</p>
        <div className="mt-8 flex gap-3"><Link href="/" className="btn-primary">Go home</Link><Link href="/contact" className="btn-outline">Contact us</Link></div>
      </main>
      <Footer />
    </>
  );
}
