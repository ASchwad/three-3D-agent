const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Step 1: Navigate with viewport 1200x900
  await page.setViewportSize({ width: 1200, height: 900 });
  console.log('Step 1: Navigating to http://localhost:5173 ...');
  await page.goto('http://localhost:5173');

  // Step 2: Wait 2 seconds
  console.log('Step 2: Waiting 2 seconds...');
  await page.waitForTimeout(2000);

  // Step 3: Force full page reload
  console.log('Step 3: Hard reload...');
  await page.evaluate(() => location.reload());

  // Step 4: Wait 3 seconds for scene to fully render
  console.log('Step 4: Waiting 3 seconds for scene...');
  await page.waitForTimeout(3000);

  // Step 5: Take a snapshot to confirm state
  console.log('Step 5: Taking snapshot to confirm loaded state...');
  await page.screenshot({
    path: 'screenshots/iter9b-initial-confirm.jpg',
    type: 'jpeg',
    quality: 90
  });
  console.log('  -> Saved iter9b-initial-confirm.jpg');

  // Step 6: Check if Paralette is active; click it if needed
  const pageContent = await page.content();
  console.log('Step 6: Checking for Paralette in sidebar...');

  // Try to find and click Paralette button in sidebar
  const paraletteBtns = await page.locator('button').all();
  let found = false;
  for (const btn of paraletteBtns) {
    const text = await btn.textContent();
    if (text && text.trim().toLowerCase().includes('paralette')) {
      console.log(`  Found Paralette button: "${text.trim()}"`);
      await btn.click();
      found = true;
      break;
    }
  }
  if (!found) {
    console.log('  Paralette button not found directly, trying to open projects list...');
    // Try clicking a projects toggle
    const allBtns = await page.locator('button').all();
    for (const btn of allBtns) {
      const text = await btn.textContent();
      if (text && (text.trim().toLowerCase().includes('project') || text.trim().toLowerCase().includes('model'))) {
        console.log(`  Clicking: "${text.trim()}"`);
        await btn.click();
        await page.waitForTimeout(500);
        break;
      }
    }
    // Try again
    const btns2 = await page.locator('button').all();
    for (const btn of btns2) {
      const text = await btn.textContent();
      if (text && text.trim().toLowerCase().includes('paralette')) {
        console.log(`  Found Paralette after opening list: "${text.trim()}"`);
        await btn.click();
        found = true;
        break;
      }
    }
  }

  // Wait 1 second
  console.log('Step 7: Waiting 1 second...');
  await page.waitForTimeout(1000);

  // Step 8: Hide UI
  console.log('Step 8: Hiding UI...');
  try {
    await page.evaluate(() => window.__three3d.hideUI());
    console.log('  UI hidden successfully');
  } catch (e) {
    console.log('  hideUI error:', e.message);
  }
  await page.waitForTimeout(300);

  const views = ['front', 'right', 'perspective'];

  for (const view of views) {
    console.log(`\nCapturing ${view} view...`);

    // Set camera view
    try {
      await page.evaluate((v) => window.__three3d.setCameraView(v), view);
      console.log(`  Camera set to ${view}`);
    } catch (e) {
      console.log(`  setCameraView error:`, e.message);
    }

    // Wait 500ms
    await page.waitForTimeout(500);

    // Take screenshot
    const filename = `screenshots/paralette-iter9b-${view}.png`;
    await page.screenshot({
      path: filename,
      type: 'png'
    });
    console.log(`  -> Saved ${filename}`);
  }

  // Step 10: Restore UI
  console.log('\nStep 10: Restoring UI...');
  try {
    await page.evaluate(() => window.__three3d.showUI());
    console.log('  UI restored');
  } catch (e) {
    console.log('  showUI error:', e.message);
  }

  await page.waitForTimeout(500);
  await page.screenshot({
    path: 'screenshots/iter9b-final-with-ui.jpg',
    type: 'jpeg',
    quality: 90
  });
  console.log('Final screenshot saved.');

  await browser.close();
  console.log('\nDone!');
})();
