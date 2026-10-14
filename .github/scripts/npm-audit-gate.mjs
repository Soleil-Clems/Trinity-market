// Chemin : .github/scripts/npm-audit-gate.mjs
// Gate npm audit. Politique :
//   - HIGH/CRITICAL dans les dépendances de PRODUCTION → ::error, bloquant
//   - HIGH/CRITICAL dans les devDependencies seules     → ::warning
//   - MODERATE/LOW                                      → ::warning (résumé)
// Usage : node npm-audit-gate.mjs <dossier> [dossier ...]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const summary = process.env.GITHUB_STEP_SUMMARY;
const write = (s) => summary && fs.appendFileSync(summary, s + '\n');
const HIGH = new Set(['high', 'critical']);
let blocking = 0;
const rows = [];

const audit = (dir, args) => {
  const r = spawnSync('npm', ['audit', '--json', ...args], { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  try { return JSON.parse(r.stdout); } catch { return { error: { summary: (r.stderr || r.stdout || '').slice(0, 300) } }; }
};
const titleOf = (v) => (v.via || []).find((x) => typeof x === 'object')?.title || `via ${(v.via || []).join(', ')}`;
const fixOf = (v) => (v.fixAvailable === false ? 'aucun correctif' : v.fixAvailable?.version ? `corrigé en ${v.fixAvailable.name}@${v.fixAvailable.version}` : 'npm audit fix');

for (const dir of process.argv.slice(2)) {
  if (!fs.existsSync(path.join(dir, 'package-lock.json'))) {
    console.log(`::warning title=npm audit ${dir}::package-lock.json absent, audit ignoré.`);
    continue;
  }
  console.log(`::group::npm audit — ${dir}`);
  const prod = audit(dir, ['--omit=dev']);
  const all = audit(dir, []);
  console.log('::endgroup::');
  if (prod.error || all.error) {
    console.log(`::error title=npm audit ${dir} indisponible::${(prod.error || all.error).summary || 'erreur inconnue'}`);
    blocking++;
    continue;
  }
  const pv = prod.vulnerabilities || {};
  const av = all.vulnerabilities || {};
  const count = { critical: 0, high: 0, moderate: 0, low: 0 };
  let dirBlocking = 0;
  for (const [name, v] of Object.entries(av)) {
    count[v.severity] = (count[v.severity] || 0) + 1;
    const loc = `file=${dir}/package.json,title=npm audit — ${v.severity.toUpperCase()} — ${name}`;
    if (HIGH.has(v.severity) && pv[name]) {
      dirBlocking++;
      console.log(`::error ${loc}::${titleOf(v)} (dépendance de production${v.isDirect ? ' directe' : ' transitive'}, ${fixOf(v)})`);
    } else if (HIGH.has(v.severity)) {
      console.log(`::warning ${loc}::${titleOf(v)} (devDependency uniquement, non bloquant, ${fixOf(v)})`);
    }
  }
  if (count.moderate + count.low > 0) {
    console.log(`::warning title=npm audit ${dir}::${count.moderate} MODERATE et ${count.low} LOW, non bloquants : à traiter via Dependabot.`);
  }
  blocking += dirBlocking;
  rows.push(`| \`${dir}\` | ${count.critical} | ${count.high} | ${count.moderate} | ${count.low} | ${dirBlocking ? `❌ ${dirBlocking}` : '✅ 0'} |`);
}

write('### 📦 Dépendances (npm audit)\n');
write('| Projet | Critical | High | Moderate | Low | Bloquantes (prod HIGH+) |\n|---|---:|---:|---:|---:|:---:|');
rows.forEach((r) => write(r));
write('\nPolitique : seules les vulnérabilités HIGH/CRITICAL des dépendances de production bloquent ; le reste est remonté en avertissement.\n');
if (blocking > 0) {
  console.log(`::error title=Gate dépendances::${blocking} vulnérabilité(s) HIGH/CRITICAL en production : mettre à jour la dépendance (voir annotations).`);
  process.exit(1);
}
