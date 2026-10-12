# Déploiement Docker — NestJS (`server/`) + Next.js (`client/`)

L'application tourne en quatre services : `database` (PostgreSQL), `backend` (NestJS), `frontend` (export statique Next.js servi par Nginx non-root) et `reverse-proxy` (Traefik). Traefik est le seul service qui publie un port. Il route `/api/*` vers le backend et tout le reste vers le frontend.

```
           :8080 (dev) / :443 (prod)
                     │
              ┌──────▼──────┐
              │   Traefik   │   en-têtes sécurité · compression · limites · TLS
              └──┬───────┬──┘
   front-net     │       │
       /api/*  ┌─▼──┐  ┌─▼───────┐  /*
               │back│  │frontend │
               └─┬──┘  └─────────┘
   back-net      │  (internal : pas d'Internet, pas de front)
               ┌─▼──────┐
               │postgres│  volume db-data
               └────────┘
```

## Démarrage rapide

**Dev** (depuis un clone propre, aucune configuration requise) :

```bash
docker compose --project-directory . -f .docker/docker-compose.yml up -d --build   # → http://localhost:8080
./scripts/verify.sh                 # vérifie les critères d'acceptation
```

**Prod** (sur le serveur, avec seulement `.docker/docker-compose.prod.yml`, `.env` et `secrets/`) :

```bash
cp .env.prod.example .env           # renseigner DOMAIN, ACME_EMAIL, REGISTRY, APP_VERSION
./scripts/gen-secrets.sh            # crée secrets/db_password.txt et secrets/jwt_secret.txt
docker compose --project-directory . -f .docker/docker-compose.prod.yml pull
docker compose --project-directory . -f .docker/docker-compose.prod.yml up -d
./scripts/check-headers.sh https://$DOMAIN
```

## Différences dev / prod

| Aspect | Dev — `.docker/docker-compose.yml` | Prod — `.docker/docker-compose.prod.yml` |
|---|---|---|
| Images | construites localement (`build:`) | tirées du registre, tag figé `APP_VERSION` (aucun build, aucun code monté) |
| Port public | `8080` en HTTP | `443` en HTTPS uniquement |
| TLS | aucun | Let's Encrypt (challenge TLS-ALPN-01), TLS ≥ 1.2 |
| HSTS | non (inutile en HTTP) | `max-age=63072000; includeSubDomains; preload` |
| Secrets | variables d'environnement avec valeurs par défaut de dev | Docker secrets (`/run/secrets/*`), variables `*_FILE`, aucune valeur par défaut |
| CORS | `http://localhost:8080` | `https://$DOMAIN` uniquement |
| Logs applicatifs | niveaux NestJS complets | `fatal/error/warn/log` (debug et verbose désactivés, pas de Swagger) |
| Logs Traefik | `INFO` | `WARN` + access log JSON |
| Migrations | automatiques, service one-shot `migrate` | identique |
| Limites CPU/RAM | aucune | `deploy.resources.limits` sur chaque service |
| Rotation des logs Docker | défaut du démon | `json-file`, 10 Mo × 5 fichiers compressés |
| Sauvegardes | non | `scripts/backup-db.sh` par cron, rotation, copie hors site |

Les deux environnements partagent les Dockerfiles, la configuration dynamique de Traefik (`reverse-proxy/dynamic/app.yml`), la séparation réseau `front-net` / `back-net` (internal), les utilisateurs non-root, le système de fichiers en lecture seule, `cap_drop: ALL` et `no-new-privileges`. Ce qui diffère entre les deux, ce sont les flags de configuration statique de Traefik passés dans `command:`. L'image du frontend est la même dans les deux cas, car l'API est appelée en relatif (`/api`).

## Reverse proxy (Traefik)

La configuration est découpée en deux. La configuration statique (entrypoints, ACME, ping) est passée en flags par Compose, ce qui permet l'interpolation de `${DOMAIN}`. La configuration dynamique (routeurs, middlewares, TLS) est embarquée dans l'image `proxy`. Traefik n'a donc pas besoin d'accéder au socket Docker, ce qui retire un vecteur classique d'élévation de privilèges.

Le routage applique trois règles :

- `/api` et `/api/*` vont au backend (priorité 100).
- Tout le reste va au frontend (priorité 1).
- Pour les routes inconnues, Nginx sert `index.html` en fallback SPA.

Les en-têtes de sécurité sont attachés à l'entrypoint, donc ils s'appliquent à toutes les réponses, y compris les erreurs :

- `Content-Security-Policy`
- `X-Content-Type-Options`
- `X-Frame-Options: DENY`
- `Referrer-Policy`
- `Permissions-Policy`
- `Cross-Origin-Opener-Policy`
- en prod, `Strict-Transport-Security`

Ces en-têtes suffisent pour obtenir la note A sur securityheaders.com. La CSP autorise `'unsafe-inline'` pour les scripts, car l'export statique de Next.js injecte des scripts inline sans pouvoir utiliser de nonce. C'est ce qui empêche d'atteindre A+. Pour aller plus loin, il faudrait un runtime Next.js avec middleware et nonces.

La compression est assurée par Traefik en zstd, brotli ou gzip selon le navigateur. Nginx ne compresse pas, sinon brotli ne pourrait pas être proposé. Le cache est réglé par Nginx :

- assets hashés `/_next/static/*` : `immutable`, 1 an ;
- autres ressources statiques : 7 jours ;
- pages HTML : `no-cache`.

Limites et timeouts :

- **Corps de requête :** 10 Mo maximum sur l'API, 1 Mo sur le front.
- **Débit de l'API :** 100 requêtes/s par IP, avec une rafale jusqu'à 200.
- **Côté client :** lecture 30 s, écriture 60 s, connexion inactive 180 s.
- **Vers les backends :** connexion 5 s, en-têtes de réponse 30 s.

