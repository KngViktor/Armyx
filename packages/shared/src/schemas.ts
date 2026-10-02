/**
 * Zod schemas shared by the browser (instant feedback) and the API (authoritative
 * validation). Never trust the client: the API re-validates every payload.
 */
import { z } from 'zod';
import {
  ADMIN_ROLES,
  APPLICATION_STATUSES,
  DOCUMENT_TYPES,
  ENTRY_TYPES,
  GENDERS,
  MARITAL_STATUSES,
  QUALIFICATIONS,
  TRADES,
} from './enums';
import { STATE_CODES, isValidLga } from './nigeria';

// ---------------------------------------------------------------- primitives

/** Nigerian mobile number, normalised to E.164 (+234XXXXXXXXXX). */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .refine((v) => /^(\+234|234|0)[789][01]\d{8}$/.test(v), 'Enter a valid Nigerian mobile number')
  .transform((v) => '+234' + v.replace(/^(\+234|234|0)/, ''));

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address'));

/**
 * Password policy: 10+ characters with upper, lower, digit and symbol.
 * Long passphrases (16+) are accepted without the composition rules (NIST 800-63B friendly).
 */
export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password is too long')
  .refine(
    (v) =>
      v.length >= 16 ||
      (/[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v)),
    'Use upper and lower case letters, a number and a symbol (or a passphrase of 16+ characters)',
  );

const name = z
  .string()
  .trim()
  .min(2, 'Too short')
  .max(60, 'Too long')
  .regex(/^[A-Za-z][A-Za-z' -]*$/, 'Letters, spaces, hyphens and apostrophes only');

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD');
const otpCode = z.string().regex(/^\d{6}$/, 'Enter the 6-digit code');

// ---------------------------------------------------------------- auth

export const registerSchema = z.object({
  surname: name,
  firstName: name,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  /** Explicit NDPA consent to processing of personal data for recruitment. */
  consent: z.literal(true, { error: 'You must accept the privacy notice to continue' }),
  captchaToken: z.string().optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const verifyOtpSchema = z.object({
  userId: z.uuid(),
  channel: z.enum(['email', 'phone']),
  code: otpCode,
});

export const resendOtpSchema = z.object({
  userId: z.uuid(),
  channel: z.enum(['email', 'phone']),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
  totp: z.string().regex(/^\d{6}$/).optional(),
  captchaToken: z.string().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const totpCodeSchema = z.object({ code: otpCode });

export const forgotPasswordSchema = z.object({ email: emailSchema, captchaToken: z.string().optional() });
export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(128),
  password: passwordSchema,
});

// ---------------------------------------------------------------- application steps

export const personalStepSchema = z.object({
  surname: name,
  firstName: name,
  middleName: name.optional().or(z.literal('')),
  gender: z.enum(GENDERS),
  dateOfBirth: isoDate,
  maritalStatus: z.enum(MARITAL_STATUSES),
  nin: z.string().regex(/^\d{11}$/, 'NIN must be 11 digits'),
  residentialAddress: z.string().trim().min(10).max(300),
  stateOfResidence: z.enum(STATE_CODES as [string, ...string[]]),
});

export const originStepSchema = z
  .object({
    stateOfOrigin: z.enum(STATE_CODES as [string, ...string[]]),
    lga: z.string().min(2).max(60),
    hometown: z.string().trim().min(2).max(80),
  })
  .refine((v) => isValidLga(v.stateOfOrigin, v.lga), { path: ['lga'], message: 'Select an LGA in your state of origin' });

export const educationStepSchema = z.object({
  highestQualification: z.enum(QUALIFICATIONS),
  olevelCredits: z.coerce.number().int().min(0).max(9),
  hasEnglishAndMaths: z.boolean(),
  olevelSittings: z.coerce.number().int().min(1).max(2),
  institutions: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(120),
        qualification: z.enum(QUALIFICATIONS),
        yearCompleted: z.coerce.number().int().min(1980).max(2100),
      }),
    )
    .min(1)
    .max(6),
});

export const physicalStepSchema = z.object({
  heightCm: z.coerce.number().min(120).max(230),
  weightKg: z.coerce.number().min(35).max(180),
  genotype: z.enum(['AA', 'AS', 'AC', 'SS', 'SC', 'unknown']),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown']),
  hasDisability: z.boolean(),
  hasCriminalRecord: z.boolean(),
});

export const nextOfKinStepSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  relationship: z.enum(['parent', 'sibling', 'spouse', 'guardian', 'relative']),
  phone: phoneSchema,
  address: z.string().trim().min(10).max(300),
});

export const entryStepSchema = z
  .object({
    entryType: z.enum(ENTRY_TYPES),
    trade: z.enum(TRADES).optional(),
    preferredScreeningState: z.enum(STATE_CODES as [string, ...string[]]),
  })
  .refine((v) => v.entryType !== 'specialist' || !!v.trade, {
    path: ['trade'],
    message: 'Select your trade / specialisation',
  });

