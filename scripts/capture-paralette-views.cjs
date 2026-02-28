const { chromium } = require('playwright');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');
const BASE_URL = 'http://localhost:5173';
const VIEWPORT = { width: 1200, height: 900 };

const VIEWS = [
  { name: 'front', key: 'front', file: 'paralette-current-front.jpg' },
  { name: 'right', key: 'right', file: 'paralette-current-right.jpg' },
  { name: 'top', key: 'top', file: 'paralette-current-top.jpg' },
  { name: 'perspective', key: 'perspective', file: 'paralette-current-perspective.jpg' },
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewportSize(VIEWPORT);

  console.log('Navigating to', BASE_URL);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await sleep(2000);

  // Step 1: Click "PROJECTS" breadcrumb to open the project list
  console.log('Clicking PROJECTS breadcrumb...');
  const projectsBreadcrumb = await page.getByText('Projects', { exact: false }).first();
  if (projectsBreadcrumb) {
    await projectsBreadcrumb.click();
    await sleep(1000);
    console.log('Clicked Projects breadcrumb');
  }

  // Take a screenshot to see what appeared after clicking
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'debug-after-projects-click.jpg'), type: 'jpeg' });

  // Step 2: Look for Paralette in any newly visible elements
  console.log('Looking for Paralette project link...');
  const allVisible = await page.$$eval('*', els =>
    els
      .filter(el => el.textContent?.trim().toLowerCase() === 'paralette' || el.textContent?.trim().toLowerCase() === 'paralette')
      .map(el => ({ tag: el.tagName, text: el.textContent?.trim(), class: el.className.substring(0, 80) }))
  );
  console.log('Elements with Paralette text:', JSON.stringify(allVisible, null, 2));

  // Try clicking Paralette by text
  try {
    await page.getByText('Paralette', { exact: true }).first().click({ timeout: 3000 });
    await sleep(1500);
    console.log('Clicked Paralette');
  } catch (e) {
    console.log('Could not click Paralette by exact text:', e.message);
    // Try case-insensitive
    try {
      await page.getByText('paralette', { exact: false }).first().click({ timeout: 3000 });
      await sleep(1500);
      console.log('Clicked paralette (case-insensitive)');
    } catch (e2) {
      console.log('Still could not find Paralette:', e2.message);
    }
  }

  // Take a screenshot to confirm current state
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'debug-after-paralette-click.jpg'), type: 'jpeg' });
  console.log('Current state screenshot saved');

  await sleep(2000);

  // Check if __three3d API is available
  const hasAPI = await page.evaluate(() => typeof window.__three3d !== 'undefined');
  console.log('window.__three3d available:', hasAPI);

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
    }
    await sleep(800);

    const filePath = path.join(SCREENSHOTS_DIR, view.file);
    await page.screenshot({ path: filePath, type: 'jpeg', quality: 92 });
    console.log(`Saved: ${filePath}`);
  }

  // Restore UI
  if (hasAPI) {
    console.log('Restoring UI...');
    await page.evaluate(() => window.__three3d.showUI());
    await sleep(500);
  }

  await browser.close();
  console.log('Done!');
})();
