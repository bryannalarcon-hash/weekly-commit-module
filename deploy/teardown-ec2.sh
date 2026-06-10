#!/usr/bin/env bash
# deploy/teardown-ec2.sh — fully reverse provision-ec2.sh so the demo stops costing money: terminate
# the instance, release the Elastic IP, and delete the security group. Leaves the key pair by default
# (cheap, reusable); pass --all to also delete the key pair + local .pem. Reads deploy/.ec2-state.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ENVF="${WCM_AWS_ENV:-$HOME/gauntlet/.env}"
[ -f "$HERE/.ec2-state" ] || { echo "no deploy/.ec2-state — nothing to tear down"; exit 0; }
source "$HERE/.ec2-state"
gv(){ grep -E "^$1=" "$ENVF" | head -1 | cut -d= -f2- | tr -d '"'"'"'\r '; }
export AWS_ACCESS_KEY_ID="$(gv AWS_ACCESS_KEY_ID)"
export AWS_SECRET_ACCESS_KEY="$(gv AWS_SECRET_ACCESS_KEY)"
export AWS_DEFAULT_REGION="$(gv AWS_DEFAULT_REGION)"; : "${AWS_DEFAULT_REGION:=us-east-1}"

echo "[1/4] terminate instance $WCM_EC2_INSTANCE_ID"
aws ec2 terminate-instances --instance-ids "$WCM_EC2_INSTANCE_ID" >/dev/null
aws ec2 wait instance-terminated --instance-ids "$WCM_EC2_INSTANCE_ID"
echo "  terminated"

echo "[2/4] release Elastic IP $WCM_EC2_PUBLIC_IP"
aws ec2 release-address --allocation-id "$WCM_EC2_EIP_ALLOC" && echo "  released" || echo "  (already released)"

echo "[3/4] delete security group $WCM_EC2_SG"
for i in 1 2 3 4 5; do
  aws ec2 delete-security-group --group-id "$WCM_EC2_SG" 2>/dev/null && { echo "  deleted"; break; }
  echo "  retry $i (ENI detach lag)..."; sleep 10
done

echo "[4/4] state"
if [ "${1:-}" = "--all" ]; then
  aws ec2 delete-key-pair --key-name "$WCM_EC2_KEY" && echo "  key pair deleted"
  rm -f "$WCM_EC2_PEM" && echo "  local pem removed"
fi
rm -f "$HERE/.ec2-state"
echo "DONE — the demo is torn down (no further EC2/EIP charges)."
