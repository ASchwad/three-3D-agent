const { chromium } = require('playwright');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');
const BASE_URL = 'http://localhost:5173';
const VIEWPORT = { width: 1200, height: 900 };

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  // Use headless: false to ensure WebGL works properly
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewportSize(VIEWPORT);

  // Log console errors for debugging
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('PAGE ERROR:', msg.text());
  });

  console.log('Navigating to', BASE_URL);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await sleep(3000);

  // Check for WebGL support
  const hasWebGL = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  });
  console.log('WebGL available:', hasWebGL);

  // Check window.__three3d availability first
  let hasAPI = await page.evaluate(() => typeof window.__three3d !== 'undefined');
  console.log('Initial __three3d available:', hasAPI);

  // Look at the DOM to understand the current state
  const domInfo = await page.evaluate(() => {
    return {
      title: document.title,
      canvasCount: document.querySelectorAll('canvas').length,
      bodyText: document.body.innerText.substring(0, 200),
      allKeys: Object.keys(window).filter(k => k.startsWith('__'))
    };
  });
  console.log('DOM info:', JSON.stringify(domInfo, null, 2));

  // Switch to Paralette project
  console.log('Switching to Paralette project via hover...');

  // Hover to open the projects dropdown
  const projectsEl = await page.getByText('Projects', { exact: false }).first();
  await projectsEl.hover();
  await sleep(800);

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'iter8-v3-hover.jpg'), type: 'jpeg' });

  // Now click Paralette
  try {
    const paraletteBtn = await page.getByRole('button', { name: /paralette/i }).first();
    await paraletteBtn.click({ timeout: 3000 });
    await sleep(2000);
    console.log('Clicked Paralette button');
  } catch (e) {
    console.log('Button approach failed:', e.message);
    try {
      await page.getByText('Paralette', { exact: true }).first().click({ timeout: 3000 });
      await sleep(2000);
      console.log('Clicked Paralette text');
    } catch (e2) {
      console.log('Still failed:', e2.message);
    }
  }

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'iter8-v3-after-switch.jpg'), type: 'jpeg' });

  // Wait longer for the 3D scene to initialize
  console.log('Waiting for __three3d API (extended)...');
  for (let i = 0; i < 50; i++) {
    hasAPI = await page.evaluate(() => typeof window.__three3d !== 'undefined');
    if (hasAPI) {
      console.log(`API found after ${i * 300}ms`);
      break;
    }
    await sleep(300);
  }
  console.log('window.__three3d available:', hasAPI);

  if (!hasAPI) {
    console.log('API still not available. Checking window keys...');
    const windowKeys = await page.evaluate(() => Object.keys(window).filter(k => k.startsWith('__') || k.includes('three') || k.includes('Three')));
    console.log('Relevant window keys:', windowKeys);

    // Check if Canvas rendered
    const canvasInfo = await page.evaluate(() => {
      const canvases = Array.from(document.querySelectorAll('canvas'));
      return canvases.map(c => ({ width: c.width, height: c.height, class: c.className }));
    });
    console.log('Canvas elements:', JSON.stringify(canvasInfo));
  }

  if (hasAPI) {
    const apiMethods = await page.evaluate(() => Object.keys(window.__three3d));
    console.log('API methods:', apiMethods);
  }

  // Give the 3D scene extra time to fully render
  await sleep(2000);

  // Hide UI panels
  if (hasAPI) {
    console.log('Hiding UI panels...');
    await page.evaluate(() => window.__three3d.hideUI());
    await sleep(800);
  }

  const views = [
    { name: 'front', file: 'paralette-iter8-front.png' },
    { name: 'right', file: 'paralette-iter8-right.png' },
    { name: 'perspective', file: 'paralette-iter8-perspective.png' },
  ];

  for (const view of views) {
    console.log(`Capturing ${view.name} view...`);
    if (hasAPI) {
      const result = await page.evaluate((v) => window.__three3d.setCameraView(v), view.name);
      console.log(`setCameraView ${view.name} result:`, result);
    }
    await sleep(1200);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, view.file),
      type: 'png'
    });
    console.log(`Saved: ${view.file}`);
  }

  // Restore UI
  if (hasAPI) {
    console.log('Restoring UI...');
    await page.evaluate(() => window.__three3d.showUI());
  }

  await browser.close();
  console.log('Done!');
})();
