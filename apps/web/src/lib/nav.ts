/** Primary navigation + mega-menu structure (used by header, footer and sitemap). */
export interface NavLink {
  label: string;
  href: string;
  description?: string;
}
export interface NavItem {
  label: string;
  href: string;
  groups?: { title: string; links: NavLink[] }[];
  feature?: { title: string; text: string; href: string; image: string; cta: string };
}

export const NAV: NavItem[] = [
  { label: 'Home', href: '/' },
  {
    label: 'About Us',
    href: '/about',
    groups: [
      {
        title: 'Who we are',
        links: [
          { label: 'History', href: '/about/history', description: 'From 1863 to a modern force' },
          { label: 'Vision, Mission & Values', href: '/about#mission', description: 'What guides every soldier' },
          { label: 'Chief of Army Staff', href: '/about/leadership', description: 'Profile of the COAS' },
        ],
      },
      {
        title: 'Structure',
        links: [
          { label: 'Organisation Chart', href: '/about/organisation', description: 'Interactive command structure' },
          { label: 'Ranks & Insignia', href: '/about/ranks', description: 'Officers and soldiers' },
        ],
      },
    ],
    feature: { title: 'Victory is from God alone', text: 'Discover the proud heritage of the Nigerian Army.', href: '/about/history', image: '/images/officers-walking.jpg', cta: 'Read our history' },
  },
  {
    label: 'Join the Army',
    href: '/join',
    groups: [
      {
        title: 'Recruitment',
        links: [
          { label: 'Eligibility Requirements', href: '/join/eligibility', description: 'Age, height, education' },
          { label: 'How to Apply', href: '/join/how-to-apply', description: 'Step-by-step guide' },
          { label: 'Apply Online', href: '/portal', description: 'Recruitment portal' },
        ],
      },
      {
        title: 'Training & help',
        links: [
          { label: 'Training Institutions', href: '/join/institutions', description: 'Depot, NDA and corps schools' },
          { label: 'Frequently Asked Questions', href: '/join/faqs', description: 'Searchable answers' },
          { label: 'Verify a Slip', href: '/verify', description: 'Check an acknowledgement slip' },
        ],
      },
    ],
    feature: { title: 'Recruitment is FREE', text: 'Never pay anyone for forms or slots. Apply only through this website.', href: '/join/how-to-apply', image: '/images/recruits-helmets.jpg', cta: 'Start your journey' },
  },
  {
    label: 'Operations & News',
    href: '/news',
    groups: [
      {
        title: 'Newsroom',
        links: [
          { label: 'Press Releases', href: '/news', description: 'Search official statements' },
          { label: 'Photo & Video Gallery', href: '/news/gallery', description: 'Images from the field' },
          { label: 'Events Calendar', href: '/news/events', description: 'Ceremonies and exercises' },
        ],
      },
    ],
    feature: { title: 'Army Day Celebration', text: 'Highlights from NADCEL parades and community projects.', href: '/news/gallery', image: '/images/armoured-vehicle.jpg', cta: 'View gallery' },
  },
  {
    label: 'Welfare & Services',
    href: '/welfare',
    groups: [
      {
        title: 'Support for',
        links: [
          { label: 'Serving Personnel', href: '/welfare/serving-personnel', description: 'Healthcare, housing, insurance' },
          { label: 'Veterans', href: '/welfare/veterans', description: 'Pensions and resettlement' },
          { label: 'Families', href: '/welfare/families', description: 'Schools, healthcare, support' },
        ],
      },
    ],
  },
  {
    label: 'Resources',
    href: '/resources',
    groups: [
      {
        title: 'Documents',
        links: [
          { label: 'Downloads Library', href: '/resources', description: 'Forms and publications' },
          { label: 'Tenders & Procurement', href: '/resources/tenders', description: 'Open invitations and status' },
          { label: 'Policies', href: '/resources/policies', description: 'Privacy, FOI, human rights' },
        ],
      },
    ],
  },
  { label: 'Contact', href: '/contact' },
];
