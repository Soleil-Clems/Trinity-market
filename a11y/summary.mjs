// Chemin : a11y/summary.mjs
// Résumé pa11y + Lighthouse : tableau par page, annotations pour chaque erreur WCAG.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { baseUrl, pages, slug } = require('./config.cjs');

const R = '../reports/a11y';
const summary = process.env.GITHUB_STEP_SUMMARY;
const write = (s) => summary && fs.appendFileSync(summary, s + '\n');
const read = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null);

const pa11y = read(`${R}/pa11y.json`);
const lh = read(`${R}/lighthouse/manifest.json`);
const rows = [];

for (const page of pages) {
  const key = Object.keys(pa11y?.results || {}).find((u) =>
    page.role ? u.includes(`a11y-page=${slug(page.name)}`) : u === `${baseUrl}${page.path}`);
  const res = key ? pa11y.results[key] : null;
  const issues = Array.isArray(res) ? res.filter((i) => i.type === 'error') : [];
  const crashed = res && !Array.isArray(res) ? true : (Array.isArray(res) && res.some((i) => i instanceof Object && i.message && !i.code));
  for (const i of issues.slice(0, 10)) {
    console.log(`::error title=a11y — ${page.name} — ${i.code}::${i.message.replace(/\s+/g, ' ').slice(0, 300)} [${i.selector}]`);
  }
  const run = (lh || []).find((r) => new URL(r.url).pathname === page.path && r.isRepresentativeRun !== false);
  const score = run?.summary?.accessibility;
  if (score != null && score < 0.9) {
    console.log(`::error title=Lighthouse — ${page.name}::Score accessibilité ${Math.round(score * 100)} < 90`);
  }
  rows.push(`| ${page.name} | \`${page.path}\` | ${res == null ? '⚠️ non audité' : crashed ? '⚠️ erreur d’exécution' : issues.length ? `❌ ${issues.length}` : '✅ 0'} | ${score == null ? '—' : `${score >= 0.9 ? '✅' : '❌'} ${Math.round(score * 100)}`} |`);
}

write('### ♿ Accessibilité — WCAG 2.1 AA\n');
write('| Page | Chemin | Erreurs pa11y (bloquant > 0) | Score Lighthouse (bloquant < 90) |\n|---|---|:---:|:---:|');
rows.forEach((r) => write(r));
write('\n📦 Rapports HTML détaillés (pa11y + Lighthouse, captures) : artefact `a11y-report` de ce run.\n');
