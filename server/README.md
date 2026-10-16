# Time Manager — backend

API REST de l'application de pointage, en NestJS 12 et TypeScript. Toutes les routes sont préfixées par `/api`.

## Lancer

```bash
cp .env.example .env
npm install
npm run start:dev
```

L'API écoute sur http://localhost:3000. Avec Docker, `make up` depuis la racine lance toute la stack avec rechargement à chaud et expose l'API sur http://localhost:8080/api.

## Variables d'environnement

Elles sont validées au démarrage par `src/config/env.ts`. Si une variable manque ou est invalide, l'application s'arrête avec un message qui la nomme.

| Variable | Obligatoire | Défaut | Rôle |
| --- | --- | --- | --- |
| `NODE_ENV` | Non | `development` | `development`, `test` ou `production` ; fixe le niveau de log |
| `PORT` | Non | `3000` | Port d'écoute |
| `CORS_ORIGIN` | Oui | — | Origines autorisées, séparées par des virgules |
| `DATABASE_URL` | Oui | — | URL de connexion PostgreSQL |
| `JWT_SECRET` | Oui | — | Secret de signature des access tokens, 32 caractères minimum |
| `APP_URL` | Oui | — | Adresse publique du front, utilisée pour les liens envoyés par mail |
| `SMTP_HOST` | Oui | — | Serveur SMTP (`mailpit` en dev) |
| `SMTP_PORT` | Oui | — | Port SMTP (`1025` pour Mailpit) |
| `MAIL_FROM` | Oui | — | Expéditeur des mails |

## Structure

```
src/
  main.ts       démarrage : préfixe /api, CORS, logger
  app.module.ts assemblage des modules, filtre d'erreurs et validation globaux
  config/       schéma et validation des variables d'environnement
  common/       code partagé : filtre d'erreurs, validation zod, logger
  prisma/       PrismaService, la connexion à la base
  auth/         login, refresh, logout, mots de passe, anti brute-force, guard global
  mail/         envoi des mails en SMTP (nodemailer)
  health/       GET /api/health, avec l'état de la base
  generated/    client Prisma généré, hors git
prisma/         schéma, migrations et seed de démo
test/           tests e2e ; test/integration/ pour les tests sur une vraie base
```

Les modules métier (`auth`, `users`, `teams`, `clocks`, `reports`) s'ajoutent à côté de `health/`, un dossier par module.

## Base de données

Le schéma est dans `prisma/schema.prisma` et les migrations dans `prisma/migrations/`. Le client Prisma est généré dans `src/generated/`, qui n'est pas versionné : lancer `npx prisma generate` après un clone ou un changement de schéma.

Avec Docker, tout se fait depuis la racine du repo :

| Commande | Rôle |
| --- | --- |
| `make up` | Applique les migrations en attente, puis démarre l'API |
| `make seed` | Vide la base et charge le jeu de démo |
| `make migration name=ajout_x` | Crée une migration après une modification du schéma |

La base n'est pas exposée sur la machine hôte : les commandes Prisma qui la contactent passent par le conteneur `backend`.

Trois règles sont écrites en SQL dans la migration, parce que Prisma ne sait pas les exprimer : une seule session ouverte par employé (index unique partiel), un départ postérieur à l'arrivée, et une fin d'absence qui ne précède pas son début.

## Comptes de démo

`make seed` crée 18 comptes, 3 équipes et 4 semaines de pointages qui se terminent la veille du jour où il est lancé. Tous les comptes ont le mot de passe `Testtest1#`. Il fait moins de 12 caractères : le seed écrit le hash directement et n'est pas soumis à la politique des mots de passe, qui ne s'applique qu'aux mots de passe choisis par l'API.

| Rôle | Email | À montrer |
| --- | --- | --- |
| Admin (RH) | `marc.dubois@trinitymarket.example` | Vue de toute l'entreprise |
| Manager | `sophie.martin@trinitymarket.example` | Équipe Service client, créneaux tournants |
| Manager | `nadia.benali@trinitymarket.example` | Équipes Entrepôt et Comptabilité |
| Employée | `camille.laurent@trinitymarket.example` | Un départ oublié corrigé par sa manager |
| Employé | `karim.haddad@trinitymarket.example` | Heures sup, journée de plus de 10 h, repos de moins de 11 h |
| Employé | `lucas.petit@trinitymarket.example` | Retards fréquents |
| Employé | `hugo.fournier@trinitymarket.example` | Session restée ouverte |
| Employé | `thomas.garnier@trinitymarket.example` | Journées sans pause |

Le seed refuse de tourner si `NODE_ENV` vaut `production`.

## Authentification

