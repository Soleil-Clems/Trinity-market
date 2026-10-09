#!/usr/bin/env bash
# Chemin : scripts/gen-secrets.sh
# Génère les secrets de prod s'ils n'existent pas (idempotent, ne réécrit jamais).
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
mkdir -p secrets
chmod 700 secrets      # protège les secrets des autres utilisateurs de l'hôte

gen() {
  local file="secrets/$1"
  if [ -s "$file" ]; then echo "• $file existe déjà (conservé)"; return; fi
  printf '%s' "$2" > "$file"
  # lisible dans les conteneurs (uid postgres / node) ; le dossier reste en 700
  chmod 444 "$file"
  echo "✔ $file créé"
}

# hex = URL-safe (utilisé dans DATABASE_URL)
gen db_password.txt "$(openssl rand -hex 32)"
gen jwt_secret.txt  "$(openssl rand -base64 48 | tr -d '\n')"

echo
echo "⚠  Le mot de passe DB n'est appliqué qu'à la création du volume db-data."
echo "   Sauvegarder ./secrets/ hors du serveur (gestionnaire de secrets)."