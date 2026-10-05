# ADR-0003 — Client web

- **Statut** : Accepté
- **Date** : 2026-10-05

## Contexte

Le projet nécessite une interface web accessible, maintenable et cohérente avec l'écosystème TypeScript. La stack doit intégrer des composants UI réutilisables et permettre d'industrialiser les contrôles d'accessibilité.

## Décision

Nous retenons **Next.js + React + TypeScript**, avec **Tailwind CSS**, **shadcn/ui** et une démarche **a11y intégrée au développement et à la CI**.

Next.js fournit le framework applicatif React et une structure de projet complète. TypeScript assure le typage. Tailwind CSS standardise la construction des interfaces et shadcn/ui fournit des composants accessibles et personnalisables.

## Alternatives écartées

- **React + Vite** : écarté car Next.js est la solution retenue pour le projet et fournit un cadre applicatif plus complet, notamment pour le routage, le rendu et les conventions de production.
- **Bibliothèque UI complète imposant son runtime et son thème** : écartée au profit de shadcn/ui + Tailwind afin de conserver davantage de contrôle sur le markup, les styles et l'accessibilité.

## Conséquences

### Positives

- Stack React/TypeScript cohérente avec le backend TypeScript.
- Framework applicatif complet.
- Composants UI réutilisables et personnalisables.
- Accessibilité intégrée au cycle de développement et à la CI.

### Négatives

- Next.js ajoute des conventions et des mécanismes à maîtriser.
- Tailwind et shadcn/ui demandent une discipline de conception pour conserver une UI cohérente.
- Les tests automatisés d'accessibilité ne remplacent pas les tests manuels.
