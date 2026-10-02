/**
 * Canonical enumerations shared by the web app, API, workers and CMS.
 * Keep these in sync with the PostgreSQL enum types in apps/api/db/migrations.
 */

export const ADMIN_ROLES = ['super_admin', 'recruitment_officer', 'reviewer', 'viewer'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  recruitment_officer: 'Recruitment Officer',
  reviewer: 'Reviewer',
  viewer: 'Viewer',
};

/** Lifecycle of a submitted application. Drafts live outside this enum (see drafts table). */
export const APPLICATION_STATUSES = [
  'submitted',
  'under_review',
  'shortlisted',
  'invited_for_screening',
  'rejected',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  shortlisted: 'Shortlisted',
  invited_for_screening: 'Invited for Screening',
  rejected: 'Not Successful',
};

export const ENTRY_TYPES = ['regular', 'short_service', 'specialist'] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  regular: 'Regular Recruit (Non-Tradesman)',
  short_service: 'Short Service Commission',
  specialist: 'Specialist / Tradesman',
};

export const GENDERS = ['male', 'female'] as const;
export type Gender = (typeof GENDERS)[number];

export const MARITAL_STATUSES = ['single', 'married', 'divorced', 'widowed'] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];

/**
 * Qualifications ordered from lowest to highest. The index is used as a rank
 * by the eligibility engine ("minimum qualification" comparisons).
 */
export const QUALIFICATIONS = ['ssce', 'nd', 'nce', 'hnd', 'bsc', 'msc', 'phd'] as const;
export type Qualification = (typeof QUALIFICATIONS)[number];

export const QUALIFICATION_LABELS: Record<Qualification, string> = {
  ssce: 'SSCE / NECO / NABTEB / GCE (O-Level)',
  nd: 'National Diploma (ND)',
  nce: 'Nigeria Certificate in Education (NCE)',
  hnd: 'Higher National Diploma (HND)',
  bsc: "Bachelor's Degree",
  msc: "Master's Degree",
  phd: 'Doctorate (PhD)',
};

export const qualificationRank = (q: Qualification): number => QUALIFICATIONS.indexOf(q);

export const TRADES = [
  'driver',
  'electrician',
  'plumber',
  'carpenter',
  'mason',
  'welder',
  'mechanic',
  'tailor',
  'cook',
  'ict',
  'nursing',
  'laboratory',
  'pharmacy',
  'radiography',
  'musician',
  'photographer',
] as const;
export type Trade = (typeof TRADES)[number];

export const DOCUMENT_TYPES = [
  'passport_photo',
  'olevel_certificate',
  'higher_certificate',
  'birth_certificate',
  'state_of_origin_letter',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface DocumentRule {
  label: string;
  required: boolean;
  /** Allowed MIME types. Verified again server-side against file magic bytes. */
  mimeTypes: string[];
  maxBytes: number;
}

export const DOCUMENT_RULES: Record<DocumentType, DocumentRule> = {
  passport_photo: { label: 'Passport photograph', required: true, mimeTypes: ['image/jpeg', 'image/png'], maxBytes: 500 * 1024 },
  olevel_certificate: { label: "O-Level certificate / result", required: true, mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], maxBytes: 2 * 1024 * 1024 },
  higher_certificate: { label: 'Higher certificate (if any)', required: false, mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], maxBytes: 2 * 1024 * 1024 },
  birth_certificate: { label: 'Birth certificate / age declaration', required: true, mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], maxBytes: 2 * 1024 * 1024 },
  state_of_origin_letter: { label: 'Certificate of state of origin', required: true, mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], maxBytes: 2 * 1024 * 1024 },
};

export const APPLICATION_STEPS = [
  'personal',
  'origin',
  'education',
  'physical',
  'next_of_kin',
  'entry',
] as const;
export type ApplicationStep = (typeof APPLICATION_STEPS)[number];

export const EXERCISE_STATES = ['draft', 'open', 'closed'] as const;
export type ExerciseState = (typeof EXERCISE_STATES)[number];
