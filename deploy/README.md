<!-- deploy/README.md — how the Weekly Commit Module is containerized and deployed to a single AWS
     EC2 host. Covers the image build, the local prod-stack smoke, the EC2 provision/ship/teardown
     scripts, and the demo's auth posture. The heavier ECS-Fargate+RDS+CDK path is intentionally NOT
     built (this single-host footprint was chosen for a cheap, reversible demo). -->

# WCM — AWS deploy (single EC2 host)

A self-contained demo of the Weekly Commit Module on **one EC2 `t3.small`**: Postgres + the Spring
backend + an nginx-served federated frontend, all via `docker compose`, reachable on `:80` through an
Elastic IP. Chosen for a cheap (~$15/mo, free-tier eligible), fast, fully-reversible demo.

> **Currently live:** **http://ec2-44-218-6-116.compute-1.amazonaws.com/** — pick a persona with
> `?member=<slug>` (e.g. `?member=priya` = manager, `?member=diego` = IC), or use the in-app switcher
> pill. Run `bash deploy/teardown-ec2.sh` to stop the instance and the charge.

## What runs

| Container | Image | Role |
|---|---|---|
| `wcm-postgres` | `postgres:16.4` | DB (named volume; Flyway-migrated, demo-seeded on first boot) |
| `wcm-backend` | `wcm-backend:latest` | Spring Boot API, profiles **`demo,e2e,graph`** (seeded + `X-Debug-Member` header auth + real MS Graph adapter) |
| `wcm-frontend` | `wcm-frontend:latest` | nginx: host-shell at `/`, federated remote at `/remote/`, `/api` → backend |
| `wcm-caddy` | `caddy:2` | TLS edge on `:80`/`:443` — auto-cert HTTPS at `https://44-218-6-116.sslip.io/`; plain HTTP by IP still proxied |

**Auth posture (demo):** the public URL runs the **hermetic** profile — the same `X-Debug-Member`
persona seam the local demo uses (CB-2 login bypass + switcher pill), so there is **no Auth0
round-trip** to configure for a throwaway host. **MS Graph is LIVE here**: Microsoft requires an
HTTPS redirect URI off localhost, which is why the Caddy edge + sslip.io hostname exist — the
registered redirect is `https://44-218-6-116.sslip.io/api/graph/callback`, and the backend gets
`AZURE_*` + `APP_BASE_URL` from the on-instance `.env` (copied from gitignored `deploy/.env` by
`ship-to-ec2.sh`). Each persona still needs a one-time Outlook consent click (a real Microsoft
sign-in) before calendar features go live for them; until then those endpoints report
`connected:false`.

## Build the images
```bash
docker build -f deploy/Dockerfile.backend  -t wcm-backend:latest  .
docker build -f deploy/Dockerfile.frontend -t wcm-frontend:latest .
```
The frontend image builds both Vite bundles in `VITE_E2E=true` mode: the remote with `--base=/remote/`
and the host with `VITE_REMOTE_ENTRY=/remote/remoteEntry.js`, `VITE_API_BASE=/api`.

## Smoke locally first
```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d
# → http://localhost/  (try /?member=priya to act as the manager persona)
```

## Provision + deploy to EC2
Needs AWS creds in `~/gauntlet/.env` (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
`AWS_DEFAULT_REGION`). The scripts never echo secrets and keep them out of `.git`.
```bash
bash deploy/provision-ec2.sh    # key pair + SG(22,80) + t3.small + Elastic IP -> deploy/.ec2-state
bash deploy/ship-to-ec2.sh      # docker save | ssh docker load + compose up; waits for public health
# → http://<EIP>/   (printed at the end; act as a persona via /?member=<slug>)
```
`ship-to-ec2.sh` streams the images over SSH (no registry/ECR needed) and is re-runnable to redeploy.

## Tear down (stop the charges)
```bash
bash deploy/teardown-ec2.sh         # terminate instance + release EIP + delete SG
bash deploy/teardown-ec2.sh --all   # also delete the key pair + local .pem
```

## Files
- `Dockerfile.backend` / `Dockerfile.frontend` — two-stage build + runtime images
- `nginx.conf` — host `/`, remote `/remote/`, `/api` → backend proxy
- `docker-compose.prod.yml` — local stack (builds images) · `docker-compose.ec2.yml` — on-instance (image-only)
- `provision-ec2.sh` · `ship-to-ec2.sh` · `teardown-ec2.sh` — lifecycle
- `.env` (gitignored) — `GRAPH_TOKEN_ENC_KEY` · `.ec2-state` (gitignored) — provisioned resource IDs
