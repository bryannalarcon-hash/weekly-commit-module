#!/usr/bin/env bash
# deploy/ship-to-ec2.sh — push the locally-built images + the on-instance compose to the EC2 host
# provisioned by provision-ec2.sh, then bring the stack up. Streams the two images over SSH
# (docker save | gzip | ssh 'gunzip | docker load') so nothing large is staged on disk, copies the
# image-only compose + the GRAPH_TOKEN_ENC_KEY env, and runs `docker compose up -d`. Re-runnable:
# a repeat ship reloads images and recreates the stack. Reads deploy/.ec2-state for the host/key.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/.ec2-state"
SSH="ssh -i $WCM_EC2_PEM -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 ec2-user@$WCM_EC2_PUBLIC_IP"
SCP="scp -i $WCM_EC2_PEM -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

echo "[1/5] wait for SSH + docker on $WCM_EC2_PUBLIC_IP"
for i in $(seq 1 40); do
  if $SSH 'command -v docker >/dev/null && sudo docker info >/dev/null 2>&1' 2>/dev/null; then echo "  ready (~$((i*5))s)"; break; fi
  sleep 5
  [ "$i" = 40 ] && { echo "  TIMED OUT waiting for docker"; exit 1; }
done

echo "[2/5] stream images (wcm-backend + wcm-frontend) -> docker load on host"
docker save wcm-backend:latest wcm-frontend:latest | gzip | $SSH 'gunzip | sudo docker load'

echo "[3/5] copy compose + env"
$SCP "$HERE/docker-compose.ec2.yml" ec2-user@"$WCM_EC2_PUBLIC_IP":/home/ec2-user/docker-compose.yml
$SCP "$HERE/.env" ec2-user@"$WCM_EC2_PUBLIC_IP":/home/ec2-user/.env

echo "[4/5] compose up"
$SSH 'cd /home/ec2-user && sudo docker compose --env-file .env up -d'

echo "[5/5] wait for seed + public health"
for i in $(seq 1 40); do
  H=$(curl -s -o /dev/null -w '%{http_code}' "http://$WCM_EC2_PUBLIC_IP/" 2>/dev/null || echo 000)
  A=$(curl -s -o /dev/null -w '%{http_code}' -H 'X-Debug-Member: diego' "http://$WCM_EC2_PUBLIC_IP/api/commits/current" 2>/dev/null || echo 000)
  echo "  t=$((i*5))s  frontend=$H  api(diego)=$A"
  [ "$H" = 200 ] && [ "$A" = 200 ] && { echo "LIVE -> http://$WCM_EC2_PUBLIC_IP/"; break; }
  sleep 5
done
