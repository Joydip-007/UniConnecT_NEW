const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--force-device-scale-factor=2'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
  await page.goto('file:///Users/joydipdatta/UniConnecT_NEW/mockups/feed-redesign.html', {
    waitUntil: 'networkidle0',
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({
    path: '/Users/joydipdatta/UniConnecT_NEW/mockups/feed-redesign.png',
    fullPage: true,
  });
  await browser.close();
  console.log('done');
})();
