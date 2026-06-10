# AI Usage Log

How AI tooling was used to build the **Weekly Commit Module (WCM)** — the required *AI USAGE LOG*
deliverable. The whole module was built AI-first: a **Claude Code** Opus-tier orchestrator (research →
planning → an autonomous `/goal` build → live integrations → AWS deploy) plus **Claude Design** (a
separate Claude-powered frontend design agent) for the UI. The driving session is captured turn-by-turn
in [`ai-logging/claude-planner-conversation.md`](ai-logging/claude-planner-conversation.md).

> **Note on completeness & method.** Engineering/orchestration was logged under one role — **planner**
> — whose session ran from initial research (2026-06-08 18:12 CDT) through the autonomous build, the
> live Auth0 + Microsoft Graph integration grind, the documentation pass, and the AWS deploy that put
> the app live (2026-06-09 22:36 CDT, **http://44.218.6.116/**). The build phases (scaffold → domain →
> API → integrations → frontend → e2e → stress/CI) ran as **Task subagent swarms inside that same
> session**, so their cost is folded into the planner log's per-turn lines rather than separate
> `claude-coder-conversation.md` files. The **frontend visual design** was done in a *separate* tool,
> **Claude Design**, whose handoff artifacts live locally under `design/` (gitignored). All dollar
> figures are **`[EST list-rate]`** — summed from the per-turn token lines the logging hook recorded, at
> public list rates, **not** billed cost. No interactive `/usage` block was available at synthesis time
> (it is authoritative when present), and **14 of the 53 logged turns recorded tokens without a price**,
> so the headline dollar figure is a **verified lower bound** — see *Usage Numbers*.

## Tools used

