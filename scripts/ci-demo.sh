#!/usr/bin/env bash
# Chemin : scripts/ci-demo.sh
# Démo keynote : ouvre une PR brouillon qui déclenche volontairement une gate de la CI.
#   ./scripts/ci-demo.sh secret|vuln|a11y|test [branche cible, défaut : develop]
# Prérequis : gh (GitHub CLI) authentifié, arbre de travail propre.
# Après la démo : gh pr close --delete-branch <branche>   (affiché à la fin)
set -euo pipefail
cd "$(dirname "$0")/.."
SCENARIO="${1:?usage: ci-demo.sh secret|vuln|a11y|test [base]}"
BASE="${2:-develop}"

command -v gh >/dev/null || { echo "GitHub CLI (gh) requis : https://cli.github.com"; exit 1; }
git diff --quiet && git diff --cached --quiet || { echo "Arbre de travail non propre : committer ou remiser d'abord."; exit 1; }

BRANCH="demo/ci-gate-${SCENARIO}-$(date +%Y%m%d-%H%M%S)"
git fetch -q origin "$BASE"
git switch -q -c "$BRANCH" "origin/$BASE"

case "$SCENARIO" in
  secret)
    # Secret factice à forte entropie, format générique (non révocable, aucun fournisseur réel)
    KEY="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 40)"
    mkdir -p server/src/demo
    printf '// Démo CI : secret committé par erreur\nexport const PAYMENT_API_SECRET_KEY = "%s";\n' "$KEY" > server/src/demo/config.ts
    EXPECT="Security — secrets (gitleaks)"
    ;;
  vuln)
    # lodash < 4.17.21 : CVE-2021-23337 (injection de commande, HIGH) en dépendance de production
    (cd server && npm install --save --save-exact --no-audit --no-fund lodash@4.17.20)
    EXPECT="Security — dépendances (npm audit + dependency review)"
    ;;
  a11y)
    APP_DIR=$( [ -d client/src/app ] && echo client/src/app || echo client/app )
    mkdir -p "$APP_DIR/a11y-demo"
    cat > "$APP_DIR/a11y-demo/page.tsx" <<'TSX'
// Démo CI : bouton sans nom accessible (icône seule, ni texte ni aria-label)
export default function A11yDemoPage() {
  return (
    <main>
      <h1>Démo accessibilité</h1>
      <button type="button">
        <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" /></svg>
      </button>
    </main>
  );
}
TSX
    node -e "const f='a11y/pages.json',c=require('./'+f);c.pages.push({name:'Démo a11y',path:'/a11y-demo/',role:null});require('fs').writeFileSync(f,JSON.stringify(c,null,2)+'\n')"
    EXPECT="Accessibilité (pa11y : règle button-name)"
    ;;
  test)
    cat > server/src/ci-demo.spec.ts <<'TS'
// Démo CI : test volontairement faux
describe('Démo CI', () => {
  it('calcule les heures supplémentaires', () => {
    expect(35 + 4).toBe(40);
  });
});
TS
    EXPECT="Tests backend"
    ;;
  *) echo "Scénario inconnu : $SCENARIO (secret|vuln|a11y|test)"; exit 1 ;;
esac

git add -A
git commit -q -m "demo(ci): gate ${SCENARIO} — NE PAS FUSIONNER"
git push -q -u origin "$BRANCH"
URL=$(gh pr create --draft --base "$BASE" --head "$BRANCH" \
  --title "[DÉMO] Gate « ${SCENARIO} » — ne pas fusionner" \
  --body "PR de démonstration : le contrôle **${EXPECT}** doit échouer et bloquer la fusion via le check requis **CI OK**.")
git switch -q -

echo
echo "PR ouverte : $URL"
echo "Contrôle attendu en échec : $EXPECT"
echo "Après la démo : gh pr close --delete-branch \"$BRANCH\""