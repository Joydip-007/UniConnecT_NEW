// Usage: node scripts/screenshot.cjs <name|all>
// Saves to screenshots/<name>.png — run after any UI change to keep references fresh.
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Must match AuthLoader.tsx's DEV_MOCK_USER.id and devMocks.ts's DEV_PROFILE.id —
// ProfilePage's isOwnProfile check compares this against the fetched profile's id.
const DEV_USER_ID = '11111111-1111-4111-8111-111111111111';

const PUBLIC_CAPTURE_MATRIX = [
  { suffix: '',               w: 1440, h: 900, theme: 'dark' },
  { suffix: '-light',         w: 1440, h: 900, theme: 'light' },
  { suffix: '-mobile',        w: 390,  h: 844, theme: 'dark' },
  { suffix: '-mobile-light',  w: 390,  h: 844, theme: 'light' },
];

function buildPublicRoutes(name, routePath) {
  return Object.fromEntries(
    PUBLIC_CAPTURE_MATRIX.map((variant) => [
      `${name}${variant.suffix}`,
      { path: routePath, auth: false, ...variant },
    ]),
  );
}

// Route map — add new entries as pages are built in Figma
const ROUTES = {
  ...buildPublicRoutes('landing', '/'),
  ...buildPublicRoutes('about', '/about'),
  'login':       { path: '/login',                    auth: false, w: 1440, h: 900  },
  'login-mob':   { path: '/login',                    auth: false, w: 390,  h: 844  },
  'register':    { path: '/register',                 auth: false, w: 1440, h: 900  },
  'otp':         { path: '/otp',                      auth: false, w: 1440, h: 900  },
  'feed':        { path: '/feed',                     auth: true,  w: 1440, h: 900  },
  'profile':     { path: `/profile/${DEV_USER_ID}`,   auth: true,  w: 1440, h: 900  },
  'learn':       { path: '/learn',                    auth: true,  w: 1440, h: 900  },
};

async function capture(name, route) {
  const outDir = path.join(__dirname, '..', 'screenshots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const out = path.join(outDir, `${name}.png`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: route.w, height: route.h, deviceScaleFactor: 2 });
  if (route.theme) {
    await page.evaluateOnNewDocument((theme) => {
      try {
        localStorage.setItem('uc.theme', theme);
      } catch {}
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.setAttribute('data-theme-mode', theme);
    }, route.theme);
  }

  const url = `http://localhost:5173${route.path}${route.auth ? '?dev-auth=1' : ''}`;
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
  await page.addStyleTag({
    content: `
      .tsqd-open-btn-container,
      .tsqd-open-btn {
        display: none !important;
      }
    `,
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: route.w, height: route.h } });
  await browser.close();
  console.log(`✓ ${name.padEnd(12)} → screenshots/${name}.png`);
}

(async () => {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: node scripts/screenshot.cjs <name|all>\nNames:', Object.keys(ROUTES).join(', '));
    process.exit(1);
  }
  const names = target === 'all' ? Object.keys(ROUTES) : [target];
  for (const name of names) {
    if (!ROUTES[name]) { console.error(`Unknown page: ${name}`); process.exit(1); }
    await capture(name, ROUTES[name]);
  }
})();
