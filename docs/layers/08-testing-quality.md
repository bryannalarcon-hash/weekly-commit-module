<!-- 08-testing-quality.md — faithful layer doc for the WCM testing strategy + quality gates (5 test
     layers: BE unit, BE integration *IT, FE Vitest, Cypress/Playwright E2E, k6 perf) and the CI gates. -->

# 08 — Testing & Quality Gates

## Executive summary

The Weekly Commit Module is verified by a **five-layer test strategy** wired into one CI pipeline
(`.github/workflows/ci.yml`), each layer with a **hard gate** that fails the build on breach:

1. **Backend unit** — pure-logic JUnit 5 tests, the FSM exemplar being `LifecycleServiceTest`
   (`backend/src/test/java/com/solovis/wcm/commit/LifecycleServiceTest.java:22`), no Spring/DB.
2. **Backend integration** — `*IT.java` extending `AbstractWebIT`
   (`backend/src/test/java/com/solovis/wcm/AbstractWebIT.java:32`): `@SpringBootTest` +
   `@AutoConfigureMockMvc` + `@ActiveProfiles("test")` against a **process-wide singleton
   Testcontainers Postgres 16.4** (`backend/src/test/java/com/solovis/wcm/WcmPostgresContainer.java:12`),
   authenticating with a **local RS256 keypair** (`backend/src/test/java/com/solovis/wcm/common/TestJwtConfig.java:34`),
   each test rolled back via `@Transactional`.
3. **Frontend unit/component** — Vitest workspace (jsdom + `@vitejs/plugin-react`) with MSW-mocked
   API and jest-axe a11y (`vitest.workspace.ts`, `vitest.setup.ts`).
4. **E2E** — Cypress + `@badeball/cypress-cucumber-preprocessor` Gherkin (3 `.feature` files /
   6 scenarios) driving the **live federated app** over the real backend, plus one Playwright smoke
   (`e2e/playwright/smoke.spec.ts`).
5. **Performance** — k6 scenarios (`perf/*.js`) against a `@Profile("stress")` ~2000-record dataset,
   with **HARD p95<200ms / zero-error / pagination-invariant thresholds** that exit non-zero on breach.

**Quality gates** bind to `mvn verify` (Spotless / SpotBugs / JaCoCo line ≥80% — `backend/pom.xml`)
and to the FE pipeline (Vitest coverage **80%** — see VERIFIED note below — TypeScript strict
`tsc --noEmit`, ESLint 9 flat, Prettier 3.3.3).

> **VERIFIED — frontend coverage threshold is 80, not 70.** `vitest.config.ts:33-38` sets
> `thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 }`. `docs/TECHNICAL.md:281`
> claims "the FE gate is **70%**, not 80" and `docs/TECHNICAL.md:281,308` attribute the gate to
> `vitest.workspace.ts`. Both are **stale/incorrect**: the real number is **80** and the gate lives in
> `vitest.config.ts` (the workspace file explicitly defers coverage to root — `vitest.workspace.ts:2-3`).
> See *Gotchas* for the full drift list.

## Responsibilities

- Prove the **lifecycle FSM** (DRAFT→LOCKED→RECONCILING→RECONCILED→CARRY_FORWARD) exhaustively and
  the server-enforced guards (link-at-lock, snapshot immutability, item-edit windows).
- Prove the **HTTP contract**: status codes, RFC-7807 `application/problem+json` bodies, row-level
  authz (a member cannot read another's commit; manager A cannot see manager B's reports).
- Prove the **integration seams** hermetically: the `commit.locked`→calendar side-effect, the
  SNS→SQS event path (LocalStack), the Graph adapter request shape (MockWebServer).
- Prove the **federated FE end-to-end** through the host→remote MF boundary against a real backend.
- Prove the **performance NFRs** (plan-read p95<200ms; Pageable correctness at the 2000-record ceiling).
- Enforce **format/static-analysis/coverage gates** so a regression below bar fails CI.

## Key components

