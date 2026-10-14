# syntax=docker/dockerfile:1.7
# Chemin : client/Dockerfile
ARG NODE_IMAGE=node:24.19.0-alpine3.24
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.30.4-alpine

# ---------- Stage 1 : deps ----------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# ---------- Stage 2 : build — next build (output: 'export') ----------
FROM deps AS build
COPY . .

# Publique (embarquée dans le JS) → jamais de secret. /api = même origine via Traefik,
# donc la MÊME image sert en dev et en prod.
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm run build

# ---------- Stage 3 : runtime — Nginx non-root ----------
FROM ${NGINX_IMAGE} AS runtime

# Correctifs de sécurité des paquets OS (scan Trivy)
USER root
RUN apk upgrade --no-cache

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/out /usr/share/nginx/html

USER 101
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1