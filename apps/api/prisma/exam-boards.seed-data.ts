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
