// Chemin : a11y/pa11yci.cjs
// pa11y-ci : WCAG 2.1 niveau AA (moteurs axe-core + HTML_CodeSniffer).
// Toute erreur fait échouer la commande ; avertissements et notices sont ignorés.
const { baseUrl, login, pages, slug, credentials } = require('./config.cjs');

const REPORTS = '../reports/a11y';

function entry(page) {
  const name = slug(page.name);
  const common = { screenCapture: `${REPORTS}/screens/${name}.png` };
  if (!page.role) return { ...common, url: `${baseUrl}${page.path}` };

  const { email, password } = credentials(page.role);
  return {
    ...common,
    // URL unique par page (le paramètre est ignoré par l'app) : sinon les résultats
    // de toutes les pages protégées seraient fusionnés sous l'URL de connexion.
    url: `${baseUrl}${login.path}?a11y-page=${name}`,
    actions: [
      `wait for element ${login.email} to be visible`,
      `set field ${login.email} to ${email}`,
      `set field ${login.password} to ${password}`,
      `click element ${login.submit}`,
      `wait for path to not be ${login.path}`,
      `navigate to ${baseUrl}${page.path}`,
      `wait for element ${page.ready || 'main'} to be visible`,
    ],
  };
}

module.exports = {
  defaults: {
    standard: 'WCAG2AA',
    runners: ['axe', 'htmlcs'],
    timeout: 60000,
    wait: 500,
    concurrency: 1,
    useIncognitoBrowserContext: true, // session vierge par page (rôles différents)
    chromeLaunchConfig: { args: ['--no-sandbox', '--disable-dev-shm-usage'] },
    reporters: [
      'cli',
      ['json', { fileName: `${REPORTS}/pa11y.json` }],
      ['pa11y-ci-reporter-html', { destination: `${REPORTS}/pa11y-html`, includeZeroIssues: true }],
    ],
  },
  urls: pages.map(entry),
};
