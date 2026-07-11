# Azure Student Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make 3 targeted code changes (env, Redis, upload service), fix packages/shared for production Node.js, and create a GitHub Actions workflow that deploys the Express API to Azure App Service B1.

**Architecture:** The monorepo's `packages/shared` currently exports raw TypeScript source — fine for Vite and ts-node-dev, but Node.js `require()` in production can't execute `.ts` files. Task 1 fixes this by adding a CommonJS build step and conditional exports. Tasks 2–4 are the 3 mechanical code changes for Cloudflare R2 and Upstash. Task 5 wires the GitHub Actions CI/CD pipeline.

**Tech Stack:** pnpm workspaces · TypeScript · GitHub Actions · Azure App Service B1 · Neon PostgreSQL · Upstash Redis (ioredis + Bull) · Cloudflare R2 (AWS SDK v3) · Vercel (frontend, untouched)

---

## File Map

| Status | Path | Change |
|---|---|---|
| Modify | `packages/shared/tsconfig.json` | Output CommonJS instead of ESNext |
| Modify | `packages/shared/package.json` | Add build/dev scripts; conditional exports; remove `"type":"module"` |
| Modify | `.gitignore` | Add `dist/` to ignore list |
| Modify | `apps/api/src/config/env.ts` | Add `AWS_ENDPOINT` + `AWS_PUBLIC_URL` |
| Modify | `apps/api/src/config/redis.ts` | Add `tls:{}` for `rediss://` URLs |
| Modify | `apps/api/src/services/upload.service.ts` | Pass R2 endpoint; build correct public URL |
| Create | `.github/workflows/deploy-api.yml` | Build + deploy to Azure App Service |

---

## Task 1: Fix packages/shared for production Node.js

**Files:**
- Modify: `packages/shared/tsconfig.json`
- Modify: `packages/shared/package.json`
- Modify: `.gitignore`

**Why this is needed:** `packages/shared` currently exports `"./src/index.ts"` as its main entry. Vite and
`ts-node-dev` handle TypeScript natively so local dev works. In production, `node dist/server.js`
calls `require('@uniconnect/shared')` — Node.js follows the `exports` map, finds a `.ts` file, and
crashes. The fix: compile shared to CommonJS and add a `"require"` condition in `exports` that
points to the compiled output, while keeping `"default"` on the TypeScript source so Vite and
ts-node-dev continue working unchanged.

- [ ] **Step 1: Update tsconfig.json for CommonJS output**

Replace the entire contents of `packages/shared/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Update package.json — scripts, exports, remove `"type":"module"`**

Replace the entire contents of `packages/shared/package.json`:

```json
{
  "name": "@uniconnect/shared",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "require": "./dist/index.js",
      "default": "./src/index.ts"
    },
    "./types": {
      "types": "./src/types/index.ts",
      "require": "./dist/types/index.js",
      "default": "./src/types/index.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.5.3"
  },
  "dependencies": {
    "zod": "^4.4.3"
  }
}
```

> **What changed and why:**
> - Removed `"type": "module"` — without this, Node.js treats `.js` output as CommonJS, matching
>   the `"module": "CommonJS"` tsconfig setting.
> - `"require": "./dist/index.js"` — Node.js `require()` in production hits this condition. ✓
> - `"default": "./src/index.ts"` — Vite (bundler) and ts-node-dev both fall back to `default`
>   and get the TypeScript source, exactly as before. ✓
> - Added `build` and `dev` scripts. `pnpm dev` at root (parallel) will run `tsc --watch` for
>   shared alongside the API and web dev servers.

- [ ] **Step 3: Add `dist/` to root .gitignore**

The current `.gitignore` only ignores `node_modules` and `.pnpm-store`. Add `dist/` so the
compiled shared output isn't committed.

Replace `.gitignore` with:

```gitignore
node_modules
.pnpm-store
dist/
*.tsbuildinfo
```

- [ ] **Step 4: Build shared and verify**

```bash
cd /path/to/repo
npx pnpm --filter @uniconnect/shared build
```

Expected: `packages/shared/dist/` is created with `index.js`, `index.d.ts`, and a `types/`
subdirectory. No TypeScript errors.

Verify the output is CommonJS:

```bash
head -3 packages/shared/dist/index.js
```

Expected output contains `"use strict"` and `Object.defineProperty(exports, ...)` — CommonJS
syntax, not ESM `export`.

- [ ] **Step 5: Verify API dev still works (ts-node-dev uses `default` condition)**

```bash
npx pnpm --filter api typecheck
```

Expected: `0 errors`. The API tsconfig still resolves `@uniconnect/shared` through TypeScript
paths (it reads `"types": "./src/index.ts"` for type information), so nothing changes for type
checking.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/tsconfig.json packages/shared/package.json .gitignore
git commit -m "chore(shared): compile to CommonJS for production Node.js compatibility"
```

