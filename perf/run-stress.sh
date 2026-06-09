#!/usr/bin/env bash
# perf/run-stress.sh — one-shot STRESS/LOAD harness for the Weekly Commit Module backend.
# Brings up a FRESH stack, loads the ~2000-record roll-up dataset, runs the k6 load tier against the
# secured API (via the @Profile("e2e") X-Debug-Member dev-auth header), prints each k6 summary, and
# tears everything down. Steps:
#   1. docker compose down -v then up postgres (16.4) FRESH, wait until healthy (clean DB per run so
#      the write-path lifecycle scenario's created commits never collide with a prior run).
#   2. start the Spring Boot backend with profiles e2e,demo,stress (dev-auth + demo RCDO tree + the
#      StressSeeder's 210 reports / ~2000 commits), wait on /actuator/health, then wait on the seed.
#   3. run three k6 scenarios in the grafana/k6 Docker image (no sudo), each with HARD thresholds:
#        a. plan-retrieval.js       GET /commits/current     p95<200ms (the brief's plan-read NFR)
#        b. rollup-pagination.js    GET /rollup paginated     correctness + stable pagination + p95
#        c. lifecycle-throughput.js create->link->submit      full DRAFT->LOCKED, all 2xx + p95 gate
#   4. clean shutdown of the backend + containers on exit. Overall exit is non-zero if ANY k6 run
#      breached a threshold (k6 exits 99 on threshold failure), so green here means thresholds passed.
#
# Env knobs: KEEP_UP=1 leave the stack up after the run; SKIP_STACK=1 reuse a backend already serving
# (then only k6 runs); WCM_DB_PORT (default 5433); BACKEND_PORT (default 8080); the per-scenario
# VU/duration knobs (PLAN_VUS, ROLLUP_VUS, LIFECYCLE_ITERATIONS, ...) pass straight through to k6.
set -uo pipefail

PERF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$PERF_DIR/.." && pwd)"
LOG_DIR="$(mktemp -d /tmp/wcm-stress.XXXXXX)"
TOOLCHAIN="$HOME/.local/wcm-toolchain.env"

DB_PORT="${WCM_DB_PORT:-5433}"
BACKEND_PORT="${BACKEND_PORT:-8080}"
API_URL="http://localhost:${BACKEND_PORT}"
K6_IMAGE="${K6_IMAGE:-grafana/k6:latest}"
STRESS_MANAGER="stress-mgr@solovis.test"

# The grafana/k6 container reaches the host-published backend by the host's own LAN IP. On Docker
# Desktop / WSL2 the container's localhost and host.docker.internal point at the Docker VM, NOT this
# host, so resolve the gateway/host IP the bridge can actually route to (verified: a default-bridge
# container reaches the backend on this address). --add-host keeps host.docker.internal available too,
# for parity with the e2e harness. Override the whole base URL with WCM_API_BASE if needed.
HOST_IP="$(ip -4 route show default 2>/dev/null | awk '{print $9; exit}')"
[ -z "$HOST_IP" ] && HOST_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
K6_API_BASE="${WCM_API_BASE:-http://${HOST_IP}:${BACKEND_PORT}}"
DOCKER_HOST_MAP="--add-host=host.docker.internal:host-gateway"

BACKEND_PID=""
EXIT_CODE=0

log() { printf '\n=== %s ===\n' "$*"; }

cleanup() {
  if [ "${KEEP_UP:-0}" = "1" ]; then
    log "KEEP_UP=1 — leaving the stack running (backend pid ${BACKEND_PID:-?})"
    return
  fi
  log "Cleaning up"
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
  pkill -f 'spring-boot:run' 2>/dev/null
  if [ "${SKIP_STACK:-0}" != "1" ]; then
    (cd "$REPO_ROOT" && docker compose down -v >/dev/null 2>&1)
  fi
}
trap cleanup EXIT INT TERM

wait_for() { # url label timeout_s
  local url="$1" label="$2" max="${3:-120}" i=0
  log "Waiting for $label ($url)"
  until [ "$(curl -s -o /dev/null -w '%{http_code}' "$url" 2>/dev/null)" = "200" ]; do
    i=$((i + 1))
    if [ "$i" -ge "$max" ]; then
      echo "TIMEOUT waiting for $label"
      return 1
    fi
    sleep 1
  done
  echo "$label is up"
}

