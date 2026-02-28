const { chromium } = require('playwright');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');
const BASE_URL = 'http://localhost:5173';
const VIEWPORT = { width: 1200, height: 900 };

const VIEWS = [
  { name: 'front', key: 'front', file: 'paralette-iter8-front.png' },
  { name: 'right', key: 'right', file: 'paralette-iter8-right.png' },
  { name: 'perspective', key: 'perspective', file: 'paralette-iter8-perspective.png' },
];

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

  // Take initial screenshot to see state
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'iter8-initial.jpg'), type: 'jpeg' });
  console.log('Initial screenshot saved');

  // Check current page content
  const pageText = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('Page text:', pageText);

  // Try to switch to Paralette project if not already active
  console.log('Looking for Paralette project...');

  // First try clicking Projects breadcrumb
  try {
    const projectsEl = await page.getByText('Projects', { exact: false }).first();
    await projectsEl.click({ timeout: 3000 });
    await sleep(1000);
    console.log('Clicked Projects');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'iter8-after-projects.jpg'), type: 'jpeg' });
  } catch (e) {
    console.log('Could not click Projects:', e.message);
  }

  // Try clicking Paralette
  try {
    await page.getByText('Paralette', { exact: true }).first().click({ timeout: 3000 });
    await sleep(2000);
    console.log('Clicked Paralette');
  } catch (e) {
    console.log('Could not click Paralette by exact text:', e.message);
    try {
      await page.getByText('Paralette', { exact: false }).first().click({ timeout: 3000 });
      await sleep(2000);
      console.log('Clicked Paralette (non-exact)');
    } catch (e2) {
      console.log('Still could not find Paralette:', e2.message);
    }
  }

  await sleep(2000);

  // Check if __three3d API is available
  const hasAPI = await page.evaluate(() => typeof window.__three3d !== 'undefined');
  console.log('window.__three3d available:', hasAPI);

  if (hasAPI) {
    const apiMethods = await page.evaluate(() => Object.keys(window.__three3d));
    console.log('API methods:', apiMethods);
  }

  // Hide UI panels
  if (hasAPI) {
    console.log('Hiding UI panels...');
    await page.evaluate(() => window.__three3d.hideUI());
    await sleep(500);
  }

  // Capture each view
  for (const view of VIEWS) {
    console.log(`Setting camera to ${view.name} view...`);
    if (hasAPI) {
      await page.evaluate((viewKey) => window.__three3d.setCameraView(viewKey), view.key);
      await sleep(1000);
    }

    const filePath = path.join(SCREENSHOTS_DIR, view.file);
    await page.screenshot({ path: filePath, type: 'png' });
    console.log(`Saved: ${filePath}`);
  }

  // Restore UI
  if (hasAPI) {
    console.log('Restoring UI...');
    await page.evaluate(() => window.__three3d.showUI());
    await sleep(500);
  }

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'iter8-final-with-ui.jpg'), type: 'jpeg' });

  await browser.close();
  console.log('Done!');
})();