---

## Task 2: Add Cloudflare R2 env vars to env schema

**Files:**
- Modify: `apps/api/src/config/env.ts`

- [ ] **Step 1: Add two optional fields to envSchema**

In `apps/api/src/config/env.ts`, add the two lines marked `+` after `AWS_SECRET_ACCESS_KEY`:

```typescript
// Before:
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  OTP_EXPIRES_MINUTES: ...

// After:
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_ENDPOINT: z.string().url().optional(),    // Cloudflare R2: https://<accountid>.r2.cloudflarestorage.com
  AWS_PUBLIC_URL: z.string().url().optional(),  // R2 public bucket base URL: https://pub-<hash>.r2.dev
  OTP_EXPIRES_MINUTES: ...
```

The full updated `apps/api/src/config/env.ts`:

```typescript
import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  CLIENT_URL: z.string().optional(),
  WEB_URL: z.string().optional(),
  DATABASE_URL: z.string().default('postgresql://postgres@localhost:5432/uniconnect_db'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32).default('development-jwt-secret-change-before-production'),
  JWT_REFRESH_SECRET: z.string().min(32).default('development-refresh-secret-change-before-production'),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  AWS_REGION: z.string().default('ap-southeast-1'),
  AWS_S3_BUCKET: z.string().default('uniconnect-local'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_ENDPOINT: z.string().url().optional(),    // Cloudflare R2 endpoint
  AWS_PUBLIC_URL: z.string().url().optional(),  // R2 public bucket base URL
  OTP_EXPIRES_MINUTES: z.coerce.number().int().positive().default(10),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
  DEV_INVITE_TOKEN: z.string().default('dev-invite'),
  DEV_INVITE_EMAIL: z.string().email().default('student@uiu.ac.bd'),
  DEV_INVITE_ROLE: z.enum(['student', 'alumni', 'faculty', 'admin']).default('student'),
})

const parsedEnv = envSchema.parse(process.env)
const clientUrl = parsedEnv.CLIENT_URL ?? parsedEnv.WEB_URL ?? 'http://localhost:5173'
const resendFromEmail = parsedEnv.RESEND_FROM_EMAIL ?? parsedEnv.EMAIL_FROM ?? 'UniConnecT <noreply@uniconnectt.me>'

export const env = {
  ...parsedEnv,
  CLIENT_URL: clientUrl,
  WEB_URL: clientUrl.split(",")[0].trim(),
  RESEND_FROM_EMAIL: resendFromEmail,
  EMAIL_FROM: resendFromEmail,
}

export type Env = typeof env
```

- [ ] **Step 2: Run typecheck to verify**

```bash
npx pnpm --filter api typecheck
```

Expected: `0 errors`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/config/env.ts
git commit -m "feat(api): add AWS_ENDPOINT and AWS_PUBLIC_URL env vars for Cloudflare R2"
```

---

## Task 3: Add Upstash TLS support to Redis client

**Files:**
- Modify: `apps/api/src/config/redis.ts`

**Context:** Upstash connection strings start with `rediss://` (double-s = TLS required). ioredis v5
handles `rediss://` URLs but needs an explicit `tls: {}` option to enable TLS handshake. Without it,
the connection attempt fails with `ERR_SSL_WRONG_VERSION_NUMBER`. Bull queues (`apps/api/src/queues/`)
pass `env.REDIS_URL` directly to Bull v4, which uses ioredis v4 internally — that version also
handles `rediss://` URLs natively, so those files do not need to change.

- [ ] **Step 1: Add TLS detection**

Replace the entire contents of `apps/api/src/config/redis.ts`:

```typescript
import Redis from 'ioredis'
import { env } from './env'

const isTls = env.REDIS_URL.startsWith('rediss://')

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 3) return null
    return 500
  },
  ...(isTls && { tls: {} }),
})

export async function pingRedis() {
  if (redis.status === 'wait') {
    await redis.connect()
  }

  await redis.ping()
}
```

- [ ] **Step 2: Run typecheck**

```bash
npx pnpm --filter api typecheck
```

