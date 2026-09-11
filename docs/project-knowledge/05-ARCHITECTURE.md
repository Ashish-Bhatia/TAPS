# TAPS — Architecture

## 1. Guiding Principles

- One shared backend/API for web + mobile — no duplicated business logic.
- Boring, well-documented tech over novel tech — this is a solo-founder-run product; operability matters more than cleverness.
- AI features are a service layer behind an API boundary, swappable independently of the model provider.

## 2. Recommended Stack

| Layer                       | Choice                                                                            | Why                                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Web frontend                | Next.js (React, TypeScript)                                                       | SSR/SEO parity with the content-heavy source site, single codebase for web                                 |
| Mobile                      | React Native (Expo)                                                               | Shares component logic/patterns with the Next.js team's React knowledge; single codebase for Android + iOS |
| Backend API                 | Node.js + NestJS (TypeScript)                                                     | Structured, testable, shares types with frontend via a shared `packages/types` workspace                   |
| Database                    | PostgreSQL                                                                        | Relational fit for ExamBoard/Post/PastPaper/StudyMaterial/Syllabus model; mature tooling                   |
| ORM                         | Prisma                                                                            | Type-safe schema, migrations, works well with NestJS + shared types                                        |
| File storage (PDFs, images) | S3-compatible object storage (Cloudflare R2 or AWS S3)                            | Cheap at scale, direct CDN delivery                                                                        |
| Search                      | PostgreSQL full-text search initially; Meilisearch if relevance becomes a problem | Avoid overbuilding search for MVP                                                                          |
| AI layer                    | Anthropic API (Claude) behind an internal `AIService` module                      | Question generation, study-plan generation, doubt-solving chat, all isolated behind one interface          |
| Auth                        | NextAuth / Passport (JWT)                                                         | Standard, avoids vendor lock-in for MVP                                                                    |
| CI/CD                       | GitHub Actions                                                                    | Native to GitHub repo, free tier sufficient at MVP scale                                                   |
| Hosting (web)               | Vercel (Next.js) or Fly.io                                                        | Fast to ship, matches Next.js SSR needs                                                                    |
| Hosting (API + DB)          | Fly.io / Railway / Render                                                         | Simple managed Postgres + container hosting                                                                |
| Mobile distribution         | Google Play Console (Android), App Store Connect (iOS, Phase 2)                   | Replaces the source site's raw-APK distribution with a maintainable update channel                         |

## 3. Monorepo Layout

```
/apps
  /web         (Next.js)
  /mobile      (Expo/React Native)
  /api         (NestJS)
/packages
  /types       (shared TS types/DTOs)
  /ui          (shared design tokens/components where feasible)
/docs
  /backlog
  /architecture
  /adr         (Architecture Decision Records)
/infra          (IaC / CI configs)
```

## 4. Core Data Model (v1, derived from `03-SOURCE-SITE-CONTENT-INVENTORY.md`)

- `ExamBoard` (id, name, type[teaching|tet], description)
  - Also carries a `searchVector` (`tsvector`) column for full-text search, added by `TAPS-3.4` — see ADR 009.
- `Post` (id, examBoardId?, type[notification|article], title, slug, body, heroImage, publishedAt, updatedAt)
  - Also carries a `searchVector` (`tsvector`) column for full-text search, added by `TAPS-3.4` — see ADR 009.
- `Syllabus` (id, examBoardId, subject, topics[])
- `PastPaper` (id, examBoardId, subject, year, fileUrl)
- `StudyMaterial` (id, subject, title, fileUrl)
- `Book` (id, class, subject, title, fileUrl)
- `User` (id, email, name, examTargets[], createdAt)
- `QuizQuestion` (id, subject, topic, difficulty, sourcePaperId?, questionText, options[], correctOption, explanation)
- `QuizAttempt` (id, userId, quizId, score, weakTopics[], completedAt)
- `StudyPlan` (id, userId, examBoardId, targetDate, dailyPlan[])

## 5. AI Service Boundary

All AI calls go through `apps/api/src/ai/ai.service.ts`:

- `generateQuizFromPaper(pastPaperId)` → `QuizQuestion[]`
- `getAdaptiveQuiz(userId, examBoardId)` → next quiz tuned to weak topics
- `generateStudyPlan(userId, examBoardId, targetDate, dailyHours)` → `StudyPlan`
- `askDoubt(userId, question, examBoardContext)` → scoped chat response

This isolation means model/provider changes never touch controllers or frontend code.

## 6. Architecture Decision Records (ADRs)

Every significant technical choice (e.g., "why Postgres over Mongo", "why Expo over bare React Native") gets a short ADR in `/docs/adr/NNN-title.md`: Context → Decision → Consequences. Required by `07-DOCUMENTATION-STANDARDS.md`.
