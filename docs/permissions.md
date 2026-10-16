# Matrice des permissions

Qui peut appeler quelle route de l'API. Elle sert de référence aux tickets backend et frontend, et le test
`server/test/integration/permissions.int-spec.ts` la vérifie : chaque route implémentée doit y figurer, et ses
décorateurs (`@Public`, `@Roles`, `@CanAccessUser`, `@CanAccessTeam`) doivent correspondre à sa ligne.

## Rôles

| Rôle | Périmètre |
| --- | --- |
| `EMPLOYEE` | Ses propres données |
| `MANAGER` | Ses propres données, les équipes qu'il gère et leurs membres |
| `ADMIN` | Toute l'entreprise, avec les mêmes actions qu'un manager (persona RH) |

Les rôles sont listés explicitement sur chaque route : `@Roles('MANAGER', 'ADMIN')` ne laisse passer que ces deux
rôles, il n'y a pas de hiérarchie implicite.

## Légende

| Valeur | Sens |
| --- | --- |
| Oui | Accès sans restriction |
| Non | Refusé : 401 sans authentification, 403 sinon |
| Soi | Seulement sur son propre compte |
| Ses équipes | Seulement sur les équipes qu'il gère et leurs membres, et sur son propre compte |

La colonne **Contrôle** dit comment la restriction est appliquée :

| Contrôle | Mécanisme |
| --- | --- |
| — | Aucun contrôle de propriété |
| utilisateur | `@CanAccessUser()` : l'`{id}` de la route doit être soi, un membre d'une équipe gérée, ou n'importe qui pour un admin |
| équipe | `@CanAccessTeam()` : l'`{id}` de la route doit être une équipe gérée, ou n'importe laquelle pour un admin |
| filtre | Route de liste : le service filtre les résultats avec `AccessPolicyService.visibleUsers()` ou `visibleTeams()` |
| session | La session doit appartenir à un utilisateur accessible ; à implémenter avec B-09 |

Une route refusée par le contrôle de propriété renvoie 403, même si la ressource n'existe pas : un manager ne
peut pas deviner quels identifiants existent hors de ses équipes.

## Routes

| Route | Ticket | Anonyme | Employé | Manager | Admin | Contrôle |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /api` | B-01 | Oui | Oui | Oui | Oui | — |
| `GET /api/health` | B-01 | Oui | Oui | Oui | Oui | — |
| `POST /api/auth/login` | B-03 | Oui | Oui | Oui | Oui | — |
| `POST /api/auth/refresh` | B-03 | Oui | Oui | Oui | Oui | — |
| `POST /api/auth/logout` | B-03 | Oui | Oui | Oui | Oui | — |
| `POST /api/auth/forgot-password` | B-04 | Oui | Oui | Oui | Oui | — |
| `POST /api/auth/reset-password` | B-04 | Oui | Oui | Oui | Oui | — |
| `PATCH /api/me/password` | B-04 | Non | Oui | Oui | Oui | — |
| `GET /api/me` | B-07 | Non | Oui | Oui | Oui | — |
| `PATCH /api/me` | B-07 | Non | Oui | Oui | Oui | — |
| `DELETE /api/me` | B-07 | Non | Oui | Oui | Oui | — |
| `GET /api/users` | B-07 | Non | Non | Ses équipes | Oui | filtre |
| `POST /api/users` | B-07 | Non | Non | Oui | Oui | — |
| `GET /api/users/{id}` | B-07 | Non | Soi | Ses équipes | Oui | utilisateur |
| `PATCH /api/users/{id}` | B-07 | Non | Non | Ses équipes | Oui | utilisateur |
| `DELETE /api/users/{id}` | B-07 | Non | Non | Ses équipes | Oui | utilisateur |
| `GET /api/teams` | B-08 | Non | Non | Ses équipes | Oui | filtre |
| `POST /api/teams` | B-08 | Non | Non | Oui | Oui | — |
| `GET /api/teams/{id}` | B-08 | Non | Non | Ses équipes | Oui | équipe |
| `PATCH /api/teams/{id}` | B-08 | Non | Non | Ses équipes | Oui | équipe |
| `DELETE /api/teams/{id}` | B-08 | Non | Non | Ses équipes | Oui | équipe |
| `POST /api/teams/{id}/members` | B-08 | Non | Non | Ses équipes | Oui | équipe |
| `DELETE /api/teams/{id}/members/{userId}` | B-08 | Non | Non | Ses équipes | Oui | équipe |
| `POST /api/me/clock` | B-09 | Non | Oui | Oui | Oui | — |
| `GET /api/me/clock` | B-09 | Non | Oui | Oui | Oui | — |
| `PATCH /api/sessions/{id}` | B-09 | Non | Non | Ses équipes | Oui | session |
| `GET /api/users/{id}/sessions` | B-09 | Non | Soi | Ses équipes | Oui | utilisateur |
| `GET /api/users/{id}/summary` | B-10 | Non | Soi | Ses équipes | Oui | utilisateur |
| `GET /api/teams/{id}/averages` | B-11 | Non | Non | Ses équipes | Oui | équipe |
| `GET /api/reports/kpis` | B-12 | Non | Non | Ses équipes | Oui | filtre |
| `GET /api/me/export` | B-13 | Non | Oui | Oui | Oui | — |

Les routes des tickets à venir sont la cible : le ticket qui les implémente peut proposer de changer leur ligne, et
le test l'obligera à garder la matrice à jour.
