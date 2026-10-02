import { getContent } from '@/lib/content';
import { PageHero } from '@/components/site/PageHero';
import { EventsCalendar } from '@/components/news/EventsCalendar';

export const dynamic = 'force-static';
export const metadata = { title: 'Events Calendar', description: 'Upcoming Nigerian Army ceremonies, recruitment activities and events.' };

export default async function EventsPage() {
  const { events } = await getContent();
  return (
    <>
      <PageHero title="Events calendar" intro="Ceremonies, recruitment milestones, sports and community activities." eyebrow="Operations & News" crumbs={[{ label: 'News', href: '/news' }, { label: 'Events' }]} />
      <section className="container-x py-16"><EventsCalendar events={events} /></section>
    </>
  );
}
