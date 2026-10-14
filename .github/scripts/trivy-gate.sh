#!/usr/bin/env bash
# Chemin : .github/scripts/trivy-gate.sh
# Scan Trivy d'une image (OS + librairies), export JSON + SARIF, gate :
#   HIGH/CRITICAL avec correctif → ::error (bloquant)
#   HIGH/CRITICAL sans correctif, MEDIUM, LOW → ::warning
# Usage : trivy-gate.sh <image> <nom> [dossier de sortie]
set -euo pipefail
IMAGE="${1:?image}"; NAME="${2:?nom}"; OUT="${3:-reports/trivy}"
TRIVY_IMAGE="${TRIVY_IMAGE:?TRIVY_IMAGE doit être épinglé, ex. aquasec/trivy:0.72.0}"
CACHE="${TRIVY_CACHE_DIR:-$HOME/.cache/trivy}"
mkdir -p "$OUT" "$CACHE"
OUT_ABS="$(cd "$OUT" && pwd)"

MOUNTS=(); FLAGS=()
if [ -f .trivyignore ]; then
  MOUNTS=(-v "$PWD/.trivyignore:/work/.trivyignore:ro"); FLAGS=(--ignorefile /work/.trivyignore)
fi
trivy() {
  docker run --rm -u "$(id -u):$(id -g)" --group-add "$(stat -c %g /var/run/docker.sock)" \
    -v /var/run/docker.sock:/var/run/docker.sock:ro -v "$CACHE:/cache" -v "$OUT_ABS:/out" \
    ${MOUNTS[@]+"${MOUNTS[@]}"} "$TRIVY_IMAGE" --cache-dir /cache "$@"
}

echo "::group::Trivy — analyse de $IMAGE"
trivy image --quiet --scanners vuln ${FLAGS[@]+"${FLAGS[@]}"} \
  --format json --output "/out/$NAME.json" "$IMAGE"
trivy convert --format sarif --output "/out/$NAME.sarif" "/out/$NAME.json"
echo "::endgroup::"

J="$OUT_ABS/$NAME.json"
count() { jq "[.Results[]?.Vulnerabilities[]? | select(.Severity==\"$1\" and $2)] | length" "$J"; }
CF=$(count CRITICAL '((.FixedVersion // "") != "")'); HF=$(count HIGH '((.FixedVersion // "") != "")')
CU=$(count CRITICAL '((.FixedVersion // "") == "")'); HU=$(count HIGH '((.FixedVersion // "") == "")')
MED=$(count MEDIUM 'true'); LOW=$(count LOW 'true')

jq -r '[.Results[]? | .Target as $t | .Vulnerabilities[]? | select((.Severity=="CRITICAL" or .Severity=="HIGH") and ((.FixedVersion // "") != ""))
        | "\(.Severity)\t\(.VulnerabilityID)\t\(.PkgName)\t\(.InstalledVersion)\t\(.FixedVersion)\t\($t)"] | unique | .[:20][]' "$J" |
while IFS=$'\t' read -r sev id pkg inst fix target; do
  echo "::error title=Trivy ${NAME} — ${sev} ${id}::${pkg} ${inst} → corrigé en ${fix} (${target})"
done
[ "$((CU + HU))" -gt 0 ] && echo "::warning title=Trivy ${NAME}::$((CU + HU)) vulnérabilité(s) HIGH/CRITICAL sans correctif publié : surveillées, non bloquantes."
[ "$((MED + LOW))" -gt 0 ] && echo "::warning title=Trivy ${NAME}::${MED} MEDIUM et ${LOW} LOW, non bloquantes."

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### 🛡️ Trivy — image \`${NAME}\`"
    echo
    echo "| | Critical | High | Medium | Low |"
    echo "|---|---:|---:|---:|---:|"
    echo "| Avec correctif (**bloquant** si > 0 pour Critical/High) | ${CF} | ${HF} | ${MED} | ${LOW} |"
    echo "| Sans correctif (avertissement) | ${CU} | ${HU} | — | — |"
    echo
  } >> "$GITHUB_STEP_SUMMARY"
fi

if [ "$((CF + HF))" -gt 0 ]; then
  echo "::error title=Gate Trivy ${NAME}::$((CF + HF)) vulnérabilité(s) HIGH/CRITICAL corrigeable(s) : mettre à jour l'image de base ou la dépendance."
  exit 1
fi