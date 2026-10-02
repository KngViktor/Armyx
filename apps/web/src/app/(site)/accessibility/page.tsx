import { PageHero } from '@/components/site/PageHero';

export const dynamic = 'force-static';
export const metadata = { title: 'Accessibility', description: 'Accessibility statement for the Nigerian Army website.' };

export default function AccessibilityPage() {
  return (
    <>
      <PageHero title="Accessibility statement" intro="We want everyone to be able to use this website." crumbs={[{ label: 'Accessibility' }]} />
      <section className="prose-army container-x max-w-3xl py-16">
        <p>This website aims to meet the Web Content Accessibility Guidelines (WCAG) 2.1 level AA. You should be able to navigate with a keyboard alone, use a screen reader, zoom to 200% without loss of content, and use the site on mobile phones, tablets and desktops.</p>
        <p>Measures include: semantic HTML landmarks and headings, a “skip to main content” link, visible focus indicators, text alternatives for images, form fields with associated labels and error messages, sufficient colour contrast, and respect for “reduced motion” settings.</p>
        <p>If you find a barrier, contact us through the contact page and tell us the page address and the problem. We will respond within 10 working days.</p>
      </section>
    </>
  );
}
