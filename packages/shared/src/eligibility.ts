/**
 * Eligibility engine. Pure and deterministic so the exact same rules run:
 *  - in the browser (instant "pre-check" before the applicant wastes time),
 *  - in the API on submission (authoritative — blocks ineligible applicants),
 *  - in the admin preview when officers edit rules.
 */
import { qualificationRank } from './enums';
import type { EligibilityRules, DraftData, RuleSet } from './schemas';

export interface EligibilityResult {
  eligible: boolean;
  /** Human-readable reasons the applicant is not eligible (empty if eligible). */
  reasons: string[];
}

/** Age in whole years on `asAt` (normally the exercise closing date). */
export function ageOn(dateOfBirth: string, asAt: Date): number {
  const dob = new Date(dateOfBirth + 'T00:00:00Z');
  let age = asAt.getUTCFullYear() - dob.getUTCFullYear();
  const m = asAt.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && asAt.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

export function checkEligibility(
  rules: EligibilityRules,
  data: DraftData,
  asAt: Date,
): EligibilityResult {
  const reasons: string[] = [];
  const entryType = data.entry?.entryType;
  if (!entryType) return { eligible: false, reasons: ['Choose an entry type'] };
  const r: RuleSet = rules[entryType];
  if (!r?.enabled) return { eligible: false, reasons: ['This entry type is not open in the current exercise'] };

  const p = data.personal;
  if (p) {
    const age = ageOn(p.dateOfBirth, asAt);
    if (age < r.minAge || age > r.maxAge)
      reasons.push(`Age must be between ${r.minAge} and ${r.maxAge} years (you will be ${age})`);
    if (r.singleOnly && p.maritalStatus !== 'single') reasons.push('Applicants for this entry must be single');
  }

  const ph = data.physical;
  if (ph && p) {
    const min = p.gender === 'female' ? r.minHeightFemaleCm : r.minHeightMaleCm;
    if (ph.heightCm < min) reasons.push(`Minimum height is ${(min / 100).toFixed(2)}m`);
    if (ph.hasCriminalRecord) reasons.push('Applicants must not have a criminal record');
  }

  const e = data.education;
  if (e) {
    if (qualificationRank(e.highestQualification) < qualificationRank(r.minQualification))
      reasons.push('Your highest qualification is below the minimum for this entry');
    if (e.olevelCredits < r.minCredits) reasons.push(`At least ${r.minCredits} O-Level credits are required`);
    if (r.requireEnglishAndMaths && !e.hasEnglishAndMaths)
      reasons.push('Credits in English Language and Mathematics are required');
    if (e.olevelSittings > r.maxSittings) reasons.push(`O-Level results must be obtained in at most ${r.maxSittings} sitting(s)`);
  }

  return { eligible: reasons.length === 0, reasons };
}

/** Sensible defaults used when an officer creates a new exercise. */
export const DEFAULT_RULES: EligibilityRules = {
  regular: {
    enabled: true, minAge: 18, maxAge: 22, minHeightMaleCm: 168, minHeightFemaleCm: 165,
    minQualification: 'ssce', minCredits: 4, requireEnglishAndMaths: true, singleOnly: true, maxSittings: 2,
  },
  specialist: {
    enabled: true, minAge: 18, maxAge: 26, minHeightMaleCm: 168, minHeightFemaleCm: 165,
    minQualification: 'ssce', minCredits: 4, requireEnglishAndMaths: true, singleOnly: true, maxSittings: 2,
  },
  short_service: {
    enabled: true, minAge: 20, maxAge: 32, minHeightMaleCm: 168, minHeightFemaleCm: 165,
    minQualification: 'bsc', minCredits: 5, requireEnglishAndMaths: true, singleOnly: false, maxSittings: 2,
  },
};
