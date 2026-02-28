const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-webgl',
      '--use-gl=angle',
      '--enable-gpu',
      '--no-sandbox',
      '--ignore-gpu-blocklist',
      '--enable-accelerated-2d-canvas',
      '--disable-gpu-sandbox',
    ],
  });
  const page = await browser.newPage();

  // Step 1 & 2: Navigate and resize to 1200x900
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('http://localhost:5173');
  console.log('Navigated to app');

  // Step 3: Wait 2 seconds for scene to render
  await page.waitForTimeout(2000);

  // Wait for __three3d to be available (set once Canvas mounts)
  await page.waitForFunction(
    () => typeof window.__three3d !== 'undefined',
    { timeout: 10000 }
  ).catch(() => console.log('WARNING: __three3d not found initially'));

  // Step 4: Switch to Paralette project
  // Hover to open dropdown
  await page.mouse.move(120, 40);
  await page.waitForTimeout(600);

  // Click the Paralette button
  const paraletteBtn = page.locator('button').filter({ hasText: /^Paralette/ }).first();
  if (await paraletteBtn.count() > 0) {
    await paraletteBtn.click();
    console.log('Clicked Paralette');
  }
  await page.waitForTimeout(1500);

  // Step 5: Hide UI
  await page.evaluate(() => window.__three3d.hideUI());
  await page.waitForTimeout(300);
  console.log('UI hidden');

  // ─────────────────────────────────────────────────────
  // Step 6a: Front view (camera auto-fits model)
  // ─────────────────────────────────────────────────────
  await page.evaluate(() => window.__three3d.setCameraView('front'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/paralette-grip-fix-front.jpg', type: 'jpeg', quality: 90 });
  console.log('Saved front view');

  // ─────────────────────────────────────────────────────
  // Step 6b: Perspective view
  // ─────────────────────────────────────────────────────
  await page.evaluate(() => window.__three3d.setCameraView('perspective'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/paralette-grip-fix-perspective.jpg', type: 'jpeg', quality: 90 });
  console.log('Saved perspective view');

  // ─────────────────────────────────────────────────────
  // Step 6c: Close-up of grip area from front-right angle
  // Model: H=62, group offset y=-H/2=-31, so apex world y = 62-31 = 31
  // Grip tube at world (0, 31, 0) - close camera from right-front
  // ─────────────────────────────────────────────────────
  await page.evaluate(() => window.__three3d.setCameraPosition(30, 45, 25, 0, 31, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/paralette-grip-fix-closeup.jpg', type: 'jpeg', quality: 90 });
  console.log('Saved closeup view');

  // ─────────────────────────────────────────────────────
  // Step 6d: Looking into the bore (from the side)
  // Camera positioned to look into the bore of the grip tube
  // ─────────────────────────────────────────────────────
  await page.evaluate(() => window.__three3d.setCameraPosition(-5, 31, 40, 0, 31, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/paralette-grip-fix-bore.jpg', type: 'jpeg', quality: 90 });
  console.log('Saved bore view');

  // Step 7: Restore UI
  await page.evaluate(() => window.__three3d.showUI());
  console.log('UI restored');

  await browser.close();
  console.log('Done');
})();
