<!-- docs/layers/OVERVIEW.md — system overview for the Weekly Commit Module (WCM).
     The whole system at a glance: the layer map, a representative request walkthrough,
     cross-cutting concerns, key decisions, flagged drift, and a TOC into the 9 layer docs. -->

# Weekly Commit Module — System Overview

## What it is

The **Weekly Commit Module (WCM)** replaces the 15Five weekly-planning slice for Solovis and enforces
the missing link between individual weekly work and company strategy. An employee drafts a weekly
**commit** whose items each link to a **Supporting Outcome** in the **RCDO** strategy hierarchy (Rally
Cry → Defining Objective → Outcome → Supporting Outcome); the link is *enforced at LOCK, not at save*.
They lock the week, reconcile planned-vs-actual, and carry unfinished items forward. A manager reviews
each item and sees a team **roll-up** of completion, carry-over, and RCDO alignment. Locking a week can
also create a delegated **Outlook** calendar event via Microsoft Graph.

It ships as a **Vite Module-Federation remote** (`wc-remote`) that a thin `host-shell` loads — built to
run standalone but structured to be slotted into the production "PA" host. The backend is a **Java 21 /
Spring Boot 3.3** service over **PostgreSQL 16.4**.

## At a glance

- **Stack:** TypeScript (strict) · React 18 · Vite 5 + `@module-federation/vite` · Redux Toolkit + RTK
  Query · Tailwind + Flowbite (being phased out) · Java 21 · Spring Boot 3.3 · Hibernate/JPA · Flyway ·
  PostgreSQL 16.4 · Auth0 (OAuth2 JWT) · Microsoft Graph (Outlook) · AWS SNS/SQS (event seam).
- **Shape:** client-side SPA micro-frontend (one MF remote + one host) ⇄ one Spring Boot service ⇄ one
  Postgres. Monolithic service, modular-by-package; npm workspaces + Nx monorepo on the FE.
- **Entry points:** the browser enters through the host (`apps/host-shell`) which lazy-loads the remote's
  `./WeeklyCommitApp`; work reaches the backend only through the `/api/*` REST surface, and only ever via
  the single RTK Query slice (`libs/api/src/commitApi.ts`).

## The layers

```
                          BROWSER
   ┌─────────────────────────────────────────────────────────┐
   │  05 Micro-Frontend Shell & Federation                    │
   │     host-shell ── loads ──▶ wc-remote (remoteEntry.js)    │
   │     (BrowserRouter, shared singletons, AuthBridge seam)   │
   │            │                         │                    │
   │            ▼                         ▼                    │
   │  07 Screens & Design System   06 Frontend Data Layer      │
   │     (lifecycle screens,          (RTK Query slice,        │
   │      libs/ui OKLCH tokens)        tags, MSW mock backend)  │
   └──────────────────────────────────────┬───────────────────┘
                                           │  HTTPS  /api/*  (Bearer JWT)
                          ─────────────────┼──────────────────────────────
                                           ▼            SPRING BOOT
   ┌─────────────────────────────────────────────────────────┐
   │  03 Security & Authorization  (authn → scope → row-level) │
   │  02 API & Contract            (thin controllers, 7807)    │
   │  01 Domain & Lifecycle        (RCDO + commit + FSM)  ◀──┐ │
   │  04 Integrations & Eventing   (Graph + SNS→SQS) ───────┘ │
   └──────────────────────────────────────┬───────────────────┘
                                           ▼
                              PostgreSQL 16.4 (Flyway V1..V10)
   ── cross-cutting ──  08 Testing & Quality Gates  ·  09 Build, Monorepo & Deployment
```