if [ "${SKIP_STACK:-0}" != "1" ]; then
  # --- 1. Fresh Postgres -----------------------------------------------------------------------
  log "Starting FRESH Postgres (docker compose down -v; up)"
  (cd "$REPO_ROOT" && docker compose down -v >/dev/null 2>&1)
  (cd "$REPO_ROOT" && docker compose up -d postgres) || { echo "compose up failed"; exit 1; }
  log "Waiting for Postgres healthy"
  s=none
  for _ in $(seq 1 60); do
    s="$(docker inspect -f '{{.State.Health.Status}}' wcm-postgres 2>/dev/null || echo none)"
    [ "$s" = "healthy" ] && break
    sleep 2
  done
  [ "$s" = "healthy" ] || { echo "Postgres not healthy"; exit 1; }

  # --- 2. Backend (e2e,demo,stress) ------------------------------------------------------------
  log "Starting backend (profiles e2e,demo,stress) — seeds ~2000-record roll-up"
  # shellcheck disable=SC1090
  [ -f "$TOOLCHAIN" ] && source "$TOOLCHAIN"
  (
    cd "$REPO_ROOT"
    DB_URL="jdbc:postgresql://localhost:${DB_PORT}/wcm" \
    SPRING_PROFILES_ACTIVE="e2e,demo,stress" \
    GRAPH_TOKEN_ENC_KEY="$(head -c 32 /dev/zero | base64)" \
      mvn -q -o -f backend/pom.xml spring-boot:run
  ) > "$LOG_DIR/backend.log" 2>&1 &
  BACKEND_PID=$!
fi

wait_for "$API_URL/actuator/health" "backend health" 240 \
  || { [ -f "$LOG_DIR/backend.log" ] && tail -50 "$LOG_DIR/backend.log"; exit 1; }

# The StressSeeder runs as a CommandLineRunner; the roll-up isn't fully populated until it commits.
# Poll the manager roll-up until it reports the full report population before loading k6.
log "Waiting for the stress dataset to finish seeding"
seeded=0
for _ in $(seq 1 150); do
  total="$(curl -s -H "X-Debug-Member: ${STRESS_MANAGER}" \
    "$API_URL/api/rollup?page=0&size=1" \
    | sed -n 's/.*"totalElements":\([0-9]*\).*/\1/p')"
  if [ "${total:-0}" -ge 210 ]; then seeded=1; echo "roll-up reports ${total} reports — seeded"; break; fi
  sleep 2
done
[ "$seeded" = "1" ] || { echo "stress seed did not reach 210 reports"; tail -40 "$LOG_DIR/backend.log" 2>/dev/null; exit 1; }

# --- 3. k6 scenarios ---------------------------------------------------------------------------
run_k6() { # script label
  local script="$1" label="$2"
  log "k6: ${label}  (${script})  -> ${K6_API_BASE}"
  docker run --rm $DOCKER_HOST_MAP \
    -e WCM_API_BASE="$K6_API_BASE" \
    -e PLAN_VUS -e PLAN_DURATION \
    -e ROLLUP_VUS -e ROLLUP_DURATION -e ROLLUP_PAGE_SIZE -e ROLLUP_PAGE_P95_MS \
    -e LIFECYCLE_VUS -e LIFECYCLE_ITERATIONS -e LIFECYCLE_WRITE_P95_MS \
    -v "$PERF_DIR:/scripts" -w /scripts \
    "$K6_IMAGE" run "$script" 2>&1 | tee "$LOG_DIR/k6-${label}.log"
  local code=${PIPESTATUS[0]}
  if [ "$code" -ne 0 ]; then
    echo ">>> k6 ${label} FAILED a threshold (exit ${code})"
    EXIT_CODE=1
  else
    echo ">>> k6 ${label} PASSED all thresholds"
  fi
}

run_k6 "plan-retrieval.js" "plan-retrieval"
run_k6 "rollup-pagination.js" "rollup-pagination"
run_k6 "lifecycle-throughput.js" "lifecycle-throughput"

log "Logs in ${LOG_DIR}"
echo "Overall stress exit: ${EXIT_CODE} (0 = all k6 thresholds passed)"
exit "$EXIT_CODE"
