#!/usr/bin/env bash
# Chemin : scripts/trivy-scan.sh
# Scan des images de prod : échec si une vulnérabilité HIGH/CRITICAL corrigeable existe.
# Usage : ./scripts/trivy-scan.sh [image ...]   (par défaut : les images locales de dev)
# Épingler TRIVY_IMAGE sur une version vérifiée (ex. aquasec/trivy:0.xx.y).
set -euo pipefail
TRIVY_IMAGE="${TRIVY_IMAGE:-aquasec/trivy:0.72.0}"
IMAGES=("$@")
[ ${#IMAGES[@]} -eq 0 ] && IMAGES=(app-backend:local app-frontend:local app-proxy:local)

status=0
for img in "${IMAGES[@]}"; do
  echo "=== $img ==="
  docker run --rm \
    -v /var/run/docker.sock:/var/run/docker.sock:ro \
    -v "$HOME/.cache/trivy:/root/.cache/" \
    -v "$PWD/.trivyignore:/.trivyignore:ro" \
    "$TRIVY_IMAGE" image \
      --severity HIGH,CRITICAL \
      --ignore-unfixed \
      --ignorefile /.trivyignore \
      --exit-code 1 \
      "$img" || status=1
done
exit $status