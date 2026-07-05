import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Wait for the dev server to be ready
  let retries = 10;
  while (retries > 0) {
    try {
      await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 5000 });
      break;
    } catch (e) {
      retries--;
      if (retries === 0) throw e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Scroll to bottom to ensure footer is visible
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  
  // Wait a bit for any animations (like TextHoverEffect) to render
  await page.waitForTimeout(1000);

  // Take screenshot of the footer specifically, or the whole page if easier
  // We'll select the footer to only capture that part
  const footer = await page.$('.uc-landing-footer');
  if (footer) {
    await footer.screenshot({ path: 'footer_screenshot.png' });
    console.log('Saved footer screenshot to footer_screenshot.png');
  } else {
    await page.screenshot({ path: 'footer_screenshot.png', fullPage: true });
    console.log('Saved full page screenshot to footer_screenshot.png');
  }

  await browser.close();
})();
