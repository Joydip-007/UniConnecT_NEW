import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('https://cdn.21st.dev/mdafsarx/hover-footer/default/bundle.1760085852601.html?theme=dark&dark=true', { waitUntil: 'networkidle' });

  // Take screenshot
  await page.screenshot({ path: 'demo_screenshot.png', fullPage: true });
  console.log('Saved demo screenshot to demo_screenshot.png');

  await browser.close();
})();
