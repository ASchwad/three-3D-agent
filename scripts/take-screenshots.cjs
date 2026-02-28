const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: [
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });
  const page = await browser.newPage();

  // Enable console logging (filter noisy WebGL errors)
  page.on('console', msg => {
    const text = msg.text();
    if (!text.includes('WebGL context') && !text.includes('THREE.WebGLRenderer')) {
      console.log('BROWSER:', text);
    }
  });

  // Set viewport to 1200x900
  await page.setViewportSize({ width: 1200, height: 900 });

  // Navigate
  await page.goto('http://localhost:5173');

  // Wait for the page to fully load - wait for canvas to appear
  await page.waitForSelector('canvas', { timeout: 10000 });
  console.log('Canvas found');

  // Wait 2 seconds for scene to render
  await page.waitForTimeout(2000);

  // Switch to Paralette project
  await page.hover('text=Projects');
  await page.waitForTimeout(500);
  await page.click('text=Paralette');
  await page.waitForTimeout(2000);

  // Check WebGL support
  const webglStatus = await page.evaluate(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return gl ? 'WebGL supported' : 'WebGL NOT supported';
    } catch (e) {
      return 'WebGL error: ' + e.message;
    }
  });
  console.log('WebGL status:', webglStatus);

  // Wait for window.__three3d to be available (poll)
  await page.waitForFunction(() => {
    return !!(window.__three3d && typeof window.__three3d.hideUI === 'function');
  }, { timeout: 15000 });
  console.log('window.__three3d is ready');

  // Check what's available
  const apiKeys = await page.evaluate(() => Object.keys(window.__three3d || {}));
  console.log('API keys:', JSON.stringify(apiKeys));

  // Step 5: Hide UI
  await page.evaluate(() => window.__three3d.hideUI());
  await page.waitForTimeout(500);
  console.log('UI hidden');

  // Step 6: Front view
  await page.evaluate(() => window.__three3d.setCameraView('front'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/paralette-iter8b-front.png', type: 'png' });
  console.log('Front screenshot saved');

  // Right view
  await page.evaluate(() => window.__three3d.setCameraView('right'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/paralette-iter8b-right.png', type: 'png' });
  console.log('Right screenshot saved');

  // Perspective view
  await page.evaluate(() => window.__three3d.setCameraView('perspective'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/paralette-iter8b-perspective.png', type: 'png' });
  console.log('Perspective screenshot saved');

  // Step 7: Restore UI
  await page.evaluate(() => window.__three3d.showUI());
  await page.waitForTimeout(300);

  console.log('All screenshots saved successfully!');
  await browser.close();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
