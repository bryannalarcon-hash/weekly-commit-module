<!-- docs/DEMO_SCRIPT_R2.md — Round-2 interview demo-video script for the Weekly Commit Module.
     Rebuilt around the interviewer's explicit ask: a results-driven product walkthrough where every
     act carries one "I chose X over Y because Z" trade-off (product + architecture), named at the
     surface so the video plants them, with deep mechanics held in the cheat sheet for Round 3.
     Companion to DEMO_SCRIPT.md (the 5-act feature walkthrough) and planning/DECISIONS.md (A1–A10). -->

# WCM — Demo Video Script (Round-2 submission, ~10 min)

Rebuilt around what the ST6 interviewer asked for in Round 2: a results-driven walkthrough where
**every act carries one explicit _"I chose X over Y because Z"_ trade-off** — named at the surface so
the video plants them, with the deep mechanics held back for Round 3 (he said the next round "goes one
level deeper" on exactly this).

**Framing**
- **Target ~10 min.** Spoken budget is tight (~1,400 words), so each trade-off is _one sentence_ in the
  video — name it, give the why, move on. The full reasoning is in the cheat sheet at the bottom.
- The interviewer's exact ask: _"the architecture is X and I chose X because it's better than Y… and
  why I made these decisions around what to put in the product and the features."_ So this hits **both
  product-scope decisions and architecture decisions.**
- He prizes **"no BS"** — so there's a deliberate honesty beat near the end (what's wired vs. designed).
  That's a strength signal for a trade-offs round, not a weakness.

---

## Before you hit record (not on camera)
- Stack up in demo mode: `docker compose up -d postgres` → backend `SPRING_PROFILES_ACTIVE=e2e,demo` →
  `nx serve wc-remote` then `nx serve host-shell` → open **http://localhost:4200**.
- Hit **Reset demo data** (`POST /api/e2e/reset`) for a clean seed.
- Have the **PersonaPill** ready (bottom-right) to switch seeded actors: Sana (IC), Priya (mgr), Omar
  (IC, has a reconciling gap), Marcus (mgr).
- Optional: a second tab on the **learn-site** layer map if you want a 10-sec architecture visual — but
  the product is the star.

> 🎙️ Legend: **[SHOW]** = on-screen action · **[SAY]** = narration · **★ TRADE-OFF** = the decision
> call-out to voice.

---

### 0:00 – 0:40 · Cold open — the problem, in one breath
- **[SAY]** "This is the Weekly Commit Module — it replaces the 15Five weekly-planning slice for
  Solovis. The problem 15Five has: an employee's weekly plan is completely disconnected from company
  strategy, so a manager can't see whether this week's work actually supports the right priorities until
  it's too late."
- **[SAY]** "WCM fixes that structurally — every weekly commitment is provably linked to a Supporting
  Outcome in the RCDO strategy tree, and the whole week moves through a server-enforced lifecycle. Let
  me show you, then I'll walk the decisions."

### 0:40 – 1:20 · The first decision is a *product* one
- **★ TRADE-OFF (product scope)** **[SAY]** "First decision was what _not_ to build. 15Five is huge —
  1-on-1s, recognition, surveys, reviews. I chose to replicate **only the weekly-commit core, but to
  full production depth**, instead of a shallow clone of the whole product. The assignment rewards a
  real connection between work and strategy enforced end-to-end, not surface-level breadth — so
  depth-over-breadth, with a hard anti-creep boundary."
- **[SHOW]** The My-Week landing for **Sana** (empty "Start your week" state).

### 1:20 – 3:00 · Act 1 — Draft → Lock (the heart of the product)
- **[SHOW]** Click **Start a new week** → DRAFT badge, autosave indicator. Add item *"Normalize
  custodian feeds."* Point out **Submit is disabled.**
- **★ TRADE-OFF (product / data model)** **[SAY]** "Submit is locked because the item isn't linked to
  strategy yet. The link column is actually **nullable** in the database — but linking is **enforced at
  LOCK, not at save**. I chose that over a NOT-NULL column because a draft needs to exist _before_
  you've figured out the link; enforcing at the column would create a dead-end. This way 'every
  _locked_ commitment is linked' is still guaranteed."
- **[SHOW]** Open the **RCDO picker** (4-level keyboard-navigable tree), link a Supporting Outcome →
  breadcrumb chip. Set chess tier **KING**.
- **[SHOW]** **Submit & Lock** → badge flips **DRAFT → LOCKED**, week goes read-only (mention a content
  edit now returns 409).
