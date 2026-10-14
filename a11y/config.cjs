// Chemin : a11y/config.cjs
// Configuration partagée par pa11y-ci et Lighthouse CI.
const { login, pages } = require('./pages.json');

const baseUrl = (process.env.A11Y_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Identifiants des comptes de seed : A11Y_EMPLOYEE_EMAIL / A11Y_EMPLOYEE_PASSWORD, etc.
function credentials(role) {
  const key = role.toUpperCase();
  const email = process.env[`A11Y_${key}_EMAIL`];
  const password = process.env[`A11Y_${key}_PASSWORD`];
  if (!email || !password) {
    throw new Error(`Identifiants manquants pour le rôle « ${role} » (A11Y_${key}_EMAIL / A11Y_${key}_PASSWORD)`);
  }
  return { email, password };
}

module.exports = { baseUrl, login, pages, slug, credentials };
