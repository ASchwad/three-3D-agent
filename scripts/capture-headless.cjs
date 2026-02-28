const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

  await page.goto('http://localhost:5173');
  await page.waitForTimeout(5000);

  // The project list is behind a hover menu. Trigger mouseenter to open it.
  const projectBar = await page.locator('text=Projects').first();
  await projectBar.hover();
  await page.waitForTimeout(500);

  // Now click the Paralette button
  const clicked = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent.includes('Paralette')) {
        btn.click();
        return true;
      }
    }
    return false;
  });
  console.log('Clicked Paralette:', clicked);
  await page.waitForTimeout(3000);

  await page.evaluate(() => window.__three3d.hideUI());
  await page.waitForTimeout(300);

  for (const view of ['front', 'right', 'perspective']) {
    await page.evaluate((v) => window.__three3d.setCameraView(v), view);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `screenshots/paralette-clean-${view}.png` });
    console.log(`Captured ${view}`);
  }

  await page.evaluate(() => window.__three3d.showUI());
  await browser.close();
  console.log('Done');
})().catch(console.error);
