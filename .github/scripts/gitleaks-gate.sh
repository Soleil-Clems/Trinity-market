#!/usr/bin/env bash
# Chemin : .github/scripts/gitleaks-gate.sh
# Détection de secrets dans les commits (PR : commits de la PR ; push : commits poussés ;
# GITLEAKS_FULL=1 : historique complet). Les secrets sont TOUJOURS masqués (--redact).
set -euo pipefail
GITLEAKS_IMAGE="${GITLEAKS_IMAGE:?GITLEAKS_IMAGE doit être épinglé}"
mkdir -p reports/gitleaks
ZERO=0000000000000000000000000000000000000000

if [ "${GITLEAKS_FULL:-0}" = "1" ]; then
  RANGE=""; SCOPE="historique complet"
elif [ -n "${BASE_SHA:-}" ] && [ -n "${HEAD_SHA:-}" ]; then
  RANGE="${BASE_SHA}..${HEAD_SHA}"; SCOPE="commits de la PR"
elif [ -n "${BEFORE_SHA:-}" ] && [ "${BEFORE_SHA}" != "$ZERO" ] && git cat-file -e "${BEFORE_SHA}^{commit}" 2>/dev/null; then
  RANGE="${BEFORE_SHA}..${GITHUB_SHA}"; SCOPE="commits poussés"
else
  RANGE=""; SCOPE="historique complet (nouvelle branche)"
fi

echo "::group::gitleaks — ${SCOPE}"
set +e
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/repo" -w /repo "$GITLEAKS_IMAGE" \
  git ${RANGE:+--log-opts="$RANGE"} --redact --no-banner --exit-code 2 \
  --report-format sarif --report-path reports/gitleaks/gitleaks.sarif .
RC=$?
set -e
echo "::endgroup::"

N=0
if [ -f reports/gitleaks/gitleaks.sarif ]; then
  N=$(jq '[.runs[].results[]?] | length' reports/gitleaks/gitleaks.sarif)
  jq -r '.runs[].results[]? | [.ruleId, (.locations[0].physicalLocation.artifactLocation.uri // "?"),
        (.locations[0].physicalLocation.region.startLine // 1),
        (.partialFingerprints.commitSha // "" | .[0:8])] | @tsv' reports/gitleaks/gitleaks.sarif |
  while IFS=$'\t' read -r rule file line commit; do
    echo "::error file=${file},line=${line},title=Secret détecté (${rule})::Commit ${commit} : valeur masquée. Révoquer le secret, puis le retirer de l'historique."
  done
fi
[ -n "${GITHUB_STEP_SUMMARY:-}" ] && printf '### 🔑 Secrets (gitleaks)\n\nPérimètre : %s — **%s** secret(s) détecté(s). Les valeurs ne sont jamais affichées (`--redact`).\n\n' "$SCOPE" "$N" >> "$GITHUB_STEP_SUMMARY"

if [ "$RC" -eq 2 ] || [ "$N" -gt 0 ]; then
  echo "::error title=Gate secrets::${N} secret(s) dans les commits : considérer le secret comme compromis et le révoquer immédiatement."
  exit 1
elif [ "$RC" -ne 0 ]; then
  echo "::error title=gitleaks::Erreur d'exécution de gitleaks (code ${RC})."; exit 1
fi