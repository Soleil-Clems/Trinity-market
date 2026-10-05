# ADR-0001 — Langage et framework backend

- **Statut** : Accepté
- **Date** : 2026-10-05

## Contexte

Le backend doit fournir une API structurée, maintenable et testable. Le projet est développé en TypeScript et doit permettre de structurer clairement les responsabilités applicatives, l'injection de dépendances et les tests.

## Décision

Nous retenons **NestJS + TypeScript** pour le backend.

NestJS fournit une architecture modulaire basée sur des modules, contrôleurs et services, avec une injection de dépendances native. TypeScript apporte le typage statique partagé avec le reste de la stack.

## Alternatives écartées

- **Express.js + TypeScript** : écarté car plus minimal et moins prescriptif ; il nécessite davantage de décisions et de conventions à définir et maintenir au niveau du projet.
- **Fastify sans framework structurant** : écarté car la structuration applicative et les conventions seraient davantage à construire.

## Conséquences

### Positives

- Architecture backend homogène et modulaire.
- Typage statique et outillage TypeScript.
- Injection de dépendances facilitant les tests.
- Intégration naturelle avec Jest.

### Négatives

- Plus de conventions et d'abstractions qu'un framework minimaliste.
- Courbe d'apprentissage de NestJS pour les développeurs qui ne le connaissent pas.
