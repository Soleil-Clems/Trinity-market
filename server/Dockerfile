# syntax=docker/dockerfile:1.7
# Chemin : server/Dockerfile
ARG NODE_IMAGE=node:24.19.0-alpine3.24

# ---------- Stage 1 : deps ----------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# ---------- Stage 2 : build ----------
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma (détecté automatiquement) : le client est généré avec la CLI du projet.
# --no-install : jamais de version téléchargée à la volée (cf. prisma@8 rc).
# DATABASE_URL factice : certaines versions l'exigent pour lire la config ; rien n'est contacté.
RUN if [ -f prisma/schema.prisma ] || ls prisma.config.* >/dev/null 2>&1; then \
      DATABASE_URL="postgresql://build:build@localhost:5432/build" \
      npx --no-install prisma generate; \
    fi
RUN npm run build \
 && npm prune --omit=dev \
 && npm cache clean --force
# Fichiers requis par les migrations au runtime (dossier vide si pas de Prisma)
RUN mkdir -p /migrate-assets \
 && for f in prisma prisma.config.ts prisma.config.js prisma.config.mjs; do \
      [ -e "$f" ] && cp -r "$f" /migrate-assets/ || true; \
    done

# ---------- Stage 3 : runtime ----------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

# Correctifs OS + suppression des gestionnaires de paquets (poids, CVE, surface)
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

COPY --chmod=0755 docker/entrypoint.sh /usr/local/bin/app-entrypoint.sh
COPY --chmod=0755 docker/migrate.sh    /usr/local/bin/app-migrate
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /migrate-assets/ ./

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

ENTRYPOINT ["/usr/local/bin/app-entrypoint.sh"]
CMD ["node", "dist/main.js"]