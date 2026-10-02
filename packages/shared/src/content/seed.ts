/**
 * SAMPLE seed content. It is loaded into the CMS by `pnpm cms:seed`, and the web
 * app uses it as a build-time fallback when the CMS is unreachable, so a build
 * never fails or shows an empty page.
 *
 * IMPORTANT: Before go-live, the Directorate of Army Public Relations (DAPR)
 * must review and replace every item here (names, figures, dates, contacts,
 * photographs) with officially cleared content.
 */
import type { SiteContent } from './types';

const y = new Date().getFullYear();

export const seedContent: SiteContent = {
  settings: {
    motto: 'Victory is from God alone',
    heroTitle: 'Protecting the Territorial Integrity of Nigeria',
    heroSubtitle:
      'A professional, disciplined and loyal force, committed to defending the nation and supporting civil authority.',
    mission:
      'To defend the territorial integrity of the Federal Republic of Nigeria and to support civil authority when called upon, in order to protect the people and the nation.',
    vision:
      'To have a Nigerian Army that is adequately trained, equipped and motivated to fulfil its constitutional roles, with the professionalism and discipline that earn the confidence of all Nigerians.',
    hq: {
      address: 'Army Headquarters, Mogadishu Cantonment, Asokoro, Abuja, FCT, Nigeria',
      phones: ['+234 (0) 9 000 0000', '+234 (0) 9 000 0001'],
      email: 'info@army.mil.ng',
      mapEmbed:
        'https://www.openstreetmap.org/export/embed.html?bbox=7.5100%2C9.0200%2C7.5500%2C9.0500&layer=mapnik&marker=9.0350%2C7.5300',
    },
    emergencyLines: [
      { label: 'Army Emergency Call Centre (toll-free)', number: '193' },
      { label: 'Report a security threat', number: '+234 (0) 800 000 0000' },
      { label: 'Recruitment helpdesk', number: '+234 (0) 800 000 0001' },
    ],
    social: [
      { label: 'X (Twitter)', href: 'https://x.com/HQNigerianArmy' },
      { label: 'Facebook', href: 'https://www.facebook.com/nigerianarmy' },
      { label: 'YouTube', href: 'https://www.youtube.com/' },
      { label: 'Instagram', href: 'https://www.instagram.com/' },
    ],
    history: [
      { year: '1863', title: "Glover's Hausa Force", text: 'Lieutenant John Glover of the Royal Navy forms a small force in Lagos, the earliest ancestor of the modern Nigerian Army.' },
      { year: '1900', title: 'West African Frontier Force', text: 'Regional units are brought together under the West African Frontier Force (WAFF), later the Royal WAFF.' },
      { year: '1914–1945', title: 'World Wars', text: 'Nigerian soldiers serve with distinction in the Cameroons and East Africa campaigns and in Burma during the Second World War.' },
      { year: '1956', title: 'Queen’s Own Nigeria Regiment', text: 'The Nigeria Regiment becomes the Queen’s Own Nigeria Regiment as the force is prepared for independence.' },
      { year: '1960', title: 'Nigerian Army', text: 'At independence the force becomes the Nigerian Army and soon deploys on its first UN peace support mission in the Congo.' },
      { year: '1964', title: 'Nigerian Defence Academy', text: 'The NDA in Kaduna begins training regular combatant officers for the Armed Forces.' },
      { year: 'Today', title: 'A modern, joint force', text: 'The Nigerian Army conducts internal security operations nationwide and contributes to peace support operations across Africa.' },
    ],
    coreValues: [
      { title: 'Loyalty', text: 'Unwavering allegiance to the Federal Republic of Nigeria and its Constitution.' },
      { title: 'Discipline', text: 'Obedience to lawful orders and the highest standards of personal conduct.' },
      { title: 'Courage', text: 'Physical and moral courage in the face of danger and adversity.' },
      { title: 'Integrity', text: 'Honesty and transparency in all our dealings with the public and each other.' },
      { title: 'Respect for human rights', text: 'Operations conducted in line with the Rules of Engagement and international humanitarian law.' },
    ],
  },

  news: [
    {
      slug: `${y}-recruit-intake-registration-opens`,
      title: `${y} Recruit Intake: online registration is now open`,
      excerpt: 'Eligible Nigerians aged 18–22 (26 for tradesmen) can now apply online through the official recruitment portal. Recruitment is free of charge.',
      body: [
        'The Nigerian Army announces the commencement of online registration for its Recruit Intake. Applications are accepted only through the official recruitment portal on this website.',
        'Applicants are reminded that the recruitment process is entirely free. The Army does not charge any fee at any stage, and anyone who requests money for "slots" is a fraudster who should be reported to the nearest military formation or police station.',
        'Candidates must possess a minimum of four credits in not more than two sittings, including English Language and Mathematics, and meet the age and height requirements published on the eligibility page.',
      ],
      category: 'press-release',
      publishedAt: `${y}-09-28`,
      image: '/images/parade-line.jpg',
    },
    {
      slug: 'beware-of-fake-recruitment-websites',
      title: 'Public notice: beware of fake recruitment websites and agents',
      excerpt: 'The Army warns the public against fraudulent websites, social media pages and agents demanding payment for recruitment.',
      body: [
        'The attention of the Nigerian Army has been drawn to websites and social media accounts that claim to sell recruitment forms or guarantee enlistment.',
        'Members of the public should note that the only official portal is the one linked from this website, and that no payment is ever required.',
      ],
      category: 'press-release',
      publishedAt: `${y}-09-20`,
      image: '/images/officers-walking.jpg',
    },
    {
      slug: 'passing-out-parade-depot',
      title: 'Recruits complete basic military training at Depot Nigerian Army',
      excerpt: 'Newly trained soldiers march past during the passing-out parade, marking the end of their basic military training.',
      body: [
        'The passing-out parade marked the successful completion of several months of basic training covering drill, weapon handling, fieldcraft, physical training and military law.',
        'The reviewing officer charged the new soldiers to remain loyal, disciplined and respectful of human rights in the discharge of their duties.',
      ],
      category: 'training',
      publishedAt: `${y}-09-12`,
      image: '/images/recruits-helmets.jpg',
    },
    {
      slug: 'free-medical-outreach',
      title: 'Free medical outreach reaches rural communities',
      excerpt: 'Army medical teams provided free consultations, drugs and minor surgeries as part of civil-military cooperation.',
      body: [
        'As part of its civil-military cooperation activities, the Army deployed medical personnel to provide free healthcare services to residents of host communities.',
        'Services included general consultations, eye screening, dental care and the distribution of free drugs and mosquito nets.',
      ],
      category: 'civil-military',
      publishedAt: `${y}-08-30`,
      image: '/images/soldier-truck.jpg',
    },
    {
      slug: 'armoured-corps-demonstration',
      title: 'Armoured Corps showcases mobility during Army Day celebration',
      excerpt: 'Armoured fighting vehicles took part in the march-past during the Nigerian Army Day Celebration.',
      body: [
        'Units of the Nigerian Army Armoured Corps displayed their capabilities during the Army Day Celebration (NADCEL), held annually around 6 July.',
        'The celebration featured a church service, Jumat prayers, sports competitions, a regimental dinner and a grand finale parade.',
      ],
      category: 'operations',
      publishedAt: `${y}-07-06`,
      image: '/images/armoured-vehicle.jpg',
    },
    {
      slug: 'barracks-housing-project',
      title: 'New housing units commissioned for personnel and families',
      excerpt: 'The welfare initiative provides improved accommodation for soldiers and their families.',
      body: [
        'New accommodation blocks were commissioned as part of the ongoing effort to improve the welfare of personnel and their families.',
        'The units include modern utilities and are located close to schools and medical facilities within the barracks.',
      ],
      category: 'welfare',
      publishedAt: `${y}-06-18`,
      image: '/images/officers-walking.jpg',
    },
  ],

  announcements: [
    { id: 'a1', title: 'Recruitment is FREE', summary: 'The Nigerian Army never charges for forms, slots or screening. Report anyone who asks you for money.', date: `${y}-09-28`, urgent: true },
    { id: 'a2', title: `${y} Recruit Intake portal open`, summary: 'Create an account and complete your application before the closing date.', date: `${y}-09-28`, href: '/portal/register' },
    { id: 'a3', title: 'Screening centres published', summary: 'Shortlisted candidates can view their screening venue and date on the portal dashboard.', date: `${y}-09-15`, href: '/portal' },
    { id: 'a4', title: 'Tender: construction of perimeter fencing', summary: 'Invitation to tender for works at a training institution. Closing date applies.', date: `${y}-09-10`, href: '/resources/tenders' },
  ],

  events: [
    { slug: 'recruit-registration-window', title: 'Recruit Intake online registration', date: `${y}-09-28`, endDate: `${y}-11-08`, location: 'Online — recruitment portal', description: 'Online registration window for the Recruit Intake.', category: 'recruitment' },
    { slug: 'state-screening', title: 'State-level screening exercise', date: `${y}-11-24`, endDate: `${y}-12-05`, location: 'Designated screening centres nationwide', description: 'Physical and document screening for shortlisted applicants.', category: 'recruitment' },
    { slug: 'armed-forces-remembrance', title: 'Armed Forces Remembrance Day', date: `${y + 1}-01-15`, location: 'National Arcade, Abuja', description: 'Wreath-laying ceremony in honour of fallen heroes.', category: 'ceremony' },
    { slug: 'nadcel', title: 'Nigerian Army Day Celebration (NADCEL)', date: `${y + 1}-07-01`, endDate: `${y + 1}-07-06`, location: 'Host formation (to be announced)', description: 'Annual celebration including sports, community projects and a grand finale parade.', category: 'ceremony' },
    { slug: 'coas-games', title: 'COAS Inter-Division Games', date: `${y}-12-08`, endDate: `${y}-12-14`, location: 'Abuja', description: 'Inter-division sports competition.', category: 'sports' },
  ],

  gallery: [
    { id: 'g1', type: 'photo', title: 'Recruits celebrate completion of training', src: '/images/recruits-helmets.jpg', date: `${y}-09-12` },
    { id: 'g2', type: 'photo', title: 'Senior officers at Army Headquarters', src: '/images/officers-walking.jpg', date: `${y}-08-20` },
    { id: 'g3', type: 'photo', title: 'Guard of honour', src: '/images/parade-line.jpg', date: `${y}-08-02` },
    { id: 'g4', type: 'photo', title: 'Armoured vehicle on parade', src: '/images/armoured-vehicle.jpg', date: `${y}-07-06` },
    { id: 'g5', type: 'photo', title: 'Soldier on duty', src: '/images/soldier-truck.jpg', date: `${y}-06-11` },
    { id: 'v1', type: 'video', title: 'Army Day Celebration highlights', src: '/images/armoured-vehicle.jpg', videoUrl: 'https://www.youtube-nocookie.com/embed/', date: `${y}-07-06` },
  ],

  leadership: [
    {
      name: 'Chief of Army Staff',
      rank: 'Lieutenant General',
      appointment: 'Chief of Army Staff',
      photo: '/images/officers-walking.jpg',
      bio: [
        'The Chief of Army Staff (COAS) is the professional head of the Nigerian Army, responsible to the Chief of Defence Staff and the Commander-in-Chief for the operational effectiveness, training, administration and welfare of the Army.',
        'Replace this placeholder with the official biography supplied by the Directorate of Army Public Relations, including commissioning course, command appointments, operational tours, academic qualifications and honours.',
      ],
    },
  ],

  orgChart: {
    id: 'cic', title: 'Commander-in-Chief', subtitle: 'President of the Federal Republic',
    children: [{
      id: 'cds', title: 'Chief of Defence Staff', subtitle: 'Defence Headquarters',
      children: [{
        id: 'coas', title: 'Chief of Army Staff', subtitle: 'Army Headquarters, Abuja',
        children: [
          { id: 'ahq', title: 'Army HQ Departments', subtitle: 'Principal Staff Officers', children: [
            { id: 'dapp', title: 'Policy and Plans' },
            { id: 'dato', title: 'Training and Operations' },
            { id: 'dadmin', title: 'Administration' },
            { id: 'dlog', title: 'Logistics' },
            { id: 'dmi', title: 'Military Intelligence' },
            { id: 'dase', title: 'Army Standards and Evaluation' },
          ]},
          { id: 'divs', title: 'Divisions', subtitle: 'Field formations', children: [
            { id: 'd1', title: '1 Division', subtitle: 'Kaduna' },
            { id: 'd2', title: '2 Division', subtitle: 'Ibadan' },
            { id: 'd3', title: '3 Division', subtitle: 'Jos' },
            { id: 'd6', title: '6 Division', subtitle: 'Port Harcourt' },
            { id: 'd7', title: '7 Division', subtitle: 'Maiduguri' },
            { id: 'd8', title: '8 Division', subtitle: 'Sokoto' },
            { id: 'd81', title: '81 Division', subtitle: 'Lagos' },
            { id: 'd82', title: '82 Division', subtitle: 'Enugu' },
          ]},
          { id: 'tradoc', title: 'Training and Doctrine Command', subtitle: 'Minna', children: [
            { id: 'depot', title: 'Depot Nigerian Army', subtitle: 'Zaria' },
            { id: 'schools', title: 'Corps Schools' },
          ]},
          { id: 'corps', title: 'Corps', subtitle: 'Arms and services', children: [
            { id: 'inf', title: 'Infantry' }, { id: 'arm', title: 'Armour' }, { id: 'arty', title: 'Artillery' },
            { id: 'engr', title: 'Engineers' }, { id: 'sigs', title: 'Signals' }, { id: 'med', title: 'Medical' },
            { id: 'nac', title: 'Supply and Transport' }, { id: 'mp', title: 'Military Police' },
          ]},
        ],
      }],
    }],
  },

  ranks: [
    { name: 'General', abbreviation: 'Gen', category: 'commissioned', insignia: { swords: true, eagle: true, pips: 2, wreath: true }, natoCode: 'OF-9' },
    { name: 'Lieutenant General', abbreviation: 'Lt Gen', category: 'commissioned', insignia: { swords: true, eagle: true, pips: 1, wreath: true }, natoCode: 'OF-8' },
    { name: 'Major General', abbreviation: 'Maj Gen', category: 'commissioned', insignia: { swords: true, eagle: true, wreath: true }, natoCode: 'OF-7' },
    { name: 'Brigadier General', abbreviation: 'Brig Gen', category: 'commissioned', insignia: { swords: true, wreath: true }, natoCode: 'OF-6' },
    { name: 'Colonel', abbreviation: 'Col', category: 'commissioned', insignia: { eagle: true, pips: 2 }, natoCode: 'OF-5' },
    { name: 'Lieutenant Colonel', abbreviation: 'Lt Col', category: 'commissioned', insignia: { eagle: true, pips: 1 }, natoCode: 'OF-4' },
    { name: 'Major', abbreviation: 'Maj', category: 'commissioned', insignia: { eagle: true }, natoCode: 'OF-3' },
    { name: 'Captain', abbreviation: 'Capt', category: 'commissioned', insignia: { pips: 3 }, natoCode: 'OF-2' },
    { name: 'Lieutenant', abbreviation: 'Lt', category: 'commissioned', insignia: { pips: 2 }, natoCode: 'OF-1' },
    { name: 'Second Lieutenant', abbreviation: '2Lt', category: 'commissioned', insignia: { pips: 1 }, natoCode: 'OF-1' },
    { name: 'Army Warrant Officer', abbreviation: 'AWO', category: 'non-commissioned', insignia: { crest: true, wreath: true }, natoCode: 'OR-9' },
    { name: 'Master Warrant Officer', abbreviation: 'MWO', category: 'non-commissioned', insignia: { crest: true, pips: 1 }, natoCode: 'OR-9' },
    { name: 'Warrant Officer', abbreviation: 'WO', category: 'non-commissioned', insignia: { crest: true }, natoCode: 'OR-8' },
    { name: 'Staff Sergeant', abbreviation: 'SSgt', category: 'non-commissioned', insignia: { chevrons: 3, eagle: true }, natoCode: 'OR-7' },
    { name: 'Sergeant', abbreviation: 'Sgt', category: 'non-commissioned', insignia: { chevrons: 3 }, natoCode: 'OR-6' },
    { name: 'Corporal', abbreviation: 'Cpl', category: 'non-commissioned', insignia: { chevrons: 2 }, natoCode: 'OR-4' },
    { name: 'Lance Corporal', abbreviation: 'LCpl', category: 'non-commissioned', insignia: { chevrons: 1 }, natoCode: 'OR-3' },
    { name: 'Private', abbreviation: 'Pte', category: 'other', insignia: {}, natoCode: 'OR-1' },
  ],

  institutions: [
    { slug: 'nda', name: 'Nigerian Defence Academy', location: 'Kaduna', state: 'KD', type: 'academy', description: 'Trains cadets for commissioning as regular combatant officers of the Armed Forces of Nigeria, awarding degrees alongside military training.', courses: ['Regular Combatant Course', 'Short Service Combatant Course', 'Postgraduate programmes'] },
    { slug: 'depot-na', name: 'Depot Nigerian Army', location: 'Zaria', state: 'KD', type: 'depot', description: 'The home of recruit training, where civilians are transformed into disciplined soldiers through basic military training.', courses: ['Basic Military Training', 'Recruit Drill and Weapon Handling', 'Physical Training'] },
    { slug: 'afcsc', name: 'Armed Forces Command and Staff College', location: 'Jaji', state: 'KD', type: 'college', description: 'Prepares mid-level officers for command and staff appointments.', courses: ['Junior Course', 'Senior Course'] },
    { slug: 'nasi', name: 'Nigerian Army School of Infantry', location: 'Jaji', state: 'KD', type: 'school', description: 'Trains officers and soldiers in infantry tactics and leadership.', courses: ['Young Officers Course', 'Platoon Commanders Course', 'Section Leaders Course'] },
    { slug: 'nasa', name: 'Nigerian Army School of Artillery', location: 'Kachia', state: 'KD', type: 'school', description: 'Centre of excellence for field and air defence artillery training.', courses: ['Gunnery Course', 'Air Defence Course'] },
    { slug: 'nasarm', name: 'Nigerian Army School of Armour', location: 'Bauchi', state: 'BA', type: 'school', description: 'Trains personnel in armoured warfare, driving and maintenance of armoured vehicles.', courses: ['Armoured Driving and Maintenance', 'Gunnery', 'Troop Leaders Course'] },
    { slug: 'nasme', name: 'Nigerian Army School of Military Engineering', location: 'Makurdi', state: 'BE', type: 'school', description: 'Trains combat engineers in construction, demolitions and field engineering.', courses: ['Field Engineering', 'Counter-IED', 'Construction Trades'] },
    { slug: 'nas-signals', name: 'Nigerian Army School of Signals', location: 'Lagos', state: 'LA', type: 'school', description: 'Trains signallers in military communications and information systems.', courses: ['Radio Operator', 'Information Systems', 'Electronic Warfare'] },
  ],

  faqs: [
    { id: 'f1', category: 'general', question: 'Do I pay any money to apply?', answer: 'No. Recruitment into the Nigerian Army is completely free. Never pay anyone for forms, slots or screening. Report such persons to the nearest military formation or police station.' },
    { id: 'f2', category: 'eligibility', question: 'What is the age limit?', answer: 'For regular recruits (non-tradesmen) the age limit is 18 to 22 years. Tradesmen/women may be up to 26 years. Ages are calculated as at the closing date of the exercise. Limits for each exercise are shown on the portal.' },
    { id: 'f3', category: 'eligibility', question: 'What is the minimum height?', answer: 'The minimum height is 1.68m for male and 1.65m for female applicants, unless otherwise stated for a specific exercise.' },
    { id: 'f4', category: 'eligibility', question: 'What educational qualification do I need?', answer: 'A minimum of four credits in not more than two sittings in WAEC, NECO, NABTEB or GCE, including English Language and Mathematics.' },
    { id: 'f5', category: 'eligibility', question: 'Can married people apply?', answer: 'Applicants for the regular recruit intake must be single. Short Service Commission applicants are not subject to this rule unless stated in the exercise notice.' },
    { id: 'f6', category: 'application', question: 'Can I save my application and continue later?', answer: 'Yes. Every step is saved automatically. You can log in on any device and continue from where you stopped until the closing date.' },
    { id: 'f7', category: 'application', question: 'I did not receive my verification code.', answer: 'Check your spam folder, confirm the email address or phone number is correct, and use the "Resend code" button after 60 seconds. Codes expire after 10 minutes.' },
    { id: 'f8', category: 'application', question: 'Can I edit my application after submission?', answer: 'No. Review your application carefully on the preview page before you submit. After submission you can only view and print your acknowledgement slip.' },
    { id: 'f9', category: 'documents', question: 'What documents do I need to upload?', answer: 'A recent passport photograph (JPG/PNG, max 500KB), O-Level result, birth certificate or age declaration, and certificate of state of origin (PDF/JPG/PNG, max 2MB each).' },
    { id: 'f10', category: 'screening', question: 'How will I know if I am shortlisted?', answer: 'Your status on the portal dashboard will change to "Shortlisted" and later "Invited for Screening" with your venue and date. You will also receive an email and SMS.' },
    { id: 'f11', category: 'screening', question: 'What should I bring to screening?', answer: 'Your printed acknowledgement slip, original credentials, birth certificate, state of origin certificate, and sportswear for the physical fitness test.' },
    { id: 'f12', category: 'training', question: 'Where does recruit training take place?', answer: 'Successful candidates undergo basic military training at the Depot Nigerian Army, Zaria.' },
  ],

  downloads: [
    { id: 'd1', title: 'Recruit Intake — Guidelines for Applicants', category: 'forms', fileType: 'PDF', sizeKb: 420, url: '/downloads/sample.pdf', date: `${y}-09-28` },
    { id: 'd2', title: 'Guarantor / Local Government Attestation Form', category: 'forms', fileType: 'PDF', sizeKb: 180, url: '/downloads/sample.pdf', date: `${y}-09-28` },
    { id: 'd3', title: 'Nigerian Army Annual Report', category: 'reports', fileType: 'PDF', sizeKb: 5200, url: '/downloads/sample.pdf', date: `${y}-03-01` },
    { id: 'd4', title: 'Nigerian Army Magazine', category: 'publications', fileType: 'PDF', sizeKb: 8400, url: '/downloads/sample.pdf', date: `${y}-06-30` },
  ],

  tenders: [
    { ref: `NA/PROC/${y}/014`, title: 'Construction of perimeter fencing at a training institution', category: 'works', publishedAt: `${y}-09-10`, deadline: `${y + 1}-01-20`, status: 'open', description: 'Invitation to tender for the construction of perimeter fencing. Bidders must be registered on the Bureau of Public Procurement database.', documentUrl: '/downloads/sample.pdf' },
    { ref: `NA/PROC/${y}/013`, title: 'Supply of medical consumables to military hospitals', category: 'goods', publishedAt: `${y}-08-25`, deadline: `${y + 1}-01-05`, status: 'open', description: 'Supply and delivery of assorted medical consumables.', documentUrl: '/downloads/sample.pdf' },
    { ref: `NA/PROC/${y}/011`, title: 'Facility management services for Army Headquarters', category: 'services', publishedAt: `${y}-07-02`, deadline: `${y}-08-01`, status: 'closed', description: 'Cleaning, landscaping and facility maintenance services.', documentUrl: '/downloads/sample.pdf' },
    { ref: `NA/PROC/${y}/007`, title: 'Consultancy for ICT infrastructure audit', category: 'consultancy', publishedAt: `${y}-04-15`, deadline: `${y}-05-15`, status: 'awarded', description: 'Independent audit of ICT infrastructure.', documentUrl: '/downloads/sample.pdf' },
  ],

  policies: [
    { id: 'p1', title: 'Privacy Notice (Nigeria Data Protection Act 2023)', category: 'policies', fileType: 'PDF', sizeKb: 210, url: '/privacy', date: `${y}-01-01` },
    { id: 'p2', title: 'Freedom of Information Policy', category: 'policies', fileType: 'PDF', sizeKb: 160, url: '/downloads/sample.pdf', date: `${y}-01-01` },
    { id: 'p3', title: 'Human Rights Policy and Rules of Engagement (public summary)', category: 'policies', fileType: 'PDF', sizeKb: 340, url: '/downloads/sample.pdf', date: `${y}-01-01` },
    { id: 'p4', title: 'Procurement Policy', category: 'policies', fileType: 'PDF', sizeKb: 260, url: '/downloads/sample.pdf', date: `${y}-01-01` },
  ],

  welfare: [
    {
      slug: 'serving-personnel', title: 'Serving Personnel',
      intro: 'Services that support the health, accommodation and wellbeing of serving officers and soldiers.',
      services: [
        { title: 'Military hospitals and medical centres', area: 'healthcare', description: 'Free medical care at Nigerian Army reference hospitals and medical reception stations nationwide.' },
        { title: 'Barracks accommodation', area: 'housing', description: 'Allocation of quarters within barracks and access to the Army Post-Service Housing scheme.' },
        { title: 'Group Life Assurance', area: 'insurance', description: 'Group life insurance cover for all serving personnel.' },
        { title: 'Professional development', area: 'education', description: 'Sponsorship for career courses and approved academic programmes.' },
      ],
    },
    {
      slug: 'veterans', title: 'Veterans',
      intro: 'Support for retired personnel, including pension administration and post-service housing.',
      services: [
        { title: 'Military Pensions Board', area: 'pension', description: 'Enrolment, verification and payment of military pensions and gratuities.', contact: 'Military Pensions Board, Abuja' },
        { title: 'Post-service housing', area: 'housing', description: 'Access to the Nigerian Army Post-Service Housing Development Limited (NAPSHDL) scheme.' },
        { title: 'Veterans’ healthcare', area: 'healthcare', description: 'Medical care for retirees at designated military hospitals.' },
        { title: 'Resettlement training', area: 'education', description: 'Vocational and entrepreneurship training before and after retirement.' },
      ],
    },
    {
      slug: 'families', title: 'Families',
      intro: 'Programmes for spouses, children and dependants of serving and fallen personnel.',
      services: [
        { title: 'Army children schools', area: 'education', description: 'Nursery, primary and secondary education through Command Children Schools.' },
        { title: 'Dependants’ healthcare', area: 'healthcare', description: 'Medical care for registered dependants at military medical facilities.' },
        { title: 'Support for families of the fallen', area: 'support', description: 'Benefits processing, scholarships and counselling for families of personnel who paid the supreme price.' },
        { title: 'Army Officers’ Wives Association (NAOWA)', area: 'support', description: 'Welfare, empowerment and outreach programmes for families in the barracks.' },
      ],
    },
  ],
};
