/**
 * Seeds a development / staging database:
 *  - admin accounts for each role (2FA enrolment is forced at first login)
 *  - an OPEN recruitment exercise with default eligibility rules and quotas
 *  - screening centres
 *  - SEED_APPLICANTS sample applicants (default 2,000) with realistic spread
 *    across states, statuses and entry types. Their accounts double as the
 *    login pool for the k6 load tests: loadtest+<n>@example.ng / SEED_APPLICANT_PASSWORD
 *
 * Never run against production.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { hash, Algorithm } from '@node-rs/argon2';
import {
  DEFAULT_RULES, NIGERIAN_STATES, generateApplicationId, ApplicationData, ageOn,
} from '@armyx/shared';
import { FieldCrypto } from '@armyx/shared/server';

const N = Number(process.env.SEED_APPLICANTS ?? 2000);
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!Army2026';
const APPLICANT_PASSWORD = process.env.SEED_APPLICANT_PASSWORD ?? 'Applicant#2026';

const SURNAMES = ['Abubakar', 'Adeyemi', 'Okafor', 'Bello', 'Eze', 'Ibrahim', 'Okon', 'Adebayo', 'Musa', 'Nwosu', 'Danjuma', 'Ogunleye', 'Etim', 'Yusuf', 'Chukwu', 'Lawal', 'Ekpo', 'Garba', 'Ojo', 'Uche', 'Suleiman', 'Akpan', 'Olawale', 'Obi', 'Usman', 'Bassey', 'Aliyu', 'Ogbonna', 'Shehu', 'Ike'];
const FIRST = ['Musa', 'Chinedu', 'Aisha', 'Tunde', 'Ngozi', 'Ibrahim', 'Emeka', 'Fatima', 'Segun', 'Amina', 'Uchenna', 'Bola', 'Hauwa', 'Ifeanyi', 'Kemi', 'Sani', 'Blessing', 'Yakubu', 'Chiamaka', 'Femi', 'Zainab', 'Obinna', 'Halima', 'Kelechi', 'Funmi'];
const pick = <T>(a: readonly T[], i: number) => a[i % a.length]!;
const rand = (n: number) => Math.floor(Math.random() * n);

async function main() {
  const db = new Client({ connectionString: process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL });
  await db.connect();
  const crypto = FieldCrypto.fromEnv();
  const opts = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
  const adminHash = await hash(ADMIN_PASSWORD, opts);
  const applicantHash = await hash(APPLICANT_PASSWORD, opts);

  // ---------------- admins
  const admins = [
    ['superadmin@army.mil.ng', 'Super Administrator', 'super_admin'],
    ['officer@army.mil.ng', 'Recruitment Officer', 'recruitment_officer'],
    ['reviewer@army.mil.ng', 'Application Reviewer', 'reviewer'],
    ['viewer@army.mil.ng', 'Dashboard Viewer', 'viewer'],
  ];
  for (const [email, name, role] of admins) {
    await db.query(
      `INSERT INTO admin_users (email, full_name, role, password_hash) VALUES ($1,$2,$3,$4)
       ON CONFLICT (email) DO NOTHING`,
      [email, name, role, adminHash],
    );
  }
  const { rows: [superAdmin] } = await db.query(`SELECT id FROM admin_users WHERE email = 'superadmin@army.mil.ng'`);

  // ---------------- exercise
  const year = new Date().getFullYear();
  const quotas = Object.fromEntries(NIGERIAN_STATES.map((s) => [s.code, 400]));
  await db.query(`UPDATE exercises SET state = 'closed' WHERE state = 'open' AND code <> 'RRI'`);
  const { rows: [ex] } = await db.query(
    `INSERT INTO exercises (code, title, state, opens_at, closes_at, rules, quotas, created_by)
     VALUES ('RRI', $1, 'open', now() - interval '3 days', now() + interval '45 days', $2, $3, $4)
     ON CONFLICT (code) DO UPDATE SET state = 'open', opens_at = EXCLUDED.opens_at, closes_at = EXCLUDED.closes_at
     RETURNING id, closes_at`,
    [`${year} Regular Recruit Intake (RRI)`, JSON.stringify(DEFAULT_RULES), JSON.stringify(quotas), superAdmin.id],
  );

  // ---------------- screening centres
  const centres = [
    ['Ojo Cantonment', 'LA', 'Ojo Cantonment, Ojo, Lagos'],
    ['Mogadishu Cantonment', 'FC', 'Mogadishu Cantonment, Asokoro, Abuja'],
    ['Depot Nigerian Army', 'KD', 'Depot NA, Zaria, Kaduna'],
    ['Odogbo Barracks', 'OY', 'Odogbo Barracks, Ibadan, Oyo'],
    ['Bori Camp', 'RI', 'Bori Camp, Port Harcourt, Rivers'],
    ['Abakpa Cantonment', 'EN', 'Abakpa Cantonment, Enugu'],
    ['Maimalari Cantonment', 'BO', 'Maimalari Cantonment, Maiduguri, Borno'],
    ['Rukuba Barracks', 'PL', 'Rukuba Barracks, Jos, Plateau'],
  ];
  const { rows: existingCentres } = await db.query(`SELECT id FROM screening_centres WHERE exercise_id = $1`, [ex.id]);
  if (!existingCentres.length) {
    for (const [name, state, address] of centres) {
      await db.query(`INSERT INTO screening_centres (exercise_id, name, state_code, address, capacity_per_day) VALUES ($1,$2,$3,$4,500)`, [ex.id, name, state, address]);
    }
  }

  // ---------------- applicants (batched inserts via unnest)
  const { rows: [{ n: existing }] } = await db.query(`SELECT count(*)::int AS n FROM users WHERE consent_version = 'seed'`);
  const statuses = ['submitted', 'submitted', 'submitted', 'under_review', 'under_review', 'shortlisted', 'rejected'];
  const entries = ['regular', 'regular', 'regular', 'specialist', 'short_service'] as const;
  const BATCH = 500;
  for (let start = existing; start < N; start += BATCH) {
    const users: any[][] = [[], [], [], [], [], [], []];
    const apps: any[][] = Array.from({ length: 20 }, () => []);
    for (let i = start; i < Math.min(start + BATCH, N); i++) {
      const id = randomUUID();
      const email = `loadtest+${i}@example.ng`;
      const phone = `+2348${String(100000000 + i).slice(-9)}`;
      const surname = pick(SURNAMES, i * 7 + rand(5)).toUpperCase();
      const firstName = pick(FIRST, i * 3 + rand(7));
      const state = NIGERIAN_STATES[rand(NIGERIAN_STATES.length)]!;
      const gender = i % 5 === 0 ? 'female' : 'male';
      const entryType = pick(entries, i);
      const dob = `${year - 19 - rand(3)}-${String(1 + rand(12)).padStart(2, '0')}-${String(1 + rand(28)).padStart(2, '0')}`;
      [id, crypto.blindIndex(email), crypto.blindIndex(phone), crypto.encrypt(email), crypto.encrypt(phone), surname, firstName].forEach((v, k) => users[k]!.push(v));
      // Only ~70% of seeded accounts have submitted; the rest are fresh accounts for load testing the form.
      if (i % 10 < 7) {
        const data: ApplicationData = {
          personal: { surname, firstName, middleName: '', gender, dateOfBirth: dob, maritalStatus: 'single', nin: String(10000000000 + i), residentialAddress: `${1 + rand(80)} Sample Street, ${state.name}`, stateOfResidence: state.code },
          origin: { stateOfOrigin: state.code, lga: state.lgas[rand(state.lgas.length)]!, hometown: state.name },
          education: { highestQualification: entryType === 'short_service' ? 'bsc' : 'ssce', olevelCredits: 5 + rand(3), hasEnglishAndMaths: true, olevelSittings: 1, institutions: [{ name: 'Government Secondary School', qualification: 'ssce', yearCompleted: year - 2 }] },
          physical: { heightCm: 168 + rand(20), weightKg: 60 + rand(20), genotype: 'AA', bloodGroup: 'O+', hasDisability: false, hasCriminalRecord: false },
          next_of_kin: { fullName: `${pick(FIRST, i + 3)} ${surname}`, relationship: 'parent', phone: '+2348030000000', address: `${state.name} State` },
          entry: { entryType, trade: entryType === 'specialist' ? 'driver' : undefined, preferredScreeningState: state.code },
        };
        const submittedAt = new Date(Date.now() - rand(3 * 24 * 3600 * 1000));
        const row = [
          randomUUID(), generateApplicationId('RRI', year, randomBytes(8)), ex.id, id, pick(statuses, i * 13 + rand(3)), entryType,
          data.entry.trade ?? null, surname, firstName, gender, ageOn(dob, ex.closes_at), state.code, data.origin.lga,
          data.education.highestQualification, data.physical.heightCm, state.code, crypto.blindIndex(email), crypto.blindIndex(phone),
          crypto.encryptJson(data),
        ];
        row.forEach((v, k) => apps[k]!.push(v));
        apps[19]!.push(submittedAt);
      }
    }
    await db.query(
      `INSERT INTO users (id, email_hash, phone_hash, email_enc, phone_enc, surname, first_name, password_hash, email_verified_at, phone_verified_at, consent_version, consent_at)
       SELECT u.*, $8, now(), now(), 'seed', now()
         FROM unnest($1::uuid[], $2::bytea[], $3::bytea[], $4::bytea[], $5::bytea[], $6::text[], $7::text[]) AS u
       ON CONFLICT DO NOTHING`,
      [...users, applicantHash],
    );
    if (apps[0]!.length) {
      await db.query(
        `INSERT INTO applications (id, application_no, exercise_id, user_id, status, entry_type, trade, surname, first_name, gender, age,
                                   state_code, lga, qualification, height_cm, preferred_screening_state, email_hash, phone_hash, pii_enc, submitted_at)
         SELECT * FROM unnest($1::uuid[], $2::text[], $3::uuid[], $4::uuid[], $5::application_status[], $6::entry_type[], $7::text[], $8::text[],
                              $9::text[], $10::text[], $11::smallint[], $12::char(2)[], $13::text[], $14::text[], $15::numeric[], $16::char(2)[],
                              $17::bytea[], $18::bytea[], $19::bytea[], $20::timestamptz[])
         ON CONFLICT DO NOTHING`,
        apps,
      );
    }
    // Load-test accounts that have not submitted get a complete draft + document records
    // so the k6 spike test can exercise the real submission path.
    if (process.env.SEED_LOADTEST_DRAFTS !== 'false') {
      const draftUsers: string[] = [];
      for (let k = 0; k < users[0]!.length; k++) if ((start + k) % 10 >= 7) draftUsers.push(users[0]![k]);
      if (draftUsers.length) {
        await db.query(
          `INSERT INTO documents (user_id, exercise_id, type, s3_key, content_type, size_bytes, status)
           SELECT u, $2, t, 'loadtest/' || u || '/' || t || '.pdf', 'application/pdf', 1024, 'verified'
             FROM unnest($1::uuid[]) u CROSS JOIN unnest(ARRAY['passport_photo','olevel_certificate','birth_certificate','state_of_origin_letter']) t
           ON CONFLICT DO NOTHING`,
          [draftUsers, ex.id],
        );
      }
    }
    process.stdout.write(`\rSeeded ${Math.min(start + BATCH, N)}/${N} applicant accounts`);
  }
  console.log(`\n\nSeed complete.
  Admin logins (2FA enrolment is required on first sign-in):
    superadmin@army.mil.ng / officer@army.mil.ng / reviewer@army.mil.ng / viewer@army.mil.ng
    password: ${ADMIN_PASSWORD}
  Applicant logins: loadtest+<0..${N - 1}>@example.ng / ${APPLICANT_PASSWORD}
    (accounts with n % 10 >= 7 have not submitted yet)`);
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