- **Claude Code (Claude Opus, orchestrator mode)** — primary driver. Ran research, planning, then an
  autonomous build: decomposed the brief into tasks, fanned out coder/verifier subagents, reviewed their
  output, and looped eval + QA until green. Kicked off by the `/goal` prompt (#16, below) and carried
  through live integrations, docs, and deploy.
- **Claude Design** — a separate Claude-powered **frontend design agent**, briefed via
  `design/CLAUDE_DESIGN_BRIEF.md` (theming + the 9-screen page→sub-page→feature inventory + the hard
  Flowbite/Tailwind/MF constraints). It produced a high-fidelity design suite (OKLCH token system, IBM
  Plex typography, the lifecycle/RCDO/chess component set, all 9 screens + the widget) that engineering
  **adapted into the `apps/wc-remote` React 18 + Flowbite + Tailwind Module-Federation remote**. The
  first handoff was off-target and was caught and re-driven (see *Hallucinations caught*). Artifacts are
  local: `design/_cdesign/` (v1, off-target) and `design/_v2/` (the corrected WCM suite).
- **Task subagents / verifier + blind-QA swarms** — parallel coders for each module (backend domain, API,
  integrations, frontend screens, e2e), then verifier, blind-QA, and focused-testing agents that
  stress-tested the running app and fed defects back. These ran on the same Opus tier as the
  orchestrator (visible as the multi-million-token cache-read turns) — a next-time lever is to route
  deterministic verifier checks to a cheaper tier.
- **Test + verify stack** — JUnit 5 + MockMvc + **Testcontainers** Postgres (backend, `mvn verify`,
  JaCoCo 80% gate, Spotless + SpotBugs), **Vitest** + React Testing Library (frontend), **Cypress +
  Cucumber/Gherkin** (chosen over Playwright at #6) + **Playwright** smoke (e2e), **k6** (stress).
  Red→green discipline: regression test first, confirm it fails, fix, re-green.
- **Identity / integrations (real, not mocked)** — **Auth0** (OAuth2 JWT; management-API token wired
  #28–#29) and **Microsoft Graph / Outlook** delegated calendar (Azure app `WCM Outlook` on a paid
  tenant after dev-program ineligibility; admin consent + group calendars; #30–#52).
- **Infra / VCS / delivery** — **AWS single-host EC2** deploy (`t3.small`, **Docker Compose**: Postgres +
  Spring backend + nginx-served federated frontend, on an Elastic IP) live at **http://44.218.6.116/**;
  GauntletAI **GitLab** (source of truth) + **GitHub** mirror.
- **AI-logging hook** — a project-local `UserPromptSubmit`/`Stop` hook (`ai-logging/prompt_logger.py`)
  that recorded each prompt and final reply with a per-turn token line, producing the raw log this
  deliverable is synthesized from.

## How it was built — research, design, autonomous build, live integration, deploy

Eight phases across ~28 hours of wall-clock (2026-06-08 18:12 → 2026-06-09 22:39 CDT), 70 logged prompts.

### Phase A — Research / dossier · prompts #1–#4 · Jun 8 18:12 → 18:30
Decoded the assignment line-items (Weekly Commit CRUD, RCDO hierarchy, chess layer, lifecycle FSM,
reconciliation, manager roll-up, MF integration) and set the ST6/Solovis context.
- *"The company this project is for is ST6 for a position in solovis. We should put together a research
  plan … determining all the functionality of ff, down to the detail of each page … Maybe we can find
  the APIs they mention and probe them."* (#2) → launched the 15Five feature-by-feature dossier.

### Phase B — Planning & tech-stack decisions · #5–#15 · Jun 8 19:15 → 23:56
A deep tech-explainer + decision-locking pass that fixed the schema and architecture before any code:
TS strict, JaCoCo 80%, Vitest, Spotless/SpotBugs, AbstractAuditingEntity, and the RTK Query tag-based
cache-invalidation model (the long #6–#9 RTK Query teardown).
- *"Go with cypress since it is under expectations while playwright is only under dev tools."* (#6) →
  locked **Cypress + Cucumber/Gherkin** as the primary e2e, Playwright as smoke.
- *"Go with AWS CDK. What additional env variables do you need for the auth0 and ms graph?"* (#13) →
  fixed the deploy target and the empty-safe env-ref contract (every secret defaults blank so a bare
  boot starts; a non-blank value activates that integration).
- *"I want to prioritize correctness over speed. The fallbacks should not exist."* (#15) → the standing
  **no-silent-fallback** discipline: real MF, real Graph, real Auth0, server-enforced lifecycle,
  RFC-7807 errors instead of permissive defaults.

### Phase C — Autonomous `/goal` build · #16–#21 · Jun 9 00:06 → 08:16
One directive launched the full build-verify pipeline; the orchestrator ran hands-off through the
feature commits (scaffold, domain, API + security + event seam, Graph + SNS/SQS, frontend, e2e,
stress/CI) with subagent swarms, looping the eval suite + QA to green; interrupted for offline travel
and resumed from a `/handoff`.
- *"/goal Complete the assignment_description … Use review agents often and use blind qa agents to stress
  test … Loop the eval suite + qa agents + blind qa agents until everything runs clean … end on
  deploying to AWS fully … The app should have a seeded demo based on real solovis expected values. Make
  sure the testing hits what the assignment description demands (unit, e2e, subsystem, api, stress)."*
  (#16) → the single most decision-driving prompt: the autonomous loop, the multi-tier QA strategy, the
  test matrix, the seeded demo, and AWS as the finish line.

### Phase D — Frontend design via Claude Design · #22–#26 · Jun 9 08:36 → 10:14
A first Claude Design zip was dropped (#22) but came back as a **generic "ST6 Operating Console"**
(Dashboard/Tasks/Inbox/Engagements) — the wrong product. The mismatch was diagnosed (#24), the brief was
hardened (§0 naming the 9 real WCM screens; ST6/Solovis demoted to visual tone), and the corrected
**Weekly Commit Module design suite** (`design/_v2/`) was produced and wired into the remote.
- *"I place a c-design in the design folder. It is a zip describing the frontend appearance. Wire it in
  as the new front end."* (#22) → introduced **Claude Design** as the frontend source of truth.
- *"…No CSS Modules or styled-components — use Tailwind … Use RTK Query for all API data fetching …
  Backend must use Spring Data JPA … this is a client-side SPA. In production, WC is a Vite Module
  Federation remote …"* (#25) → re-confirmed the hard constraints binding both engineering and design.

### Phase E — Live Auth0 + MS Graph + change-board · #27–#56 · Jun 9 12:50 → 19:01
The long real-integration grind: wired live **Auth0**, then fought **Microsoft Graph / Azure** tenant +
app-registration eligibility (ending on a paid tenant, app `WCM Outlook`, redirect-URI + admin-consent
fixes), provisioned a **real demo team** (3 employees + 1 manager with group calendars), and debugged
the Graph OAuth callback. Logged and implemented two change-board items.
- *"…put their calendars under a group so I can view them from the bryannalarcon calendar … Put that as
  a feature in the changeboard."* (#50) → **CB-1**: group-calendar scheduling from the manager surface.
- *"…the login page should have a bypass for each of the accounts and there should be a pill that allows
  you to switch between each account."* (#54) → **CB-2**: the hermetic per-persona login bypass + the
  account-switcher pill used in the live demo.

### Phase F — Docs: layer-docs + learn-site · #57–#64 · Jun 9 19:18 → 20:58
- *"run layer docs and learn site"* (#57) → `/layer-docs` (initial pass: 9 layers + OVERVIEW into
  `docs/layers/`, **7 drift items flagged** between the older TECHNICAL.md and the actual code, state
  stamped at HEAD `772a193`) and `/learn-site` (a standalone React/Vite explainer in `docs/learn-site/`
  — clickable layer map, "follow a request" stepper, Plain⇄Deep toggle).

### Phase G — Interview demo-script · #65–#67 · Jun 9 21:50 → 22:22
Drafted a trade-offs-focused demo-video script from the ST6 R2 interview transcript and saved it (kept
local, gitignored — not part of the submitted repo).

### Phase H — AI_USAGE remake + AWS deploy went live · #68–#70 · Jun 9 22:36 → 22:39
- *"Gitignore it. Remake the AI_usage md using the logging md in ai logging. I also used claude
  design."* (#68) → this deliverable; the reply to #68 is also where the **single-host AWS EC2 deploy
  went live at http://44.218.6.116/** (Docker Compose on a `t3.small` + Elastic IP). A follow-up fixed a
  white-page Module-Federation render and requested the public URL (#69).

> **Deploy note (honest deviation):** IaC was *planned* as **AWS CDK → ECR/EKS + RDS + S3/CloudFront +
> SNS/SQS** (#13, and in `docs/TECHNICAL.md §9`). The **realized** deploy is the simpler, cost-bounded
> **single-host EC2 + Docker Compose** path under `deploy/` (~$15/mo, teardown via
> `deploy/teardown-ec2.sh`). The cloud-native topology remains designed but un-provisioned, gated on
> cost approval — the SNS→SQS event seam is built and LocalStack-tested but runs in-process in this
> deploy.

## Validation steps for AI-generated code

- **Test-first, red→green, no vacuous green.** New behavior gets a failing regression test first,
  verified RED, then fixed to GREEN (the blind-QA RFC-7807 fix added four MockMvc cases — malformed
  JSON, bad enum, empty body, wrong media type — confirmed failing *before* the handlers were added).
- **Full eval suite as the gate.** Backend `mvn verify` (Spotless + SpotBugs + JUnit/Testcontainers) and
  frontend `tsc --noEmit` + `vitest` (80% coverage gate) must be green before a change is done.
- **Blind-QA / verifier swarms.** Independent agents drove the running app to find contract gaps rather
  than trusting the coder agents' self-reports (#16, #55).
- **End-to-end coverage to spec.** Cypress+Gherkin BDD e2e, Playwright smoke, and k6 stress (to the
  brief's 2000-record / <200ms targets) exercise the lifecycle the way a user/manager hits it.
- **Design fidelity, then adaptation — not blind import.** Claude Design output was treated as a
  *reference* recreated in React/Flowbite/Tailwind (tokens mapped onto the codebase), and was rejected
  and re-driven when off-target.

### Hallucinations / bad output caught

- **Claude Design produced the wrong product (caught #22–#24).** The first handoff was a generic "ST6
  Operating Console" (Dashboard/Tasks/Inbox/Engagements), not the WCM screens. Caught on review; the
  brief was hardened (§0 naming the 9 real screens) and Claude Design re-run to produce the correct
  suite (`design/_v2/`).
- **Bare 403 on malformed request bodies (blind-QA HIGH).** Coder output had no handler for
  `HttpMessageNotReadableException` / `HttpMediaTypeNotSupportedException`, so an unparseable body
  escaped the `@RestControllerAdvice` and surfaced as an empty 403 — instead of the spec's 400/415
  `application/problem+json`. Caught by blind-QA, fixed with two explicit handlers + regression tests.
- **White-page Module-Federation render on the live host (caught #69).** The first deployed build
  rendered blank; fixed as part of bringing the EC2 deploy fully live.
- **Missing AI_USAGE deliverable, then a stale one.** The build produced the raw per-session log but
  never synthesized the required `AI_USAGE.md`; an early synthesis then covered only the first ~17
  prompts (~$58). This document is the corrected, full-scope rewrite through the live deploy.

## Reflection

**Where AI helped most.** Turning one `/goal` directive into a complete, multi-layer, tested module —
domain FSM, API + RFC-7807 + Auth0 + row-level authz, Graph/eventing seams, a federated React frontend,
and the full test pyramid — and pairing it with a *separate* design agent for the UI, with orchestrator
subagent swarms looping QA to green without per-step human input.

**Where it produced bad output.** A design agent that confidently built the wrong product until
corrected; error-contract edge cases the happy-path tests missed (the malformed-body 403); and a
blank-render deploy — all surfaced by review/blind-QA passes, not the generating agents themselves.

**What I'd do differently.** Route deterministic verifier checks to a cheaper model tier (the verifier
swarms ran on Opus — the multi-million-token cache-read turns are ~97% of all spend); pin the design
brief's §0 product-scope guard *before* the first Claude Design run to avoid the wrong-product round-trip;
and capture `/usage` per phase *before* sessions age out so the deliverable carries measured cost rather
than list-rate estimates.

---

## Usage Numbers

**Source & method.** No interactive `/usage` block was available at synthesis (it is authoritative when
present). Figures below are summed from the per-turn token lines the logging hook recorded in
`claude-planner-conversation.md` (each line de-duplicates streamed responses by request id and prices 5m
vs 1h cache writes separately). **Every dollar figure is `[EST list-rate]`** — computed at public list
rates from token volume, not a billed invoice.

**Coverage & lower-bound caveat.** Of **70 logged prompts**, **53 carry a per-turn token line** (the
other 17 are one-word continuations, paste-only credential turns, or turns whose reply merged into an
adjacent one). Of those 53, **14 recorded tokens but no dollar figure** — their tokens are counted in the
token sums but contribute **$0** to the dollar sum. **The ~$168.84 total is therefore a verified lower
bound**; true list-rate spend is higher, concentrated in Phase E (live integrations) and Phase C (the
build), where the largest dollar-less turns sit (e.g. the #55 change-board pass: 31.2M cache-read,
un-priced).

### Session totals — summed from the 53 per-turn token lines

| Metric | Value |
|---|---|
| Span | 2026-06-08 18:12 → 2026-06-09 22:39 CDT |
| Logged prompts / turns with token lines | 70 / 53 |
| Model | Claude Opus (orchestrator) + Task subagents · Claude Design (UI) |
| Input tokens | 230,431 |
| Cache-read tokens | 312,550,910 |
| Cache-write tokens | 6,627,260 |
| Output tokens | 1,173,990 |
| Total tokens | ~320,582,591 (~320.6M) |
| **Total cost** | **~$168.84 [EST list-rate]** — **lower bound** (14 logged turns recorded tokens only) |

Spend is overwhelmingly **cache reads (~97.5% of tokens)** — i.e. re-feeding the growing project context
into orchestration, review, design-wiring, and verification turns, not fresh generation.

### Per-phase breakdown (`[EST list-rate]`; phase buckets re-sum to the grand total)

| Phase | Prompts | Turns w/ line | Input | Cache-read | Cache-write | Output | ~$ |
|---|---|---:|---:|---:|---:|---:|---:|
| A — Research | #1–#4 | 3 | 12,930 | 3,450,724 | 114,668 | 69,395 | 3.61 |
| B — Planning | #5–#15 | 10 | 42,927 | 20,143,416 | 478,258 | 237,459 | 20.75 |
| C — `/goal` build | #16–#21 | 4 | 39,905 | 47,562,271 | 1,666,814 | 236,755 | 46.57 |
| D — Claude Design wire-in | #22–#26 | 5 | 28,341 | 83,299,462 | 501,900 | 301,744 | 54.35 |
| E — Auth0 + Graph + CB | #27–#56 | 21 | 33,938 | 105,459,294 | 3,028,520 | 192,157 | 26.72† |
| F — Docs (layer/learn-site) | #57–#64 | 6 | 60,498 | 42,827,641 | 346,189 | 91,114 | 5.83† |
| G — Demo-script | #65–#67 | 3 | 396 | 1,311,191 | 52,122 | 22,183 | 1.73 |
| H — AI_USAGE + AWS deploy | #68–#70 | 1 | 11,496 | 8,496,911 | 438,789 | 23,183 | 9.27 |
| **TOTAL** | **#1–#70** | **53** | **230,431** | **312,550,910** | **6,627,260** | **1,173,990** | **168.84** |

† Phases E and F contain several token-only (un-priced) turns, so their true `$` is higher than shown;
the token columns are complete. The single biggest cost centers are **Phase D** (the Claude Design
wire-in, 83.3M cache-read) and **Phase C** (the autonomous build, 47.6M cache-read).

### Largest known single turn

| Prompt | What it drove | in | cache-read | cache-write | out | ~$ |
|---|---|---:|---:|---:|---:|---:|
| #68 | AI_USAGE remake + the live AWS EC2 deploy | 11,496 | 8,496,911 | 438,789 | 23,183 | $9.27 |

(Per-turn dollar figures for the heavier build/design/integration turns in Phases C–E are partly
un-priced in the log; the **per-phase** table above is the reliable cost view.)
