# TAPS — Loop Prevention & Escalation Protocol
**This document is mandatory reading. Its rules override "keep trying" instincts.**

## Why this exists
Long-running AI-driven development can get stuck: repeating the same failed fix, oscillating between two designs, or endlessly "refining" something without shipping it. This protocol makes stalling detectable and forces a decision.

## Hard Rules

1. **Two-strike rule on fixes.** If an attempted fix for the same bug/error fails twice, do not attempt a third variation of the same approach. Stop, state plainly: "Two attempts at [approach] have failed: [what happened each time]." Then either propose a genuinely different approach, or escalate (Rule 4).

2. **Decision oscillation check.** If a design/architecture question has been revisited more than once in the same session without new information changing the analysis, stop and name it: "We've discussed [X vs Y] twice without new information. Here's my recommendation and why — confirm or override." Do not open a third round of the same comparison unsolicited.

3. **No silent scope creep as a stalling tactic.** If a story seems stuck, the answer is never to quietly expand it into a bigger refactor to "solve it properly." Ship the smallest change that satisfies the acceptance criteria; file a follow-up story for anything bigger.

4. **Escalation format** (when Rule 1 or 2 triggers, or a task requires a founder-only action):
   ```
   BLOCKED: [one-line description]
   Tried: [what was attempted, and result of each attempt]
   Options:
     A) [option] — tradeoff
     B) [option] — tradeoff
   Recommendation: [A or B, and why]
   Needs from you: [exact decision, or exact action per Custom Instructions Rule 2]
   ```
   This format is used in-chat and, for repo-affecting blocks, also written to `docs/runbooks/` or as a comment on the relevant GitHub issue/PR so it isn't lost.

5. **Session/context boundaries.** At the start of any new working session (new chat, or a fresh Claude Code invocation), re-state current Sprint, current Story in progress, and last known state before continuing — never assume unstated context carried over perfectly. This prevents "loop via amnesia," where work is redone because prior state wasn't re-established.

6. **Time-box exploratory work.** Any task framed as "figure out the best way to do X" gets an explicit budget (e.g., "one comparison pass, then decide") before starting — open-ended exploration without a stopping condition is itself a loop risk.

7. **CI/test failures.** If the same test fails after a fix is pushed, do not push a second unverified guess — reproduce the failure locally/in Codespace first, confirm the actual cause, then fix. Guessing repeatedly against CI is a loop.

## What "not stuck" looks like
Forward progress every session: a story moves state (Ready → In Progress → Done, or explicitly Blocked with the escalation format above) — it never just sits in the same state across multiple sessions without a stated reason.
