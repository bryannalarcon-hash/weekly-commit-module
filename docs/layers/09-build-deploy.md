<!-- 09-build-deploy.md — faithful layer doc for the WCM build system, npm-workspaces+Nx monorepo,
     Vite 5 MF + Tailwind/PostCSS, Maven backend build, Spring profile matrix, and the AWS deploy design. -->

# 09 — Build, Monorepo & Deployment

## Executive summary

The Weekly Commit Module is a **two-toolchain monorepo**: an **npm-workspaces + Nx** frontend
(`apps/*` + `libs/*`, `package.json:7-10`) built with **Vite 5 + Module Federation**, and a
**Maven / Spring Boot 3.3.13 / Java 21** backend (`backend/pom.xml`). Local infra is a single
`docker-compose.yml` Postgres 16.4. Runtime behavior is selected entirely by **Spring profiles**
(`default` / `test` / `e2e` / `demo` / `stress` / `graph` / `aws`), each flipping a specific seam
(auth, seed, calendar adapter, event publisher) with **no code change**.

The **AWS deployment** is a *design + runbook* (`docs/TECHNICAL.md:359-375`): backend→ECR/EKS, RDS
Postgres 16.4, the federated FE (`host-shell` + `wc-remote`'s `remoteEntry.js`)→S3+CloudFront, and an
SNS+SQS+DLQ event seam that flips on purely by activating the `aws` profile and setting
`WCM_SNS_TOPIC_ARN` / `WCM_SQS_QUEUE_URL`. **EKS/S3/CloudFront provisioning is not executed** by
default CI — it is gated on AWS credentials + explicit cost approval (a partial-satisfaction of the
brief's AWS requirement; the SNS→SQS seam itself is built and LocalStack-tested).

> **Documented deviation — npm, not Yarn.** The brief lists *Yarn Workspaces*; this build uses **npm
> workspaces** with the same `apps/*`+`libs/*` layout, keeping Nx for the task graph
> (`docs/TECHNICAL.md:295`, `:333-338`; PRD line 77 says PA's package manager need not be replicated).

## Responsibilities

- Define the **workspace graph** (apps + libs) and resolve cross-package imports via path aliases.
- Build the **MF remote** (`wc-remote` → chunked `remoteEntry.js`) and the **host** (`host-shell`)
  with shared React/React-DOM/Router singletons.
- Run the **Tailwind/PostCSS** pipeline off a single OKLCH token source.
- Build + verify the **backend** (Spring Boot fat jar; Flyway migrations; the verify-time gate chain).
- Provision **local infra** (Postgres 16.4) and document the **AWS target topology**.
- Centralize **every secret** in `.env.example` (gitignored real `.env`) and the profile/env matrix.

## Key components

| Component | Path:line | Role |
|---|---|---|
| Workspaces + scripts | `package.json:7` | `apps/*`+`libs/*` workspaces; scripts `build`/`test`/`lint`/`format`/`typecheck` |
| Nx task graph | `nx.json:15` | `targetDefaults` for `build`/`lint`/`test` with caching; `production` named-input excludes test/config |
| TS path aliases | `tsconfig.base.json:26` | `@wcm/types`→`libs/types/src`, `@wcm/api`→`libs/api/src`, `@wcm/ui`→`libs/ui/src` |
| TS strict opts | `tsconfig.base.json:18-23` | `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch` |
| Remote Vite config | `apps/wc-remote/vite.config.ts:1` | `@module-federation/vite`: exposes `./WeeklyCommitApp` + `./WeeklyCommitWidget`; CORS for cross-origin `remoteEntry.js` |
| Host Vite config | `apps/host-shell/vite.config.ts:1` | Declares the `wc` remote (`VITE_REMOTE_ENTRY` override); shares react/react-dom/react-router-dom as singletons |
| Tailwind config | `tailwind.config.js:17` | Content globs (anchored to config dir); OKLCH colors mapped to CSS vars; IBM Plex fonts; radii/shadows |
| PostCSS config | `postcss.config.js:12` | Tailwind (absolute config path) then Autoprefixer |
| OKLCH token source | `libs/ui/src/theme.colors.mjs:1` | Single source: drives `tailwind.config.js` + `global.css` (33 OKLCH vars) + typed `tokens.ts` |
| Vitest workspace | `vitest.workspace.ts:26` | Aggregates app/lib test projects (env+plugins only; coverage lives in `vitest.config.ts`) |
| ESLint flat config | `eslint.config.js:7` | ESLint 9 flat; `typescript-eslint` recommended + react-hooks; ignores `backend/**` and build output |
| Prettier | `.prettierrc`, `package.json:43` | Prettier `3.3.3` (`format`/`format:write`) |
| Maven build | `backend/pom.xml:8` | Spring Boot 3.3.13, Java 21, Flyway, springdoc, oauth2-resource-server, AWS SDK v2 BOM |
| Flyway migrations | `backend/src/main/resources/db/migration/` | **V1..V10** applied at boot (`application.yml:65-70`) |
| Spring core config | `backend/src/main/resources/application.yml:10` | Datasource, Hibernate `validate`+UTC+no-OIV, Auth0/Graph/AWS env refs (empty-safe), actuator health-only |
| Local infra | `docker-compose.yml:3` | `postgres:16.4`, host `5433`→container `5432`, healthcheck, named volume |
| Secrets template | `.env.example:1` | Every secret documented; VITE_* public, server secrets marked `# SECRET`; real `.env` gitignored |
| CI pipeline | `.github/workflows/ci.yml:33` | Builds/tests both toolchains; `nx build wc-remote` emits the CDN bundle (`ci.yml:113`) |

## Interfaces & contracts

- **Path-alias contract** — app/lib code imports the three libs via `@wcm/*`
  (`tsconfig.base.json:26-30`); the same aliases must be honored by Vite/Vitest resolution (Vitest
  loads `@vitejs/plugin-react` for libs that have no own Vite config — `vitest.workspace.ts:4-8`).
- **Module Federation contract** — `wc-remote` (name `wc`) exposes `./WeeklyCommitApp` and
  `./WeeklyCommitWidget` (`apps/wc-remote/vite.config.ts`); `host-shell` (name `host`) consumes the
  `wc` remote from `VITE_REMOTE_ENTRY` (default `http://localhost:4201/remoteEntry.js`) and shares
  **react / react-dom / react-router-dom as singletons** (`apps/host-shell/vite.config.ts`). The
  remote sends `Access-Control-Allow-Origin` for the cross-origin `remoteEntry.js` import on both
  `vite` and `vite preview` (`apps/wc-remote/vite.config.ts:31-49`).
- **Version pins** — `@module-federation/vite` is pinned **exactly** to `1.7.0`, Vite `^5.4.2`,
  Vitest `^2.1.9`, Nx `^19.6.0` (`package.json:27,42,51,52`); `engines` require Node ≥20 / npm ≥10
  (`package.json:11-14`).
- **Profile/env contract** — every external secret in `application.yml` is an env ref defaulting to
  **empty**, so the app boots with nothing configured; a non-blank value (or a profile) activates the
  integration (`application.yml:1-9`). The event seam flips in-process↔SNS/SQS purely via the `aws`
  profile + `WCM_SNS_TOPIC_ARN`/`WCM_SQS_QUEUE_URL` (`application.yml:27-34`, `.env.example:42-49`).
- **Schema contract** — Hibernate runs `ddl-auto: validate` against the Flyway-migrated schema
  (`application.yml:57-60`); the app refuses to start if entities and migrations diverge.

## Data & state

- **Build cache** — Nx caches `build`/`lint`/`test` (`nx.json:15-29`); the E2E harness passes
  `--skip-nx-cache` so the `VITE_E2E`/remote-entry env actually re-bakes (`e2e/run-e2e.sh:103-114`).
- **Local DB** — a named Docker volume `wcm-pgdata` persists Postgres data
  (`docker-compose.yml:14-23`); the stress harness wipes it (`docker compose down -v`) each run.
- **Secrets** — read from `.env`/profile env, never committed; AWS creds for deploy live in
  `~/gauntlet/.env`, not the repo (`.env.example:37-39`).

## Dependencies

**Depends on**
- Node ≥20 toolchain (npm, Nx 19, Vite 5, Vitest 2) and the JDK 21 + Maven backend toolchain.
- Docker (compose Postgres; LocalStack/k6/Cypress images in the test tiers).
- The OKLCH token module as the single styling source (`libs/ui/src/theme.colors.mjs`); Tailwind
  cannot import the `.ts` tokens, hence the plain-JS literals.

**Used by**
- `.github/workflows/ci.yml` — `fe` job runs `tsc`/`vitest`/`nx build wc-remote`; `be` job runs
  `mvn verify`; `e2e`/`stress` jobs build + boot the full stack.
- The deployment design (below) consumes the `nx build` artifacts (host bundle + `remoteEntry.js`)
  and the Spring Boot jar.

## How it works (flow)

1. **FE build** — `npm run build` → `nx run-many -t build`; `nx build wc-remote` emits the chunked
   `remoteEntry.js` (the CDN bundle, `ci.yml:113`); `nx build host-shell` emits the host SPA. Both
   resolve `@wcm/*` aliases and run the Tailwind/PostCSS pipeline off the shared OKLCH tokens.
2. **Typecheck/lint/format** — `tsc --noEmit -p tsconfig.base.json` (strict), `eslint .`,
   `prettier --check .` (`package.json:21-23`).
3. **BE build** — `mvn -f backend/pom.xml verify` compiles (Java 21 + Lombok), runs surefire/failsafe,
   then the Spotless/SpotBugs/JaCoCo gates (see doc 08); Flyway V1..V10 apply against the datasource;
   Hibernate `validate` checks the schema.
4. **Local run** — `docker compose up -d postgres` + the backend under `e2e,demo` + the federated FE
   is the full product locally (`docs/TECHNICAL.md:367-369`).
5. **Deploy (design)** — CI/CDK would push the backend image to **ECR**, run it on **EKS** with
   `/actuator/health` readiness/liveness, point it at **RDS Postgres 16.4**, upload the host bundle +
   `remoteEntry.js` to **S3** fronted by **CloudFront** (CORS + cache), and create the **SNS topic +
   SQS queue + DLQ**; Auth0/Graph/DB secrets land in **Secrets Manager/SSM**. Activating the `aws`
   profile swaps `InProcessEventPublisher`→`SnsEventPublisher` + starts the `SqsEventPoller`
   (`docs/TECHNICAL.md:359-365`).

## Spring profiles matrix

| Profile | Flips | Evidence (path:line) |
|---|---|---|
| **default** (none) | In-process event publisher (`!aws`); stub calendar adapter (`!graph`); prod JWT chain (`!e2e`); no seed | `InProcessEventPublisher.java:15`, `StubCalendarAdapter.java:18`, `SecurityConfig.java:43` |
| **test** | IT profile: imports `TestJwtConfig` (local RS256 keypair + decoder) so MockMvc auths with minted bearers | `AbstractWebIT.java:29-30`, `TestJwtConfig.java:33` |
| **e2e** | REPLACES the JWT chain with `E2eSecurityConfig` + `X-Debug-Member` header auth; enables the per-scenario reset endpoint | `E2eSecurityConfig.java:46`, `DebugHeaderCurrentMemberProvider.java:18`, `E2eResetController.java:36` |
| **demo** | `DemoSeeder` CommandLineRunner loads the SOLOVIS_SEED RCDO tree + member graph | `DemoSeeder.java:44` |
| **stress** | `StressSeeder` bulk-loads ~210 reports / ~2100 commits / ~8400 items (runs demo seed first) | `StressSeeder.java:42`, `perf/README.md:18-28` |
| **graph** | Swaps the stub for the real `GraphCalendarAdapter` (delegated `/me/events`) | `GraphCalendarAdapter.java:31`, `StubCalendarAdapter.java:18` |
| **aws** | `SnsEventPublisher` + `SqsEventPoller` + AWS clients (`AwsClientConfig`); the SNS→SQS seam | `SnsEventPublisher.java:21`, `SqsEventPoller.java:26`, `AwsClientConfig.java:24` |

Profiles compose: ITs run `test`; perf runs `e2e,demo,stress` (`perf/run-stress.sh:97`); browser E2E
runs `e2e,demo` (`e2e/run-e2e.sh:90-97`); the SNS→SQS IT runs `test,aws` (`SnsSqsEventingIT.java:51`).

## Deploy topology

```
                          ┌──────────── CloudFront (CORS + cache) ────────────┐
   browser ──────────────▶│  S3: host-shell bundle  +  wc-remote/remoteEntry.js │
        │   /api/*         └────────────────────────────────────────────────────┘
        ▼
   ┌──────────── EKS (ECR image, JRE-21) ────────────┐        ┌──────────────┐
   │  Spring Boot (profile: aws[,graph])             │───────▶│ RDS Postgres │
   │  /actuator/health  (readiness/liveness)         │  JDBC  │    16.4      │
   │  SnsEventPublisher ──▶ SQS poller ──▶ consumers │        └──────────────┘
   └───────┬─────────────────────────▲────────────────┘
           │ publish commit.locked    │ long-poll
           ▼                          │
       ┌────────┐  fan-out   ┌───────────────┐  on failure  ┌─────┐
       │  SNS   │──────────▶ │  SQS (queue)  │ ───────────▶ │ DLQ │
       └────────┘            └───────────────┘              └─────┘
   secrets: Auth0 / Graph / DB  →  Secrets Manager / SSM
```

NOTE: EKS/S3/CloudFront provisioning is **design + runbook only**, gated on AWS creds + cost approval
(`docs/TECHNICAL.md:371-374`). The SNS→SQS seam is built and proven offline against LocalStack
(`SnsSqsEventingIT`, see doc 08).

## Design decisions & rationale

- **npm workspaces over Yarn** — same `apps/*`+`libs/*` shape, Nx kept for caching/task graph; a
  low-risk, documented deviation (`docs/TECHNICAL.md:333-338`).
- **Profile-driven seams, not config branches** — auth, seed, calendar adapter and event publisher
  each have a `@Profile`-selected implementation, so flipping environments (test↔e2e↔aws↔graph) is a
  profile change with no code edit; the default boot needs zero AWS/Auth0/Graph secrets
  (`application.yml:1-9`).
- **Single OKLCH token source** — `theme.colors.mjs` drives Tailwind, `global.css`, and typed tokens
  so a brand swap is one edit; the literals are plain JS because Tailwind cannot import the `.ts`
  module (`libs/ui/src/theme.colors.mjs:1-8`).
- **Singletons + router sharing in MF** — `react-router-dom` MUST be a singleton or the host's
  `BrowserRouter` context breaks for the remote (`apps/host-shell/vite.config.ts:36-39`).
- **Exact MF plugin pin** — `@module-federation/vite@1.7.0` is pinned (not `^`) because the MF/Vite
  integration is version-sensitive (`package.json:27`).
- **AWS provisioning gated, seam abstracted** — building the SNS→SQS abstraction + LocalStack proof
  without spinning paid infra satisfies the architecture while deferring cost
  (`docs/TECHNICAL.md:294`, `:371-374`).

## Gotchas & sharp edges

- **DRIFT (migration ceiling).** `docs/TECHNICAL.md:288` says "Flyway V1…V8"; the tree actually has
  **V1..V10** (`backend/src/main/resources/db/migration/`, through
  `V10__member_timezone_and_notifications.sql`). Doc 08's `AbstractPersistenceIT` summary saying
  "V1..V5" is also narrower than reality.
- **Two package managers, one repo.** The root is npm (`package.json`); the backend is Maven
  (`backend/pom.xml`). ESLint deliberately ignores `backend/**` (`eslint.config.js:14`); Spotless owns
  Java formatting. Don't run JS tooling over `backend/`.
- **`docker-compose.yml` maps host 5433**, but `.env.example` `DB_URL` and `application.yml` default to
  `:5432` (`docker-compose.yml:13`, `.env.example:32`, `application.yml:37`). The CI/e2e/stress
  harnesses set `DB_URL=...:5433` explicitly (`ci.yml:72`, `run-e2e.sh:95`); a bare local run against
  the compose DB must override the port.
- **MF env must bypass Nx cache.** Without `--skip-nx-cache`, Nx replays a bundle built without the
  `VITE_E2E`/remote-entry env, breaking the federated E2E (`e2e/run-e2e.sh:104-106`).
- **`aws` profile changes transactionality.** The SNS→SQS path crosses transactions, so AWS-profile
  ITs are not `@Transactional` and must hand-clean rows (`SnsSqsEventingIT.java:130-145`).
- **Actuator is health-only.** Only `/actuator/health` is exposed and `permitAll` in both security
  chains (`application.yml:71-81`); other actuator endpoints are intentionally absent.
- **AWS not provisioned by default CI.** The `live` CI job and any `cdk deploy` are gated on secrets +
  cost approval (`ci.yml:204-247`, `docs/TECHNICAL.md:371-374`) — "deployed" here means the design +
  the local/LocalStack equivalent, not a standing cloud stack.

## Connects to

- **07 — Frontend / Module Federation** (the host/remote contract this build produces).
- **08 — Testing & Quality Gates** (the Maven gate plugins, CI jobs, and profile usage in tests).
- **Eventing / Integrations layer docs** (the `aws`/`graph` profiles' SNS→SQS and Graph seams).
