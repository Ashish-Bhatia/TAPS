# TAPS — Agile Process

Adapted Scrum for a two-member team: Ashish (Product Owner) + Claude (entire engineering team, across chat + Claude Code).

## 1. Hierarchy
```
Phase (from PRD)
 └── Epic (a major capability, e.g. "Exam Content Hubs")
      └── User Story (INVEST: Independent, Negotiable, Valuable, Estimable, Small, Testable)
           └── Task (technical breakdown, Claude-only granularity)
```

## 2. User Story Format (mandatory)
```
ID: TAPS-<epic-number>.<story-number>
Title: As a <user>, I want <capability>, so that <benefit>
Acceptance Criteria:
  - Given/When/Then, at least 2, testable
Definition of Ready: data model / design dependency named and resolved
Estimate: S / M / L (relative sizing, not hours)
Doc impact: which doc(s) in /docs get updated when this ships
```

## 3. Sprint Cadence
- **Sprint length:** 1 week (short, because the "team" is available continuously — avoids multi-week drift)
- **Sprint 0** is mandatory before any product feature work: repo scaffold, CI/CD, environment config, architecture skeleton, empty-but-deployed web + mobile shells.
- **Sprint Planning:** at the start of each sprint, Claude proposes a Sprint Backlog (subset of the Product Backlog) sized to what can realistically be completed; Ashish approves or adjusts.
- **Daily async check-in:** not a meeting — Claude posts a short status note (what shipped, what's blocked, what's next) at the end of any session with committed work.
- **Sprint Review:** at sprint end, Claude produces a demo-able summary + updated docs + a list of what moved to Done.
- **Retro:** short — what slowed the sprint down, one process change to try next sprint. This directly feeds `10-LOOP-PREVENTION-PROTOCOL.md` if the slowdown was a stuck loop.

## 4. Definition of Ready (a story can enter a sprint)
- Acceptance criteria written
- Dependencies (API, data model, design) identified and not blocking
- Doc impact identified

## 5. Definition of Done (a story can be marked Done)
- Code written, committed, PR opened with description referencing the Story ID
- Tests written and passing (unit at minimum; integration where the story touches an API boundary)
- Relevant doc(s) in `/docs` updated in the same PR
- No known regression in existing functionality
- If the story required a founder action (Step 2/3/7 from Custom Instructions), those exact steps were delivered and confirmed complete

## 6. Backlog Location
The Product Backlog lives as `/docs/backlog/BACKLOG.md` in the repo (Markdown table: ID, Title, Epic, Status, Sprint), maintained by Claude Code as part of normal commits — not only in chat. Chat-Project planning proposes stories; Claude Code commits them into the tracked backlog file.

## 7. Epics for Phase 0–1 (seed list, to be refined at Sprint 0 planning)
- EPIC 1: Repo, CI/CD & environment scaffolding
- EPIC 2: Content data model + CMS/admin for Posts, ExamBoards, PastPapers, StudyMaterial, Syllabus
- EPIC 3: Web app — navigation, exam hub pages, search
- EPIC 4: AI quiz engine (question generation + adaptive selection)
- EPIC 5: User accounts, progress dashboard
- EPIC 6: Mobile app (Android)
- EPIC 7: AI study-plan generator
- EPIC 8: AI doubt-solving assistant
