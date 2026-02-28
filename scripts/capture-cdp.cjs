const { chromium } = require('playwright');

(async () => {
  // Connect to the MCP Chrome browser that has GPU/WebGL support
  // The MCP Chrome main process uses the user data dir - find the remote debugging port
  const browser = await chromium.connectOverCDP('http://localhost:61823');
  console.log('Connected to browser');

  const contexts = browser.contexts();
  console.log('Contexts:', contexts.length);

  let page;
  if (contexts.length > 0) {
    const pages = contexts[0].pages();
    console.log('Pages:', pages.length);
    if (pages.length > 0) {
      page = pages[0];
      console.log('Using existing page:', await page.url());
    } else {
      page = await contexts[0].newPage();
    }
  } else {
    const context = await browser.newContext();
    page = await context.newPage();
  }

  await page.setViewportSize({ width: 1200, height: 900 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('http://localhost:5173');
  await page.waitForTimeout(5000);

  // Check WebGL and __three3d
  const check1 = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const gl = canvas ? (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) : null;
    return {
      hasCanvas: !!canvas,
      hasWebGL: !!gl,
      three3dType: typeof window.__three3d,
      three3dKeys: window.__three3d ? Object.keys(window.__three3d) : []
    };
  });
  console.log('Check 1:', JSON.stringify(check1));

  // Hover to open project switcher, click Paralette
  await page.locator('text=Projects').first().hover();
  await page.waitForTimeout(500);
  await page.locator('text=Paralette').first().click();
  await page.waitForTimeout(4000);

  const check2 = await page.evaluate(() => {
    return {
      three3dType: typeof window.__three3d,
      three3dKeys: window.__three3d ? Object.keys(window.__three3d) : []
    };
  });
  console.log('Check 2 (after Paralette switch):', JSON.stringify(check2));

  // Extract parameter values
  const panelText = await page.evaluate(() => {
    return document.body.innerText;
  });
  console.log('Panel snippet:', panelText.substring(0, 800));

  if (check2.three3dType !== 'undefined') {
    console.log('API available! Using camera controls...');

    // Hide UI
    await page.evaluate(() => window.__three3d.hideUI());
    await page.waitForTimeout(300);

    // Front
    await page.evaluate(() => window.__three3d.setCameraView('front'));
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'screenshots/paralette-iter6d-front.png', type: 'png' });
    console.log('Front done');

    // Right
    await page.evaluate(() => window.__three3d.setCameraView('right'));
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'screenshots/paralette-iter6d-right.png', type: 'png' });
    console.log('Right done');

    // Perspective
    await page.evaluate(() => window.__three3d.setCameraView('perspective'));
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'screenshots/paralette-iter6d-perspective.png', type: 'png' });
    console.log('Perspective done');

    // Restore UI
    await page.evaluate(() => window.__three3d.showUI());
    await page.waitForTimeout(300);
  } else {
    console.log('API still not available - taking screenshots without camera control');

    // Manually hide UI overlay elements
    await page.evaluate(() => {
      const root = document.querySelector('.relative');
      if (root) {
        Array.from(root.children).forEach((child) => {
          const el = child;
          if (el.tagName.toLowerCase() !== 'canvas' && !el.querySelector('canvas')) {
            el._savedDisplay = el.style.display;
            el.style.display = 'none';
          }
        });
      }
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'screenshots/paralette-iter6d-front.png', type: 'png' });
    await page.screenshot({ path: 'screenshots/paralette-iter6d-right.png', type: 'png' });
    await page.screenshot({ path: 'screenshots/paralette-iter6d-perspective.png', type: 'png' });

    await page.evaluate(() => {
      const root = document.querySelector('.relative');
      if (root) {
        Array.from(root.children).forEach((child) => {
          const el = child;
          if (el._savedDisplay !== undefined) {
            el.style.display = el._savedDisplay;
            delete el._savedDisplay;
          }
        });
      }
    });
  }

  console.log('Console errors count:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.log('First error:', consoleErrors[0]);
  }

  await browser.close();
})().catch(console.error);
