# ADR-0002 — Base de données et ORM

- **Statut** : Accepté
- **Date** : 2026-10-05

## Contexte

L'application a besoin d'une base relationnelle robuste et d'un accès aux données typé depuis le backend TypeScript. Les migrations doivent être versionnées et reproductibles entre les environnements.

## Décision

Nous retenons **PostgreSQL + Prisma**.

PostgreSQL fournit un moteur relationnel mature et transactionnel. Prisma fournit un client TypeScript typé ainsi qu'un mécanisme de migration permettant de faire évoluer le schéma de manière versionnée.

## Alternatives écartées

- **MySQL + ORM** : écarté car PostgreSQL est mieux adapté aux besoins relationnels prévisibles du projet et reste largement supporté.
- **TypeORM** : écarté au profit de Prisma pour son expérience de développement TypeScript, son client généré et son typage du modèle de données.

## Conséquences

### Positives

- Base relationnelle mature et fiable.
- Migrations versionnées.
- Client Prisma fortement intégré à TypeScript.
- Réduction des erreurs liées aux accès aux données grâce au typage.

### Négatives

- Dépendance à Prisma et à son modèle de génération.
- Les requêtes SQL très spécifiques peuvent nécessiter de sortir du niveau d'abstraction Prisma.
- PostgreSQL ajoute un composant à exploiter par rapport à une base embarquée.