- **★ TRADE-OFF (architecture — FSM)** **[SAY]** "That transition is guarded by a **hand-rolled state
  machine** — an enum plus a transition service that owns every legal edge. I chose that over Spring
  Statemachine because the logic is small and the value is in it being _exhaustively unit-testable with
  no database_ — the FSM holds no repositories at all. A heavyweight library would've been more ceremony
  than the five states justify."

### 3:00 – 4:30 · Act 2/3 — Reconciliation (planned vs. actual)
- **[SHOW]** As **Priya** (manager), start reconciliation on Sana's week → **LOCKED → RECONCILING.** As
  Sana, mark item 1 complete, item 2 incomplete — note only _status_ changes; planned text/link/tier
  stay frozen.
- **★ TRADE-OFF (architecture — reconciliation model)** **[SAY]** "When the week locked, I froze an
  **immutable snapshot** of the plan. Reconciliation diffs that snapshot against live status. I chose a
  real snapshot over _deriving_ a diff from the current items because a derived diff is lossy — it can't
  honestly tell you what was added _after_ the lock."
- **[SHOW]** Switch to **Omar's** seeded reconciling week → two-column planned-vs-actual, one item
  flagged **added-after-lock.** "That flag only exists because the snapshot is the contract."
- **[SHOW]** As Priya, **Mark reviewed** → RECONCILED. As Sana, **Carry forward** → new DRAFT carries
  the unfinished item, old week → CARRY_FORWARD, lineage shown.
- **[SAY]** "Nothing unfinished is silently dropped between weeks, and the right roles drive each step —
  the manager opens and closes the window, the owner records actuals."

### 4:30 – 6:00 · Act 4 — Manager roll-up (the visibility 15Five lacked)
- **[SHOW]** As **Marcus**, open the **Review queue** → his reports' submissions → open **Lena's**
  per-item review.
- **[SHOW]** Open the **Team dashboard** → metric tiles: completion %, carry-over, **alignment %**
  (fraction of items linked to strategy). Drill through Lena's row → resolves her latest reviewable
  commit (not a dead-end).
- **★ TRADE-OFF (architecture — security)** **[SAY]** "Marcus sees only _his_ reports. Authorization is
  resolved from the **JWT subject server-side** — never a member id from the request body. I made
  endpoint-scope and data-scope two different layers on purpose: a valid manager token still can't read
  another team's data. That closes the IDOR/BOLA hole a client-supplied id would open — and it's beyond
  what the brief asked for."
- **★ TRADE-OFF (architecture — performance)** **[SAY]** "This roll-up is built to page up to 2,000
  records under 200 ms. I batch-load the reports to kill the N+1, and there's a k6 perf test that fails
  the build if p95 crosses 200 ms — so the number is enforced, not aspirational."

### 6:00 – 7:30 · Act 5 — Outlook + the micro-frontend seam
- **[SHOW]** Settings → **Connect Outlook** → Microsoft consent → returns **Connected.** Toggle
  create-event-on-lock. Lock a week → an all-day Outlook event appears with the items + a deep-link.
- **★ TRADE-OFF (architecture — integration)** **[SAY]** "Calendar sync hangs off a
  **`CalendarSyncPort` interface** and fires from a `commit.locked` **event**, not inline in the lock
  transaction. I chose event-driven over a synchronous Graph call so a Microsoft outage can _never_
  roll back your lock — sync is a side-effect, the consumer is idempotent, and it runs in-process
  locally but flips to **SNS→SQS** in AWS just by switching a Spring profile."
- **[SHOW]** *(10 sec, optional)* Flash the learn-site/architecture map or the host loading the remote.
- **★ TRADE-OFF (architecture — micro-frontend)** **[SAY]** "The frontend ships as a **Module Federation
  remote** loaded by a thin host, with React and the router **shared as singletons** so there's one
  React instance and the host's router reaches the remote. And every backend call goes through **one RTK
  Query slice** — no raw fetch, no Saga — so caching and invalidation have a single source of truth."

### 7:30 – 8:45 · The honesty beat (his "no-BS" value, on purpose)
- **★ TRADE-OFF (scope honesty)** **[SAY]** "Two deliberate calls I'll be upfront about. One: the AWS
  event path is **built and tested against LocalStack**, but I did _not_ provision live
  EKS/S3/CloudFront — that's design-and-runbook only, gated behind real credentials and cost approval.
  The seam is real; the cloud bill isn't. Two: I used **npm workspaces instead of Yarn**, because the
  brief said I didn't need to replicate the host app's package management — same monorepo shape, one
  fewer tool."
- **[SAY]** "I kept a written conformance table of every brief requirement and where it's satisfied or
  deliberately deviated — so none of this is hidden."

