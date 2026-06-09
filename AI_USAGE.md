# AI Usage Log

How AI tooling was used to build the **Weekly Commit Module (WCM)** — the required *AI USAGE LOG*
deliverable. The whole module was built AI-first with **Claude Code** (Opus-tier orchestrator + Task
subagent swarms), driven from a single role-separated session captured turn-by-turn in
[`ai-logging/claude-planner-conversation.md`](ai-logging/claude-planner-conversation.md).

> **Note on completeness.** This project was logged under one role — **planner** — whose session ran
> from initial research (2026-06-08 18:12 CDT) straight through the autonomous build (to 2026-06-09
> 06:43 CDT). The build phases (scaffold → domain → API → integrations → frontend → e2e → stress/CI)
> were executed by **Task subagent swarms inside that same session** rather than as separate
> per-role logs, so there is no distinct `claude-coder-conversation.md` / `claude-designer-conversation.md`;
> their token cost is captured in the planner log's later per-turn lines (the large build turns,
> below). All dollar figures here are **`[EST list-rate]`** — derived from per-turn transcript token
> counts at public list rates, **not** billed cost. An interactive `/usage` block was not available
> for this synthesis (it is the authoritative source when present); see *Usage Numbers* for the
> method and caveats.

## Tools used

- **Claude Code (Claude Opus, orchestrator mode)** — primary driver. Ran research, planning, and then
  an autonomous build: decomposed the brief into tasks, fanned out coder/verifier subagents, reviewed
  their output, and looped eval + QA until green. Kicked off by the `/goal` prompt (#16, below).
- **Task subagents / verifier + blind-QA swarms** — parallel coders for each module (backend domain,
  API, integrations, frontend screens, e2e), then verifier and blind-QA agents that stress-tested the
  running app and fed defects back. These ran on the same Opus tier as the orchestrator (visible as
  the multi-million-token cache-read turns) — a next-time lever is to route deterministic verifier
  checks to a cheaper tier.
- **Test + verify stack** — JUnit 5 + MockMvc + **Testcontainers** Postgres (backend, `mvn verify`),
  **Vitest** + React Testing Library (frontend), **Cypress + Cucumber/Gherkin** + **Playwright** smoke
  (e2e), **k6** (stress). Red→green discipline: regression test first, confirm it fails, fix, re-green.
- **Infra / VCS** — GauntletAI GitLab (source of truth) + GitHub mirror; AWS targeted for deploy
  (ECR/EKS + RDS + S3/CloudFront + SNS/SQS), provisioning gated on credentials + cost approval.
- **AI-logging hook** — a project-local `UserPromptSubmit`/`Stop` hook (`ai-logging/prompt_logger.py`)
  that recorded each prompt and final reply, with a per-turn token line, producing the raw log this
  deliverable is synthesized from.

## How it was built — research + autonomous build, one logged session

### Phase 1 — Planner / research · 2026-06-08 18:12 → 23:30 CDT · prompts #1–#11

Decoded the brief and the ST6/Solovis context, learned the prescribed stack (Module Federation, RTK
Query, Spring Boot, Spotless/SpotBugs, auditing entities), and settled the decisions that fix the
schema and architecture before any code was written.

Architecture-shaping prompts:
- *"Weekly commit CRUD with RCDO hierarchy linking, chess layer for categorization … full weekly
  lifecycle state machine (DRAFT → LOCKED → RECONCILING → RECONCILED → Carry Forward) … Make a chart
  explaining each item here. Expand acronyms."* (#1) → established the RCDO model + the lifecycle FSM
  as the spine of the domain.
- *"Go with cypress since it is under expectations while playwright is only under dev tools. Expand on
  RTK query …"* (#6) → locked Cypress+Gherkin as the primary e2e (Playwright kept as smoke), and the
  RTK Query tag-based cache-invalidation model for the FE data layer.
- *"Go with AWS CDK. What additional env variables do you need for the auth0 and ms graph?"* (#13) →
  fixed the deploy target and the empty-safe env-ref contract (every external secret defaults to blank
  so a bare boot still starts; a non-blank value activates that integration).
- *"I want to prioritize correctness over speed. The fallbacks should not exist."* (#15) → drove the
  no-silent-fallback posture: server-enforced lifecycle, real validation, RFC-7807 problem responses
  instead of permissive defaults.

### Phase 2 — Autonomous build + QA loop · 2026-06-09 00:06 → 06:43 CDT · prompts #16–#17

One directive launched the full build-verify pipeline; the orchestrator then ran hands-off through
the seven feature commits (scaffold, domain, API+security+event seam, Graph+SNS/SQS integrations,
frontend, e2e, stress/CI) with subagent swarms and looped the eval suite + QA until clean.

Architecture-shaping prompts:
- *"/goal Complete the assignment_description. Make assumptions and relay them to me when you finish.
  … Use review agents often and use blind qa agents to stress test the application when done. Loop the
  eval suite + qa agents + blind qa agents until everything runs clean. … The app should have a seeded
  demo based on real solovis expected values. Make sure the testing hits what the assignment
  description demands (unit, e2e, subsystem, api, stress)."* (#16) → the entire autonomous build,
  the demo seeder, and the multi-layer test matrix. This is the turn the heavy build cost belongs to.
- *"After the first blind qa, pause. I will have to travel with no internet."* (#17) → the blind-QA
  pass that produced the defect list this very change set (the RFC-7807 malformed-body fix +
  this AI_USAGE deliverable) closes.

## Validation steps for AI-generated code

- **Test-first, red→green, no vacuous green.** New behavior gets a failing regression test first,
  verified RED, then fixed to GREEN. The blind-QA RFC-7807 fix followed exactly this: four MockMvc
  cases (malformed JSON, bad enum, empty body, wrong media type) were added and confirmed failing
  ("Content type not set", empty body) *before* the `@ExceptionHandler`s were added.
- **Full eval suite as the gate.** Backend `mvn verify` (Spotless + SpotBugs + JUnit/Testcontainers,
  82 tests) and frontend `tsc --noEmit` + `vitest` (93 tests across 21 files) must be green before a
  change is considered done.
- **Blind-QA / verifier swarms.** Independent agents drove the running app to find contract gaps
  (e.g. the bare-403 on unparseable bodies) rather than trusting the coder agents' self-reports.
- **End-to-end coverage to spec.** Cypress+Gherkin BDD e2e, Playwright smoke, and k6 stress exercise
  the lifecycle the way a user/manager hits it, per the brief's unit/e2e/subsystem/api/stress demand.

### Hallucinations / bad output caught

- **Bare 403 on malformed request bodies (blind-QA HIGH).** Coder output had no handler for
  `HttpMessageNotReadableException` / `HttpMediaTypeNotSupportedException`, so an unparseable body
  escaped the `@RestControllerAdvice` and surfaced as an empty 403 via the stateless chain's `/error`
  dispatch — instead of the spec's 400/415 `application/problem+json`. Caught by blind-QA, fixed with
  two explicit handlers (`malformed_request` 400 / `unsupported_media_type` 415) + regression tests.
- **Missing AI_USAGE deliverable.** The build produced the raw per-session log but never synthesized
  the required `AI_USAGE.md` deliverable. Caught in verification; this document closes it.
- **This document's own scope.** Initial framing implied separate coder/designer role logs; corrected
  here to state truthfully that the build ran as subagents within the single planner session, and that
  all costs are list-rate estimates (no interactive `/usage` was available at synthesis time).

## Reflection

**Where AI helped most.** Turning one `/goal` directive into a complete, multi-layer, tested module —
domain FSM, API + RFC-7807 errors + Auth0 + row-level authz, Graph/eventing seams, a federated React
frontend, and the full test pyramid — with the orchestrator fanning work across subagents and looping
QA to green without per-step human input.

**Where it produced bad output.** Error-contract edge cases the happy-path tests didn't cover (the
malformed-body 403), and a missed deliverable (this log) — both surfaced only by an adversarial
blind-QA pass, not by the coder agents themselves.

**What I'd do differently.** Route deterministic verifier checks to a cheaper model tier (the
verifier swarms ran on Opus — the multi-million-token cache-read turns); capture `/usage` per phase
*before* sessions age out so the deliverable carries measured cost rather than list-rate estimates;
and log build subagents under their own role files so per-phase attribution is exact.

---

## Usage Numbers

**Source & method.** No interactive `/usage` block was available when this deliverable was
synthesized (it is the authoritative source when present). The figures below are summed from the
per-turn token lines the logging hook recorded in `claude-planner-conversation.md` (each line already
de-duplicates streamed responses by request id and prices 5m vs 1h cache writes separately), plus a
project-wide transcript sum as an activity cross-check. **Every dollar figure is `[EST list-rate]`**,
computed at public list rates from token volume — transcripts never record billed cost, so these are
an estimate, not a measured invoice.

### Session totals — estimated from per-turn token lines (14 logged turns)

| Metric | Value |
|---|---|
| Span | 2026-06-08 18:12 → 2026-06-09 06:43 CDT |
| Logged turns with token lines | 14 |
| Model | Claude Opus (orchestrator) + Task subagents |
| Input tokens | ~63,966 |
| Output tokens | ~457,582 |
| Cache read | ~54,422,086 |
| Cache write | ~2,082,595 |
| Total tokens | ~57,026,229 |
| **Total cost** | **~$58 [ESTIMATED, list-rate]** (sum of the per-turn `[EST list-rate]` figures; 2 of 14 turns recorded tokens only, so true total is somewhat higher) |

The cost is overwhelmingly **cache reads (~95% of tokens)** — i.e. spend went to re-feeding the
growing project context into orchestration, review, and verification turns, not to fresh generation.
The two largest turns dominate: prompt **#11** (planning/conformance, ~$12.03) and prompt **#17** (the
build + blind-QA turn, ~$34.12 on ~30.8M cache-read tokens).

### Largest per-turn costs (from the log's per-turn lines, `[EST list-rate]`)

| Prompt | What it drove | in | cache-read | cache-write | out | ~$ |
|---|---|---:|---:|---:|---:|---:|
| #17 | Autonomous build + first blind-QA | 8,109 | 30,827,946 | 1,489,669 | 150,728 | $34.12 |
| #11 | PRD conformance / planning depth | 40,623 | 9,384,672 | 391,555 | 128,585 | $12.03 |
| #12 | IaC / deploy + env contract | 544 | 5,372,093 | 42,811 | 39,536 | $4.11 |
| #4 | Research plan + blocking questions | 1,233 | 3,083,085 | 63,801 | 39,065 | $3.16 |
| #14 | Vite/Auth0/Graph slot-in design | 280 | 2,436,857 | 19,466 | 19,602 | $1.90 |

### Transcript token volume by day (project-wide activity proxy)

De-duplicated by request id across the project's session transcript (`~/.claude/projects/<slug>/*.jsonl`).
These sums include every subagent turn, so they exceed the foreground per-turn totals above — an
**activity proxy, not a billed-cost number**.

| Day | Turns | Input | Output | Cache read | Cache write |
|---|---:|---:|---:|---:|---:|
| 2026-06-08 | 19 | 12,546 | 53,710 | 1,532,691 | 116,779 |
| 2026-06-09 | 133 | 52,372 | 430,554 | 58,358,738 | 2,027,943 |
| **Total** | **152** | **64,918** | **484,264** | **59,891,429** | **2,144,722** |

Grand total tokens (activity proxy): **~62.6M**.
