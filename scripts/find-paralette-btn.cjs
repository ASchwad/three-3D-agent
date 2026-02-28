const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 900 });

  console.log('Navigating...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 2000));

  // Take a screenshot to see what the UI looks like
  await page.screenshot({ path: 'screenshots/debug-ui.jpg', type: 'jpeg' });
  console.log('Saved debug UI screenshot');

  // Log all buttons with text
  const buttons = await page.$$eval('button, [role="button"], [role="tab"]', els =>
    els.map(el => ({ tag: el.tagName, text: el.textContent?.trim(), class: el.className }))
  );
  console.log('All buttons:', JSON.stringify(buttons, null, 2));

  // Also log all visible text nodes
  const allText = await page.evaluate(() => {
    const texts = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walker.nextNode()) {
      const t = node.textContent.trim();
      if (t && t.length > 1 && t.length < 100) {
        texts.push(t);
      }
    }
    return [...new Set(texts)];
  });
  console.log('All text nodes:', allText);

  await browser.close();
})();
