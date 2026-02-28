const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-gl=swiftshader', '--enable-accelerated-2d-canvas', '--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 900 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push('PAGE ERROR: ' + err.message));

  await page.goto('http://localhost:5173');
  await page.waitForTimeout(6000);

  // Check WebGL and __three3d availability
  const initialCheck = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const gl = canvas ? (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) : null;
    return {
      hasCanvas: !!canvas,
      hasWebGL: !!gl,
      three3dType: typeof window.__three3d,
      three3dKeys: window.__three3d ? Object.keys(window.__three3d) : []
    };
  });
  console.log('Initial check:', JSON.stringify(initialCheck));

  // Hover to open project switcher
  await page.locator('text=Projects').first().hover();
  await page.waitForTimeout(500);

  // Click Paralette
  await page.locator('text=Paralette').first().click();
  await page.waitForTimeout(4000);

  // Check again after switching
  const afterSwitch = await page.evaluate(() => {
    return {
      three3dType: typeof window.__three3d,
      three3dKeys: window.__three3d ? Object.keys(window.__three3d) : []
    };
  });
  console.log('After switch:', JSON.stringify(afterSwitch));

  // Take screenshot showing loaded Paralette
  await page.screenshot({ path: 'screenshots/paralette-iter6d-loaded-final.jpg', type: 'jpeg', quality: 85 });
  console.log('Paralette loaded screenshot taken');

  // Try hiding UI - check if the API is available
  if (afterSwitch.three3dType !== 'undefined') {
    // API available - use it
    await page.evaluate(() => window.__three3d.hideUI());
    await page.waitForTimeout(300);

    await page.evaluate(() => window.__three3d.setCameraView('front'));
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'screenshots/paralette-iter6d-front.png', type: 'png' });
    console.log('Front screenshot taken');

    await page.evaluate(() => window.__three3d.setCameraView('right'));
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'screenshots/paralette-iter6d-right.png', type: 'png' });
    console.log('Right screenshot taken');

    await page.evaluate(() => window.__three3d.setCameraView('perspective'));
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'screenshots/paralette-iter6d-perspective.png', type: 'png' });
    console.log('Perspective screenshot taken');

    await page.evaluate(() => window.__three3d.showUI());
    await page.waitForTimeout(300);
  } else {
    // API not available in headless - manually hide UI and position camera
    console.log('__three3d not available, using manual approach');

    // Hide UI elements manually
    await page.evaluate(() => {
      const root = document.querySelector('.relative');
      if (root) {
        Array.from(root.children).forEach((child) => {
          const el = child;
          if (el.tagName.toLowerCase() !== 'canvas' && !el.querySelector('canvas')) {
            el.dataset.wasVisible = el.style.display;
            el.style.display = 'none';
          }
        });
      }
    });
    await page.waitForTimeout(300);

    // Take screenshots from current default perspective (all three use same view since no camera API)
    await page.screenshot({ path: 'screenshots/paralette-iter6d-front.png', type: 'png' });
    console.log('Front screenshot taken (no camera control)');
    await page.screenshot({ path: 'screenshots/paralette-iter6d-right.png', type: 'png' });
    console.log('Right screenshot taken (no camera control)');
    await page.screenshot({ path: 'screenshots/paralette-iter6d-perspective.png', type: 'png' });
    console.log('Perspective screenshot taken (no camera control)');

    // Restore UI
    await page.evaluate(() => {
      const root = document.querySelector('.relative');
      if (root) {
        Array.from(root.children).forEach((child) => {
          const el = child;
          if (el.dataset.wasVisible !== undefined) {
            el.style.display = el.dataset.wasVisible;
            delete el.dataset.wasVisible;
          }
        });
      }
    });
  }

  console.log('Console errors:', JSON.stringify(consoleErrors));
  await browser.close();
})().catch(console.error);
