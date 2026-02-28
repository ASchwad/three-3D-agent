const { chromium } = require('playwright');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');
const BASE_URL = 'http://localhost:5173';
const VIEWPORT = { width: 1200, height: 900 };

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

  // Step 1: Hover over the project switcher top-left to open it
  console.log('Hovering over the project switcher area...');
  // Try hovering over the top-left region where the project switcher resides
  await page.mouse.move(100, 50);
  await sleep(800);

  // Take a screenshot to see the initial state
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'integrated-debug-initial.jpg'), type: 'jpeg' });

  // Step 2: Try to click the "Projects" or project switcher button
  console.log('Looking for Projects button or switcher...');

  // Try multiple selectors for the project switcher
  let projectSwitcherFound = false;

  // Try clicking "Projects" text
  try {
    await page.getByText('Projects', { exact: false }).first().click({ timeout: 3000 });
    await sleep(1000);
    console.log('Clicked Projects');
    projectSwitcherFound = true;
  } catch (e) {
    console.log('Could not click Projects text:', e.message);
  }

  if (!projectSwitcherFound) {
    // Try hovering and clicking the top-left area
    try {
      await page.mouse.move(112, 32);
      await sleep(500);
      await page.mouse.click(112, 32);
      await sleep(1000);
      console.log('Clicked top-left area');
      projectSwitcherFound = true;
    } catch (e) {
      console.log('Could not click top-left:', e.message);
    }
  }

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'integrated-debug-after-projects.jpg'), type: 'jpeg' });
  console.log('After projects click screenshot saved');

  // Step 3: Click on "Paralette" project
  console.log('Looking for Paralette project...');
  try {
    await page.getByText('Paralette', { exact: true }).first().click({ timeout: 3000 });
    await sleep(1500);
    console.log('Clicked Paralette');
  } catch (e) {
    console.log('Could not click Paralette by exact text:', e.message);
    try {
      await page.getByText('Paralette', { exact: false }).first().click({ timeout: 3000 });
      await sleep(1500);
      console.log('Clicked Paralette (case-insensitive)');
    } catch (e2) {
      console.log('Still could not find Paralette:', e2.message);
    }
  }

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'integrated-debug-after-paralette.jpg'), type: 'jpeg' });
  console.log('After Paralette click screenshot saved');

  // Wait for scene to fully render
  await sleep(2000);

  // Check if __three3d API is available
  const hasAPI = await page.evaluate(() => typeof window.__three3d !== 'undefined');
  console.log('window.__three3d available:', hasAPI);

  if (!hasAPI) {
    console.error('ERROR: window.__three3d API not available! Cannot proceed with camera controls.');
    await browser.close();
    return;
  }

  // Step 4: Hide UI panels
  console.log('Hiding UI panels...');
  await page.evaluate(() => window.__three3d.hideUI());
  await sleep(500);

  // Step 5: Front view
  console.log('Setting front view...');
  await page.evaluate(() => window.__three3d.setCameraView('front'));
  await sleep(500);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'paralette-integrated-front.png'),
    type: 'png',
  });
  console.log('Saved: paralette-integrated-front.png');

  // Step 6: Perspective view
  console.log('Setting perspective view...');
  await page.evaluate(() => window.__three3d.setCameraView('perspective'));
  await sleep(500);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'paralette-integrated-perspective.png'),
    type: 'png',
  });
  console.log('Saved: paralette-integrated-perspective.png');

  // Step 7: Close-up grip from angle
  console.log('Setting close-up grip angle...');
  await page.evaluate(() => window.__three3d.setCameraPosition(12, 68, 25, 0, 58, 0));
  await sleep(500);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'paralette-integrated-closeup.png'),
    type: 'png',
  });
  console.log('Saved: paralette-integrated-closeup.png');

  // Step 8: Side/right view
  console.log('Setting right/side view...');
  await page.evaluate(() => window.__three3d.setCameraView('right'));
  await sleep(500);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'paralette-integrated-side.png'),
    type: 'png',
  });
  console.log('Saved: paralette-integrated-side.png');

  // Step 9: Restore UI
  console.log('Restoring UI...');
  await page.evaluate(() => window.__three3d.showUI());
  await sleep(500);

  await browser.close();
  console.log('Done! All 4 screenshots captured.');
})();
