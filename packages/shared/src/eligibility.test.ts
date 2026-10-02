import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEligibility, DEFAULT_RULES, ageOn } from './eligibility';
import { generateApplicationId, isValidApplicationId } from './application-id';

const asAt = new Date('2026-10-31T00:00:00Z');
const base = {
  personal: { surname: 'Ade', firstName: 'Musa', gender: 'male', dateOfBirth: '2006-01-15', maritalStatus: 'single', nin: '12345678901', residentialAddress: '12 Broad Street, Lagos', stateOfResidence: 'LA' },
  physical: { heightCm: 172, weightKg: 68, genotype: 'AA', bloodGroup: 'O+', hasDisability: false, hasCriminalRecord: false },
  education: { highestQualification: 'ssce', olevelCredits: 5, hasEnglishAndMaths: true, olevelSittings: 1, institutions: [] },
  entry: { entryType: 'regular', preferredScreeningState: 'LA' },
} as any;

test('ageOn handles birthdays', () => {
  assert.equal(ageOn('2006-11-01', asAt), 19);
  assert.equal(ageOn('2006-10-31', asAt), 20);
});

test('eligible applicant passes', () => {
  assert.deepEqual(checkEligibility(DEFAULT_RULES, base, asAt), { eligible: true, reasons: [] });
});

test('short, over-age, married applicant is blocked with reasons', () => {
  const d = structuredClone(base);
  d.physical.heightCm = 160;
  d.personal.dateOfBirth = '1990-01-01';
  d.personal.maritalStatus = 'married';
  const r = checkEligibility(DEFAULT_RULES, d, asAt);
  assert.equal(r.eligible, false);
  assert.equal(r.reasons.length, 3);
});

test('application id round trip', () => {
  const id = generateApplicationId('RRI', 2026, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
  assert.match(id, /^NA-26-RRI-[0-9A-Z]{8}-[0-9A-Z]$/);
  assert.ok(isValidApplicationId(id));
  assert.ok(!isValidApplicationId(id.slice(0, -1) + (id.endsWith('0') ? '1' : '0')));
});