| # | Layer | Responsibility | Doc |
|---|-------|----------------|-----|
| 01 | **Domain & Lifecycle** | RCDO hierarchy, the WeeklyCommit aggregate, the server-enforced lifecycle FSM, snapshots, the data model + Flyway migrations + auditing | [01-domain-lifecycle.md](01-domain-lifecycle.md) |
| 02 | **API & Contract** | Thin REST controllers, the `/api/*` surface, RFC-7807 errors, OpenAPI, `PageResponse` pagination | [02-api-contract.md](02-api-contract.md) |
| 03 | **Security & Authorization** | Auth0 resource server, scope gating, row-level ownership, Graph consent state, e2e dev-auth | [03-security-authz.md](03-security-authz.md) |
| 04 | **Integrations & Eventing** | Outlook/Graph calendar sync behind a port, the in-process vs SNS→SQS event seam, idempotent consumers | [04-integrations-eventing.md](04-integrations-eventing.md) |
| 05 | **Micro-Frontend Shell & Federation** | host/remote split, MF exposes/remotes, shared singletons, async bootstrap, the AuthBridge seam, lazy routing | [05-microfrontend-federation.md](05-microfrontend-federation.md) |
| 06 | **Frontend Data Layer** | The single RTK Query slice, tag-based cache invalidation, the token seam, shared types, the MSW mock backend | [06-frontend-data.md](06-frontend-data.md) |
| 07 | **Screens & Design System** | The lifecycle screens, the manager views, the widget, `libs/ui` primitives + OKLCH tokens | [07-screens-design-system.md](07-screens-design-system.md) |
| 08 | **Testing & Quality Gates** | The 5-layer test strategy, k6 perf, JaCoCo/Vitest/Spotless/SpotBugs gates, CI | [08-testing-quality.md](08-testing-quality.md) |
| 09 | **Build, Monorepo & Deployment** | Nx + npm workspaces, path aliases, Vite/Tailwind, the Spring profiles matrix, the AWS deploy design | [09-build-deploy.md](09-build-deploy.md) |

## How it fits together

Follow one representative action — **an employee locks their week** — from click to calendar:

1. **Screen (07).** In `EditCommit`, the employee adds items, links each to a Supporting Outcome via the
   RCDO picker, sets a chess tier, and presses **Submit & Lock**. The button is disabled until there is
   ≥1 item and all are linked (a UX pre-check; the server re-checks).
2. **Data layer (06).** The screen calls the `useSubmitCommitMutation` hook. The RTK Query slice
   (`libs/api/src/commitApi.ts`) issues `POST /api/commits/{id}/submit`, attaching `Authorization:
   Bearer <token>` from the token seam (`tokenProvider`).
3. **Federation (05).** That request leaves the remote, which is running inside the host's
   `BrowserRouter` with React/Router shared as singletons; in dev the host proxies `/api` to the backend.
4. **Security (03).** The Spring `SecurityFilterChain` validates the Auth0 RS256 JWT, then the service
   resolves the acting member from the **JWT subject** (never a body id) — so you can only lock your own
   week.
5. **Domain & Lifecycle (01).** `LifecycleService.lock(...)` enforces the `DRAFT→LOCKED` guard (≥1 item,
   every item linked), **freezes an immutable `CommitSnapshot`** of the plan, stamps `submittedAt`, and
   emits a `commit.locked` domain event. Illegal transitions are rejected as RFC-7807 `409`.
6. **API & Contract (02).** The controller returns the updated `CommitDto`; errors render as
   `ProblemDetail`. RTK Query's `invalidatesTags` then refetches the week list automatically.
7. **Integrations & Eventing (04).** The `commit.locked` event drives `CommitLockedCalendarConsumer` →
   `CalendarSyncPort` → (under the `graph` profile) a real delegated Outlook event. A Graph failure does
   **not** roll back the lock — calendar sync is a side effect, not part of the transaction.

Reconciliation and the manager roll-up follow the same spine; the **snapshot vs live status** diff is
what powers planned-vs-actual.

## Cross-cutting concerns

- **Auth/identity** threads through both halves: Auth0 issues the JWT; the FE `AuthBridge` (05) picks the
  token source (host-injected / self-Auth0 / hermetic E2E header) and feeds the RTK Query token seam (06);
  the BE validates it and derives row-level ownership (03).
- **Error contract:** one shape end-to-end — RFC-7807 `ProblemDetail` from `ApiExceptionHandler` (02),
  mirrored by the MSW mock (06) and surfaced by FE error states (07).