Expected: `0 errors`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/config/redis.ts
git commit -m "feat(api): add TLS support for Upstash Redis (rediss:// URLs)"
```

---

## Task 4: Update upload service for Cloudflare R2

**Files:**
- Modify: `apps/api/src/services/upload.service.ts`

**Context:** Cloudflare R2 is S3-compatible but requires two differences from AWS:
1. A custom endpoint passed to `S3Client` (`https://<accountid>.r2.cloudflarestorage.com`).
2. Public file URLs use R2's CDN pattern (`https://pub-<hash>.r2.dev/<key>`) not the Amazon URL.
When `AWS_ENDPOINT` / `AWS_PUBLIC_URL` are unset (local dev), the service falls back to the
existing Amazon URL pattern — no dev workflow change.

- [ ] **Step 1: Replace the full file**

Replace the entire contents of `apps/api/src/services/upload.service.ts`:

```typescript
import { randomUUID } from 'node:crypto'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '../config/env'

export const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials:
    env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
  ...(env.AWS_ENDPOINT && {
    endpoint: env.AWS_ENDPOINT,   // https://<accountid>.r2.cloudflarestorage.com
    forcePathStyle: false,        // R2 uses virtual-hosted-style (default for R2)
  }),
})

export interface CreateUploadCommandInput {
  fileName: string
  contentType: string
  folder?: string
}

export interface PresignedUpload {
  uploadUrl: string
  publicUrl: string
}

export function createUploadKey(input: CreateUploadCommandInput) {
  const safeFileName = sanitizeFileName(input.fileName)
  const folder = input.folder?.replace(/^\/+|\/+$/g, '') || 'uploads'
  return `${folder}/${randomUUID()}-${safeFileName}`
}

export function createPutObjectCommand(input: CreateUploadCommandInput) {
  const key = createUploadKey(input)

  return {
    key,
    command: new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
      ContentType: input.contentType,
    }),
  }
}

export async function getPresignedUploadUrl(key: string, contentType: string): Promise<PresignedUpload> {
  const command = new PutObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: key,
    ContentType: contentType,
  })

  return {
    uploadUrl: await getSignedUrl(s3Client, command, { expiresIn: 300 }),
    publicUrl: buildPublicUrl(key),
  }
}

/** Returns the public CDN URL for a stored object key. */
export function buildPublicUrl(key: string): string {
  if (env.AWS_PUBLIC_URL) {
    return `${env.AWS_PUBLIC_URL}/${encodeS3Key(key)}`
  }
  return `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${encodeS3Key(key)}`
}

export const uploadService = {
  getPresignedUploadUrl,
}

export function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-')
}

function encodeS3Key(key: string) {
  return key.split('/').map(encodeURIComponent).join('/')
}
```

> `buildPublicUrl` is extracted as a named export to make it unit-testable without mocking S3.

- [ ] **Step 2: Write a unit test for `buildPublicUrl`**

Create `apps/api/src/services/upload.service.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => {
  vi.resetModules()
})

describe('buildPublicUrl', () => {
  it('uses AWS_PUBLIC_URL when set', async () => {
    vi.stubEnv('AWS_PUBLIC_URL', 'https://pub-abc123.r2.dev')
    vi.stubEnv('AWS_S3_BUCKET', 'uniconnect-uploads')
    vi.stubEnv('AWS_REGION', 'auto')
    const { buildPublicUrl } = await import('./upload.service')
    expect(buildPublicUrl('avatars/test-file.jpg')).toBe(
      'https://pub-abc123.r2.dev/avatars/test-file.jpg',
    )
  })

  it('falls back to Amazon URL when AWS_PUBLIC_URL is not set', async () => {
    vi.stubEnv('AWS_PUBLIC_URL', '')
    vi.stubEnv('AWS_S3_BUCKET', 'my-bucket')
    vi.stubEnv('AWS_REGION', 'ap-southeast-1')
    const { buildPublicUrl } = await import('./upload.service')
    expect(buildPublicUrl('uploads/foo.png')).toBe(
      'https://my-bucket.s3.ap-southeast-1.amazonaws.com/uploads/foo.png',
    )
  })

  it('URL-encodes special characters in the key', async () => {
    vi.stubEnv('AWS_PUBLIC_URL', 'https://pub-abc123.r2.dev')
    const { buildPublicUrl } = await import('./upload.service')
    expect(buildPublicUrl('uploads/my file (1).jpg')).toBe(
      'https://pub-abc123.r2.dev/uploads/my%20file%20(1).jpg',
    )
  })
})
```

- [ ] **Step 3: Run the unit test**

```bash
npx pnpm --filter api test src/services/upload.service.test.ts
```

Expected output: all 3 tests pass.