| Component | Path:line | Role |
|---|---|---|
| `AbstractWebIT` | `backend/src/test/java/com/solovis/wcm/AbstractWebIT.java:32` | `@SpringBootTest`+MockMvc base; `@ActiveProfiles("test")`, `@Import(TestJwtConfig)`, `@Transactional` rollback |
| `AbstractPersistenceIT` | `backend/src/test/java/com/solovis/wcm/AbstractPersistenceIT.java:20` | `@DataJpaTest` base; real datasource (`replace=NONE`) so Flyway V1..V10 apply + Hibernate `validate` |
| `WcmPostgresContainer` | `backend/src/test/java/com/solovis/wcm/WcmPostgresContainer.java:12` | Process-wide singleton `postgres:16.4`, started once, never stopped; `max_connections=300` |
| `TestJwtConfig` | `backend/src/test/java/com/solovis/wcm/common/TestJwtConfig.java:34` | `@Profile("test")` local RS256 keypair: `mint`/`bearer`/`employee`/`manager` post-processors |
| `LifecycleServiceTest` | `backend/src/test/java/com/solovis/wcm/commit/LifecycleServiceTest.java:22` | Pure FSM unit test (no Spring/DB): full legal/illegal edge matrix, lock guard, snapshot immutability, carry-forward |
| `CommitControllerIT` | `backend/src/test/java/com/solovis/wcm/commit/CommitControllerIT.java:32` | CRUD+submit; spoofed-`memberId` ignored (`:105`); cross-member read 403 (`:126`); `<200ms` read assert (`:310`); problem+json regressions |
| `ReconciliationControllerIT` | `backend/src/test/java/com/solovis/wcm/commit/ReconciliationControllerIT.java:1` | Reconcile half; split actor model (manager vs owner) under scope gate |
| `RollupControllerIT` | `backend/src/test/java/com/solovis/wcm/review/RollupControllerIT.java:1` | Roll-up metrics, manager A≠B isolation, Pageable boundaries, review write 403 for unrelated manager |
| `RcdoControllerIT` | `backend/src/test/java/com/solovis/wcm/rcdo/RcdoControllerIT.java:1` | RCDO browse/picker; 4-level nested tree; 401 when unauthenticated |
| `CommitLockedConsumerIT` | `backend/src/test/java/com/solovis/wcm/integration/CommitLockedConsumerIT.java:37` | `submit`→`commit.locked`→calendar synced once; event-id persisted on items + `lastSyncAt`; preference gate; idempotent replay |
| `SnsSqsEventingIT` | `backend/src/test/java/com/solovis/wcm/integration/SnsSqsEventingIT.java:54` | `@ActiveProfiles({"test","aws"})` on a **LocalStack** Testcontainer; publish→SNS→SQS→poll→consume once (idempotent) |
| `GraphCalendarAdapterTest` | `backend/src/test/java/com/solovis/wcm/integration/GraphCalendarAdapterTest.java:1` | Real adapter vs OkHttp **MockWebServer**: asserts `/me/events` body + delegated bearer header |
| `OpenApiContractIT` | `backend/src/test/java/com/solovis/wcm/common/OpenApiContractIT.java:1` | `/v3/api-docs` includes commits/rcdo/rollup (contract guard) |
| `AuditingEntityIT` | `backend/src/test/java/com/solovis/wcm/common/AuditingEntityIT.java:1` | JPA auditing auto-populates `created_by`/audit fields |
| `SecurityIntegrationTest` | `backend/src/test/java/com/solovis/wcm/common/SecurityIntegrationTest.java:1` | Resource-server chain: 401/403/200, bad-audience 401, forged test-JWT rejected by prod decoder |
| `MemberProvisioningIT` | `backend/src/test/java/com/solovis/wcm/member/MemberProvisioningIT.java:1` | JIT provisioning idempotency + email/auth0Subject uniqueness |
| `DemoSeederIT` | `backend/src/test/java/com/solovis/wcm/member/DemoSeederIT.java:1` | Demo seed loads deterministically + idempotently (count-sensitive — relies on others rolling back) |
| Vitest workspace | `vitest.workspace.ts:26` | jsdom env, `@vitejs/plugin-react`, MF stub aliases for `wc/WeeklyCommitApp` + `wc/WeeklyCommitWidget` |
| Vitest setup | `vitest.setup.ts:4` | jest-dom + jest-axe `toHaveNoViolations`; auto-`cleanup()` after each test |
| Vitest coverage gate | `vitest.config.ts:13` | v8 provider, `all:true`, **80%** lines/functions/branches/statements |
| MSW handlers | `libs/api/src/msw/handlers.ts` | Mock the `@wcm/api` API surface for FE component tests |
| Cypress config | `e2e/cypress.config.ts:14` | Gherkin pipeline (cucumber + esbuild preprocessor); `baseUrl :4200`; `retries.runMode:1`; `video:false` |
| Feature files | `e2e/cypress/e2e/features/*.feature` | 3 files, 6 scenarios (lifecycle / reconciliation / manager-rollup) |
| Common steps | `e2e/cypress/e2e/step_definitions/common.steps.ts:7` | Per-scenario `cy.resetData()`; shared review-detail assertion |
| Playwright smoke | `e2e/playwright/smoke.spec.ts:9` | App loads through host-shell, MF mounts, employee reaches authenticated home |
| E2E harness | `e2e/run-e2e.sh:1` | Boots compose PG + backend(`e2e,demo`) + federated FE, waits on URLs, runs Cypress + Playwright |
| k6 — plan retrieval | `perf/plan-retrieval.js:26` | `GET /api/commits/current`; HARD `p95<200`, `http_req_failed rate==0`, `checks rate==1` |
| k6 — rollup pagination | `perf/rollup-pagination.js:32` | `GET /api/rollup?page&size`; per-page `p95<200`+stable-pagination invariants |
| k6 — lifecycle throughput | `perf/lifecycle-throughput.js:33` | create→link→submit; write `p95<400`, every iteration reaches LOCKED |
| Stress harness | `perf/run-stress.sh:1` | Fresh DB + backend(`e2e,demo,stress`) + 3 k6 runs; non-zero exit on any threshold breach |
| Backend Maven gates | `backend/pom.xml:180` | Spotless (`:224`), SpotBugs (`:246`), JaCoCo merge+check ≥0.80 (`:265`), Failsafe ITs (`:210`) |
| CI pipeline | `.github/workflows/ci.yml:33` | `be` / `fe` / `e2e` / `stress` jobs + gated `live` job |

