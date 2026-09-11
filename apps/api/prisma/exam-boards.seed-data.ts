// Structural fields only — names, types, and descriptions below are written
// in our own words from general public knowledge of what each organization
// is, never copied from sarkariteachers.com or any other source site (see
// the legal/content boundary in the project's custom instructions).
export interface ExamBoardSeed {
  name: string;
  type: 'TEACHING' | 'TET';
  description: string;
}

export const examBoards: ExamBoardSeed[] = [
  {
    name: 'DSSSB',
    type: 'TEACHING',
    description:
      'Delhi Subordinate Services Selection Board — recruits teaching and other subordinate staff for Delhi government schools and departments.',
  },
  {
    name: 'KVS',
    type: 'TEACHING',
    description:
      'Kendriya Vidyalaya Sangathan — the central government body running Kendriya Vidyalaya schools nationwide, recruiting PGT/TGT/PRT teachers for them.',
  },
  {
    name: 'NVS',
    type: 'TEACHING',
    description:
      'Navodaya Vidyalaya Samiti — runs the Jawahar Navodaya Vidyalaya residential school system and recruits teachers and staff for its schools.',
  },
  {
    name: 'BPSE',
    type: 'TEACHING',
    description:
      'Bihar School Examination Board — conducts teacher recruitment examinations for government school teaching posts in Bihar.',
  },
  {
    name: 'UP-TGT/PGT',
    type: 'TEACHING',
    description:
      'Uttar Pradesh Trained Graduate Teacher / Post Graduate Teacher recruitment exam — the state-level selection process for TGT and PGT teaching posts in Uttar Pradesh government schools.',
  },
  {
    name: 'REET',
    type: 'TEACHING',
    description:
      'Rajasthan Eligibility Examination for Teachers — the state-level teacher recruitment exam that qualifies candidates for teaching posts in Rajasthan government schools.',
  },
  {
    name: 'CTET',
    type: 'TET',
    description:
      'Central Teacher Eligibility Test — a nationwide eligibility exam conducted by CBSE that qualifies candidates to teach in central government schools across India.',
  },
  {
    name: 'UPTET',
    type: 'TET',
    description:
      'Uttar Pradesh Teacher Eligibility Test — the state-level teacher eligibility exam required to teach in Uttar Pradesh government schools.',
  },
  {
    name: 'HTET',
    type: 'TET',
    description:
      'Haryana Teacher Eligibility Test — the state-level teacher eligibility exam required to teach in Haryana government schools.',
  },
];
