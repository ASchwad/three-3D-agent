const { chromium } = require('playwright');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');
const BASE_URL = 'http://localhost:5173';
const VIEWPORT = { width: 1200, height: 900 };

const VIEWS = [
  { name: 'front', key: 'front', file: 'paralette-current-front.png' },
  { name: 'right', key: 'right', file: 'paralette-current-right.png' },
  { name: 'top', key: 'top', file: 'paralette-current-top.png' },
  { name: 'perspective', key: 'perspective', file: 'paralette-current-perspective.png' },
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

  // Wait for initial render
  await sleep(3000);

  // Switch to Paralette project if needed
  console.log('Checking for Paralette project in switcher...');
  try {
    // Look for a project switcher button or tab labeled "Paralette"
    const paraletteBtns = await page.$$('button, [role="tab"], [role="menuitem"]');
    let found = false;
    for (const btn of paraletteBtns) {
      const text = await btn.textContent();
      if (text && text.trim().toLowerCase().includes('paralette')) {
        console.log('Clicking Paralette project button:', text.trim());
        await btn.click();
        found = true;
        await sleep(1500);
        break;
      }
    }
    if (!found) {
      console.log('Paralette button not found by text - checking current active project via DOM');
    }
  } catch (e) {
    console.log('Error switching project:', e.message);
  }

  await sleep(2000);

  // Check if __three3d API is available
  const hasAPI = await page.evaluate(() => typeof window.__three3d !== 'undefined');
  console.log('window.__three3d available:', hasAPI);

  // Hide UI panels
  if (hasAPI) {
    console.log('Hiding UI panels...');
    await page.evaluate(() => {
      if (typeof window.__three3d?.hideUI === 'function') {
        window.__three3d.hideUI();
      }
    });
    await sleep(500);
  }

  // Capture each view
  for (const view of VIEWS) {
    console.log(`Setting camera to ${view.name} view...`);

    if (hasAPI) {
      await page.evaluate((viewKey) => {
        if (typeof window.__three3d?.setCameraView === 'function') {
          window.__three3d.setCameraView(viewKey);
        }
      }, view.key);
    }

    await sleep(800);

    const filePath = path.join(SCREENSHOTS_DIR, view.file);
    await page.screenshot({ path: filePath, type: 'jpeg', quality: 90 });
    console.log(`Saved: ${filePath}`);
  }

  // Restore UI
  if (hasAPI) {
    console.log('Restoring UI...');
    await page.evaluate(() => {
      if (typeof window.__three3d?.showUI === 'function') {
        window.__three3d.showUI();
      }
    });
  }

  await browser.close();
  console.log('Done!');
})();
