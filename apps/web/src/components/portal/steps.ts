/** Field definitions for the application wizard (rendered generically by StepForm). */
import {
  ENTRY_TYPE_LABELS, ENTRY_TYPES, MARITAL_STATUSES, NIGERIAN_STATES, QUALIFICATION_LABELS, QUALIFICATIONS, STATE_BY_CODE, TRADES,
  type ApplicationStep,
} from '@armyx/shared';

export type FieldType = 'text' | 'date' | 'number' | 'select' | 'checkbox' | 'textarea' | 'tel' | 'radio-cards';
export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  hint?: string;
  options?: { value: string; label: string; description?: string }[];
  optionsFrom?: (v: Record<string, any>) => { value: string; label: string }[];
  show?: (v: Record<string, any>) => boolean;
  half?: boolean;
  autoComplete?: string;
  inputMode?: 'numeric' | 'tel' | 'text';
  min?: number;
  max?: number;
}

const opts = (xs: readonly string[], labels?: Record<string, string>) => xs.map((x) => ({ value: x, label: labels?.[x] ?? x.charAt(0).toUpperCase() + x.slice(1).replace(/_/g, ' ') }));
const states = NIGERIAN_STATES.map((s) => ({ value: s.code, label: s.name }));

export const STEPS: { id: ApplicationStep; title: string; description: string; fields: FieldDef[] }[] = [
  {
    id: 'personal', title: 'Personal details', description: 'As they appear on your NIN and certificates.',
    fields: [
      { name: 'surname', label: 'Surname', type: 'text', required: true, half: true, autoComplete: 'family-name' },
      { name: 'firstName', label: 'First name', type: 'text', required: true, half: true, autoComplete: 'given-name' },
      { name: 'middleName', label: 'Middle name', type: 'text', half: true, autoComplete: 'additional-name' },
      { name: 'gender', label: 'Gender', type: 'select', required: true, half: true, options: opts(['male', 'female']) },
      { name: 'dateOfBirth', label: 'Date of birth', type: 'date', required: true, half: true, autoComplete: 'bday' },
      { name: 'maritalStatus', label: 'Marital status', type: 'select', required: true, half: true, options: opts(MARITAL_STATUSES) },
      { name: 'nin', label: 'National Identification Number (NIN)', type: 'text', required: true, half: true, inputMode: 'numeric', hint: '11 digits' },
      { name: 'stateOfResidence', label: 'State of residence', type: 'select', required: true, half: true, options: states },
      { name: 'residentialAddress', label: 'Residential address', type: 'textarea', required: true, autoComplete: 'street-address' },
    ],
  },
  {
    id: 'origin', title: 'State of origin', description: 'Your state and Local Government Area of origin.',
    fields: [
      { name: 'stateOfOrigin', label: 'State of origin', type: 'select', required: true, half: true, options: states },
      { name: 'lga', label: 'Local Government Area', type: 'select', required: true, half: true, optionsFrom: (v) => (STATE_BY_CODE[v.stateOfOrigin]?.lgas ?? []).map((l) => ({ value: l, label: l })), hint: 'Select your state first' },
      { name: 'hometown', label: 'Hometown', type: 'text', required: true },
    ],
  },
  {
    id: 'education', title: 'Education', description: 'Your highest qualification and O-Level results.',
    fields: [
      { name: 'highestQualification', label: 'Highest qualification', type: 'select', required: true, options: opts(QUALIFICATIONS, QUALIFICATION_LABELS) },
      { name: 'olevelCredits', label: 'Number of O-Level credits', type: 'number', required: true, half: true, min: 0, max: 9 },
      { name: 'olevelSittings', label: 'Number of sittings', type: 'select', required: true, half: true, options: [{ value: '1', label: 'One sitting' }, { value: '2', label: 'Two sittings' }] },
      { name: 'hasEnglishAndMaths', label: 'I have credits in English Language and Mathematics', type: 'checkbox' },
    ],
  },
  {
    id: 'physical', title: 'Physical details', description: 'You will be measured again at screening.',
    fields: [
      { name: 'heightCm', label: 'Height (cm)', type: 'number', required: true, half: true, min: 120, max: 230, hint: 'e.g. 170 for 1.70m' },
      { name: 'weightKg', label: 'Weight (kg)', type: 'number', required: true, half: true, min: 35, max: 180 },
      { name: 'genotype', label: 'Genotype', type: 'select', required: true, half: true, options: opts(['AA', 'AS', 'AC', 'SS', 'SC', 'unknown'], { unknown: "Don't know" }) },
      { name: 'bloodGroup', label: 'Blood group', type: 'select', required: true, half: true, options: opts(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'], { unknown: "Don't know" }) },
      { name: 'hasDisability', label: 'I have a physical disability', type: 'checkbox' },
      { name: 'hasCriminalRecord', label: 'I have been convicted of a criminal offence', type: 'checkbox' },
    ],
  },
  {
    id: 'next_of_kin', title: 'Next of kin', description: 'Someone we can contact in an emergency.',
    fields: [
      { name: 'fullName', label: 'Full name', type: 'text', required: true, half: true },
      { name: 'relationship', label: 'Relationship', type: 'select', required: true, half: true, options: opts(['parent', 'sibling', 'spouse', 'guardian', 'relative']) },
      { name: 'phone', label: 'Phone number', type: 'tel', required: true, half: true, inputMode: 'tel' },
      { name: 'address', label: 'Address', type: 'textarea', required: true },
    ],
  },
  {
    id: 'entry', title: 'Choice of entry', description: 'Choose how you want to join and where you prefer to be screened.',
    fields: [
      { name: 'entryType', label: 'Entry type', type: 'radio-cards', required: true, options: ENTRY_TYPES.map((t) => ({ value: t, label: ENTRY_TYPE_LABELS[t], description: t === 'regular' ? 'Enlist as a soldier (non-tradesman).' : t === 'specialist' ? 'Tradesman / specialist with a trade skill.' : 'Graduate commission as an officer.' })) },
      { name: 'trade', label: 'Trade / specialisation', type: 'select', required: true, half: true, options: opts(TRADES, { ict: 'ICT' }), show: (v) => v.entryType === 'specialist' },
      { name: 'preferredScreeningState', label: 'Preferred screening state', type: 'select', required: true, half: true, options: states },
    ],
  },
];

/** Converts form strings back to typed values expected by the API schemas. */
export function coerce(step: ApplicationStep, v: Record<string, any>) {
  const out: Record<string, any> = { ...v };
  for (const f of STEPS.find((s) => s.id === step)!.fields) {
    if (f.type === 'number' && out[f.name] !== '' && out[f.name] !== undefined) out[f.name] = Number(out[f.name]);
    if (f.type === 'checkbox') out[f.name] = !!out[f.name];
    if (f.show && !f.show(v)) delete out[f.name];
  }
  if (step === 'education') out.olevelSittings = Number(out.olevelSittings);
  if (out.trade === '') delete out.trade;
  return out;
}
