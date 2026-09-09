# TAPS — AI Features Specification

This is what makes TAPS an "Assessment System" rather than a content blog. All features route through `AIService` (see `05-ARCHITECTURE.md §5`).

## 1. AI Quiz Generation from Past Papers

**Input:** a `PastPaper` record (PDF text extracted at ingestion time)
**Process:** Claude extracts question/answer pairs, tags each by subject + topic + difficulty, normalizes into `QuizQuestion` records.
**Output:** a structured, searchable question bank — instead of the source site's "download a PDF and hope," users get an interactive quiz immediately.
**Story seed:** TAPS-4.1 "As a user, I want to take a quiz generated from real past papers, so that my practice matches the actual exam."

## 2. Adaptive Assessment Engine

**Input:** a user's `QuizAttempt` history
**Process:** track per-topic accuracy; next quiz oversamples weak topics and adjusts difficulty (harder if consistently correct, easier if consistently wrong, to keep the user in a productive difficulty zone).
**Output:** a personalized next quiz + a weak-topic heatmap on the dashboard.
**Story seed:** TAPS-4.3 "As a user, I want my next quiz to focus on my weak topics, so that I improve efficiently instead of re-practicing what I already know."

## 3. AI Study Plan Generator

**Input:** exam target, exam date, daily hours available, current weak topics (if any attempts exist yet)
**Process:** generate a day-by-day plan covering full syllabus breadth first, then weighting toward weak topics as the exam date approaches.
**Output:** a `StudyPlan` record rendered as a calendar/checklist in-app.
**Story seed:** TAPS-7.1 "As a user, I want a personalized day-by-day study plan for my exam date, so that I don't have to plan my own syllabus coverage."

## 4. AI Doubt-Solving Assistant

**Input:** a user's free-text question, scoped to their selected `ExamBoard`/subject context
**Process:** Claude answers strictly within the syllabus scope, citing the relevant topic; refuses or redirects if asked something outside the exam-prep domain (defined guardrail, not open-domain chat).
**Output:** in-app chat thread, retained per user for reference.
**Story seed:** TAPS-8.1 "As a user, I want to ask a doubt about a topic and get an explanation scoped to my exam syllabus, so that I don't need to search elsewhere."

## 5. Guardrails (apply to all four features)

- Every AI-generated question/answer is flagged `ai_generated: true` and reviewable/editable by an admin — never presented as officially sourced from the exam body without review.
- No AI feature invents exam dates, eligibility criteria, or notification details — those come only from ingested `Post`/`Syllabus`/`ExamBoard` records, never generated freeform. This is a factual-accuracy boundary specific to a domain where wrong info costs users a real exam attempt.
- Doubt-assistant stays within exam-prep scope; out-of-scope questions get a polite redirect, not a best-effort answer.

## 6. Phase Placement

- Quiz generation + adaptive engine: Phase 1 (MVP) — this is the core differentiator, ship it first.
- Study plan generator: Phase 2
- Doubt-solving assistant: Phase 2 (needs the guardrail work above to be production-safe)
