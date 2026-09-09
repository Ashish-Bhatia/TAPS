# Source Site Content & IA Inventory — sarkariteachers.com

**Purpose:** Defines the structure, navigation, page types, and feature set TAPS replicates. This is a structural blueprint, not a content source — no text/images from the source site are to be copied into TAPS. All TAPS copy is original, authored to fill the same structural slots.

## Primary Navigation (mega-menu)
1. **Home** — feed of latest posts, popular sections grid, download shortcuts, "explore other opportunities" links, app download CTA
2. **Teaching Exams** (dropdown) → DSSSB, KVS, NVS, BPSE, UP-TGT/PGT, REET — each links to an exam hub page
3. **TET-Exams** (dropdown) → CTET, UPTET, HTET — each an exam hub page
4. **Syllabus** (category page + per-exam sub-pages) → DSSSB, KVS, NVS, HTET, UP TGT/PGT, REET, Super TET, UPTET — each further linking to eligibility/detail articles
5. **Previous Years Papers** (category hub) → per-exam paper archives (DSSSB, KVS, NVS, HTET, REET, UP TGT/PGT)
6. **Study Materials** — subject-wise notes/PDFs hub
7. **New Jobs** — category feed of fresh recruitment notification posts
8. **NCERT Books** — class-wise (6–12) subject-wise book downloads

## Recurring Page Types (templates to build)
1. **Notification/Article post** — title, hero image, body, "Read More", published/modified date, category tags. (Home feed = paginated list of these.)
2. **Exam Hub page** — overview of an exam body + links out to its Syllabus / Pattern / Previous Papers / Study Material / Eligibility sub-pages.
3. **Syllabus page** — per-subject syllabus breakdown, often linking to an "Eligibility Criteria" article.
4. **Previous Papers page** — list of downloadable/viewable PDFs by year and subject.
5. **Study Material page** — subject-wise notes/PDF downloads.
6. **Download index page** — aggregated links across all of the above (this becomes, in TAPS, the natural entry point into the AI quiz generator, since these are the raw materials the AI question bank is built from).
7. **Static/legal pages** — About Us, Contact Us, Disclaimer, Privacy Policy.

## Cross-cutting Features Observed
- Sticky/mega-menu navigation with nested dropdowns (3 levels deep in places)
- Site search
- "Popular Sections" visual grid linking to top exam hubs
- Social links footer (Facebook, YouTube, Telegram, Instagram)
- Native Android APK distributed via a direct download link (no Play Store listing) — **TAPS should instead ship via Play Store/TestFlight for legitimacy and update management**
- Pagination on the home feed
- SEO metadata per post (title, description, OG tags) — carry this discipline into TAPS's CMS/page model

## Mapping to TAPS Data Model (feeds Architecture doc)
| Source concept | TAPS entity |
|---|---|
| Exam body (DSSSB, KVS...) | `ExamBoard` |
| TET exam (CTET, UPTET...) | `ExamBoard` (subtype: TET) |
| Notification/article post | `Post` (type: notification \| syllabus \| article) |
| Previous paper PDF | `PastPaper` (linked to `ExamBoard`, `Subject`, `Year`) — also the raw input for AI-generated `QuizQuestion` bank |
| Study material PDF | `StudyMaterial` (linked to `Subject`) |
| Syllabus page | `Syllabus` (linked to `ExamBoard`, list of `SyllabusTopic`) |
| NCERT book | `Book` (linked to `Class`, `Subject`) |

This table is the seed for the database schema in `05-ARCHITECTURE.md`.
