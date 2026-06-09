#!/usr/bin/env bash
# e2e/run-e2e.sh — one-shot LIVE end-to-end harness for the Weekly Commit Module.
# Brings up the whole federated stack and runs the browser suites against it, then tears everything
# down. Steps:
#   1. docker compose up postgres (16.4) and wait until healthy
#   2. start the Spring Boot backend with profiles e2e,demo (hermetic X-Debug-Member auth + demo seed)
#   3. build + serve the frontend host-shell (:4200) + wc-remote (:4201) with VITE_E2E (live MF — the
#      host loads the remote; the remote is NOT tested standalone)
#   4. wait-on all URLs (backend health, remoteEntry.js, host root)
#   5. run Cypress headless via the cypress/included Docker image (repo mounted, --network host)
#   6. run the Playwright smoke (npx playwright if its browser runs, else the mcr playwright image)
#   7. clean shutdown of every process/container on exit
#
# Env knobs: SKIP_BUILD=1 reuse existing dist; KEEP_UP=1 leave the stack running after the run.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
E2E_DIR="$REPO_ROOT/e2e"
LOG_DIR="$(mktemp -d /tmp/wcm-e2e.XXXXXX)"
TOOLCHAIN="$HOME/.local/wcm-toolchain.env"

DB_PORT="${WCM_DB_PORT:-5433}"
BACKEND_PORT=8080
HOST_PORT=4200
REMOTE_PORT=4201
HOST_URL="http://localhost:${HOST_PORT}"
API_URL="http://localhost:${BACKEND_PORT}"
# URLs as seen from INSIDE a container. On Docker Desktop / WSL2 the container's `localhost` is the
# Docker VM, not the WSL host, so the browser suites reach the app via host.docker.internal (mapped
# to the host gateway with --add-host below). On native Linux this host also resolves to the gateway.
CONTAINER_HOST="host.docker.internal"
CONTAINER_HOST_URL="http://${CONTAINER_HOST}:${HOST_PORT}"
# Step-def cy.request() calls go through the HOST's /api proxy (port 4200), not the backend port
# directly — the host preview is proven reachable from the container via the gateway, and proxying
# avoids depending on the backend port also being routable through the Docker-Desktop VM gateway.
CONTAINER_API_URL="$CONTAINER_HOST_URL"
DOCKER_HOST_MAP="--add-host=${CONTAINER_HOST}:host-gateway"
CY_IMAGE="cypress/included:13.15.0"
PW_IMAGE="mcr.microsoft.com/playwright:v1.47.2-jammy"

BACKEND_PID=""
HOST_PID=""
REMOTE_PID=""
EXIT_CODE=0

log() { printf '\n=== %s ===\n' "$*"; }

