// Chemin : .github/scripts/ci-verdict.mjs
// Verdict final lisible en 30 secondes : quels contrôles ont échoué, pourquoi, quoi faire.
// Entrée : variable NEEDS = toJSON(needs) du job agrégateur.
import fs from 'node:fs';

const needs = JSON.parse(process.env.NEEDS || '{}');
const summary = process.env.GITHUB_STEP_SUMMARY;
const write = (s) => summary && fs.appendFileSync(summary, s + '\n');
const run = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;

// [libellé, cause probable et action, bloquant ?]
const JOBS = {
  lint: ['Lint', 'erreurs ESLint : voir les annotations sur les fichiers, puis `npx eslint .` en local', true],
  build: ['Build des images', 'compilation TypeScript / Next.js ou Dockerfile en échec, ou vulnérabilité HIGH/CRITICAL corrigeable dans une image (Trivy)', true],
  'test-backend': ['Tests backend', "test unitaire ou d'intégration en échec, ou couverture sous le seuil", true],
  'test-frontend': ['Tests frontend', 'test en échec ou couverture sous le seuil', true],
  'coverage-report': ['Commentaire de couverture', 'informatif uniquement', false],
  secrets: ['Secrets (gitleaks)', 'un secret est présent dans les commits : le révoquer, puis le retirer de l’historique', true],
  dependencies: ['Dépendances', 'dépendance de production avec vulnérabilité HIGH/CRITICAL (npm audit ou dependency review) : la mettre à jour', true],
  sast: ['SAST (CodeQL)', 'vulnérabilité HIGH/CRITICAL détectée dans le code', true],
  a11y: ['Accessibilité', 'erreur WCAG 2.1 AA (pa11y) ou score Lighthouse < 90 : voir le rapport a11y-report', true],
};
const ICON = { success: '✅', failure: '❌', cancelled: '⛔', skipped: '⏭️' };

const failed = [];
const warned = [];
let table = '| Contrôle | Résultat | Bloquant |\n|---|:---:|:---:|\n';
for (const [id, { result }] of Object.entries(needs)) {
  const [label, why, blocking] = JOBS[id] || [id, 'voir le job', true];
  table += `| ${label} | ${ICON[result] || result} ${result} | ${blocking ? 'oui' : 'non'} |\n`;
  if (result === 'failure' || result === 'cancelled') (blocking ? failed : warned).push({ label, why, result });
}

if (failed.length === 0) {
  write(`## ✅ CI OK — fusion autorisée\n\n${table}`);
  warned.forEach((w) => console.log(`::warning title=${w.label}::Échec non bloquant (${w.why}).`));
  process.exit(0);
}

write(`## ❌ CI bloquée — ${failed.length} contrôle(s) en échec\n`);
write(failed.map((f) => `- **${f.label}** : ${f.result === 'cancelled' ? 'annulé (timeout ou run plus récent)' : f.why}.`).join('\n'));
write(`\nDétail : ouvrir le job concerné dans le [run](${run}) ; les annotations ❌ pointent la ligne en cause.\n\n${table}`);
failed.forEach((f) => console.log(`::error title=CI bloquée — ${f.label}::${f.result === 'cancelled' ? 'job annulé' : f.why}`));
process.exit(1);
