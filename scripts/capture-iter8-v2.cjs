const { chromium } = require('playwright');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');
const BASE_URL = 'http://localhost:5173';
const VIEWPORT = { width: 1200, height: 900 };

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize(VIEWPORT);

  console.log('Navigating to', BASE_URL);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await sleep(3000);

  // Try to switch to Paralette project
  console.log('Switching to Paralette project...');

  // Hover over the Projects breadcrumb to open dropdown
  const projectsEl = await page.getByText('Projects', { exact: false }).first();
  await projectsEl.hover();
  await sleep(500);

  // Take debug shot to see dropdown
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'iter8-v2-projects-hover.jpg'), type: 'jpeg' });

  // Click Paralette in the dropdown
  try {
    await page.getByText('Paralette', { exact: true }).first().click({ timeout: 3000 });
    await sleep(2000);
    console.log('Clicked Paralette');
  } catch (e) {
    console.log('Could not click Paralette:', e.message);
  }

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'iter8-v2-after-switch.jpg'), type: 'jpeg' });

  // Wait for __three3d API to appear (it's set up inside Canvas via useEffect)
  console.log('Waiting for __three3d API...');
  let hasAPI = false;
  for (let i = 0; i < 30; i++) {
    hasAPI = await page.evaluate(() => typeof window.__three3d !== 'undefined');
    if (hasAPI) break;
    await sleep(200);
  }
  console.log('window.__three3d available:', hasAPI);

  if (hasAPI) {
    const apiMethods = await page.evaluate(() => Object.keys(window.__three3d));
    console.log('API methods:', apiMethods);
  }

  // Give the 3D scene time to fully render
  await sleep(2000);

  // Hide UI panels
  if (hasAPI) {
    console.log('Hiding UI panels...');
    await page.evaluate(() => window.__three3d.hideUI());
    await sleep(800);
  }

  // FRONT VIEW
  console.log('Capturing front view...');
  if (hasAPI) {
    const result = await page.evaluate(() => window.__three3d.setCameraView('front'));
    console.log('setCameraView front result:', result);
  }
  await sleep(1000);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'paralette-iter8-front.png'),
    type: 'png'
  });
  console.log('Saved front view');

  // RIGHT VIEW
  console.log('Capturing right view...');
  if (hasAPI) {
    const result = await page.evaluate(() => window.__three3d.setCameraView('right'));
    console.log('setCameraView right result:', result);
  }
  await sleep(1000);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'paralette-iter8-right.png'),
    type: 'png'
  });
  console.log('Saved right view');

  // PERSPECTIVE VIEW
  console.log('Capturing perspective view...');
  if (hasAPI) {
    const result = await page.evaluate(() => window.__three3d.setCameraView('perspective'));
    console.log('setCameraView perspective result:', result);
  }
  await sleep(1000);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'paralette-iter8-perspective.png'),
    type: 'png'
  });
  console.log('Saved perspective view');

  // Restore UI
  if (hasAPI) {
    console.log('Restoring UI...');
    await page.evaluate(() => window.__three3d.showUI());
    await sleep(500);
  }

  await browser.close();
  console.log('Done!');
})();
