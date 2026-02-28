const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Step 1 & 2: Navigate and resize
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('http://localhost:5173');
  console.log('Navigated to app');

  // Step 3: Wait 2 seconds for scene to render
  await page.waitForTimeout(2000);

  // Step 4: Switch to Paralette project
  // Hover over project switcher top left
  const projectsBtn = await page.locator('button, [role="button"]').filter({ hasText: /projects/i }).first();
  if (await projectsBtn.count() > 0) {
    await projectsBtn.hover();
    await page.waitForTimeout(300);
    await projectsBtn.click();
    await page.waitForTimeout(300);
  } else {
    // Try clicking the top-left area where project switcher typically is
    await page.mouse.move(100, 50);
    await page.waitForTimeout(300);
  }

  // Click the Paralette item
  const paralette = await page.locator('button, [role="button"], li, a').filter({ hasText: /paralette/i }).first();
  if (await paralette.count() > 0) {
    await paralette.click();
    console.log('Clicked Paralette');
  } else {
    // Try finding any element with paralette text
    const anyParalette = await page.locator(':text("Paralette")').first();
    if (await anyParalette.count() > 0) {
      await anyParalette.click();
      console.log('Clicked Paralette via text');
    } else {
      console.log('Could not find Paralette button - checking page state');
      await page.screenshot({ path: 'screenshots/debug-grip-initial.jpg', type: 'jpeg' });
    }
  }
  await page.waitForTimeout(1000);

  // Step 5: Hide UI
  try {
    await page.evaluate(() => window.__three3d.hideUI());
    console.log('UI hidden');
  } catch (e) {
    console.log('hideUI error:', e.message);
  }
  await page.waitForTimeout(300);

  // Step 6a: Front view
  try {
    await page.evaluate(() => window.__three3d.setCameraView('front'));
    console.log('Set front view');
  } catch (e) {
    console.log('setCameraView front error:', e.message);
  }
  await page.waitForTimeout(500);
  await page.screenshot({
    path: 'screenshots/paralette-grip-fix-front.jpg',
    type: 'jpeg',
    quality: 90
  });
  console.log('Saved front view');

  // Step 6b: Perspective view
  try {
    await page.evaluate(() => window.__three3d.setCameraView('perspective'));
    console.log('Set perspective view');
  } catch (e) {
    console.log('setCameraView perspective error:', e.message);
  }
  await page.waitForTimeout(500);
  await page.screenshot({
    path: 'screenshots/paralette-grip-fix-perspective.jpg',
    type: 'jpeg',
    quality: 90
  });
  console.log('Saved perspective view');

  // Step 6c: Close-up of grip from angle
  try {
    await page.evaluate(() => window.__three3d.setCameraPosition(15, 65, 25, 0, 58, 0));
    console.log('Set closeup position');
  } catch (e) {
    console.log('setCameraPosition closeup error:', e.message);
  }
  await page.waitForTimeout(500);
  await page.screenshot({
    path: 'screenshots/paralette-grip-fix-closeup.jpg',
    type: 'jpeg',
    quality: 90
  });
  console.log('Saved closeup view');

  // Step 6d: Bore view
  try {
    await page.evaluate(() => window.__three3d.setCameraPosition(-10, 62, 30, 0, 62, 0));
    console.log('Set bore position');
  } catch (e) {
    console.log('setCameraPosition bore error:', e.message);
  }
  await page.waitForTimeout(500);
  await page.screenshot({
    path: 'screenshots/paralette-grip-fix-bore.jpg',
    type: 'jpeg',
    quality: 90
  });
  console.log('Saved bore view');

  // Step 7: Restore UI
  try {
    await page.evaluate(() => window.__three3d.showUI());
    console.log('UI restored');
  } catch (e) {
    console.log('showUI error:', e.message);
  }

  await browser.close();
  console.log('Done');
})();