| Route | Rôle |
| --- | --- |
| `POST /api/auth/login` | Vérifie l'email et le mot de passe, renvoie un access token et pose le cookie de refresh |
| `POST /api/auth/refresh` | Renvoie un nouvel access token et remplace le refresh token |
| `POST /api/auth/logout` | Révoque la session et supprime le cookie |
| `POST /api/auth/forgot-password` | Envoie un lien de réinitialisation par mail, toujours 202 |
| `POST /api/auth/reset-password` | Définit le mot de passe à partir d'un lien de réinitialisation ou d'activation |
| `PATCH /api/me/password` | Change le mot de passe de l'utilisateur connecté, ancien mot de passe requis |

- **Access token** : JWT signé en HS256, valable 15 minutes, à envoyer dans l'en-tête `Authorization: Bearer <token>`. Il contient l'identifiant, le rôle et l'identifiant de session (`sid`).
- **Refresh token** : valeur aléatoire valable 7 jours, envoyée dans le cookie `refresh_token` (`httpOnly`, `SameSite=Strict`, path `/api/auth`, `Secure` en production). Seul son hash SHA-256 est stocké en base.
- **Rotation** : chaque appel à `refresh` révoque le token utilisé et en émet un nouveau. Un token présenté une seconde fois révoque toute la session.
- **Routes protégées par défaut** : `AuthGuard` est global. Une route ouverte se marque avec `@Public()`.
- **Anti-énumération** : email inconnu, mot de passe faux, compte supprimé et compte sans mot de passe renvoient le même 401, après un temps de calcul équivalent.

### Mots de passe

- **Politique** : 12 à 128 caractères, et refus des mots de passe courants. La liste `src/auth/common-passwords.txt` reprend les entrées de 12 caractères ou plus des 100 000 mots de passe les plus utilisés publiés par le NCSC britannique (dépôt SecLists, licence MIT). La comparaison ignore la casse.
- **Liens par mail** : jeton aléatoire de 32 octets, dont seul le hash SHA-256 est stocké dans `password_reset_tokens`. Il sert une seule fois. Le lien de réinitialisation vaut 30 minutes et le lien d'activation 72 heures. Demander un nouveau lien invalide le précédent.
- **Activation** : `PasswordManagementService.sendActivation(userId)` envoie le lien `APP_URL/activate?token=…` à un compte créé sans mot de passe. La création des comptes par un manager (B-07) l'appellera.
- **Réinitialisation** : `forgot-password` répond tout de suite et pareil que l'email existe ou non. La recherche du compte et l'envoi du mail se font après la réponse, pour que le temps de réponse ne trahisse pas l'existence du compte. Un mot de passe redéfini révoque toutes les sessions du compte.
- **Changement** : `PATCH /api/me/password` révoque les autres sessions et garde la session courante, retrouvée grâce au `sid` de l'access token. Les access tokens déjà émis restent valables jusqu'à leur expiration, 15 minutes au plus.

### Anti brute-force

Les échecs sont comptés dans la table `auth_attempts`, sous une clé hachée : ni l'IP ni l'email n'y sont stockés en clair. Au-delà de 5 tentatives en 15 minutes, la route renvoie 429 jusqu'à ce que la plus ancienne sorte de la fenêtre.

| Route | Ce qui est compté | Clé |
| --- | --- | --- |
| `POST /api/auth/login` | Échecs, remis à zéro par une connexion réussie | IP + email |
| `POST /api/auth/forgot-password` | Toutes les demandes | IP + email |
| `PATCH /api/me/password` | Mots de passe actuels erronés | Utilisateur |

Le compteur est en base plutôt qu'en mémoire : il survit aux redémarrages et reste juste si plusieurs instances du backend tournent. `reset-password` n'est pas limité : le jeton fait 256 bits, il ne se devine pas.

### Rôles et propriété

Trois rôles : `EMPLOYEE` voit ses propres données, `MANAGER` ses équipes et leurs membres, `ADMIN` toute l'entreprise. La matrice route × rôle est dans [`docs/permissions.md`](../docs/permissions.md).

| Outil | Rôle |
| --- | --- |
| `@Roles('MANAGER', 'ADMIN')` | Réserve la route aux rôles listés, sans hiérarchie implicite ; 403 sinon |
| `@CanAccessUser('id')` | L'utilisateur de `:id` doit être soi, un membre d'une équipe gérée, ou n'importe qui pour un admin ; 403 sinon |
| `@CanAccessTeam('id')` | L'équipe `:id` doit être gérée par le manager, ou n'importe laquelle pour un admin ; 403 sinon |
| `AccessPolicyService.visibleUsers()` / `visibleTeams()` | Filtre Prisma à appliquer aux routes de liste |

Les guards s'exécutent dans cet ordre : `AuthGuard` (401), `RolesGuard` puis `OwnershipGuard` (403). Le test `test/integration/permissions.int-spec.ts` échoue si une route existe sans ligne dans la matrice, ou si ses décorateurs ne correspondent pas à sa ligne.

