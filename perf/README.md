# Weekly Commit Module — Stress / Load Test Tier (k6)

The fourth test tier (after unit / integration / E2E): a [k6](https://k6.io) load suite that proves
the brief's performance NFRs under concurrency, against a deliberately large dataset.

- **Brief NFR:** "API response times under 200ms for plan retrieval" and "Spring Data Pageable for
  team views up to 2000 records."
- **Run it:** `perf/run-stress.sh` (no sudo; k6 runs in the `grafana/k6` Docker image).
- **Green only if k6 thresholds pass:** every script declares HARD thresholds; k6 exits non-zero
  (99) on a breach, and `run-stress.sh` propagates that, so a green run means the NFRs held.

## What it sets up

A `@Profile("stress")` seeder (`backend/.../member/StressSeeder.java`) bulk-loads, deterministically
and idempotently, a single-manager roll-up at the brief's scale:

| Entity | Count | Notes |
|---|---|---|
| Stress manager | 1 | `stress-mgr@solovis.test` — drive `/rollup` as this member |
| Direct reports | 210 | `stress-report-0..209@solovis.test` |
| Weekly commits | ~2100 | 10 weeks/report, across DRAFT / LOCKED / RECONCILING / RECONCILED |
| Commit items | ~8400 | 4/commit, all linked to a seeded RCDO SupportingOutcome |
| Snapshots / reviews | per post-DRAFT / RECONCILED commit | the KTD4 / RECONCILED FSM invariants |

The manager's roll-up therefore returns **210 report rows aggregating ~2000 commits / ~8000 items** —
the Pageable team view at the 2000-record ceiling. The seeder defensively runs the demo seed first
(idempotent) so the RCDO tree its items link to is present regardless of runner ordering. The
regression test guarding it is `backend/.../member/StressSeederIT.java`.

Auth: the secured API is reached with the `@Profile("e2e")` dev-auth header `X-Debug-Member` (a
seeded member's email); MANAGER members carry `SCOPE_reconcile:commits`, so `/rollup` authorizes
exactly as the prod Auth0 JWT chain would. No Auth0 tenant is needed.

## The three k6 scenarios

| Script | Endpoint(s) | Asserts (HARD thresholds) |
|---|---|---|
| `plan-retrieval.js` | `GET /api/commits/current` | `http_req_duration p95 < 200ms`, zero errors, all checks pass |
| `rollup-pagination.js` | `GET /api/rollup?page&size` | per-page `p95 < 200ms`, **stable pagination** (no id on two pages, union == totalElements, globally name-sorted across pages, totalElements constant), zero errors |
| `lifecycle-throughput.js` | `POST /commits` → `PUT /commits/{id}` → `POST /commits/{id}/submit` | every step 2xx, `p95 < 400ms` on writes, all iterations complete a full DRAFT→LOCKED |

A breach of ANY threshold fails the run. Thresholds are never removed; only the **load profile** (VU
count / duration / page size) is scoped to this single-box dev environment — see below.

## Load profile (and why it is scoped, not the threshold)

The 200ms bar is a fixed NFR. What is tuned to the host is the *concurrency* at which we assert it —
a realistic home-screen / dashboard load for a single dev box (8 cores, ~11 GB), not an unbounded
flood. Each profile is env-tunable so CI or a bigger box can raise it without touching the threshold.

| Scenario | Default profile | Env overrides |
|---|---|---|
| plan-retrieval | 20 VUs constant, 30s | `PLAN_VUS`, `PLAN_DURATION` |
| rollup-pagination | 8 VUs constant, 30s, page size 50 | `ROLLUP_VUS`, `ROLLUP_DURATION`, `ROLLUP_PAGE_SIZE`, `ROLLUP_PAGE_P95_MS` |
| lifecycle-throughput | 6 VUs, 90 shared iterations | `LIFECYCLE_VUS`, `LIFECYCLE_ITERATIONS`, `LIFECYCLE_WRITE_P95_MS` |

A roll-up read at the full 2000-record scale is comfortably **<200ms** because the read model
batch-loads a page's commits + items in a fixed number of queries (`WeeklyCommitRepository
.findByMemberIdIn` + `CommitItemRepository.findByWeeklyCommitIdIn` + one RCDO id-set load) instead of
the per-report / per-commit round trips that an N+1 read would do at this scale.

## Networking note (WSL2 / Docker Desktop)

`run-stress.sh` points k6 at the host's LAN IP (auto-detected from the default route), because on
Docker Desktop / WSL2 a container's `localhost` and `host.docker.internal` resolve to the Docker VM,
not this host — the backend (published on `*:8080`) is reachable from a bridge container only via the
host IP. `--add-host=host.docker.internal:host-gateway` is still passed for parity. Override the base
URL with `WCM_API_BASE` (e.g. `http://host.docker.internal:8080` on native Linux).

## Files

```
perf/
├── run-stress.sh             # the harness: fresh DB + backend(e2e,demo,stress) + 3 k6 runs + teardown
├── lib/config.js             # shared API base + dev-auth header + seeded stress identities
├── plan-retrieval.js         # GET /commits/current load — p95<200ms
├── rollup-pagination.js      # GET /rollup pagination correctness + p95 over the 2000-record set
├── lifecycle-throughput.js   # create→link→submit DRAFT→LOCKED throughput
└── stress.js                 # (legacy) general read-path <200ms smoke across the hot GETs
```
