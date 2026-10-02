/**
 * Content collections. Shapes mirror packages/shared/src/content/types.ts so
 * the /api/site-content endpoint can return a SiteContent object directly.
 * Editors work in the CMS; visitors only ever see the statically generated site.
 */
import type { Access, CollectionConfig, Field, GlobalConfig } from 'payload';
import { revalidateHooks } from '../lib/revalidate';

const isAdmin: Access = ({ req }) => (req.user as { role?: string } | null)?.role === 'admin';
const isEditor: Access = ({ req }) => !!req.user;
const publicRead = { read: () => true, create: isEditor, update: isEditor, delete: isAdmin };

const image: Field = { name: 'image', type: 'text', required: true, admin: { description: 'Image path or URL, e.g. /images/parade-line.jpg, or the URL of an uploaded Media item.' } };
const slug: Field = { name: 'slug', type: 'text', required: true, unique: true, index: true, admin: { position: 'sidebar' } };
const date = (name: string, required = true): Field => ({ name, type: 'date', required, admin: { date: { pickerAppearance: 'dayOnly' } } });
const select = (name: string, options: string[], required = true): Field => ({ name, type: 'select', required, options: options.map((o) => ({ label: o, value: o })) });
const base = (slugName: string, useAsTitle: string, fields: Field[], extra: Partial<CollectionConfig> = {}): CollectionConfig => ({
  slug: slugName,
  admin: { useAsTitle, group: 'Website content' },
  access: publicRead,
  hooks: revalidateHooks,
  fields,
  ...extra,
});

export const Users: CollectionConfig = {
  slug: 'users',
  auth: { tokenExpiration: 60 * 60 * 4, maxLoginAttempts: 5, lockTime: 15 * 60 * 1000 },
  admin: { useAsTitle: 'email', group: 'Administration' },
  access: { read: isEditor, create: isAdmin, update: isAdmin, delete: isAdmin },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'role', type: 'select', required: true, defaultValue: 'editor', options: [{ label: 'Administrator', value: 'admin' }, { label: 'Editor (DAPR)', value: 'editor' }], saveToJWT: true },
  ],
};

export const Media: CollectionConfig = {
  slug: 'media',
  admin: { group: 'Website content' },
  access: publicRead,
  upload: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    imageSizes: [{ name: 'card', width: 800 }, { name: 'hero', width: 1920 }],
  },
  fields: [{ name: 'alt', type: 'text', required: true, admin: { description: 'Describe the image for screen-reader users.' } }],
};

export const News = base('news', 'title', [
  { name: 'title', type: 'text', required: true },
  slug,
  { name: 'excerpt', type: 'textarea', required: true, maxLength: 300 },
  { name: 'body', type: 'array', required: true, labels: { singular: 'Paragraph', plural: 'Paragraphs' }, fields: [{ name: 'text', type: 'textarea', required: true }] },
  select('category', ['press-release', 'operations', 'training', 'civil-military', 'welfare', 'sports']),
  date('publishedAt'),
  image,
], { versions: { drafts: true }, defaultSort: '-publishedAt' });

export const Announcements = base('announcements', 'title', [
  { name: 'title', type: 'text', required: true },
  { name: 'summary', type: 'textarea', required: true },
  date('date'),
  { name: 'href', type: 'text' },
  { name: 'urgent', type: 'checkbox', defaultValue: false },
], { defaultSort: '-date' });

export const Events = base('events', 'title', [
  { name: 'title', type: 'text', required: true }, slug, date('date'), date('endDate', false),
  { name: 'location', type: 'text', required: true }, { name: 'description', type: 'textarea', required: true },
  select('category', ['ceremony', 'recruitment', 'sports', 'community', 'training']),
], { defaultSort: 'date' });

export const Gallery = base('gallery', 'title', [
  { name: 'title', type: 'text', required: true }, select('type', ['photo', 'video']),
  { name: 'src', type: 'text', required: true, admin: { description: 'Image (or video thumbnail) path/URL' } },
  { name: 'videoUrl', type: 'text', admin: { condition: (d) => d.type === 'video', description: 'https://www.youtube-nocookie.com/embed/<id>' } },
  date('date'),
]);

export const Leaders = base('leaders', 'name', [
  { name: 'name', type: 'text', required: true }, { name: 'rank', type: 'text', required: true }, { name: 'appointment', type: 'text', required: true },
  { name: 'photo', type: 'text', required: true }, { name: 'order', type: 'number', defaultValue: 0 },
  { name: 'bio', type: 'array', fields: [{ name: 'text', type: 'textarea', required: true }] },
], { defaultSort: 'order' });

