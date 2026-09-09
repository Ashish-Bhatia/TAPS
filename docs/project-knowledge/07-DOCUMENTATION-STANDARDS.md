# TAPS — Documentation Standards

Documentation is a Definition-of-Done requirement, not a separate task. If it isn't documented, the story isn't done.

## Structure (`/docs` in repo)

```
/docs
  /backlog/BACKLOG.md          — living product backlog (table)
  /architecture/               — system diagrams, data model, one file per major subsystem
  /adr/NNN-title.md            — Architecture Decision Records
  /api/                        — API endpoint reference (generated from NestJS/OpenAPI where possible)
  /runbooks/                   — "how to do X" operational docs (deploy, restore DB, rotate keys)
  /sprints/sprint-NN-summary.md — end-of-sprint summary (what shipped, what moved, retro notes)
  /setup/                      — environment/local dev setup instructions
```

## What Must Be Documented, and When

| Event                                                                                         | Doc required                                                                                      |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| New Epic started                                                                              | One-page summary in `/docs/architecture/` if it introduces a new subsystem                        |
| New user-facing feature                                                                       | Acceptance criteria (already in backlog) + short usage note if behavior isn't obvious from the UI |
| New API endpoint                                                                              | Entry in `/docs/api/`                                                                             |
| Architectural or technical choice with real trade-offs                                        | ADR in `/docs/adr/`                                                                               |
| Any manual step the founder had to perform (env var, third-party console click, key rotation) | Runbook entry in `/docs/runbooks/`, so it's repeatable without re-deriving it                     |
| Sprint ends                                                                                   | `/docs/sprints/sprint-NN-summary.md`                                                              |

## ADR Format

```
# NNN — <Decision Title>
Status: Proposed | Accepted | Superseded by NNN
Context: what problem forced this decision
Decision: what was chosen
Consequences: what this makes easier, what it makes harder
```

## README Requirement

Repo root `README.md` always reflects current reality: how to run web/mobile/api locally, current architecture summary (one paragraph + link to `/docs/architecture`), current Sprint number and link to its backlog view. Claude updates this every sprint — it must never go stale.

## Ownership

Claude Code writes and commits documentation as part of the same PR as the code it describes — never as a deferred "documentation sprint" cleanup pass. This is what makes "everything needs to be documented" enforceable rather than aspirational.