## Interfaces & contracts

- **Backend test auth contract** — `AbstractWebIT` runs under the `test` profile, so the real
  resource-server chain (`SecurityConfig`, `@Profile("!e2e")`) is active and tests attach a **locally
  minted RS256 bearer** whose `subject` equals a seeded `Member.auth0Subject`
  (`TestJwtConfig.employee/manager`, `TestJwtConfig.java:113-120`). The local `JwtDecoder`
  (`TestJwtConfig.java:53`) verifies these; the PROD issuer-backed decoder rejects them (proven by
  `SecurityIntegrationTest`). Manager routes require the `reconcile:commits` permission
  (`TestJwtConfig.java:43`).
- **Perf/E2E auth contract (different profile)** — the perf and Cypress/Playwright tiers run the
  backend under `e2e` (not `test`), where `E2eSecurityConfig` REPLACES the JWT chain
  (`backend/src/main/java/com/solovis/wcm/common/E2eSecurityConfig.java:46`) and the hermetic
  `X-Debug-Member` header names a seeded member
  (`backend/src/main/java/com/solovis/wcm/common/DebugHeaderCurrentMemberProvider.java:18`;
  k6: `perf/lib/config.js:15`). MANAGER members carry `SCOPE_reconcile:commits`, so `/rollup`
  authorizes exactly as the prod JWT chain would.
- **Transactional-rollback contract** — `@Transactional` on `AbstractWebIT` joins each controller's
  REQUIRED transaction and reverts it, keeping the shared container clean for the count-sensitive
  `DemoSeederIT` (`AbstractWebIT.java:23-26`). Non-transactional ITs that cross transactions
  (e.g. `SnsSqsEventingIT`) clean up their own rows in `@AfterEach`
  (`SnsSqsEventingIT.java:135`).
- **Vitest MF alias contract** — the host's lazy `import('wc/WeeklyCommitApp')` /
  `import('wc/WeeklyCommitWidget')` resolve to local stubs under Vitest
  (`vitest.workspace.ts:31-33`, stubs at `apps/host-shell/src/__mocks__/`), since no MF runtime exists
  in the unit env.
