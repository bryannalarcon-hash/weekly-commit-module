<!-- docs/TEST_RESULTS.md — the required TEST RESULTS deliverable. Summarizes the test inventory across
     all five suites, the build-failing quality gates, WHERE the raw reports are produced/uploaded, and
     how to reproduce. Counts are from the committed test sources; gates are enforced green in CI. -->

# Weekly Commit Module — Test Results

This is the required **TEST RESULTS** deliverable. WCM is tested across **five suites** (frontend unit,
backend unit, backend integration/API/subsystem, end-to-end, and stress), and every numbered quality
gate is **build-failing in CI** — a merged build on `main` certifies that all suites pass and coverage
clears 80%. Counts below are exact (from the committed test sources, this repo as of 2026-06-09); the
raw reports are produced per run and uploaded by CI.

## Latest measured run — 2026-06-09 (local · JDK 21.0.11 · Node 20 · Docker/Testcontainers)

| Suite | Tool | Tests | Result | Coverage |
|-------|------|------:|--------|----------|
| Frontend unit / component | Vitest + RTL + MSW (jsdom) | **260** (44 files) | ✅ **all pass** | **95.9% lines · 91.6% branches · 82.4% functions · 95.9% statements** |
| Backend unit | JUnit 5 + Mockito (surefire) | **120** (20 suites) | ✅ **all pass** | — |
| Backend integration / API / subsystem | MockMvc + Testcontainers (failsafe) | **135** (25 suites) | ✅ **all pass** | — |
| Backend coverage (merged unit + IT) | JaCoCo 0.8.12 | — | ✅ ≥ 80% line gate met | **85.9% line · 84.5% instruction · 67.9% branch** |

**Headline: 515 automated tests executed, 0 failures** — 260 frontend (Vitest) + 255 backend (120 JUnit
unit + 135 Testcontainers integration). `tsc --noEmit` (strict): **0 errors**. Both coverage gates clear
their floors — frontend ≥ 80% on all four metrics, backend **85.9% line** vs the **≥ 80%** JaCoCo line
gate. The E2E (Cypress/Gherkin + Playwright) and k6 stress suites need the full Docker stack and run via
the harness / CI (`run-e2e.sh` / `run-stress.sh`); they were not part of this local capture.

## Where the results are placed

Test reports are **generated per run** into these paths (all **gitignored** — they are large and
regenerable, so they are not committed):

| Suite | Raw report location (generated) |
|-------|---------------------------------|
| Frontend coverage | `coverage/` (HTML + lcov + `coverage-summary.json`) |
| Backend unit | `backend/target/surefire-reports/**/*.xml` |
| Backend integration (IT) | `backend/target/failsafe-reports/**/*.xml` |
| Backend coverage (JaCoCo) | `backend/target/site/jacoco/index.html` (merged ut+it) |
| E2E (Cypress/Playwright) | `e2e/cypress/{screenshots,videos}`, `e2e/test-results`, `e2e/playwright-report` |
| Stress (k6) | `perf/k6-summary.json` |

