const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  // Desktop full page
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop.goto('http://localhost:8400/index.html', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await desktop.waitForTimeout(2500);
  // trigger reveal animations by scrolling through, then back to top
  await desktop.evaluate(async () => {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
    window.scrollTo(0, 0);
  });
  await desktop.waitForTimeout(800);
  await desktop.screenshot({ path: 'shot-desktop-full.png', fullPage: true });

  // Desktop hero only
  await desktop.screenshot({ path: 'shot-desktop-hero.png' });

  // Modal (force open via exit-intent simulation isn't reliable headless; wait isn't needed — just clear the guard and dispatch)
  await desktop.evaluate(() => { try { sessionStorage.clear(); } catch (e) {} });
  await desktop.reload({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await desktop.waitForTimeout(16000); // 15s dwell trigger
  await desktop.screenshot({ path: 'shot-modal.png' });

  // Mobile full page
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto('http://localhost:8400/index.html', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await mobile.waitForTimeout(2000);
  await mobile.evaluate(() => {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
    window.scrollTo(0, 0);
  });
  await mobile.waitForTimeout(500);
  await mobile.screenshot({ path: 'shot-mobile-full.png', fullPage: true });

  await browser.close();
  console.log('done');
})();