export const STEP_SCHEMAS = {
  personal: personalStepSchema,
  origin: originStepSchema,
  education: educationStepSchema,
  physical: physicalStepSchema,
  next_of_kin: nextOfKinStepSchema,
  entry: entryStepSchema,
} as const;

export type PersonalStep = z.infer<typeof personalStepSchema>;
export type OriginStep = z.infer<typeof originStepSchema>;
export type EducationStep = z.infer<typeof educationStepSchema>;
export type PhysicalStep = z.infer<typeof physicalStepSchema>;
export type NextOfKinStep = z.infer<typeof nextOfKinStepSchema>;
export type EntryStep = z.infer<typeof entryStepSchema>;

/** Full application payload = all steps completed. */
export interface ApplicationData {
  personal: PersonalStep;
  origin: OriginStep;
  education: EducationStep;
  physical: PhysicalStep;
  next_of_kin: NextOfKinStep;
  entry: EntryStep;
}
export type DraftData = Partial<ApplicationData>;

export const saveStepSchema = z.object({
  step: z.enum(['personal', 'origin', 'education', 'physical', 'next_of_kin', 'entry']),
  data: z.record(z.string(), z.unknown()),
});

export const submitSchema = z.object({
  declaration: z.literal(true, { error: 'You must accept the declaration' }),
  captchaToken: z.string().optional(),
});

// ---------------------------------------------------------------- documents

export const presignUploadSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  contentType: z.string().max(100),
  size: z.coerce.number().int().positive(),
});

export const confirmUploadSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  key: z.string().min(10).max(300),
});

// ---------------------------------------------------------------- public forms

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  subject: z.enum(['general', 'recruitment', 'welfare', 'media', 'procurement', 'report']),
  message: z.string().trim().min(10).max(4000),
  captchaToken: z.string().optional(),
  /** Honeypot: real users never fill this hidden field. */
  website: z.string().max(0).optional().or(z.literal('')),
});
export type ContactInput = z.infer<typeof contactSchema>;

// ---------------------------------------------------------------- admin

export const ruleSetSchema = z.object({
  enabled: z.boolean(),
  minAge: z.number().int().min(16).max(60),
  maxAge: z.number().int().min(16).max(60),
  minHeightMaleCm: z.number().min(120).max(220),
  minHeightFemaleCm: z.number().min(120).max(220),
  minQualification: z.enum(QUALIFICATIONS),
  minCredits: z.number().int().min(0).max(9),
  requireEnglishAndMaths: z.boolean(),
  singleOnly: z.boolean(),
  maxSittings: z.number().int().min(1).max(2),
});
export type RuleSet = z.infer<typeof ruleSetSchema>;

export const eligibilityRulesSchema = z.object({
  regular: ruleSetSchema,
  short_service: ruleSetSchema,
  specialist: ruleSetSchema,
});
export type EligibilityRules = z.infer<typeof eligibilityRulesSchema>;

export const exerciseSchema = z.object({
  code: z.string().regex(/^[A-Z0-9-]{3,20}$/),
  title: z.string().trim().min(5).max(160),
  opensAt: z.iso.datetime(),
  closesAt: z.iso.datetime(),
  rules: eligibilityRulesSchema,
  /** Per-state shortlisting quota keyed by state code. 0 / missing = unlimited. */
  quotas: z.record(z.string(), z.number().int().min(0)).default({}),
});
export type ExerciseInput = z.infer<typeof exerciseSchema>;

export const applicantFilterSchema = z.object({
  exerciseId: z.uuid().optional(),
  q: z.string().trim().max(100).optional(),
  state: z.string().max(3).optional(),
  lga: z.string().max(60).optional(),
  qualification: z.enum(QUALIFICATIONS).optional(),
  entryType: z.enum(ENTRY_TYPES).optional(),
  status: z.enum(APPLICATION_STATUSES).optional(),
  gender: z.enum(GENDERS).optional(),
  sort: z.enum(['submitted_at', 'surname', 'state', 'status', 'height_cm']).default('submitted_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  /** Keyset pagination cursor (opaque) — avoids OFFSET scans on millions of rows. */
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ApplicantFilter = z.infer<typeof applicantFilterSchema>;

export const bulkStatusSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(5000),
  status: z.enum(['under_review', 'shortlisted', 'rejected']),
  note: z.string().trim().max(500).optional(),
});

export const bulkScreeningSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(5000),
  centreId: z.uuid(),
  screeningDate: z.iso.datetime(),
});

export const screeningCentreSchema = z.object({
  name: z.string().trim().min(3).max(160),
  stateCode: z.enum(STATE_CODES as [string, ...string[]]),
  address: z.string().trim().min(5).max(300),
  capacityPerDay: z.number().int().min(1).max(100000),
});

export const adminUserSchema = z.object({
  email: emailSchema,
  fullName: z.string().trim().min(3).max(120),
  role: z.enum(ADMIN_ROLES),
});

export const exportSchema = z.object({
  format: z.enum(['csv', 'xlsx']),
  filter: applicantFilterSchema.omit({ cursor: true, limit: true }).partial(),
});