> Note: `vi.stubEnv` requires Vitest v1+. The project uses Vitest v2 so this works as-is.

- [ ] **Step 4: Run full typecheck + lint**

```bash
npx pnpm typecheck && npx pnpm lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/upload.service.ts apps/api/src/services/upload.service.test.ts
git commit -m "feat(upload): support Cloudflare R2 endpoint and public URL override"
```

---

## Task 5: Create GitHub Actions workflow for Azure App Service

**Files:**
- Create: `.github/workflows/deploy-api.yml`

**How it works:**
1. Triggers on push to `main` when API-related files change.
2. Installs pnpm, runs the full build (shared → api).
3. Uses `pnpm deploy` to create a self-contained production directory (no dev deps, no workspace
   symlinks — just the API and its runtime node_modules).
4. Copies the compiled `dist/` into the deploy directory.
5. Uploads to Azure App Service via publish profile.

**Pre-requisite (one-time in Azure Portal):**
- Create the App Service (B1, Node 20 LTS, Linux, Singapore region)
- Enable **Always On**: Configuration → General settings → Always On → On
- Enable **Web Sockets**: Configuration → General settings → Web sockets → On
- Download the Publish Profile: Overview → Get publish profile → copy the XML
- In GitHub: Settings → Secrets → Actions → add `AZURE_WEBAPP_PUBLISH_PROFILE` (paste the XML)
- Also add `AZURE_WEBAPP_NAME` with your App Service name (e.g. `uniconnect-api`)

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/deploy-api.yml`:

```yaml
name: Deploy API → Azure App Service

on:
  push:
    branches: [main]
    paths:
      - 'apps/api/**'
      - 'packages/shared/**'
      - 'package.json'
      - 'pnpm-lock.yaml'
      - 'pnpm-workspace.yaml'
      - '.github/workflows/deploy-api.yml'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment: production

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install pnpm
        run: npm install -g pnpm@9

      - name: Install all dependencies
        run: pnpm install --frozen-lockfile

      - name: Build shared package
        run: pnpm --filter @uniconnect/shared build

      - name: Build API
        run: pnpm --filter api build

      - name: Create standalone production package
        run: |
          pnpm --filter api deploy --prod /tmp/api-deploy
          # pnpm deploy copies runtime node_modules but not the compiled dist/
          # Copy it explicitly
          cp -r apps/api/dist /tmp/api-deploy/dist

      - name: Deploy to Azure App Service
        uses: azure/webapps-deploy@v3
        with:
          app-name: ${{ secrets.AZURE_WEBAPP_NAME }}
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          package: /tmp/api-deploy
```

- [ ] **Step 2: Set the Azure App Service startup command**

In Azure Portal → App Service → Configuration → General settings → Startup Command:

```
node dist/db/migrate.js latest && node dist/server.js
```

This runs pending migrations before each boot. `dist/db/migrate.js latest` is the compiled version
of `apps/api/src/db/migrate.ts` — already present from the `pnpm --filter api build` step.

- [ ] **Step 3: Set all environment variables in Azure Portal**

Azure Portal → App Service → Configuration → Application Settings → add each:

| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon connection string (from neon.tech dashboard — includes `?sslmode=require`) |
| `REDIS_URL` | Upstash connection string (from upstash.com dashboard — starts with `rediss://`) |
| `JWT_SECRET` | 64-character random string (generate: `openssl rand -hex 32`) |
| `JWT_REFRESH_SECRET` | 64-character random string (different from JWT_SECRET) |
| `CLIENT_URL` | `https://uniconnectt.me,https://www.uniconnectt.me` |
| `AWS_REGION` | `auto` |
| `AWS_S3_BUCKET` | `uniconnect-uploads` |
| `AWS_ACCESS_KEY_ID` | R2 Access Key ID (from Cloudflare → R2 → Manage API Tokens) |
| `AWS_SECRET_ACCESS_KEY` | R2 Secret Access Key |
| `AWS_ENDPOINT` | `https://<your-accountid>.r2.cloudflarestorage.com` |
| `AWS_PUBLIC_URL` | `https://files.uniconnectt.me` (or `https://pub-<hash>.r2.dev` if no custom domain yet) |
| `RESEND_API_KEY` | From resend.com dashboard |
| `RESEND_FROM_EMAIL` | `UniConnecT <noreply@uniconnectt.me>` |
| `GEMINI_API_KEY` | Google Gemini API key for AI generation features |