**CI is the durable record.** [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs every suite
on each push/PR to `main` (JDK 21 + Node 20), fails the build if any test or gate trips, and **uploads
each report as a downloadable artifact**: `backend-test-results`, `frontend-coverage`, `e2e-cypress`,
`stress-k6-summary`. This document is the committed summary; attach the latest CI artifact set (or a
local run, below) for a specific run's raw numbers.

## Test inventory & gates (exact counts)

| Suite | Scope | Count | Tooling | Build-failing gate | Reproduce |
|-------|-------|------:|---------|--------------------|-----------|
| **Frontend unit / component** | Screens, RTK Query slice, shared UI primitives, hooks | **44 spec files** | Vitest 2 + React Testing Library + MSW (jsdom) | Coverage **≥ 80%** — lines, branches, functions, statements (`vitest.config.ts:33-38`) | `npx vitest run --coverage` |
| **Type safety** | Whole monorepo, strict | — | `tsc --noEmit` (TS strict) | **0 type errors** | `npm run typecheck` |
| **Backend unit** | Domain / FSM / validators / crypto | part of **202 `@Test`** across **11 `*Test.java`** | JUnit 5 + Mockito | (rolls into JaCoCo gate) | `mvn -f backend/pom.xml test` |
| **Backend integration / API / subsystem** | MockMvc controllers, persistence (Testcontainers Postgres), security (401/403/200 + cross-tenant), eventing (LocalStack SNS→SQS), Graph adapter (MockWebServer), OpenAPI contract, auditing | **27 `*IT.java`** (202 `@Test` total across **38 backend test files**) | JUnit 5 + MockMvc + **Testcontainers** | **JaCoCo ≥ 80% line** + **Spotless** (google-java-format) + **SpotBugs** — all bound to `verify` (`backend/pom.xml`) | `mvn -f backend/pom.xml verify` |
| **E2E** | Full lifecycle, reconciliation, manager review + roll-up, against the live federated stack | **6 Gherkin scenarios** (3 `*.feature`) + **1 Playwright smoke** | Cypress + Cucumber/Gherkin; Playwright | harness exit code (any failure fails CI) | `bash e2e/run-e2e.sh` |
| **Stress** | `<200ms` read NFR + stable pagination to ~2000 records | **3 k6 scenarios** (`plan-retrieval`, `rollup-pagination`, `lifecycle-throughput`) + legacy `stress.js` | k6 (HARD thresholds) | p95 `< 200ms` reads, `rate==0` errors, pagination-invariant `count==0` — non-zero exit on breach | `bash perf/run-stress.sh` |

**Totals:** **255 backend tests** across **38 files** (120 unit + 135 integration — 202 `@Test`
declarations expand to 255 executed cases with parameterized tests) · **260 frontend tests** across **44
spec files** · **6 E2E scenarios** + smoke · **3 k6 scenarios**. Enforced gates: **JaCoCo ≥ 80% line**,
**Vitest ≥ 80%** (×4 metrics), **Spotless**, **SpotBugs**, **`tsc` strict** — every one build-failing.

## Reproduce the whole matrix locally

```bash
docker compose up -d postgres                                   # Postgres 16.4 (Testcontainers also self-manages its own)
npm ci && npx tsc --noEmit -p tsconfig.base.json                # FE typecheck (strict)
npx vitest run --coverage                                       # FE unit + coverage gate → coverage/
mvn -f backend/pom.xml verify                                   # BE unit + IT + Spotless + SpotBugs + JaCoCo 80 → backend/target/**
bash e2e/run-e2e.sh                                             # E2E (Cypress Gherkin + Playwright smoke); KEEP_UP=1 to inspect
bash perf/run-stress.sh                                         # k6 stress smoke (<200ms gate); SKIP_STACK=1 to target a running API
```

> `mvn verify` runs surefire (unit) **and** failsafe (Testcontainers ITs) and then the Spotless,
> SpotBugs, and JaCoCo gates — so the backend unit + API + subsystem rows are one command. The hermetic
> suites use test doubles (Graph stub / MockWebServer, test-minted RS256 JWTs, Testcontainers /
> LocalStack), so the run is offline and deterministic; a separate CI `live` job exercises real Auth0 /
> Graph only when secrets are present.

## Status & provenance

The counts above are exact. The **2026-06-09 local run** (see *Latest measured run*) executed every
unit + integration suite **green — 515 tests, 0 failures** — on JDK 21.0.11 / Node 20 / Docker. Beyond
that, pass/fail and coverage are **enforced green by CI on every push to `main`** (the gates are
build-failing), so a merged build is the authoritative "all suites pass, coverage ≥ 80%" evidence. For a specific run's raw numbers, run the
commands above or download the latest CI artifacts named in *Where the results are placed*.