export const Ranks = base('ranks', 'name', [
  { name: 'name', type: 'text', required: true }, { name: 'abbreviation', type: 'text', required: true },
  select('category', ['commissioned', 'non-commissioned', 'other']), { name: 'natoCode', type: 'text', required: true },
  { name: 'order', type: 'number', required: true },
  { name: 'insignia', type: 'json', required: true, admin: { description: '{ pips, eagle, swords, chevrons, crest, wreath }' } },
], { defaultSort: 'order' });

export const Institutions = base('institutions', 'name', [
  { name: 'name', type: 'text', required: true }, slug, { name: 'location', type: 'text', required: true },
  { name: 'state', type: 'text', required: true, maxLength: 2 }, select('type', ['academy', 'depot', 'school', 'college']),
  { name: 'description', type: 'textarea', required: true },
  { name: 'courses', type: 'array', fields: [{ name: 'name', type: 'text', required: true }] },
]);

export const Faqs = base('faqs', 'question', [
  { name: 'question', type: 'text', required: true }, { name: 'answer', type: 'textarea', required: true },
  select('category', ['eligibility', 'application', 'documents', 'screening', 'training', 'general']),
  { name: 'order', type: 'number', defaultValue: 0 },
], { defaultSort: 'order' });

export const Downloads = base('downloads', 'title', [
  { name: 'title', type: 'text', required: true }, select('category', ['forms', 'publications', 'reports', 'policies']),
  select('fileType', ['PDF', 'DOCX', 'XLSX']), { name: 'sizeKb', type: 'number', required: true },
  { name: 'url', type: 'text', required: true }, date('date'),
], { defaultSort: '-date' });

export const Tenders = base('tenders', 'title', [
  { name: 'ref', type: 'text', required: true, unique: true }, { name: 'title', type: 'text', required: true },
  select('category', ['works', 'goods', 'services', 'consultancy']), date('publishedAt'), date('deadline'),
  select('status', ['open', 'closed', 'awarded', 'cancelled']), { name: 'description', type: 'textarea', required: true },
  { name: 'documentUrl', type: 'text', required: true },
], { defaultSort: '-publishedAt' });

export const Welfare = base('welfare', 'title', [
  select('slug', ['serving-personnel', 'veterans', 'families']), { name: 'title', type: 'text', required: true },
  { name: 'intro', type: 'textarea', required: true },
  { name: 'services', type: 'array', fields: [
    { name: 'title', type: 'text', required: true }, select('area', ['healthcare', 'pension', 'housing', 'education', 'insurance', 'support']),
    { name: 'description', type: 'textarea', required: true }, { name: 'contact', type: 'text' },
  ] },
]);

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  admin: { group: 'Website content' },
  access: { read: () => true, update: isEditor },
  hooks: { afterChange: [() => revalidateHooks.afterChange[0]!()] },
  fields: [
    { name: 'motto', type: 'text', required: true },
    { name: 'heroTitle', type: 'text', required: true },
    { name: 'heroSubtitle', type: 'textarea', required: true },
    { name: 'mission', type: 'textarea', required: true },
    { name: 'vision', type: 'textarea', required: true },
    { name: 'hq', type: 'group', fields: [
      { name: 'address', type: 'textarea', required: true }, { name: 'phones', type: 'json', required: true },
      { name: 'email', type: 'email', required: true }, { name: 'mapEmbed', type: 'text', required: true },
    ] },
    { name: 'emergencyLines', type: 'array', fields: [{ name: 'label', type: 'text', required: true }, { name: 'number', type: 'text', required: true }] },
    { name: 'social', type: 'array', fields: [{ name: 'label', type: 'text', required: true }, { name: 'href', type: 'text', required: true }] },
    { name: 'history', type: 'array', fields: [{ name: 'year', type: 'text', required: true }, { name: 'title', type: 'text', required: true }, { name: 'text', type: 'textarea', required: true }] },
    { name: 'coreValues', type: 'array', fields: [{ name: 'title', type: 'text', required: true }, { name: 'text', type: 'textarea', required: true }] },
    { name: 'orgChart', type: 'json', required: true, admin: { description: 'Organisation tree: { id, title, subtitle, children: [...] }' } },
  ],
};

export const collections = [Users, Media, News, Announcements, Events, Gallery, Leaders, Ranks, Institutions, Faqs, Downloads, Tenders, Welfare];