> **Custom domain for the API:** After deploy, add `api.uniconnectt.me` as a custom domain in
> Azure Portal → App Service → Custom domains → Add custom domain. Point the DNS A record at
> Cloudflare (or your registrar) to the App Service's outbound IP. Then update `VITE_API_URL`
> and `VITE_SOCKET_URL` on Vercel to use `https://api.uniconnectt.me` instead of the
> `.azurewebsites.net` URL.

- [ ] **Step 4: Set Vercel environment variables**

Vercel → Project → Settings → Environment Variables → add:

| Name | Value |
|---|---|
| `VITE_API_URL` | `https://api.uniconnectt.me` (or `https://<app>.azurewebsites.net` before custom domain is wired) |
| `VITE_SOCKET_URL` | `https://api.uniconnectt.me` (same as above) |
| `VITE_UNIVERSITY_DOMAIN` | `uiu.ac.bd` |

Also add `uniconnectt.me` and `www.uniconnectt.me` as custom domains in Vercel → Project →
Settings → Domains. Point the DNS records as Vercel instructs (A record / CNAME in your
registrar).

Trigger a redeploy on Vercel after setting variables.

- [ ] **Step 5: Set up Cloudflare R2 CORS policy**

In Cloudflare → R2 → `uniconnect-uploads` bucket → Settings → CORS Policy → Add rule:

```json
[
  {
    "AllowedOrigins": [
      "https://uniconnectt.me",
      "https://www.uniconnectt.me",
      "http://localhost:5173"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

Without this, the browser's presigned PUT request to R2 will be blocked by CORS.

- [ ] **Step 6: Commit and push to trigger deploy**

```bash
git add .github/workflows/deploy-api.yml
git commit -m "chore(ci): add GitHub Actions workflow for Azure App Service deployment"
git push origin main
```

Watch the Actions tab in GitHub — the workflow should run and deploy the API.

---

## Task 6: End-to-End Verification

Run these checks after the first successful deployment.

- [ ] **Step 1: Verify API is up**

```bash
curl https://api.uniconnectt.me/health
# or before custom domain is wired:
curl https://<your-app>.azurewebsites.net/health
```

Expected: `200 OK` with JSON body `{ "status": "ok" }` (or similar health response).

If 503: check Azure Portal → App Service → Log stream for startup errors.

- [ ] **Step 2: Verify database connection**

The startup command runs `node dist/db/migrate.js latest`. In Azure Portal → App Service →
Log stream, look for: `Migrations complete` or `0 pending migrations`. If you see a DB error,
double-check `DATABASE_URL` in Application Settings includes `?sslmode=require`.

- [ ] **Step 3: Verify Redis connection**

```bash
curl -X POST https://<your-app>.azurewebsites.net/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "x-university-domain: uiu.ac.bd" \
  -d '{"email":"test@uiu.ac.bd","password":"wrong"}'
```

Expected: `401 Unauthorized` (not 500). A 500 at this point usually means Redis is unreachable —
double-check `REDIS_URL` starts with `rediss://`.

- [ ] **Step 4: Verify Socket.io connects from Vercel frontend**

Open the deployed Vercel URL. Log in. Check browser DevTools → Network → WS tab.
Expected: a WebSocket connection to `wss://<your-app>.azurewebsites.net/socket.io/...` with status
101 Switching Protocols.

If WebSocket fails: verify **Web Sockets** is On in Azure Portal → App Service → Configuration →
General settings.

- [ ] **Step 5: Verify file upload to R2**

Go to Profile → Edit → upload a profile picture.
Expected: photo is displayed and the URL in the browser contains `pub-<hash>.r2.dev` (or your
custom R2 domain). If you get an error, check the R2 CORS policy (Step 5 of Task 5).

- [ ] **Step 6: Seed demo data (if needed)**

In Azure Portal → App Service → SSH (Console):

```bash
cd /home/site/wwwroot
node dist/db/seed.js
```

> Note: `dist/db/seed.js` only exists if the seed file (`src/db/seed.ts`) was compiled by tsc.
> Check `apps/api/tsconfig.json` — `include: ["src"]` covers it.

---

## Dev Workflow Change (one-time note for the team)

Because `packages/shared` now needs a build step, update the local startup from:

```bash
# OLD (still works for ts-node-dev since it uses the "default" condition)
npx pnpm --filter api dev
```

To (first time after pulling this branch, or after clean clone):

```bash
# NEW: build shared once, then normal dev
npx pnpm --filter @uniconnect/shared build
npx pnpm dev   # starts shared tsc --watch + api ts-node-dev + web vite in parallel
```

After the first build, `pnpm dev` keeps shared's `dist/` up to date via `tsc --watch`.
