// Chemin : .github/scripts/coverage-gate.mjs
// Résumé des tests (JUnit) + couverture, et seuil bloquant sur la couverture des lignes.
// Usage : node coverage-gate.mjs <app> <coverage-summary.json> <seuil %> [junit.xml ...]
import fs from 'node:fs';

const [app, summaryPath, minStr, ...junitFiles] = process.argv.slice(2);
const min = Number(minStr);
const summary = process.env.GITHUB_STEP_SUMMARY;
const write = (s) => summary && fs.appendFileSync(summary, s + '\n');
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// ---- Tests (JUnit : jest-junit ou Vitest)
const t = { total: 0, failed: 0, skipped: 0, time: 0 };
const failedNames = [];
for (const f of junitFiles) {
  if (!fs.existsSync(f)) continue;
  const xml = fs.readFileSync(f, 'utf8');
  for (const [, attrs] of xml.matchAll(/<testsuite\b([^>]*)>/g)) {
    const g = (n) => Number((attrs.match(new RegExp(`\\b${n}="([\\d.]+)"`)) || [])[1] || 0);
    t.total += g('tests'); t.failed += g('failures') + g('errors'); t.skipped += g('skipped'); t.time += g('time');
  }
  for (const [, name] of xml.matchAll(/<testcase\b[^>]*?\bname="([^"]*)"[^>]*>\s*<(?:failure|error)\b/g)) failedNames.push(decode(name));
}

// ---- Couverture
let cov = null;
if (fs.existsSync(summaryPath)) cov = JSON.parse(fs.readFileSync(summaryPath, 'utf8')).total;
const pct = (k) => (cov?.[k]?.pct ?? NaN);
const fmt = (v) => (Number.isFinite(v) ? `${v.toFixed(1)} %` : 'n/a');

write(`### 🧪 Tests et couverture — ${app}\n`);
write(`| Tests | ✅ Réussis | ❌ Échoués | ⏭️ Ignorés | Durée |\n|---:|---:|---:|---:|---:|`);
write(`| ${t.total} | ${t.total - t.failed - t.skipped} | ${t.failed} | ${t.skipped} | ${t.time.toFixed(1)} s |\n`);
if (failedNames.length) {
  write(`Tests en échec :\n${failedNames.slice(0, 10).map((n) => `- \`${n}\``).join('\n')}${failedNames.length > 10 ? `\n- … et ${failedNames.length - 10} autres` : ''}\n`);
}
write(`| Couverture | Lignes | Instructions | Fonctions | Branches | Seuil (lignes) |\n|---|---:|---:|---:|---:|---:|`);
write(`| ${app} | **${fmt(pct('lines'))}** | ${fmt(pct('statements'))} | ${fmt(pct('functions'))} | ${fmt(pct('branches'))} | ${min} % |\n`);
write(`📦 Rapport HTML et lcov : artefact \`coverage-${app}\` de ce run (conservé 14 jours).\n`);

if (t.failed > 0) {
  console.log(`::error title=Tests ${app} en échec::${t.failed} test(s) échoué(s) : ${failedNames.slice(0, 3).join(' ; ')}${failedNames.length > 3 ? ' …' : ''}`);
}
if (!cov) {
  console.log(`::error title=Couverture ${app} absente::Aucun rapport de couverture (${summaryPath}) : les tests ont probablement échoué avant la fin.`);
  process.exit(1);
}
if (pct('lines') < min) {
  console.log(`::error title=Couverture ${app} insuffisante::${fmt(pct('lines'))} de lignes couvertes, seuil minimal ${min} %.`);
  process.exit(1);
}
console.log(`::notice title=Couverture ${app}::${fmt(pct('lines'))} de lignes couvertes (seuil ${min} %).`);