## HTTPS

**Let's Encrypt (par défaut).** Le DNS de `DOMAIN` doit pointer vers le serveur et le port 443 doit être ouvert. Le challenge TLS-ALPN-01 passe par le port 443, donc le port 80 n'est pas nécessaire. Les certificats sont stockés dans le volume `traefik-acme` et renouvelés automatiquement. Pour vos essais, utilisez `ACME_CA_SERVER` avec l'URL de staging (indiquée dans `.env.prod.example`) afin de ne pas consommer le quota de production. Si vous voulez rediriger HTTP vers HTTPS, décommentez l'entrypoint `web` et le port `80` dans `.docker/docker-compose.prod.yml`.

**Certificat auto-signé (préproduction sans domaine public).** Lancez la stack avec `DOMAIN=localhost`. Le challenge ACME échoue et Traefik sert automatiquement son certificat auto-signé par défaut. Le navigateur affiche alors un avertissement, que vous acceptez manuellement. Pour utiliser un certificat d'entreprise, ajoutez dans `reverse-proxy/dynamic/` un fichier déclarant `tls.stores.default.defaultCertificate`. Le certificat et sa clé doivent être montés en Docker secrets, jamais copiés dans l'image.

## Secrets

Aucun secret n'est présent dans les images : `.dockerignore` exclut `.env*`, `*.pem` et `*.key`, et `scripts/verify.sh` le contrôle. En prod, aucun secret n'est non plus dans `.env` ni visible via `docker inspect`.

- `scripts/gen-secrets.sh` crée les fichiers de `secrets/` (dossier en `700`, fichiers en `444`). Le script ne réécrit jamais un fichier existant.
- Compose monte ces fichiers dans `/run/secrets/`.
- PostgreSQL lit nativement `POSTGRES_PASSWORD_FILE`.
- Le backend passe par `server/docker/entrypoint.sh`, qui transforme chaque `FOO_FILE` en variable `FOO` en mémoire puis construit `DATABASE_URL`.

Conservez une copie de `secrets/` dans un gestionnaire de secrets : sans elle, les sauvegardes restent restaurables, mais les sessions JWT seront invalidées.

## Migrations

À chaque `up`, le service `migrate` démarre avec l'image du backend, applique les migrations et se termine. Le backend ne démarre que si ce service s'est terminé avec succès (`service_completed_successfully`). Une migration en échec bloque donc le déploiement au lieu de lancer une application incohérente. Le script `app-migrate` détecte l'outil : `prisma migrate deploy` si un dossier `prisma/` existe (la CLI `prisma` doit alors être dans `dependencies`), sinon `typeorm migration:run`. `MIGRATION_COMMAND` permet de forcer une autre commande. Le même service existe en dev. Avec TypeORM, `synchronize` doit rester à `false` en prod.

## Sauvegardes de la base

Stratégie 3-2-1 : trois copies, sur deux supports, dont une hors site.

1. **Quotidien.** `scripts/backup-db.sh` lance un `pg_dump` au format custom compressé et vérifie l'archive avec `pg_restore --list`. Il calcule ensuite une somme SHA-256 et applique une rétention de `BACKUP_RETENTION_DAYS` jours (14 par défaut). Le cron est indiqué dans l'en-tête du script.
2. **Hors site.** La copie vers un stockage objet (S3, B2…) se fait avec la ligne `rclone`, à décommenter dans le script. Activez le chiffrement côté stockage.
3. **Restauration.** `scripts/restore-db.sh <fichier.dump>` vérifie la somme de contrôle, arrête le backend, restaure la base dans une seule transaction, puis relance la stack.
4. **Test.** Restaurez une sauvegarde au moins une fois par mois sur un environnement jetable. Une sauvegarde jamais restaurée n'est pas une sauvegarde.

Pour un RPO inférieur à 24 h, il faut ajouter l'archivage WAL en continu (pgBackRest ou WAL-G). Ce n'est pas couvert ici.

Ne lancez jamais `docker compose down -v` en prod : l'option `-v` supprime les volumes `db-data` et `traefik-acme`.

## Images et scan de sécurité

Le workflow `.github/workflows/images.yml` construit les trois images (`backend`, `frontend`, `proxy`) à chaque pull request et à chaque tag `v*`. Il les scanne avec Trivy, en mode bloquant sur les vulnérabilités HIGH et CRITICAL. Sur un tag, il pousse ensuite les images vers GHCR avec le tag correspondant. Pour lancer le scan en local : `./scripts/trivy-scan.sh`.

Plusieurs mesures limitent les vulnérabilités :

- versions de base épinglées : `node:24.19.0-alpine3.24`, `nginx-unprivileged:1.30.4-alpine`, `traefik:v3.7.11`, `postgres:17.11-alpine` ;
- `apk upgrade` au build ;
- npm, yarn et corepack supprimés de l'image du backend.

L'option `--ignore-unfixed` exclut les CVE qui n'ont pas encore de correctif. Toute autre exception doit être justifiée et datée dans `.trivyignore`. Pensez à épingler aussi la version de Trivy, dans `TRIVY_IMAGE`.

## Exploitation courante

```bash
# Mise à jour : changer APP_VERSION dans .env puis
docker compose --project-directory . -f .docker/docker-compose.prod.yml pull && docker compose --project-directory . -f .docker/docker-compose.prod.yml up -d

# Logs
docker compose --project-directory . -f .docker/docker-compose.prod.yml logs -f --tail=100 backend

# État et healthchecks
docker compose --project-directory . -f .docker/docker-compose.prod.yml ps
```