- **k6 threshold contract** — every k6 script declares HARD thresholds; k6 exits **99** on breach and
  the harnesses propagate non-zero (`perf/run-stress.sh:131`, `perf/README.md:9`).

## Data & state

- One **shared Postgres container** for the whole IT suite; tiny per-context Hikari pools
  (`maximum-pool-size=4`) avoid exhausting it (`WcmPostgresContainer.java:36`).
- IT data is **rolled back** per test (web ITs) or hand-cleaned (cross-tx ITs); the seed-count
  invariants in `DemoSeederIT` depend on that discipline.
- FE component tests build a **fresh Redux store per test** (`makeStore()` is called in each
  `*.test.tsx`, e.g. `apps/wc-remote/src/screens/Reconciliation.test.tsx`); MSW intercepts API calls
  at the network boundary (`libs/api/src/msw/handlers.ts`).
- The stress dataset is a `@Profile("stress")` seed: **1 manager, 210 reports, ~2100 commits,
  ~8400 items** (`perf/README.md:18-28`), the brief's 2000-record Pageable ceiling.

## Dependencies

**Depends on**
- Testcontainers (Postgres + LocalStack) and Docker on the runner.
- The Spring profile system: `test` (JWT path), `e2e` (X-Debug-Member path), `aws`, `graph`,
  `demo`, `stress` (see doc 09 for the full matrix).
- OkHttp MockWebServer (Graph), Nimbus JOSE (local JWTs), AWS SDK v2 (SNS/SQS ITs) — all `test`-scope
  in `backend/pom.xml:141-177`.
- Node toolchain: Vitest 2.x + `@vitest/coverage-v8`, MSW 2.x, jest-axe, Cypress 13 + cucumber
  preprocessor, `@playwright/test` 1.47.2, k6 (Docker `grafana/k6`).

**Used by**
- `.github/workflows/ci.yml` runs every layer; the four core jobs gate `main` and PRs, the `live` job
  runs the (not-yet-built) U32 real-integration suite when secrets are present (`ci.yml:204-247`).
- The TEST RESULTS deliverable: CI uploads surefire/failsafe XML + JaCoCo HTML (`ci.yml:78`), Vitest
  coverage (`ci.yml:118`), Cypress artifacts (`ci.yml:161`), the k6 summary (`ci.yml:193`).

## How it works (flow)

1. **`mvn -f backend/pom.xml verify`** (CI job `be`, `ci.yml:35`) runs surefire (unit) → failsafe
   (Testcontainers ITs) → `spotless:check` → `spotbugs:check` → JaCoCo merge (`jacoco-ut.exec` +
   `jacoco-it.exec`) → JaCoCo check (BUNDLE line ≥0.80). Any gate failing fails the job.
2. **FE job** (`ci.yml:90`): `npm ci` → `tsc --noEmit -p tsconfig.base.json` (strict) →
   `vitest run --coverage` (80% gate) → `nx build wc-remote` (emits chunked `remoteEntry.js`).
3. **E2E job** (`ci.yml:127`, `needs:[be,fe]`): `bash e2e/run-e2e.sh` brings up compose Postgres,
   the backend under `e2e,demo`, the federated FE (`VITE_E2E`), waits on every URL, runs Cypress
   headless (cucumber Gherkin) then the Playwright smoke; each scenario starts with
   `Given the demo data is reset` → `cy.resetData()` hitting the `@Profile("e2e")` reset endpoint.
4. **Stress job** (`ci.yml:173`, `needs:[be]`): `bash perf/run-stress.sh` seeds the 2000-record set,
   waits until `/api/rollup` reports ≥210 reports, then runs the three k6 scenarios with HARD
   thresholds.
5. **Live job** (`ci.yml:204`): gated on `AUTH0_ISSUER_URI` etc.; cleanly skips when secrets are
   absent (the `@Tag("live")` suite is U32 and not yet built — `-Dgroups=live` runs zero tests).

## Design decisions & rationale

- **Singleton, never-stopped Postgres container** — eliminates per-class start/stop races that caused
  connection-refused flakiness; the trade-off is shared mutable DB state, mitigated by per-test
  rollback + a 300-connection server cap (`WcmPostgresContainer.java:3-19`).
