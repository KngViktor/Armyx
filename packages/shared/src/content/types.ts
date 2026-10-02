/**
 * Content model shared by the CMS (Payload collections mirror these shapes),
 * the web app (renders them statically) and the CMS seed script.
 */
export interface NewsItem {
  slug: string;
  title: string;
  excerpt: string;
  body: string[];
  category: 'press-release' | 'operations' | 'training' | 'civil-military' | 'welfare' | 'sports';
  publishedAt: string;
  image: string;
}
export interface Announcement {
  id: string;
  title: string;
  summary: string;
  date: string;
  href?: string;
  urgent?: boolean;
}
export interface EventItem {
  slug: string;
  title: string;
  date: string;
  endDate?: string;
  location: string;
  description: string;
  category: 'ceremony' | 'recruitment' | 'sports' | 'community' | 'training';
}
export interface GalleryItem {
  id: string;
  type: 'photo' | 'video';
  title: string;
  src: string;
  /** For videos: an embeddable URL (YouTube nocookie). */
  videoUrl?: string;
  date: string;
}
export interface Leader {
  name: string;
  rank: string;
  appointment: string;
  photo: string;
  bio: string[];
}
export interface OrgNode {
  id: string;
  title: string;
  subtitle?: string;
  children?: OrgNode[];
}
export interface Rank {
  name: string;
  abbreviation: string;
  category: 'commissioned' | 'non-commissioned' | 'other';
  /** Rendering hint for the SVG insignia component. */
  insignia: { pips?: number; eagle?: boolean; swords?: boolean; chevrons?: number; crest?: boolean; wreath?: boolean };
  natoCode: string;
}
export interface Institution {
  slug: string;
  name: string;
  location: string;
  state: string;
  type: 'academy' | 'depot' | 'school' | 'college';
  description: string;
  courses: string[];
}
export interface Faq {
  id: string;
  category: 'eligibility' | 'application' | 'documents' | 'screening' | 'training' | 'general';
  question: string;
  answer: string;
}
export interface DownloadItem {
  id: string;
  title: string;
  category: 'forms' | 'publications' | 'reports' | 'policies';
  fileType: 'PDF' | 'DOCX' | 'XLSX';
  sizeKb: number;
  url: string;
  date: string;
}
export interface Tender {
  ref: string;
  title: string;
  category: 'works' | 'goods' | 'services' | 'consultancy';
  publishedAt: string;
  deadline: string;
  status: 'open' | 'closed' | 'awarded' | 'cancelled';
  description: string;
  documentUrl: string;
}
export interface WelfareSection {
  slug: 'serving-personnel' | 'veterans' | 'families';
  title: string;
  intro: string;
  services: { title: string; area: 'healthcare' | 'pension' | 'housing' | 'education' | 'insurance' | 'support'; description: string; contact?: string }[];
}
export interface SiteSettings {
  mission: string;
  vision: string;
  motto: string;
  heroTitle: string;
  heroSubtitle: string;
  hq: { address: string; phones: string[]; email: string; mapEmbed: string };
  emergencyLines: { label: string; number: string }[];
  social: { label: string; href: string }[];
  history: { year: string; title: string; text: string }[];
  coreValues: { title: string; text: string }[];
}
export interface SiteContent {
  settings: SiteSettings;
  news: NewsItem[];
  announcements: Announcement[];
  events: EventItem[];
  gallery: GalleryItem[];
  leadership: Leader[];
  orgChart: OrgNode;
  ranks: Rank[];
  institutions: Institution[];
  faqs: Faq[];
  downloads: DownloadItem[];
  tenders: Tender[];
  policies: DownloadItem[];
  welfare: WelfareSection[];
}
