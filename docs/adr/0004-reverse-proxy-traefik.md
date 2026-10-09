# ADR-0004 — Reverse proxy

- **Statut** : Accepté
- **Date** : 2026-10-05

## Contexte

L'architecture doit exposer les applications via un point d'entrée HTTP commun et pouvoir router les requêtes vers les différents services. La configuration doit rester compatible avec un déploiement conteneurisé et être simple à faire évoluer.

## Décision

Nous retenons **Traefik** comme reverse proxy.

Traefik s'intègre naturellement avec les environnements conteneurisés et permet de définir le routage à partir des services exposés. Il centralise notamment les préoccupations de point d'entrée HTTP et de TLS.

## Alternatives écartées

- **Nginx** : écarté car il nécessite davantage de configuration statique ou de mécanismes complémentaires pour découvrir et configurer dynamiquement les services dans un environnement conteneurisé.
- **Exposition directe des services** : écartée afin de conserver un point d'entrée unique et de ne pas exposer directement les services applicatifs.

## Conséquences

### Positives

- Routage centralisé.
- Bonne intégration avec les déploiements conteneurisés.
- Configuration dynamique adaptée à l'évolution du nombre de services.
- Point d'entrée unique pour le trafic HTTP/HTTPS.

### Négatives

- Ajout d'un composant d'infrastructure à administrer.
- Il faut maîtriser la configuration et le diagnostic de Traefik.
- Le comportement dynamique peut être moins familier qu'une configuration Nginx traditionnelle.
