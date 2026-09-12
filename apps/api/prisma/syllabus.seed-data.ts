// TAPS-2.15: real syllabus content for the exam boards seeded by
// exam-boards.seed-data.ts. Every subject/topic list below is transcribed
// (not copied from sarkariteachers.com or any other aggregator — see the
// project's legal/content boundary and docs/runbooks/database-seeding.md)
// from that board's own official notification/information-bulletin PDF, one
// subject at a time, not paraphrased or invented. Each entry records its
// exact official source so the mapping can be re-verified later.
//
// TAPS-2.14's investigation found only 9 real ExamBoard rows exist (not the
// 11 originally assumed) — this file covers exactly those 9. Of those, an
// official-source syllabus could be reliably sourced for 4 boards (CTET,
// HTET, REET, DSSSB). For the remaining 5 (UPTET, KVS, NVS, BPSE,
// UP-TGT/PGT), real, current, machine-fetchable official syllabus content
// could not be found despite genuine effort — see each board's comment
// below for what was tried and why it was abandoned — so, per this story's
// explicit instruction, nothing is fabricated for them: they simply have no
// entry here, and apps/web's per-board Syllabus page (already wired to real
// data by TAPS-3.6) shows its existing "no syllabus published yet" empty
// state for them rather than invented content.
export interface SyllabusSeed {
  examBoardName: string;
  subject: string;
  topics: string[];
}

