#!/usr/bin/env bash
# deploy/provision-ec2.sh — stand up the single-host WCM demo on AWS EC2 (the footprint chosen in
# deploy/README.md): a t3.small running Docker, reachable on :80 via an Elastic IP, in the default
# VPC with a security group opening 22 (SSH) + 80 (HTTP). Idempotent-ish: reuses the key pair / SG /
# EIP by name/tag if they already exist. Creds come from ~/gauntlet/.env (never echoed). Writes the
# resulting IDs + public IP to deploy/.ec2-state (gitignored) for ship-to-ec2.sh to consume.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ENVF="${WCM_AWS_ENV:-$HOME/gauntlet/.env}"
NAME="${WCM_EC2_NAME:-wcm-demo}"
TYPE="${WCM_EC2_TYPE:-t3.small}"
KEY="${WCM_EC2_KEY:-wcm-deploy-key}"
PEM="$HERE/.${KEY}.pem"
STATE="$HERE/.ec2-state"

gv(){ grep -E "^$1=" "$ENVF" | head -1 | cut -d= -f2- | tr -d '"'"'"'\r '; }
export AWS_ACCESS_KEY_ID="$(gv AWS_ACCESS_KEY_ID)"
export AWS_SECRET_ACCESS_KEY="$(gv AWS_SECRET_ACCESS_KEY)"
export AWS_DEFAULT_REGION="$(gv AWS_DEFAULT_REGION)"; : "${AWS_DEFAULT_REGION:=us-east-1}"
q(){ aws "$@"; }

echo "[1/6] key pair: $KEY"
if ! q ec2 describe-key-pairs --key-names "$KEY" >/dev/null 2>&1; then
  q ec2 create-key-pair --key-name "$KEY" --query KeyMaterial --output text > "$PEM"
  chmod 600 "$PEM"; echo "  created -> $PEM"
else echo "  exists (assuming $PEM is on disk)"; fi

echo "[2/6] security group: ${NAME}-sg"
VPC=$(q ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(q ec2 describe-security-groups --filters Name=group-name,Values="${NAME}-sg" --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo None)
if [ "$SG" = "None" ] || [ -z "$SG" ]; then
  SG=$(q ec2 create-security-group --group-name "${NAME}-sg" --description "WCM demo: ssh+http" --vpc-id "$VPC" --query GroupId --output text)
  q ec2 authorize-security-group-ingress --group-id "$SG" --ip-permissions \
     IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges='[{CidrIp=0.0.0.0/0}]' \
     IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges='[{CidrIp=0.0.0.0/0}]' >/dev/null
  echo "  created $SG (22+80 open)"
else echo "  exists: $SG"; fi

echo "[3/6] latest Amazon Linux 2023 AMI"
AMI=$(q ssm get-parameters --names /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
      --query 'Parameters[0].Value' --output text)
echo "  $AMI"

echo "[4/6] launch $TYPE (docker via user-data)"
USERDATA=$(base64 -w0 <<'UD'
#!/bin/bash
dnf update -y
dnf install -y docker
systemctl enable --now docker
usermod -aG docker ec2-user
DCV=v2.29.7
curl -SL "https://github.com/docker/compose/releases/download/${DCV}/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
mkdir -p /usr/local/lib/docker/cli-plugins
ln -sf /usr/local/bin/docker-compose /usr/local/lib/docker/cli-plugins/docker-compose
UD
)
IID=$(q ec2 run-instances --image-id "$AMI" --instance-type "$TYPE" --key-name "$KEY" \
   --security-group-ids "$SG" --user-data "$USERDATA" \
   --block-device-mappings 'DeviceName=/dev/xvda,Ebs={VolumeSize=20,VolumeType=gp3}' \
   --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$NAME}]" \
   --query 'Instances[0].InstanceId' --output text)
echo "  instance: $IID — waiting for running..."
q ec2 wait instance-running --instance-ids "$IID"

echo "[5/6] elastic IP"
EIP_ALLOC=$(q ec2 allocate-address --domain vpc --query AllocationId --output text)
q ec2 associate-address --instance-id "$IID" --allocation-id "$EIP_ALLOC" >/dev/null
PUBIP=$(q ec2 describe-addresses --allocation-ids "$EIP_ALLOC" --query 'Addresses[0].PublicIp' --output text)
echo "  $PUBIP"

echo "[6/6] persist state -> $STATE"
cat > "$STATE" <<EOF
WCM_EC2_INSTANCE_ID=$IID
WCM_EC2_SG=$SG
WCM_EC2_EIP_ALLOC=$EIP_ALLOC
WCM_EC2_PUBLIC_IP=$PUBIP
WCM_EC2_KEY=$KEY
WCM_EC2_PEM=$PEM
WCM_EC2_AMI=$AMI
EOF
cat "$STATE"
echo "DONE. SSH will be ready once user-data installs docker (~60-90s)."
