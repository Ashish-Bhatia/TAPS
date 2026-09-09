# TAPS — Product Vision & PRD

## 1. Vision
TAPS (Teacher Assessment and Preparation System) is a web + mobile platform that helps aspirants for Indian government teaching posts (PRT/TGT/PGT and TET-level exams) discover recruitment notifications, access syllabus/previous papers/study material, and — unlike the source site — **actually prepare and assess themselves** using AI: adaptive practice tests, personalized study plans, and an AI doubt-solving assistant. The source site is a static content/blog site; TAPS's differentiator is the "Assessment" half of its name.

## 2. Target Users
- **Primary:** Aspirants preparing for DSSSB/KVS/NVS/BPSE/UP-TGT-PGT/REET/CTET/UPTET/HTET and similar state/central teaching recruitment exams.
- **Secondary:** Working teachers preparing for promotional exams or TET renewal.

## 3. MVP Scope (Phase 1)
**Content & Discovery (parity with source site's structure):**
- Home feed of latest recruitment notifications ("New Jobs")
- Exam hub pages per exam body (DSSSB, KVS, NVS, BPSE, UP-TGT/PGT, REET) each with: syllabus, exam pattern, eligibility, previous-year papers, study material
- TET hub pages (CTET, UPTET, HTET) with the same sub-structure
- Downloads section (papers, syllabus, study material, NCERT books) as in-app viewers + downloadable PDFs
- Site search across all content
- Static pages: About, Contact, Disclaimer, Privacy Policy

**AI-Enabled Differentiators (see `08-AI-FEATURES-SPEC.md` for detail):**
- AI-generated practice quizzes from previous-year papers, tagged by subject/topic/difficulty
- Adaptive assessment engine (tracks weak topics, adjusts future quiz difficulty/topic mix)
- AI study-plan generator (input: exam + exam date + daily available hours → output: day-by-day plan)
- AI doubt-solving chat assistant scoped to exam syllabi
- Progress dashboard (attempted tests, accuracy trends, weak-topic heatmap)

**Platforms:**
- Responsive web app
- Mobile app (Android first, matching source site's existing APK distribution; iOS in Phase 2)

## 4. Explicit Non-Goals for MVP
- Payment/monetization features (ads, subscriptions) — Phase 2+
- Live classes / video content — Phase 2+
- Multi-language UI beyond English + Hindi — Hindi is Phase 2

## 5. Success Metrics
- Time-to-first-practice-quiz for a new user
- Weekly active test attempts per user
- Notification-to-application click-through (parity feature with source)

## 6. Release Phasing
- **Phase 0:** Repo, environment, CI/CD, architecture skeleton (Sprint 0)
- **Phase 1 (MVP):** Content hubs + search + one AI feature (adaptive quiz engine) + web app
- **Phase 2:** Full AI feature set + mobile app release
- **Phase 3:** Hindi localization, monetization, notifications/push, community features

This phasing is the input to Epic breakdown in the Agile backlog (`04-AGILE-PROCESS.md`).
