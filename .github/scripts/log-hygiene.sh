#!/usr/bin/env bash
# Chemin : .github/scripts/log-hygiene.sh
# Vérifie a posteriori les logs des jobs terminés du run : aucun secret, aucun JWT,
# aucune adresse e-mail réelle (donnée personnelle). Les valeurs trouvées ne sont
# JAMAIS réaffichées : seuls le job et la ligne sont indiqués.
set -euo pipefail
: "${GH_TOKEN:?}" "${GITLEAKS_IMAGE:?}"
D="$RUNNER_TEMP/run-logs"; R="$RUNNER_TEMP/hygiene"; mkdir -p "$D" "$R"

gh api "repos/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID/attempts/${GITHUB_RUN_ATTEMPT:-1}/jobs?per_page=100" \
  --jq '.jobs[] | select(.status == "completed") | "\(.id)\t\(.name)"' > "$R/jobs.tsv"
while IFS=$'\t' read -r id name; do
  safe=$(printf '%s' "$name" | tr -c 'A-Za-z0-9._-' '_')
  gh api "repos/$GITHUB_REPOSITORY/actions/jobs/$id/logs" > "$D/$safe.log" 2>/dev/null \
    || echo "::warning title=Hygiène des logs::Logs indisponibles pour « $name »."
done < "$R/jobs.tsv"
NJOBS=$(find "$D" -name '*.log' | wc -l | tr -d ' ')

FAIL=0
# 1) Secrets (règles gitleaks) — valeurs masquées
set +e
docker run --rm -u "$(id -u):$(id -g)" -v "$D:/logs:ro" -v "$R:/out" "$GITLEAKS_IMAGE" \
  dir /logs --redact --no-banner --exit-code 2 --report-format json --report-path /out/secrets.json >/dev/null 2>&1
set -e
NS=$( [ -f "$R/secrets.json" ] && jq 'length' "$R/secrets.json" || echo 0 )
if [ "$NS" -gt 0 ]; then
  FAIL=1
  jq -r '.[] | "\(.File | split("/") | last)\t\(.StartLine)\t\(.RuleID)"' "$R/secrets.json" | head -20 |
  while IFS=$'\t' read -r f l rule; do echo "::error title=Secret dans les logs (${rule})::Job ${f%.log}, ligne ${l} — ajouter ::add-mask:: ou ne pas afficher cette variable."; done
fi

# 2) JWT
NJ=$(grep -rcE 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}' "$D" | awk -F: '{s+=$2} END {print s+0}')
[ "$NJ" -gt 0 ] && { FAIL=1; echo "::error title=JWT dans les logs::${NJ} jeton(s) JWT affiché(s) en clair."; }

# 3) Données personnelles : adresses e-mail hors domaines de test
ALLOW='@(example\.(com|org|net)|[A-Za-z0-9.-]+\.(test|example|invalid|localhost)|localhost|users\.noreply\.github\.com|github\.com)$'
grep -rnoE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' "$D" 2>/dev/null \
  | while IFS=: read -r f l mail; do
      printf '%s' "$mail" | grep -qiE "$ALLOW" || printf '%s\t%s\n' "$(basename "$f" .log)" "$l"
    done > "$R/pii.tsv" || true
NP=$(wc -l < "$R/pii.tsv" | tr -d ' ')
if [ "$NP" -gt 0 ]; then
  FAIL=1
  head -10 "$R/pii.tsv" | while IFS=$'\t' read -r job line; do
    echo "::error title=Donnée personnelle dans les logs::Adresse e-mail dans le job ${job}, ligne ${line} (valeur non réaffichée)."
  done
fi

[ -n "${GITHUB_STEP_SUMMARY:-}" ] && printf '### 🧹 Hygiène des logs\n\n| Jobs analysés | Secrets | JWT | E-mails (hors domaines de test) |\n|---:|---:|---:|---:|\n| %s | %s | %s | %s |\n\n' \
  "$NJOBS" "$NS" "$NJ" "$NP" >> "$GITHUB_STEP_SUMMARY"
exit $FAIL