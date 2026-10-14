#!/usr/bin/env bash
# Chemin : .github/scripts/run-unit-tests.sh
# Lance les tests unitaires avec couverture (lcov + HTML + json-summary + cobertura)
# et un rapport JUnit, que le projet utilise Jest ou Vitest.
# Usage (depuis server/ ou client/) : bash ../.github/scripts/run-unit-tests.sh <app>
set -euo pipefail
APP="${1:?usage: run-unit-tests.sh <app>}"
mkdir -p reports coverage

has() { node -e "const p=require('./package.json');process.exit(({...p.dependencies,...p.devDependencies})['$1']?0:1)"; }
install_tmp() {
  echo "::group::Installation temporaire de $1 (absent de package.json)"
  npm install --no-save --no-audit --no-fund "$1"
  echo "::endgroup::"
  echo "::notice title=Tests $APP::$1 a été installé à la volée : l'ajouter en devDependency pour accélérer la CI."
}

if has vitest; then
  if ! has @vitest/coverage-v8 && ! has @vitest/coverage-istanbul; then
    install_tmp "@vitest/coverage-v8@$(node -p "require('vitest/package.json').version")"
  fi
  npx vitest run \
    --coverage.enabled=true --coverage.reportsDirectory="$PWD/coverage" \
    --coverage.reporter=json-summary --coverage.reporter=lcov \
    --coverage.reporter=text-summary --coverage.reporter=cobertura \
    --reporter=default --reporter=junit --outputFile.junit="$PWD/reports/junit-unit.xml"
elif has jest; then
  has jest-junit || install_tmp "jest-junit@17"
  export JEST_JUNIT_OUTPUT_DIR="$PWD/reports" JEST_JUNIT_OUTPUT_NAME=junit-unit.xml \
         JEST_JUNIT_ADD_FILE_ATTRIBUTE=true JEST_JUNIT_SUITE_NAME="$APP — unitaires"
  # coverageDirectory absolu : la config Nest par défaut a rootDir=src
  npx jest --ci --coverage --coverageDirectory="$PWD/coverage" \
    --coverageReporters=json-summary --coverageReporters=lcov \
    --coverageReporters=text-summary --coverageReporters=cobertura \
    --reporters=default --reporters=jest-junit
else
  echo "::error title=Tests $APP — aucun framework::Ni Jest ni Vitest dans $(basename "$PWD")/package.json : ajouter un framework de test et au moins un test."
  exit 1
fi