### 8:45 – 9:30 · Two-tier testing (quality is a result)
- **[SHOW]** *(briefly)* coverage report / CI green.
- **[SAY]** "Testing is two tiers: hermetic doubles — Testcontainers Postgres, test-minted JWTs, a Graph
  stub, MSW on the frontend, LocalStack for SNS/SQS — so CI runs fast, offline, and deterministically;
  plus a separate **live** suite gated on real secrets. I get speed _and_ a real-integration proof,
  instead of choosing one. Backend coverage gate is 80% and build-failing; the frontend gate is 80% too."

### 9:30 – 10:00 · Close (and the deliberate hook for Round 3)
- **[SAY]** "So the through-line: commit → linked to strategy → locked and immutable → reconciled by the
  right roles → rolled up for the manager → carried forward, with Outlook as a safe side-effect and
  strategic alignment measured at every step."
- **[SAY]** "Each of those decisions has a layer underneath it I'd be happy to go deeper on — the
  snapshot mechanics, the authz model, the event seam. Thanks for watching."

---

## 🃏 Trade-off cheat sheet — keep this open for Round 3

He told you Round 3 goes _one level down_ on trade-offs. **★ = voiced in the video** (surface). The rest
are your **pocket depth** — be ready to expand any into the "X vs Y because Z, and here's the mechanism"
answer.

| # | Decision | Chose | Over | Because (the one-level-deeper) |
|---|----------|-------|------|-------------------------------|
| ★ | Product scope | Weekly-commit slice at full depth | Shallow clone of all of 15Five | The brief rewards an _enforced_ work↔strategy link end-to-end; breadth dilutes it. Hard anti-creep list. |
| ★ | RCDO link enforcement | Enforce at LOCK; nullable column | NOT-NULL column / enforce at save | Drafts need to exist pre-link; invariant "every _locked_ item is linked" still holds. |
| ★ | Lifecycle FSM | Hand-rolled enum + guarded transitions | Spring Statemachine | Small, explicit, unit-testable with zero DB; service holds no repos. |
| ★ | Reconciliation | Immutable snapshot at LOCK | Diff derived from live status | Derived diff is lossy — can't detect _added-after-lock_. |
| ★ | AuthZ | Row-level ownership from JWT subject | Trust client-supplied memberId | Endpoint-scope ≠ data-scope; closes IDOR/BOLA. |
| ★ | Perf | Flat page envelope + batch-load, k6-gated <200ms | Nested PagedModel / per-row queries | Kills N+1 at 2,000 records; gate fails the build. |
| ★ | Outlook | Event-driven behind `CalendarSyncPort`, idempotent | Synchronous Graph call in the lock txn | Graph outage never rolls back the lock; in-process → SNS/SQS via profile flip. |
| ★ | Micro-frontend | `@module-federation/vite`, React/router singletons | Webpack MF / non-singleton | Maintained, Vite-native; singletons prevent dup-React hook breakage. |
| ★ | Data layer | One RTK Query slice + tag invalidation | Saga/Thunk/raw fetch | Single source of truth for cache + invalidation; brief mandate. |
| ★ | Cloud | Event seam built + LocalStack-tested; provisioning design-only | Live EKS/S3/CloudFront | Real seam without a real bill; gated on creds + cost. |
| ★ | Pkg mgr | npm workspaces | Yarn | Brief: needn't replicate host's pkg mgmt; same shape, one fewer tool. |
| | Backend layout | Package-by-feature (`commit/`,`rcdo/`,`review/`,`integration/`) | Package-by-layer | Maps to bounded contexts; scales cleaner. |
| | Auth mapping | Auth0 permissions → `SCOPE_*` authorities | Role custom-claims | Native Spring mapping, lower friction. |
| | IDs | UUID PKs | Sequential ints | Opaque, URL-safe, distribution-friendly. |
| | Standalone strategy | Thin dev-host loads the real remote | Remote built in isolation only | Exercises the real host↔remote contract prod needs. |
| | Testing | Hermetic doubles + separate live suite | Only-mocks or only-live | Fast deterministic CI _and_ real-integration proof. |
| | Graph consent | Auth-code exchange w/ signed `state` callback | (note) brief/docs say "PKCE" | Be ready: the code does auth-code + HMAC-state, _not_ PKCE — own the discrepancy honestly. |

**One coaching note (be critical with yourself here):** the interviewer is judging _"can you talk about
architecture without reading off a page."_ Don't read this table on camera. In the video, say each ★ as
a single confident sentence at the moment it's relevant; let Round 3 be where you draw the snapshot
diagram or trace the authz path. The video's job is to _prove the project is real and the decisions were
deliberate_ — and to leave him wanting the deeper conversation.