cleanup() {
  if [ "${KEEP_UP:-0}" = "1" ]; then
    log "KEEP_UP=1 — leaving the stack running (backend pid ${BACKEND_PID:-?}, host ${HOST_PID:-?}, remote ${REMOTE_PID:-?})"
    return
  fi
  log "Cleaning up"
  [ -n "$HOST_PID" ] && kill "$HOST_PID" 2>/dev/null
  [ -n "$REMOTE_PID" ] && kill "$REMOTE_PID" 2>/dev/null
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
  # vite preview / spring-boot child procs
  pkill -f 'vite preview' 2>/dev/null
  pkill -f 'spring-boot:run' 2>/dev/null
  (cd "$REPO_ROOT" && docker compose down -v >/dev/null 2>&1)
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

# --- 1. Postgres -------------------------------------------------------------------------------
log "Starting Postgres (docker compose)"
(cd "$REPO_ROOT" && docker compose up -d postgres) || { echo "compose up failed"; exit 1; }
log "Waiting for Postgres healthy"
for i in $(seq 1 60); do
  s="$(docker inspect -f '{{.State.Health.Status}}' wcm-postgres 2>/dev/null || echo none)"
  [ "$s" = "healthy" ] && break
  sleep 2
done
[ "$s" = "healthy" ] || { echo "Postgres not healthy"; exit 1; }

# --- 2. Backend (e2e,demo) ---------------------------------------------------------------------
log "Starting backend (profiles e2e,demo)"
# shellcheck disable=SC1090
[ -f "$TOOLCHAIN" ] && source "$TOOLCHAIN"
(
  cd "$REPO_ROOT"
  DB_URL="jdbc:postgresql://localhost:${DB_PORT}/wcm" \
  SPRING_PROFILES_ACTIVE="e2e,demo" \
    mvn -q -f backend/pom.xml spring-boot:run
) > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
wait_for "$API_URL/actuator/health" "backend health" 150 || { tail -40 "$LOG_DIR/backend.log"; exit 1; }

# --- 3. Frontend build + serve (VITE_E2E, live MF) --------------------------------------------
if [ "${SKIP_BUILD:-0}" != "1" ]; then
  log "Building wc-remote + host-shell (VITE_E2E=true)"
  # --skip-nx-cache so the VITE_* env (E2E flag, remote-entry URL) actually re-bakes into the bundle
  # instead of Nx replaying a previously-cached artifact built without these env values.
  (cd "$REPO_ROOT" && VITE_E2E=true VITE_API_BASE=/api npx nx build wc-remote --skip-nx-cache) > "$LOG_DIR/build-remote.log" 2>&1 \
    || { echo "remote build failed"; tail -30 "$LOG_DIR/build-remote.log"; exit 1; }
  # Point the host's federated remoteEntry at host.docker.internal so the Dockerized browser (whose
  # localhost is the container) loads the remote from the host gateway.
  (cd "$REPO_ROOT" && VITE_E2E=true VITE_API_BASE=/api \
     VITE_REMOTE_ENTRY="http://${CONTAINER_HOST}:${REMOTE_PORT}/remoteEntry.js" \
     npx nx build host-shell --skip-nx-cache) > "$LOG_DIR/build-host.log" 2>&1 \
    || { echo "host build failed"; tail -30 "$LOG_DIR/build-host.log"; exit 1; }
fi

log "Serving wc-remote (:$REMOTE_PORT) and host-shell (:$HOST_PORT)"
# Bind to 0.0.0.0 so the Dockerized Cypress/Playwright (which reach the host via host.docker.internal
# on Docker Desktop / WSL2, where --network host does NOT share the WSL host's loopback) can connect.
( cd "$REPO_ROOT/apps/wc-remote" && npx vite preview --host 0.0.0.0 --port "$REMOTE_PORT" --strictPort ) > "$LOG_DIR/remote.log" 2>&1 &
REMOTE_PID=$!
( cd "$REPO_ROOT/apps/host-shell" && WCM_API_TARGET="$API_URL" npx vite preview --host 0.0.0.0 --port "$HOST_PORT" --strictPort ) > "$LOG_DIR/host.log" 2>&1 &
HOST_PID=$!

# --- 4. Wait-on the URLs -----------------------------------------------------------------------
wait_for "http://localhost:${REMOTE_PORT}/remoteEntry.js" "remoteEntry.js" 60 || { tail -20 "$LOG_DIR/remote.log"; exit 1; }
wait_for "$HOST_URL/" "host-shell" 60 || { tail -20 "$LOG_DIR/host.log"; exit 1; }
# Sanity: the /api proxy reaches the backend through the host origin.
wait_for "$HOST_URL/actuator/health" "host→backend proxy" 30 || true

# --- 5. Cypress (cypress/included Docker image) -----------------------------------------------
# Reaches the app via host.docker.internal (Docker-Desktop/WSL2-safe). The repo is mounted so the
# Gherkin features + TS step defs + e2e/node_modules (cucumber + esbuild preprocessors) are present.
log "Running Cypress headless ($CY_IMAGE)"
docker run --rm $DOCKER_HOST_MAP \
  -e WCM_HOST_URL="$CONTAINER_HOST_URL" \
  -v "$E2E_DIR:/e2e" -w /e2e \
  --entrypoint cypress \
  "$CY_IMAGE" run --e2e --browser electron \
    --config baseUrl="$CONTAINER_HOST_URL" \
    --env apiUrl="$CONTAINER_API_URL" \
  2>&1 | tee "$LOG_DIR/cypress.log"
CY_CODE=${PIPESTATUS[0]}
[ "$CY_CODE" -ne 0 ] && EXIT_CODE="$CY_CODE"

# --- 6. Playwright smoke -----------------------------------------------------------------------
# Prefer a local run if the chromium browser is installed; otherwise use the mcr playwright image,
# reaching the app via host.docker.internal. The image already bundles the browsers.
log "Running Playwright smoke"
if (cd "$E2E_DIR" && WCM_HOST_URL="$HOST_URL" npx playwright test --reporter=list) > "$LOG_DIR/playwright.log" 2>&1; then
  cat "$LOG_DIR/playwright.log"
  echo "Playwright smoke passed (local browser)"
else
  echo "Local Playwright run failed/unavailable — retrying via Docker image $PW_IMAGE"
  # The mcr image bundles browsers matching @playwright/test 1.47.2 (pinned exactly in package.json),
  # at /ms-playwright (world-readable). Run as the HOST uid:gid so any node_modules written into the
  # mounted volume stay host-owned (no root-owned files left behind); HOME=/tmp gives npm a writable
  # home for that user. The test only needs @playwright/test + the pre-installed browsers.
  if docker run --rm $DOCKER_HOST_MAP \
      --user "$(id -u):$(id -g)" \
      -e HOME=/tmp \
      -e WCM_HOST_URL="$CONTAINER_HOST_URL" \
      -e CI=1 \
      -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
      -v "$E2E_DIR:/e2e" -w /e2e \
      "$PW_IMAGE" \
      sh -c "npm install --no-audit --no-fund >/dev/null 2>&1; WCM_HOST_URL='$CONTAINER_HOST_URL' PLAYWRIGHT_BROWSERS_PATH=/ms-playwright npx playwright test --reporter=list" \
      2>&1 | tee "$LOG_DIR/playwright.docker.log"; then
    echo "Playwright smoke passed (Docker)"
  else
    echo "Playwright smoke FAILED"
    EXIT_CODE=1
  fi
fi

log "Logs in $LOG_DIR"
echo "Cypress exit: ${CY_CODE}; overall exit: ${EXIT_CODE}"
exit "$EXIT_CODE"