- **Local RS256 keypair instead of a real Auth0 tenant** — lets the full decode→validate→authorities
  path run offline and deterministically, while still proving the prod decoder rejects forged tokens
  (`TestJwtConfig.java:88-102`, `SecurityIntegrationTest`).
- **Coverage gate at the root, not the workspace** — Vitest 2.x ignores `coverage` set on a workspace
  project, so it lives in `vitest.config.ts` with `all:true` (untested files count as 0) and honest
  excludes for MF shims, type-only files, barrels and the MSW mock server (`vitest.config.ts:1-39`).
- **Merged JaCoCo (ut+it) with honest excludes** — coverage merges unit and IT execution before the
  check; only boot/config/glue (`WcmApplication`, `*Config*`, `AbstractAuditingEntity`) and the two
  `@Profile("e2e")` test-path classes are excluded from the product bar (`backend/pom.xml:317-329`).
- **Live federated E2E (not standalone remote)** — Cypress/Playwright drive the host loading the
  remote over real Module Federation against a real backend, so the integration boundary is exercised,
  not mocked (`e2e/run-e2e.sh:8`, `smoke.spec.ts:1-4`).
- **Thresholds fixed, load profile tunable** — the 200ms NFR is never relaxed; only VU count/duration
  are env-scoped to the dev box (`perf/README.md:44-56`), so CI/bigger boxes raise concurrency without
  touching the bar.

## Gotchas & sharp edges

- **DRIFT (FE coverage number).** `docs/TECHNICAL.md:281` says the FE gate is **70%**; the real gate
  is **80%** at `vitest.config.ts:33-38`. **Use 80.**
- **DRIFT (gate location).** `docs/TECHNICAL.md:281,308` and the `vitest.workspace.ts` filename imply
  the coverage gate lives in the workspace file; it does **not** — it is in `vitest.config.ts`
  (the workspace file says so at `vitest.workspace.ts:2-3`).
- **DRIFT (testing matrix counts).** `docs/TECHNICAL.md:308-313` cites "~88 FE cases in 21 files",
  "~129 BE @Test", "30 BE test files", and a single legacy `perf/stress.js` stress scenario. The tree
  now has **44 FE test files**, **36 BE test files with 201 `@Test` annotations**, and **three** k6
  scenarios (`plan-retrieval`, `rollup-pagination`, `lifecycle-throughput`) plus the legacy
  `perf/stress.js`. Treat the TECHNICAL.md counts as approximate/stale.
- **Two auth paths, two profiles.** ITs use the `test`-profile JWT; perf + browser E2E use the
  `e2e`-profile `X-Debug-Member`. They are not interchangeable — `E2eSecurityConfig` replaces the JWT
  chain under `e2e` (`E2eSecurityConfig.java:46`).
- **Count-sensitive seed tests are coupling-sensitive.** `DemoSeederIT` assumes every other web IT
  rolled back and non-tx ITs (`SnsSqsEventingIT`) hand-clean their rows
  (`SnsSqsEventingIT.java:130-145`); add a leaky non-transactional IT and the seed counts drift.
- **`live` job runs zero tests today.** `-Dgroups=live` matches no `@Tag("live")` suite yet
  (`ci.yml:230-231`); the job is green-but-empty until U32 lands — do not read it as live coverage.
- **k6 networking is WSL2/Docker-specific.** `run-stress.sh` points k6 at the host LAN IP (not
  `localhost`/`host.docker.internal`) because of the Docker-VM loopback on WSL2/Docker Desktop
  (`perf/run-stress.sh:34-40`); override with `WCM_API_BASE` on native Linux.
- **Cypress video is off** (`e2e/cypress.config.ts:19`); only failure screenshots + the run summary
  are produced — the CI `videos/**` upload glob is a harmless no-op (`ci.yml:158-160`).
- **The `<200ms` IT assert is wall-clock and machine-dependent.** `CommitControllerIT.java:310-322`
  warms once then measures a single read; it can flake on a loaded runner — the authoritative latency
  gate is the k6 p95 in the `stress` job.

## Connects to

- **07 — Frontend / Module Federation** (the host/remote boundary the E2E + Vitest MF stubs exercise).
- **09 — Build, Monorepo & Deployment** (the profile matrix, Maven gate plugins, and CI topology).
- **Security & Eventing layer docs** (the resource-server chain and SNS→SQS seam these tests prove).
