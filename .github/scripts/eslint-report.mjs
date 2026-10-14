// Chemin : .github/scripts/eslint-report.mjs
// Convertit un rapport ESLint JSON en annotations GitHub + résumé de job.
// Politique : erreur ESLint = bloquant (::error), avertissement = non bloquant (::warning).
// Usage : node eslint-report.mjs <app> <eslint.json> [eslint.stderr]
import fs from 'node:fs';
import path from 'node:path';

const [app, reportFile, stderrFile] = process.argv.slice(2);
const summary = process.env.GITHUB_STEP_SUMMARY;
const write = (s) => summary && fs.appendFileSync(summary, s + '\n');
const MAX_ANNOTATIONS = 50;

if (!fs.existsSync(reportFile) || fs.statSync(reportFile).size === 0) {
  const err = stderrFile && fs.existsSync(stderrFile) ? fs.readFileSync(stderrFile, 'utf8').trim().split('\n').slice(-5).join(' | ') : '';
  console.log(`::error title=ESLint ${app} — exécution impossible::ESLint n'a produit aucun rapport (configuration absente ou invalide). ${err}`);
  write(`### 🔍 Lint — ${app}\n\n❌ ESLint n'a pas pu s'exécuter. Voir le log de l'étape.`);
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
const root = process.env.GITHUB_WORKSPACE || process.cwd();
let errors = 0, warnings = 0, shown = 0;
const byRule = new Map();

for (const r of results) {
  const file = path.relative(root, r.filePath);
  for (const m of r.messages) {
    const level = m.severity === 2 ? 'error' : 'warning';
    level === 'error' ? errors++ : warnings++;
    const rule = m.ruleId || 'parse-error';
    byRule.set(rule, (byRule.get(rule) || 0) + 1);
    if (shown++ < MAX_ANNOTATIONS) {
      const msg = m.message.replace(/\r?\n/g, ' ');
      console.log(`::${level} file=${file},line=${m.line || 1},col=${m.column || 1},title=ESLint ${rule}::${msg}`);
    }
  }
}

const top = [...byRule.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  .map(([r, n]) => `\`${r}\` (${n})`).join(', ');
write(`### 🔍 Lint — ${app}\n`);
write(`| ❌ Erreurs (bloquantes) | ⚠️ Avertissements | Fichiers analysés |\n|---:|---:|---:|\n| ${errors} | ${warnings} | ${results.length} |\n`);
if (top) write(`Règles les plus fréquentes : ${top}\n`);
if (shown > MAX_ANNOTATIONS) write(`_${shown - MAX_ANNOTATIONS} problèmes supplémentaires non annotés : lancer \`npx eslint .\` en local._\n`);

if (errors > 0) {
  console.log(`::error title=Lint ${app} bloquant::${errors} erreur(s) ESLint à corriger (les ${warnings} avertissements ne bloquent pas).`);
  process.exit(1);
}
if (warnings > 0) console.log(`::notice title=Lint ${app}::${warnings} avertissement(s) ESLint, non bloquants.`);