- **Config & secrets:** every external secret is an env ref defaulting to empty, so a bare boot starts;
  Spring **profiles** (`test`/`e2e`/`demo`/`stress`/`graph`/`aws`) flip integrations on and off (09).
- **Observability/quality:** coverage + static-analysis gates run in CI on every push (08).

## Key decisions & trade-offs

- **Lifecycle as a pure, repository-free FSM** (`LifecycleService`) — the highest-value logic is
  exhaustively unit-testable without a database; callers persist what it returns. (01)
- **Reconciliation = immutable snapshot vs live status** — freezing the plan at LOCK is what makes
  "planned vs actual" trustworthy and makes *added-after-lock* detectable. (01)
- **Link enforced at LOCK, not at the column** — `supporting_outcome_id` is nullable so a DRAFT can exist
  before it's linked, while "every locked commitment is linked" stays true. (01)
- **One RTK Query slice as the only data path** — no raw fetch, no Saga/Thunk; the tag graph drives
  cache invalidation. (06)
- **Host owns the router; the remote owns one lazy route table** — shared singletons + a single Suspense
  boundary give real-URL routing and code-split, sub-second render. (05, 07)
- **Ports for every external system** — `CalendarSyncPort` and `EventPublisher` make Graph and AWS
  swappable and let the app boot with no cloud creds. (04)

**Flagged drift (code has moved past `docs/TECHNICAL.md` in a few places — documented, not silently
reconciled):**

- **Migrations are `V1..V10`, not `V1..V8`** (TECHNICAL.md `:169,:288` is stale; `V9__rcdo_owner_ids`,
  `V10__member_timezone_and_notifications` exist). RCDO `owner_id` is now on **all four** levels, not just
  the leaf. (01)
- **`SecurityConfig` gates a second scope, `SCOPE_admin:rcdo`**, for the RCDO edit-tree mutations, plus a
  manager gate on `POST /api/integration/outlook/schedule` — neither is in TECHNICAL.md §4. (02, 03)
- **`CalendarSyncPort` has two methods** (`syncLockedCommit` *and* `scheduleEvent` for the CB-1 manager
  1:1 feature), not one. (04)
- **Graph consent is an authorization-code exchange with an optional `client_secret`**, not the
  PKCE flow TECHNICAL.md §5 describes — no `code_verifier`/`code_challenge` in the code. (03, 04)
- **Frontend coverage gate is 80%** (all four metrics, `vitest.config.ts:33-38`), not the 70% TECHNICAL.md
  `:281` claims, and it lives in `vitest.config.ts`, not `vitest.workspace.ts`. (08)
- **Flowbite is wired-but-being-phased-out**, not removed — still a dependency and a Tailwind plugin, used
  by `WeekSelector`; manager screens deliberately bypass it. "jest-axe" types exist but no test calls
  `axe()`; a11y is asserted directly in RTL specs. (07)
- The repo uses **npm workspaces, not Yarn** (deliberate, per PRD line 77), and **AWS provisioning is
  design + runbook only**, gated on creds + cost approval (the SNS→SQS seam is built and LocalStack-tested;
  EKS/S3/CloudFront are not provisioned). (09)

See each layer doc for the anchored detail; see the repo's `docs/TECHNICAL.md` for the deliverable-grade
brief-conformance table.

## Map

Read in order for a top-to-bottom tour, or jump to a layer:

1. [01 — Domain & Lifecycle](01-domain-lifecycle.md)
2. [02 — API & Contract](02-api-contract.md)
3. [03 — Security & Authorization](03-security-authz.md)
4. [04 — Integrations & Eventing](04-integrations-eventing.md)
5. [05 — Micro-Frontend Shell & Federation](05-microfrontend-federation.md)
6. [06 — Frontend Data Layer](06-frontend-data.md)
7. [07 — Screens & Design System](07-screens-design-system.md)
8. [08 — Testing & Quality Gates](08-testing-quality.md)
9. [09 — Build, Monorepo & Deployment](09-build-deploy.md)
