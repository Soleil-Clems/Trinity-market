# ADR-0005 — Stratégie d'authentification

- **Statut** : Accepté
- **Date** : 2026-10-05

## Contexte

L'application doit authentifier les utilisateurs tout en limitant l'exposition des informations d'authentification côté navigateur. La solution doit permettre de renouveler une session sans demander régulièrement à l'utilisateur de se reconnecter.

## Décision

Nous retenons une authentification **JWT avec refresh token stocké dans un cookie `httpOnly`**.

Le token d'accès JWT est utilisé pour authentifier les requêtes API pendant une durée courte. Le refresh token est conservé dans un cookie `httpOnly`, afin qu'il ne soit pas directement accessible au JavaScript exécuté dans le navigateur.

Les cookies d'authentification seront configurés avec des attributs de sécurité adaptés au contexte, notamment `Secure` en HTTPS et une politique `SameSite` appropriée. Le refresh token devra être renouvelable/révocable côté serveur selon les besoins de sécurité.

## Alternatives écartées

- **JWT de longue durée stocké dans `localStorage`** : écarté car une compromission XSS peut permettre à du JavaScript malveillant de lire directement le token.
- **Session serveur classique avec cookie de session** : écartée pour conserver une authentification adaptée à une API utilisant des tokens et faciliter la séparation entre le frontend et le backend.

## Conséquences

### Positives

- Le refresh token n'est pas directement lisible par le JavaScript du navigateur.
- Les access tokens peuvent avoir une durée de vie courte.
- La stratégie s'intègre bien avec une API NestJS.
- La rotation et la révocation des refresh tokens peuvent être gérées côté serveur.

### Négatives

- Il faut gérer correctement l'expiration, la rotation et la révocation des refresh tokens.
- L'utilisation de cookies implique de prendre en compte les risques CSRF et de configurer correctement `SameSite` et, si nécessaire, une protection CSRF complémentaire.
- La gestion de deux types de tokens augmente la complexité par rapport à une authentification par session simple.
