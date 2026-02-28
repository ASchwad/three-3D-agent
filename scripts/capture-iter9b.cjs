const { chromium } = require('playwright');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');

(async () => {
  // Connect to existing Chrome instance with real GPU/WebGL support
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  console.log('Connected to Chrome via CDP');

  const contexts = browser.contexts();
  let page;

  if (contexts.length > 0 && contexts[0].pages().length > 0) {
    page = contexts[0].pages()[0];
    console.log('Using existing page:', await page.url());
  } else {
    const context = await browser.newContext();
    page = await context.newPage();
  }

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[browser error]', msg.text());
  });

  // Step 1: Set viewport and navigate
  await page.setViewportSize({ width: 1200, height: 900 });
  console.log('Step 1: Navigating to http://localhost:5173 ...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

  // Step 2: Wait 2 seconds
  console.log('Step 2: Waiting 2 seconds...');
  await page.waitForTimeout(2000);

  // Step 3: Force full page reload to reset React state
  console.log('Step 3: Hard reload to reset state...');
  await page.evaluate(function() { location.reload(); });

  // Step 4: Wait 3 seconds for scene to fully render
  console.log('Step 4: Waiting 3 seconds for scene...');
  await page.waitForTimeout(3000);

  // Step 5: Snapshot to confirm loaded state
  console.log('Step 5: Taking snapshot...');
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'iter9b-initial-confirm.jpg'),
    type: 'jpeg', quality: 90
  });
  console.log('  -> Saved iter9b-initial-confirm.jpg');

  // Check WebGL
  const webglSupport = await page.evaluate(function() {
    var canvas = document.createElement('canvas');
    var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return gl ? 'WebGL OK: ' + gl.getParameter(gl.RENDERER) : 'WebGL NOT available';
  });
  console.log('WebGL:', webglSupport);

  // Step 6: Open Projects dropdown and click Paralette
  console.log('Step 6: Opening Projects dropdown...');
  await page.locator('text=Projects').first().hover();
  await page.waitForTimeout(600);

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'iter9b-projects-hover.jpg'),
    type: 'jpeg', quality: 90
  });

  const paretteBtn = page.locator('button').filter({ hasText: /paralette/i }).first();
  const parVisible = await paretteBtn.isVisible().catch(function() { return false; });
  console.log('  Paralette button visible:', parVisible);

  if (parVisible) {
    await paretteBtn.click();
    console.log('  Clicked Paralette');
  } else {
    console.log('  Paralette not visible, checking all buttons:');
    const btns = await page.locator('button').all();
    for (const btn of btns) {
      const text = await btn.textContent();
      console.log('  button: "' + (text ? text.trim() : '') + '"');
    }
  }

  // Step 7: Wait for project to load
  console.log('Step 7: Waiting 2 seconds for project to load...');
  await page.waitForTimeout(2000);

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'iter9b-paralette-active.jpg'),
    type: 'jpeg', quality: 90
  });
  console.log('  -> Saved iter9b-paralette-active.jpg');

  // Step 8: Wait for __three3d API
  console.log('Waiting for __three3d API...');
  try {
    await page.waitForFunction(function() { return typeof window.__three3d !== 'undefined'; }, { timeout: 10000 });
    console.log('  __three3d API is available');
  } catch (e) {
    console.log('  __three3d not available after 10s, proceeding without camera control');
    const canvasCount = await page.evaluate(function() { return document.querySelectorAll('canvas').length; });
    console.log('  Canvas count:', canvasCount);
    await browser.close();
    return;
  }

  // Hide UI
  console.log('Step 8: Hiding UI...');
  await page.evaluate(function() { window.__three3d.hideUI(); });
  await page.waitForTimeout(300);

  const views = ['front', 'right', 'perspective'];

  for (const view of views) {
    console.log('\nCapturing ' + view + ' view...');

    const result = await page.evaluate(function(v) { return window.__three3d.setCameraView(v); }, view);
    console.log('  Camera set to ' + view + ': ' + result);

    await page.waitForTimeout(500);

    const filename = path.join(SCREENSHOTS_DIR, 'paralette-iter9b-' + view + '.png');
    await page.screenshot({ path: filename, type: 'png' });
    console.log('  -> Saved paralette-iter9b-' + view + '.png');
  }

  // Restore UI
  console.log('\nStep 10: Restoring UI...');
  await page.evaluate(function() { window.__three3d.showUI(); });
  await page.waitForTimeout(500);

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'iter9b-final-with-ui.jpg'),
    type: 'jpeg', quality: 90
  });
  console.log('Final screenshot saved.');

  await browser.close();
  console.log('\nDone!');
})();
