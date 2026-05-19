import puppeteer from 'puppeteer'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const REFRESH_TOKEN = process.env.REFRESH_TOKEN
if (!REFRESH_TOKEN) {
  console.error('REFRESH_TOKEN env required')
  process.exit(1)
}

const WEB = 'http://localhost:5173'
const API = 'http://localhost:4000'
const OUT_DIR = resolve(process.cwd(), '.impeccable/critique/shots')
await mkdir(OUT_DIR, { recursive: true })

const CHROME_PATH = process.env.CHROME_PATH ||
  '/Users/joydipdatta/.cache/puppeteer/chrome/mac_arm-148.0.7778.97/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'

const browser = await puppeteer.launch({
  headless: 'new',
  defaultViewport: null,
  executablePath: CHROME_PATH,
  args: ['--no-sandbox'],
})

const page = await browser.newPage()
await page.setCookie({
  name: 'refreshToken',
  value: REFRESH_TOKEN,
  domain: 'localhost',
  path: '/',
  httpOnly: true,
  secure: false,
  sameSite: 'Strict',
  url: API,
})
await page.evaluateOnNewDocument(() => {
  try { localStorage.setItem('uc:has_session', '1') } catch {}
})

async function snap(width, height, name, fullPage = false) {
  await page.setViewport({ width, height, deviceScaleFactor: 2 })
  const path = `${OUT_DIR}/${name}.png`
  await page.screenshot({ path, fullPage })
  console.log('wrote', path)
}

try {
  // Initial nav — authenticates, fetches feed
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })
  await page.goto(WEB, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 2000))

  await snap(1440, 900, 'feed-desktop-1440')
  await snap(1440, 900, 'feed-desktop-1440-full', true)

  await snap(1280, 800, 'feed-laptop-1280')

  // Resize to mobile — sticky sidebars hide via @media; let layout settle
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 })
  await new Promise((r) => setTimeout(r, 500))
  await snap(390, 844, 'feed-mobile-390')
  await snap(390, 844, 'feed-mobile-390-full', true)
} catch (err) {
  console.error('capture failed:', err.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
