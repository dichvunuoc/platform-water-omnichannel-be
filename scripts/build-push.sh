#!/usr/bin/env bash
# Build & push image lên registry nội bộ registry-dev.dichvunuoc.vn.
# ⚠️ water-dev KHÔNG có docker (chỉ containerd) → KHÔNG chạy script này trên water-dev.
# Chạy từ máy có docker: laptop (start Docker Desktop) hoặc GitHub runner (CI path).
# Cần quyền `docker login registry-dev.dichvunuoc.vn` (Basic auth creds từ admin).
#
# Usage:
#   ./scripts/build-push.sh              # tag = latest
#   ./scripts/build-push.sh <tag>        # tag tuỳ chọn (vd git sha)
set -euo pipefail

REGISTRY="registry-dev.dichvunuoc.vn"
IMAGE="${REGISTRY}/omnichannel-be"
TAG="${1:-latest}"

echo "→ docker login ${REGISTRY}  (cần creds từ admin)"
docker login "${REGISTRY}"

echo "→ build ${IMAGE}:${TAG}"
docker build -t "${IMAGE}:${TAG}" .

# Luôn tag thêm :latest để manifest imagePullPolicy: Always kéo đúng newest
if [ "${TAG}" != "latest" ]; then
  docker tag "${IMAGE}:${TAG}" "${IMAGE}:latest"
fi

echo "→ push ${IMAGE}:${TAG} (+ latest)"
docker push "${IMAGE}:${TAG}"
[ "${TAG}" != "latest" ] && docker push "${IMAGE}:latest"

echo "✓ Done. Trigger rollout:"
echo "    kubectl rollout restart deployment/omnichannel-be -n omnichannel-demo"
echo "  hoặc qua SSH:  ssh water-dev 'kubectl rollout restart deployment/omnichannel-be -n omnichannel-demo'"
