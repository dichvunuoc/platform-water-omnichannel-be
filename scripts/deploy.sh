#!/bin/bash
set -e

ENV=$1

if [ -z "$ENV" ]; then
  echo "Usage: $0 [dev|staging|prod]"
  exit 1
fi

echo "Deploying to $ENV environment..."

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo "kubectl could not be found"
    exit 1
fi

# Apply manifest THẬT (deploy/k8s/omnichannel-k8s.yaml — self-contained, platform-core infra, port 4001).
# k8s/base + k8s/overlays là template NestJS gốc (tên nestjs-app, port 3000, network-policy default-deny-all
# bị lỗi) → KHÔNG dùng cho omnichannel thật.
# Qua SSH k3s (không cần VPN):  cat deploy/k8s/omnichannel-k8s.yaml | ssh water-dev 'kubectl apply -f -'
kubectl apply -f deploy/k8s/omnichannel-k8s.yaml

echo "Deployment to $ENV initiated."
