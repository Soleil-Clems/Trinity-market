// Chemin : a11y/lhci-auth.cjs
// Exécuté par Lighthouse CI avant l'audit de chaque URL : réinitialise la session
// puis se connecte avec le compte du rôle requis par la page.
const { baseUrl, login, pages, credentials } = require('./config.cjs');

module.exports = async (browser, context) => {
  const pathname = new URL(context.url).pathname;
  const target = pages.find((p) => p.path === pathname);
  const page = await browser.newPage();
  try {
    await page.goto(`${baseUrl}${login.path}`, { waitUntil: 'networkidle0' });
    const cdp = await page.createCDPSession();
    await cdp.send('Network.clearBrowserCookies');
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    if (!target?.role) return;

    const { email, password } = credentials(target.role);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector(login.email, { visible: true });
    await page.type(login.email, email);
    await page.type(login.password, password);
    await Promise.all([
      page.waitForFunction((p) => location.pathname !== p, { timeout: 30000 }, login.path),
      page.click(login.submit),
    ]);
  } finally {
    await page.close();
  }
};
