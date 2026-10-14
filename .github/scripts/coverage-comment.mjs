// Chemin : .github/scripts/coverage-comment.mjs
// Construit le commentaire de PR : couverture par app et variation vs la branche cible.
// Usage : node coverage-comment.mjs <dossier artefacts> <dossier base> <sortie.md>
import fs from 'node:fs';
import path from 'node:path';

const [artifacts, baseDir, out] = process.argv.slice(2);
const apps = [
  { name: 'backend', min: Number(process.env.COVERAGE_MIN_BACKEND || 70) },
  { name: 'frontend', min: Number(process.env.COVERAGE_MIN_FRONTEND || 60) },
];
const metrics = [['lines', 'Lignes'], ['statements', 'Instructions'], ['functions', 'Fonctions'], ['branches', 'Branches']];
const read = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null);

const cell = (cur, base) => {
  if (cur == null) return 'n/a';
  let s = `${cur.toFixed(1)} %`;
  if (base != null) {
    const d = cur - base;
    s += Math.abs(d) < 0.05 ? ' (=)' : ` (${d > 0 ? '🔼 +' : '🔽 '}${d.toFixed(1)})`;
  }
  return s;
};

let md = '<!-- ci-coverage-report -->\n## 📊 Couverture de tests\n\n';
md += `| App | ${metrics.map((m) => m[1]).join(' | ')} | Seuil | Statut |\n|---|${metrics.map(() => '---:').join('|')}|---:|:---:|\n`;
let hasBase = false;
for (const app of apps) {
  const cur = read(path.join(artifacts, `coverage-${app.name}`, 'coverage', 'coverage-summary.json'))?.total;
  const base = read(path.join(baseDir, `${app.name}.json`));
  if (base) hasBase = true;
  const lines = cur?.lines?.pct;
  const status = lines == null ? '⚠️' : lines >= app.min ? '✅' : '❌';
  md += `| ${app.name} | ${metrics.map(([k]) => cell(cur?.[k]?.pct, base?.[k]?.pct)).join(' | ')} | ${app.min} % | ${status} |\n`;
}
const base = process.env.GITHUB_BASE_REF;
md += hasBase ? `\nVariation calculée par rapport à la dernière CI de \`${base}\`.\n` : `\n_Pas encore de référence pour \`${base || 'la branche cible'}\` : la variation apparaîtra après la prochaine CI sur cette branche._\n`;
const run = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
md += `\nRapports détaillés (HTML, lcov) : artefacts \`coverage-backend\` et \`coverage-frontend\` du [run](${run}).\n`;

fs.writeFileSync(out, md);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md.replace('<!-- ci-coverage-report -->\n', ''));
