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

## Structure

```
src/
  main.ts       démarrage : préfixe /api, CORS, logger
  app.module.ts assemblage des modules, filtre d'erreurs et validation globaux
  config/       schéma et validation des variables d'environnement
  common/       code partagé : filtre d'erreurs, validation zod, logger
  prisma/       PrismaService, la connexion à la base
  health/       GET /api/health, avec l'état de la base
  generated/    client Prisma généré, hors git
prisma/         schéma, migrations et seed de démo
test/           tests e2e
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

`make seed` crée 18 comptes, 3 équipes et 4 semaines de pointages qui se terminent la veille du jour où il est lancé. Tous les comptes ont le mot de passe `TimeManager-Demo-2026`.

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
| `npm run test:cov` | Couverture |
| `npm run lint` | oxlint |
| `npm run format` | Prettier |
