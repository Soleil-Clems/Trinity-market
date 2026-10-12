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

## Structure

```
src/
  main.ts       démarrage : préfixe /api, CORS, logger
  app.module.ts assemblage des modules, filtre d'erreurs et validation globaux
  config/       schéma et validation des variables d'environnement
  common/       code partagé : filtre d'erreurs, validation zod, logger
  health/       GET /api/health
test/           tests e2e
```

Les modules métier (`auth`, `users`, `teams`, `clocks`, `reports`) s'ajoutent à côté de `health/`, un dossier par module.

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
