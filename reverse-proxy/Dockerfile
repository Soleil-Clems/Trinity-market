# syntax=docker/dockerfile:1.7
# Chemin : reverse-proxy/Dockerfile
ARG TRAEFIK_IMAGE=traefik:v3.7.14

FROM ${TRAEFIK_IMAGE}

# Correctifs OS (scan Trivy) + utilisateur non-root + dossier ACME
RUN apk upgrade --no-cache \
 && addgroup -S -g 65532 traefik \
 && adduser  -S -D -H -u 65532 -G traefik traefik \
 && mkdir -p /data \
 && chown traefik:traefik /data \
 && chmod 700 /data

# Configuration dynamique (routeurs, middlewares, TLS) : identique dev/prod.
# La config statique (entrypoints, ACME…) est passée en flags par Compose.
COPY dynamic/ /etc/traefik/dynamic/

# Ports internes > 1024 : pas besoin de root ni de NET_BIND_SERVICE
USER 65532:65532
EXPOSE 8080 8443