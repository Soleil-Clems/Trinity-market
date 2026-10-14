# Intégration continue (GitHub Actions)

Le pipeline `.github/workflows/ci.yml` tourne sur chaque pull request et sur chaque push vers `main` et `develop`. Il construit et teste le backend et le frontend, applique les security gates, audite l'accessibilité, puis rend un verdict unique : le check **CI OK**, seul check à rendre obligatoire pour fusionner.

```
lint (backend, frontend) ──► build (backend, frontend, proxy) + Trivy
test-backend (PostgreSQL) ─┐
test-frontend ─────────────┴─► coverage-report (commentaire de PR)
secrets (gitleaks) · dependencies (npm audit, dependency review) · sast (CodeQL)
a11y (pa11y-ci + Lighthouse CI sur l'app lancée par Compose)
──────────────────────────────────────────────────────────────►  CI OK
```

Les jobs indépendants tournent en parallèle. Avec le cache npm (`actions/setup-node`, qui s'appuie sur `actions/cache`), le cache des couches Docker (`type=gha`) et les caches de la base Trivy et du navigateur Puppeteer, un run complet doit durer **entre 6 et 9 minutes**. Le premier run, sans cache, est plus long.

## Fichiers

| Fichier | Rôle |
|---|---|
| `.github/workflows/ci.yml` | pipeline principal |
| `.github/workflows/secrets-history.yml` | gitleaks sur tout l'historique (manuel + mensuel) |
| `.github/workflows/images.yml` | publication des images sur GHCR lors d'un tag `v*` |
| `.github/dependabot.yml` | mises à jour npm, Docker, Compose et Actions |
| `.github/scripts/*` | gates, annotations et résumés (aucune action tierce pour ces logiques) |
| `.gitleaks.toml` | règles gitleaks par défaut + exceptions documentées |
| `a11y/` | configuration pa11y-ci et Lighthouse CI, pages auditées (`pages.json`) |
| `docker-compose.ci.yml` | override Compose pour le job a11y (images déjà construites) |
| `scripts/ci-demo.sh` | démo keynote : ouvre une PR qui déclenche une gate |

## Mise en place (une fois)

**1. Protection des branches.** Dans *Settings → Rules → Rulesets*, créer une règle pour `main` et `develop` :
- *Require a pull request before merging* ;
- *Require status checks to pass* avec le check **`CI OK`** ;
- *Require branches to be up to date before merging*.

Exiger uniquement `CI OK` suffit : ce job dépend de tous les autres et échoue si l'un des contrôles bloquants échoue. Il ne peut jamais être « ignoré », ce qui compterait comme un succès.

**2. Permissions des workflows.** Dans *Settings → Actions → General*, choisir *Workflow permissions : Read repository contents*. Chaque job ne demande que ce dont il a besoin : `checks: write` pour les rapports JUnit, `pull-requests: write` pour le commentaire de couverture, `security-events: write` pour l'onglet Security.

**3. Sécurité du dépôt.** Dans *Settings → Code security*, activer *Dependency graph*, *Dependabot alerts* et *Dependabot security updates*. Sur un dépôt **privé**, l'onglet Security (SARIF) et `dependency-review-action` nécessitent GitHub Advanced Security. Si c'est le cas, définir la variable `GHAS_ENABLED=true`. Sans GHAS, les gates continuent de bloquer, mais les résultats restent dans les annotations et les artefacts.

**4. Variables** (*Settings → Secrets and variables → Actions → Variables*), toutes facultatives :

| Variable | Défaut | Rôle |
|---|---|---|
| `COVERAGE_MIN_BACKEND` | `70` | seuil bloquant de couverture des lignes du backend |
| `COVERAGE_MIN_FRONTEND` | `60` | seuil bloquant du frontend |
| `GHAS_ENABLED` | — | `true` sur un dépôt privé avec Advanced Security |
| `A11Y_SEED_COMMAND` | `node dist/database/seed.js` | création des comptes de test ; `none` pour désactiver |

**5. Scan initial de l'historique.** Lancer *Actions → Secrets — historique complet → Run workflow*. Tout secret trouvé doit être révoqué : le retirer de l'historique ne suffit pas.

**6. Contrat attendu des projets.** Le pipeline ne réécrit pas vos configurations, il s'appuie sur :
- une configuration ESLint dans `server/` et `client/` ;
- Jest ou Vitest. `jest-junit` (Jest) et `@vitest/coverage-v8` (Vitest) sont installés à la volée s'ils manquent, mais il vaut mieux les déclarer en devDependency ;
- `server/test/jest-e2e.json` pour les tests d'intégration (structure Nest par défaut) ; l'étape est sautée s'il n'existe pas ;
- `server/src/database/seed.ts`, à partir de `seed.ts.example`, pour les comptes de test de l'audit a11y ;
- `a11y/pages.json`, avec les vrais chemins et sélecteurs du formulaire de connexion ;
- pour les logs JSON : `npm install nestjs-pino@5 pino-http@11 pino@10` dans `server/`, puis `AppLoggerModule` et `main.ts` selon les exemples.

## Lire un run en échec

1. Ouvrir le résumé du run : le bloc **CI OK** liste les contrôles en échec, la cause probable et l'action attendue.
2. Ouvrir le job concerné : son résumé donne les chiffres (tests, couverture, vulnérabilités par sévérité) et les annotations ❌ pointent le fichier et la ligne.
3. Les détails complets se trouvent dans les artefacts du run.

### Politique des messages

| Niveau | Affichage | Effet | Exemples |
|---|---|---|---|
| Erreur | `::error::` ❌ | **bloque** la fusion | erreur ESLint, test en échec, couverture sous le seuil, secret, vulnérabilité HIGH/CRITICAL corrigeable, erreur WCAG, score Lighthouse < 90 |
| Avertissement | `::warning::` ⚠️ | ne bloque pas | avertissement ESLint, vulnérabilité MEDIUM/LOW ou sans correctif, vulnérabilité HIGH limitée aux devDependencies, image au-dessus de sa taille cible |
| Information | `::notice::` ℹ️ | ne bloque pas | couverture atteinte, outil installé à la volée, étape non applicable |

Les sorties verbeuses (`npm ci`, scans, Lighthouse, logs Docker) sont repliées dans des groupes (`::group::`) pour garder les logs lisibles.

## Tests et couverture

`test-backend` lance les tests unitaires avec couverture, puis les tests d'intégration contre un PostgreSQL de service, après les migrations. `test-frontend` lance les tests unitaires. Chaque job :
- publie un rapport JUnit dans l'onglet **Checks** (« Résultats des tests — … ») ;
- écrit un résumé (réussis, échoués, ignorés, couverture) ;
- échoue si la couverture des lignes est sous le seuil.

Le rapport de couverture (HTML, `lcov.info`, `coverage-summary.json`, Cobertura) est téléchargeable depuis les artefacts `coverage-backend` et `coverage-frontend` de chaque run.

Sur une PR, le job `coverage-report` publie un commentaire avec les pourcentages et leur variation par rapport à la dernière CI de la branche cible. Le commentaire est mis à jour, jamais dupliqué. La référence est enregistrée à chaque push sur `main` et `develop`.

## Security gates

| Contrôle | Outil | Périmètre | Bloquant | Avertissement |
|---|---|---|---|---|
| Secrets | gitleaks v8.30.1 | commits de la PR ou du push (historique complet : workflow dédié) | tout secret | — |
| Dépendances | `npm audit` | `server`, `client`, `a11y` | HIGH/CRITICAL en production | HIGH en dev uniquement, MEDIUM, LOW |
| Dépendances ajoutées | `dependency-review-action` | diff de la PR | HIGH/CRITICAL | score OpenSSF faible |
| Code (SAST) | CodeQL `security-extended` | back + front (JS/TS) | security-severity ≥ 7 | MEDIUM, LOW |
| Images | Trivy 0.72.0 | OS + librairies des 3 images | HIGH/CRITICAL avec correctif | sans correctif, MEDIUM, LOW |

gitleaks, CodeQL et Trivy publient leurs résultats au format SARIF dans l'onglet **Security → Code scanning**. Les secrets sont toujours masqués (`--redact`).

Les outils de scan (Trivy, gitleaks) sont lancés depuis des images Docker **épinglées** plutôt que via leurs GitHub Actions. En mars 2026, les tags de `aquasecurity/trivy-action` et `setup-trivy` ont été détournés pour voler des identifiants de CI. Pour les actions restantes, l'étape suivante recommandée est d'épingler chaque `uses:` sur un SHA de commit (par exemple avec l'outil `pinact`) ; Dependabot sait mettre ces SHA à jour.

## Accessibilité

Le job `a11y` construit les images à partir du cache, démarre l'application complète avec Compose, crée trois comptes de test (employé, manager, admin) dont les mots de passe sont générés à chaque run et masqués, puis :
- **pa11y-ci** (axe-core + HTML_CodeSniffer, WCAG 2.1 AA) audite chaque page de `a11y/pages.json` après connexion avec le rôle requis. Une seule erreur fait échouer le job.
- **Lighthouse CI** mesure le score d'accessibilité de chaque page. Le job échoue sous 90, ou en cas de bouton ou de lien sans nom, de champ sans label, d'image sans alternative ou de page sans langue ni titre.

Le rapport (HTML pa11y, rapports Lighthouse, captures d'écran) est dans l'artefact `a11y-report`. Le résumé du job donne un tableau par page.

Pour ajouter une page, ajoutez une entrée dans `a11y/pages.json` (`name`, `path`, `role`, et éventuellement `ready` : le sélecteur attendu avant l'audit, `main` par défaut).

## Logs et données personnelles

- **Secrets.** Les secrets GitHub sont masqués automatiquement. Les valeurs générées dans le pipeline (JWT de test, mots de passe des comptes a11y) sont masquées avec `::add-mask::` avant tout usage.
- **Vérification a posteriori.** Le job **CI OK** télécharge les logs de tous les jobs du run et les analyse : règles gitleaks, jetons JWT et adresses e-mail hors domaines de test (`*.test`, `example.com`…). La moindre trouvaille fait échouer le run. Seuls le job et la ligne sont indiqués, jamais la valeur.
- **Logs du backend.** Ils sortent en JSON structuré (pino), avec un identifiant de requête. Ils ne contiennent ni en-têtes, ni adresse IP, ni query string. Les champs personnels (`email`, `password`, `firstName`, `phone`…) sont remplacés par `[REDACTED]`, et les healthchecks ne sont pas journalisés.
- **Artefacts.** Ils sont conservés 14 jours (`retention-days`).

## Démo keynote

```bash
./scripts/ci-demo.sh secret   # gitleaks bloque
./scripts/ci-demo.sh vuln     # npm audit + dependency review bloquent (lodash 4.17.20, CVE-2021-23337)
./scripts/ci-demo.sh a11y     # pa11y bloque (bouton sans nom accessible)
./scripts/ci-demo.sh test     # un test échoue
```

Chaque commande ouvre une PR en brouillon sur `develop`. Montrez ensuite, dans l'ordre :
1. le check **CI OK** rouge et le bouton *Merge* bloqué ;
2. le résumé du run, qui explique l'échec en une ligne ;
3. l'annotation sur le fichier ;
4. l'onglet Security (pour `secret`).

Fermez ensuite avec la commande `gh pr close --delete-branch …` affichée. Le secret de démo est factice, mais il reste dans l'historique de la branche distante jusqu'à sa suppression : ne l'utilisez jamais avec une vraie clé.

## Recette

| Critère | Procédure | Attendu |
|---|---|---|
| Une PR déclenche lint + build | ouvrir une PR triviale | les jobs *Lint* et *Build* apparaissent dans l'onglet Checks |
| Un build cassé bloque le merge | PR introduisant une erreur TypeScript dans `server/src` | *Build (backend)* rouge, *CI OK* rouge, fusion impossible |
| Pipeline < 10 min | relancer une PR une 2ᵉ fois (cache chaud) | durée totale du run < 10 min dans l'onglet Actions |
| Annulation des runs obsolètes | pousser deux commits rapprochés sur une PR | le premier run passe à *Cancelled* |
| Un test qui échoue bloque | `./scripts/ci-demo.sh test` | *Tests backend* rouge, test listé dans le résumé et dans l'onglet Checks |
| Couverture téléchargeable | ouvrir un run | artefacts `coverage-backend` / `coverage-frontend` contenant `lcov-report/index.html` |
| % en commentaire de PR | ouvrir une PR | commentaire « 📊 Couverture de tests » avec variation (après une CI sur la branche cible) |
| Seuil de couverture | `COVERAGE_MIN_BACKEND=99` (variable) | *Tests backend* rouge : « couverture insuffisante » |
| Secret committé bloque | `./scripts/ci-demo.sh secret` | *Security — secrets* rouge, alerte dans l'onglet Security |
| Dépendance HIGH bloque | `./scripts/ci-demo.sh vuln` | *Security — dépendances* rouge (npm audit + dependency review) |
| Résultats SARIF | onglet Security → Code scanning | alertes CodeQL, Trivy et gitleaks filtrables par outil |
| MEDIUM/LOW non bloquants | lire le résumé d'un run vert | avertissements ⚠️ présents, *CI OK* vert |
| Compréhension en 30 s | faire lire un run rouge à une personne extérieure | elle cite le contrôle en échec et sa cause depuis le résumé *CI OK* |
| Aucun secret ni PII dans les logs | ajouter temporairement `echo test@gmail.com` dans une étape | *CI OK* rouge : « Donnée personnelle dans les logs », sans réafficher l'adresse |
| Rétention 14 jours | page d'un artefact | date d'expiration à J+14 |
| Bouton sans label bloque | `./scripts/ci-demo.sh a11y` | *Accessibilité* rouge, erreur `button-name` dans le résumé et le rapport |
| Rapport a11y par PR | ouvrir un run de PR | artefact `a11y-report` (HTML pa11y + Lighthouse) |
| Dependabot actif | *Insights → Dependency graph → Dependabot* | les 4 écosystèmes sont listés, des PR `chore(deps)` sont ouvertes chaque lundi |

## Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| *Lint* : « ESLint n'a produit aucun rapport » | pas de configuration ESLint ou configuration invalide | lancer `npx eslint .` en local dans le dossier concerné |
| *Tests* : « aucun framework » | ni Jest ni Vitest dans `package.json` | ajouter un framework de test et un premier test |
| *a11y* échoue au seed | `dist/database/seed.js` absent | créer `seed.ts` depuis l'exemple, ou `A11Y_SEED_COMMAND=none` en attendant |
| *a11y* : timeout sur `wait for path to not be /login/` | sélecteurs ou chemin de connexion différents | ajuster `login` dans `a11y/pages.json` |
| upload SARIF refusé | dépôt privé sans Advanced Security | ne pas définir `GHAS_ENABLED` ; les gates restent actives |
| pas de commentaire de couverture | PR depuis un fork (jeton en lecture seule) | le résumé du job reste disponible dans le run |
| *CI OK* rouge alors que tous les jobs sont verts | hygiène des logs | lire l'annotation : job et ligne où une valeur sensible est affichée |