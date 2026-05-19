import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

const CHROME_PATH = process.env.CHROME_PATH ||
  '/Users/joydipdatta/.cache/puppeteer/chrome/mac_arm-148.0.7778.97/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'

const WEB = process.env.WEB_URL || 'http://localhost:5173'
const API = process.env.API_URL || 'http://localhost:4000'
const OUT_DIR = resolve(process.cwd(), '.impeccable/critique/shots')
const DEBUG_PORT = Number(process.env.CHROME_DEBUG_PORT || 9333)
const REFRESH_TOKEN_FILE = process.env.REFRESH_TOKEN_FILE || '/private/tmp/uniconnect_refresh_token.txt'

await mkdir(OUT_DIR, { recursive: true })

const chrome = spawn(CHROME_PATH, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--disable-background-networking',
  '--disable-component-update',
  '--disable-sync',
  '--disable-extensions',
  '--disable-features=MediaRouter,OptimizationHints',
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=/private/tmp/uniconnect-cdp-shot-${Date.now()}`,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] })

chrome.stderr.on('data', () => {})

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

async function json(url, options) {
  const res = await fetch(url, options)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`)
  return res.json()
}

async function waitForBrowser() {
  const versionUrl = `http://127.0.0.1:${DEBUG_PORT}/json/version`
  for (let i = 0; i < 80; i += 1) {
    try {
      return await json(versionUrl)
    } catch {
      await sleep(100)
    }
  }
  throw new Error('Chrome DevTools did not become ready')
}

async function getRefreshToken() {
  if (process.env.REFRESH_TOKEN) return process.env.REFRESH_TOKEN
  try {
    return (await readFile(REFRESH_TOKEN_FILE, 'utf8')).trim()
  } catch {
    return ''
  }
}

let nextId = 1
let cookieSeeded = false
function createCdp(wsUrl) {
  const ws = new WebSocket(wsUrl)
  const pending = new Map()

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    if (!msg.id) return
    const pair = pending.get(msg.id)
    if (!pair) return
    pending.delete(msg.id)
    if (msg.error) pair.reject(new Error(msg.error.message))
    else pair.resolve(msg.result)
  })

  return new Promise((resolveCdp, rejectCdp) => {
    ws.addEventListener('open', () => {
      resolveCdp({
        send(method, params = {}) {
          const id = nextId
          nextId += 1
          ws.send(JSON.stringify({ id, method, params }))
          return new Promise((resolveSend, rejectSend) => {
            pending.set(id, { resolve: resolveSend, reject: rejectSend })
          })
        },
        close() {
          ws.close()
        },
      })
    })
    ws.addEventListener('error', rejectCdp)
  })
}

async function capture({ path, width, height, url }) {
  const refreshToken = await getRefreshToken()
  const tab = await json(`http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(url)}`, {
    method: 'PUT',
  })
  const cdp = await createCdp(tab.webSocketDebuggerUrl)
  await cdp.send('Page.enable')
  await cdp.send('Network.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: width < 600 ? 3 : 2,
    mobile: width < 600,
  })
  if (refreshToken && !cookieSeeded) {
    await cdp.send('Network.setCookie', {
      name: 'refreshToken',
      value: refreshToken,
      url: API,
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
    })
    cookieSeeded = true
  }
  if (refreshToken) {
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: "try { localStorage.setItem('uc:has_session', '1') } catch {}",
    })
  }
  await cdp.send('Page.navigate', { url })
  await sleep(2500)
  await cdp.send('Runtime.evaluate', {
    expression: "document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()",
    awaitPromise: true,
  })
  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  })
  await writeFile(path, Buffer.from(shot.data, 'base64'))
  console.log('wrote', path)
  cdp.close()
}

try {
  await waitForBrowser()
  const prefix = (await getRefreshToken()) ? 'feed-auth' : 'feed-unauth'
  await capture({
    url: `${WEB}/feed`,
    width: 1440,
    height: 900,
    path: `${OUT_DIR}/${prefix}-desktop-1440.png`,
  })
  await capture({
    url: `${WEB}/feed`,
    width: 390,
    height: 844,
    path: `${OUT_DIR}/${prefix}-mobile-390.png`,
  })
} finally {
  chrome.kill('SIGTERM')
}