export const syllabuses: SyllabusSeed[] = [
  // ─── CTET (TET) ───────────────────────────────────────────────────────
  // Source: CBSE's official "CTET-SEPTEMBER, 2026 Information Bulletin"
  // Appendix-I, fetched from https://ctet.nic.in/'s own information-bulletin
  // link (a cdnbbsr.s3waas.gov.in-hosted government PDF). Two Syllabus rows
  // — CTET's own structure splits Paper I (classes I-V) and Paper II
  // (classes VI-VIII) into different compulsory sections, so "Paper I" and
  // "Paper II" are modeled as two subjects rather than merged into one.
  {
    examBoardName: 'CTET',
    subject: 'Paper I (Classes I–V)',
    topics: [
      'Child Development and Pedagogy — Child Development (Primary School Child)',
      'Child Development and Pedagogy — Concept of Inclusive Education and understanding children with special needs',
      'Child Development and Pedagogy — Learning and Pedagogy',
      'Mathematics — Content: Geometry, Shapes & Spatial Understanding, Numbers, Addition and Subtraction, Multiplication, Division, Measurement, Data Handling, Patterns, Money',
      'Mathematics — Pedagogical issues',
      'Environmental Studies — Content: Family and Friends, Food, Shelter, Water, Travel, Things We Make and Do',
      'Environmental Studies — Pedagogical Issues',
      'Language I — Language Comprehension',
      'Language I — Pedagogy of Language Development',
      'Language II — Comprehension',
      'Language II — Pedagogy of Language Development',
    ],
  },
  {
    examBoardName: 'CTET',
    subject: 'Paper II (Classes VI–VIII)',
    topics: [
      'Child Development and Pedagogy — Child Development (Elementary School Child)',
      'Child Development and Pedagogy — Concept of Inclusive Education and understanding children with special needs',
      'Child Development and Pedagogy — Learning and Pedagogy',
      'Mathematics — Number System, Algebra, Geometry, Mensuration, Data handling',
      'Mathematics — Pedagogical issues',
      'Science — Food, Materials, The World of the Living, Moving Things People and Ideas, How things work, Natural Phenomena, Natural Resources',
      'Science — Pedagogical issues',
      'Social Studies/Social Sciences — History, Geography, Social and Political Life',
      'Social Studies/Social Sciences — Pedagogical issues',
      'Language I — Language Comprehension',
      'Language I — Pedagogy of Language Development',
      'Language II — Comprehension',
      'Language II — Pedagogy of Language Development',
    ],
  },

  // ─── HTET (TET) ───────────────────────────────────────────────────────
  // Source: Board of School Education Haryana's official "HTET-2024
  // Information Bulletin" (bseh.org.in/uploads/files/...pdf, linked from
  // bseh.org.in's own search results), Annexure-I "Content of Syllabus".
  // Three Syllabus rows for HTET's three levels (PRT/TGT/PGT), each row's
  // topics drawn only from that level's common papers (Child Development &
  // Pedagogy, Languages, General Studies) plus its Mathematics/EVS or
  // Science subject-specific section — not every one of HTET's ~30
  // subject-specific option papers (TGT English, PGT Physics, etc.), which
  // would make each row unreadably long; those option-subject syllabi exist
  // in the same official bulletin and can be added the same way if needed.
  {
    examBoardName: 'HTET',
    subject: 'Level I — Primary Teacher (PRT), Classes I–V',
    topics: [
      'Child Development and Pedagogy (Part I)',
      'Language I (Hindi) — Comprehension and Pedagogy of Language Development',
      'Language II (English) — Comprehension and Pedagogy of Language Development',
      'General Studies — Haryana-related history, current affairs, geography, civics, culture',
      'General Studies — General Intelligence & Reasoning',
      'General Studies — Quantitative Aptitude',
      'Mathematics — Content and Pedagogical Issues',
      'Environmental Studies — Content and Pedagogical Issues',
    ],
  },
  {
    examBoardName: 'HTET',
    subject: 'Level II — Trained Graduate Teacher (TGT), Classes VI–VIII',
    topics: [
      'Child Development and Pedagogy (Part I)',
      'Language I (Hindi) — Comprehension and Pedagogy of Language Development',
      'Language II (English) — Comprehension and Pedagogy of Language Development',
      'General Studies — Haryana-related history, current affairs, geography, civics, culture',
      'General Studies — General Intelligence & Reasoning',
      'General Studies — Quantitative Aptitude',
      'Subject Specific (one paper opted, e.g. Mathematics, Science, Social Studies, English, Hindi, Sanskrit)',
    ],
  },
  {
    examBoardName: 'HTET',
    subject: 'Level III — Post Graduate Teacher (PGT)',
    topics: [
      'Child Development and Pedagogy (Part I, PGT-level)',
      'Language I (Hindi) — Comprehension and Pedagogy of Language Development',
      'Language II (English) — Comprehension and Pedagogy of Language Development',
      'General Studies — Haryana-related history, current affairs, geography, civics, culture',
      'General Studies — General Intelligence & Reasoning',
      'General Studies — Quantitative Aptitude',
      'Subject Specific (one paper opted, e.g. English, Hindi, Mathematics, Physics, Chemistry, Biology, History, Political Science, Commerce, Economics)',
    ],
  },

  // ─── REET (TEACHING per this repo's ExamBoard.type, despite REET
  //      standing for "Rajasthan Eligibility Examination for Teachers" —
  //      that classification predates this story and is out of scope to
  //      change here) ───────────────────────────────────────────────────
  // Source: Rajasthan Board of Secondary Education's own site
  // (rajeduboard.rajasthan.gov.in/RTET-REET/L2MathematicsandScience.pdf) —
  // the official Level 2 (classes VI-VIII), Paper II, Part (iv)a
  // "Mathematics and Science" syllabus, bilingual Hindi/English in the
  // source PDF. Only this one subject/paper was reachable within this
  // story's effort — REET's other Level 2 papers (Social Studies, Sanskrit,
  // etc.) and its Level 1 (classes I-V) syllabus were not found as
  // individually linked official PDFs during this pass.
  {
    examBoardName: 'REET',
    subject: 'Level 2, Paper II — Mathematics and Science',
    topics: [
      'Indices — multiplication and division of numbers on equal bases, laws of indices',
      'Algebraic expressions — addition, subtraction, multiplication and division, identities',
      'Factors — factors of simple algebraic expressions',
      'Equations — simple linear equation',
      'Square & Square Root',
      'Cube & Cube Root',
      'Interest — simple interest, compound interest, profit and loss',
      'Ratio and Proportion — division into proportional parts, partnership',
      'Percentage, birth and death rate, population growth, depreciation',
      'Lines and Angles — line segment, straight and curved lines, types of angles',
      'Plane figures — triangles, congruence of triangles, quadrilaterals and circle',
      'Area of plane figures — triangles, rectangles, parallelograms and trapeziums',
      'Surface area and volume — cube, cuboid and right circular cylinder',
      'Statistics — collection and classification of data, frequency distribution table, bar graph and histogram, circular graph',
      'Graph — various types of graphs',
      'Nature of Mathematics/logical thinking, place of Mathematics in curriculum, language of Mathematics, community Mathematics',
      'Evaluation, remedial teaching, problems of teaching (Mathematics)',
      'Micro-organisms — bacteria, virus, fungi (beneficial and harmful)',
      'Living beings — plant parts, nutrition in plants, respiration and excretion, plant and animal cell structure and function, cell division',
      'Human body and health — diseases spread by micro-organisms, prevention, human body systems, infectious diseases, food components and deficiency diseases, balanced diet',
      'Animal reproduction and adolescence — methods of reproduction, adolescence and puberty, reproductive health',
      'Force and motion — types of forces, pressure, types of motion, speed',
      'Energy — types and sources, energy conservation',
      'Heat — applications, transformation, temperature, melting/boiling/evaporation, insulators and conductors, methods of heat transfer',
      'Light and sound — sources of light, shadows, reflection, image formation, types and propagation of sound, echo, noise',
      'Science and technology — synthetic fibres and plastics, science and technology in medicine and telecommunication',
      'Solar system — moon and stars, sun and planets, comets, constellations',
      'Structure of matter — atom and molecule, element, compound and mixture, chemical symbols and formulae',
      'Chemical substances — oxides, greenhouse effect and global warming, hydrocarbons, acids/alkalis/salts, oxygen and nitrogen gas, nitrogen cycle, coal, petroleum and natural gas',
      'Nature and structure of science, aims and objectives, methods of science teaching',
      'Innovation, teaching material/aids, evaluation, problems, remedial teaching (Science)',
    ],
  },

  // ─── DSSSB (TEACHING) ─────────────────────────────────────────────────
  // Source: dsssb.delhi.gov.in's own "universal-tab" document library —
  // "Syllabus for TGT (English) in DoE & NDMC" and "Syllabus for TGT
  // (Natural Science), Male & Female & TGT (Physical/Natural Science) in
  // DoE & NDMC" PDFs, both genuinely subject-specific teacher-post syllabi
  // (not the separate general clerical/stenographer paper also found on the
  // same site, which is a different exam altogether and out of scope
  // here).
  {
    examBoardName: 'DSSSB',
    subject: 'TGT English',
    topics: [
      'Indian Classical Literature',
      'European Classical Literature',
      'Indian Writing in English',
      'British Poetry and Drama: 14th to 17th Centuries',
      'American Literature: 18th Century',
      'British Poetry and Drama: 17th and 18th Centuries',
      'British Literature: 18th Century',
      'British Romantic Literature',
      'British Literature: 19th Century',
      "Women's Writing",
      'British Literature: The Early 20th Century',
      'Modern European Drama',
      'Postcolonial Literatures',
      'Discipline Centric Elective — Modern Indian Writing in English Translation, Literature of the Indian Diaspora, British Literature: Post World War II, Nineteenth Century European Realism, Literary Criticism, Literary Theory, Partition Literature, Research Methodology',
      'Generic Elective — Academic Writing and Composition, Media and Communication Skills, Language and Linguistics',
      'Ability/Skill Enhancement — English Language Teaching, Translation Studies, Creative Writing, Technical Writing',
      'Topics of syllabus — Teaching Education and Methodology: Learning & Teaching, Language across the curriculum, Understanding discipline and subject, Pedagogy of a school subject, Assessment for learning, Creating an inclusive school',
    ],
  },
  {
    examBoardName: 'DSSSB',
    subject: 'TGT Natural Science',
    topics: [
      'Effect of Current — potential difference, Ohm’s law, series/parallel resistors, power dissipation, magnetic field due to current, electromagnetic induction, AC/DC',
      'Light — convergence and divergence, concave/convex mirrors and lenses, refraction, refractive index, dispersion and scattering of light',
      'Sources of Energy — fossil fuels, solar, biogas, wind, tidal, nuclear; renewable vs non-renewable',
      "Motion, Force and Newton's Laws",
      'Gravitation, Work, Energy and Power',
      'Floatation — thrust and pressure, Archimedes’ Principle, buoyancy, relative density',
      'Sound — nature, propagation, speed, range of hearing, echo, SONAR, structure of the human ear',
      'Matter — Nature and Behaviour: states of matter, mixtures and pure substances, laws of chemical combination',
      'Structure of the Atom — Dalton, Thomson, Rutherford and Bohr models, electronic configuration, isotopes/isobars/isotones',
      'Periodic Classification of Elements',
      'Chemical Substances — acids, bases and salts',
      'Chemical Reactions — formulation, balancing, types',
      'Metals and Non-Metals — properties, occurrence, corrosion',
      'Carbon Compounds — hybridization, functional groups, hydrocarbons, alcohols, carboxylic acids, soaps and detergents',
      'Conservation of Natural Resources',
      'Man-Made Materials — ceramics, cement, glass, carbon fibres, polymers, plastics',
      'Life Processes — nutrition, photosynthesis, respiration, transportation, excretion',
      'Control & Co-ordination — nervous system, reflex action, hormones, endocrine and exocrine glands',
      'Reproduction — modes of reproduction, human reproduction, family planning',
      'Heredity and Evolution',
      'The Human Eye and the Colourful World',
      'Natural Resources — cell structure, tissues, diversity of living organisms, disease and immunisation, environment and pollution',
      'Improvement in Food Resources — crop yield, animal husbandry, intercropping, cross breeding',
      'Bone and Cartilage, Animal Diversity, Comparative Anatomy and Developmental Biology of Vertebrates',
      'Physiology and Biochemistry, Applied Zoology, Aquatic Biology, Immunology, Reproductive Biology, Insects/Vectors and Diseases, Sericulture',
    ],
  },
];