Dans un contrôleur, l'utilisateur connecté se récupère avec `@CurrentUser() user: AuthenticatedUser`. Le type doit être importé avec `import type`, sinon la compilation échoue.

## Utilisateurs

| Route | Qui | Rôle |
| --- | --- | --- |
| `GET /api/users` | Manager, admin | Liste paginée (`page`, `pageSize` ≤ 100), recherche mot par mot dans prénom, nom et email (`search`), filtres `role` et `teamId` |
| `POST /api/users` | Manager, admin | Crée le compte, l'ajoute à ses équipes (`teamIds`) et envoie le lien d'activation |
| `GET /api/users/{id}` | Soi, manager de ses équipes, admin | Détail d'un compte |
| `PATCH /api/users/{id}` | Manager de ses équipes, admin | Prénom, nom, email, téléphone, heures contractuelles |
| `DELETE /api/users/{id}` | Manager de ses équipes, admin | Anonymise le compte |
| `GET /api/me`, `PATCH /api/me`, `DELETE /api/me` | Tout utilisateur connecté | Son propre compte ; `PATCH` ne modifie que prénom, nom et téléphone |
| `PATCH /api/me/password` | Tout utilisateur connecté | Change son mot de passe |

- **Création par un manager** : `teamIds` est obligatoire et ne contient que ses équipes, sinon 422 ou 403. Il ne crée que des `EMPLOYEE`. Le compte et ses appartenances sont créés dans la même requête, pour que le manager voie tout de suite la personne. Un admin choisit le rôle, et les équipes sont facultatives.
- **Statut** : `INVITED` tant que le lien d'activation n'a pas servi, `ACTIVE` ensuite.
- **Validation** : téléphone au format international (`+33612345678`, espaces et points acceptés puis retirés), contrat de 1 à 2880 minutes par semaine (48 h), fuseau horaire IANA. Un champ inconnu ou non modifiable renvoie 422.
- **Email déjà utilisé** : 409, sans tenir compte de la casse.
- **Suppression** : le compte est anonymisé (nom, email, téléphone, identifiant Microsoft et mot de passe effacés), ses sessions et liens en cours sont révoqués, et ses pointages sont conservés. Un compte qui gère encore des équipes renvoie 409 : il faut d'abord confier ses équipes à un autre manager.
- **Sortie** : `user.presenter.ts` construit la réponse champ par champ. Ni `passwordHash`, ni `microsoftId`, ni aucun token n'en sortent.

## Mails en développement

Mailpit intercepte les mails envoyés par le backend (`SMTP_HOST=mailpit`, `SMTP_PORT=1025`) et les affiche sur http://localhost:8025. Aucun mail ne sort réellement. Les tests d'intégration remplacent `MailService` par un faux qui garde les mails en mémoire.

## Documentation de l'API

Swagger UI est servi sur http://localhost:8080/api/docs, hors production uniquement. La spécification OpenAPI générée depuis le code est disponible sur `/api/docs/openapi.json` et `/api/docs/openapi.yaml`.

Les DTO créés avec `createZodDto` apparaissent automatiquement dans la spécification, à partir de leur schéma zod. Le reste se décrit sur les contrôleurs avec les décorateurs de `@nestjs/swagger` (`@ApiTags`, `@ApiOkResponse`…).

## Format d'erreur

Toute erreur passe par `AllExceptionsFilter` et renvoie la même forme :

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Cannot GET /api/unknown",
  "requestId": "88070184-f541-4cde-97bb-b7c277586056",
  "path": "/api/unknown",
  "timestamp": "2026-10-12T14:17:56.126Z"
}
```

Une entrée invalide renvoie un 422 avec un champ `details` qui liste chaque champ en erreur. Une erreur inattendue renvoie un 500 sans détail ; la cause est écrite dans les logs.

## Validation des entrées

Un DTO est une classe créée à partir d'un schéma zod. Le `ZodValidationPipe` global valide toute entrée typée par un tel DTO.

```ts
export class CreateTeamDto extends createZodDto(
  z.object({ name: z.string().min(1), description: z.string().optional() }),
) {}
```

## Logs

Les logs sortent en JSON sur la sortie standard (Pino). Chaque requête reçoit un identifiant, renvoyé dans l'en-tête `x-request-id` et repris dans le champ `requestId` des erreurs. Les en-têtes `authorization` et `cookie` sont masqués, et `/api/health` n'est pas journalisé.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run start:dev` | API en mode watch |
| `npm run build` | Compilation dans `dist/` |
| `npm test` | Tests unitaires (`*.spec.ts`) |
| `npm run test:e2e` | Tests e2e (`test/`) |
| `make test-int` (racine) | Tests d'intégration sur une base `app_test`, dans le conteneur `backend` |
| `npm run test:cov` | Couverture |
| `npm run lint` | oxlint |
| `npm run format` | Prettier |
