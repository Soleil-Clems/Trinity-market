#!/usr/bin/env bash
# Chemin : .github/scripts/sarif-gate.sh
# Gate générique sur des fichiers SARIF (CodeQL…), d'après la propriété security-severity :
#   >= 9 CRITICAL, >= 7 HIGH → ::error (bloquant) ; MEDIUM / LOW → ::warning
# Usage : sarif-gate.sh <dossier ou fichier sarif> <nom de l'outil>
set -euo pipefail
SRC="${1:?sarif}"; TOOL="${2:?outil}"
mapfile -t FILES < <(find "$SRC" -name '*.sarif' -type f 2>/dev/null)
if [ ${#FILES[@]} -eq 0 ]; then
  echo "::error title=${TOOL}::Aucun fichier SARIF produit : l'analyse a échoué."; exit 1
fi

ROWS=$(jq -r '
  .runs[] as $run
  | ([$run.tool.driver.rules[]?, $run.tool.extensions[]?.rules[]?]
      | map({key: .id, value: ((.properties["security-severity"] // "0") | tonumber)}) | from_entries) as $sev
  | $run.results[]? | select(((.suppressions // []) | length) == 0)
  | ((.ruleId // .rule.id) as $id | ($sev[$id] // 0)) as $s
  | [ (if $s >= 9 then "CRITICAL" elif $s >= 7 then "HIGH" elif $s >= 4 then "MEDIUM"
       elif $s > 0 then "LOW" elif .level == "error" then "MEDIUM" else "LOW" end),
      (.ruleId // .rule.id // "?"),
      (.locations[0].physicalLocation.artifactLocation.uri // "?"),
      (.locations[0].physicalLocation.region.startLine // 1),
      (.message.text | gsub("[\r\n]+"; " ") | .[0:200]) ] | @tsv' "${FILES[@]}")

C=0; H=0; M=0; L=0
while IFS=$'\t' read -r sev rule file line msg; do
  [ -z "${sev:-}" ] && continue
  case "$sev" in
    CRITICAL) C=$((C+1)); echo "::error file=${file},line=${line},title=${TOOL} — CRITICAL ${rule}::${msg}" ;;
    HIGH)     H=$((H+1)); echo "::error file=${file},line=${line},title=${TOOL} — HIGH ${rule}::${msg}" ;;
    MEDIUM)   M=$((M+1)); [ "$M" -le 20 ] && echo "::warning file=${file},line=${line},title=${TOOL} — MEDIUM ${rule}::${msg}" ;;
    *)        L=$((L+1)) ;;
  esac
done <<< "$ROWS"

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  printf '### 🔬 %s\n\n| Critical | High | Medium | Low |\n|---:|---:|---:|---:|\n| %s | %s | %s | %s |\n\nHIGH et CRITICAL bloquent ; MEDIUM et LOW sont remontés en avertissement.\n\n' \
    "$TOOL" "$C" "$H" "$M" "$L" >> "$GITHUB_STEP_SUMMARY"
fi
[ "$L" -gt 0 ] && echo "::notice title=${TOOL}::${L} résultat(s) LOW, consultables dans l'onglet Security."
if [ $((C + H)) -gt 0 ]; then
  echo "::error title=Gate ${TOOL}::$((C + H)) vulnérabilité(s) HIGH/CRITICAL dans le code (voir annotations)."
  exit 1
fi