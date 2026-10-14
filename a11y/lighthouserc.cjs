// Chemin : a11y/lighthouserc.cjs
// Lighthouse CI : catégorie accessibilité uniquement, score minimal 90.
const { baseUrl, pages } = require('./config.cjs');

module.exports = {
  ci: {
    collect: {
      url: pages.map((p) => `${baseUrl}${p.path}`),
      numberOfRuns: 1, // l'audit d'accessibilité est déterministe
      puppeteerScript: './lhci-auth.cjs',
      puppeteerLaunchOptions: { args: ['--no-sandbox', '--disable-dev-shm-usage'] },
      settings: {
        onlyCategories: ['accessibility'],
        disableStorageReset: true, // conserve la session ouverte par lhci-auth.cjs
        preset: 'desktop',
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',
      },
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'button-name': 'error',
        'link-name': 'error',
        label: 'error',
        'image-alt': 'error',
        'html-has-lang': 'error',
        'document-title': 'error',
        'color-contrast': 'warn',
      },
    },
    upload: { target: 'filesystem', outputDir: '../reports/a11y/lighthouse' },
  },
};
