# Deployment Design: Azure Student + Free-Tier Stack

**Date:** 2026-05-24  
**Author:** Joydip (Team Mavericks)  
**Status:** Approved

---

## Context

UniConnecT is a university social network built as a monorepo (Express API + React SPA). It needs a
public demo environment for a university project panel. The goal is to use the Azure for Students
$100 credit for the backend compute, and layer in free-tier services for everything else, maximising
the demo lifetime while keeping Socket.io (real-time chat, notifications) always-on.

---

## Chosen Approach: App Service B1 + Neon + Upstash + Vercel + Cloudflare R2

**Monthly Azure spend:** ~$13 (App Service B1 only) → ~7 months on $100 credit  
**All other services:** free tiers

---

## Infrastructure Map

```
INTERNET
   │
   ├── Vercel (free)              ← React SPA / static build
   │     VITE_API_URL ──────────────────────────────────────────┐
   │     VITE_SOCKET_URL ────────────────────────────────────────┤
   │                                                             │
   └── Azure App Service B1 (Singapore, Always On) ────────────┘
         Express REST + Socket.io (Node 20 LTS)
         │
         ├── Neon.tech (free)             ← PostgreSQL 0.5 GB
         │     ?sslmode=require in URL (auto-detected by db.ts)
         │
         ├── Upstash Redis (free)         ← Bull queues + Socket.io pub/sub
         │     rediss:// URL (TLS, handled by ioredis + new tls:{} option)
         │
         └── Cloudflare R2 (free, 10 GB) ← File uploads (S3-compatible)
               Uses existing @aws-sdk/client-s3 with endpoint override

External:
   └── Resend (free 100/day)             ← Transactional email
```

---

## Code Changes

Only 3 files change. No new dependencies.

### 1. `apps/api/src/config/env.ts`

Add two optional env vars for Cloudflare R2:

```diff
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
+ AWS_ENDPOINT: z.string().url().optional(),    // R2 endpoint: https://<accountid>.r2.cloudflarestorage.com
+ AWS_PUBLIC_URL: z.string().url().optional(),  // R2 public base URL: https://pub-<hash>.r2.dev
```

### 2. `apps/api/src/config/redis.ts`

Detect `rediss://` (Upstash TLS) and pass explicit `tls: {}` to ioredis:

```diff
+ const isTls = env.REDIS_URL.startsWith('rediss://')
+
  export const redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) return null
      return 500
    },
+   ...(isTls && { tls: {} }),
  })
```

> **Bull queues** (`apps/api/src/queues/*.queue.ts`) pass `env.REDIS_URL` directly and do not need
> to change — Bull v4's bundled ioredis v4 handles `rediss://` URLs natively.

### 3. `apps/api/src/services/upload.service.ts`

Pass R2 endpoint to S3Client and use `AWS_PUBLIC_URL` for public file URLs:

```diff
  export const s3Client = new S3Client({
    region: env.AWS_REGION,
    credentials:
      env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY }
        : undefined,
+   ...(env.AWS_ENDPOINT && {
+     endpoint: env.AWS_ENDPOINT,
+     forcePathStyle: false,   // R2 uses virtual-hosted-style
+   }),
  })

  // Inside getPresignedUploadUrl():
- publicUrl: `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${encodeS3Key(key)}`,
+ publicUrl: env.AWS_PUBLIC_URL
+   ? `${env.AWS_PUBLIC_URL}/${encodeS3Key(key)}`
+   : `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${encodeS3Key(key)}`,
```

### `apps/api/src/config/db.ts` — No change needed

Neon's connection string includes `?sslmode=require`, which the existing `shouldUseSsl()` at line 65
already detects. No modification required.

---

## Environment Variables

### Azure App Service → Configuration → Application Settings

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `DATABASE_URL` | Neon connection string (includes `?sslmode=require`) |
| `REDIS_URL` | Upstash connection string (starts with `rediss://`) |
| `JWT_SECRET` | 64-char random string |
| `JWT_REFRESH_SECRET` | 64-char random string |
| `CLIENT_URL` | Vercel URL(s), comma-separated |
| `AWS_REGION` | `auto` |
| `AWS_S3_BUCKET` | `uniconnect-uploads` (create this bucket in R2) |
| `AWS_ACCESS_KEY_ID` | R2 Access Key ID |
| `AWS_SECRET_ACCESS_KEY` | R2 Secret Access Key |
| `AWS_ENDPOINT` | `https://<accountid>.r2.cloudflarestorage.com` |
| `AWS_PUBLIC_URL` | `https://pub-<hash>.r2.dev` (or custom R2 domain) |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | `UniConnecT <noreply@yourdomain.com>` |

### Vercel → Project Settings → Environment Variables

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://<your-app>.azurewebsites.net` |
| `VITE_SOCKET_URL` | `https://<your-app>.azurewebsites.net` |
| `VITE_UNIVERSITY_DOMAIN` | `uiu.ac.bd` |

---

## Azure App Service Configuration

| Setting | Value | Why |
|---|---|---|
| Runtime stack | Node 20 LTS | Required by monorepo engines field |
| OS | Linux | Cheaper, standard for Node |
| Region | Southeast Asia (Singapore) | Closest to UIU, Dhaka |
| Pricing plan | **B1 Basic** | Minimum tier supporting Always On |
| **Always On** | **Enabled** | Prevents Socket.io cold-starts |
| **Web sockets** | **On** | Required for Socket.io — off by default |
| Startup command | `node dist/db/migrate.js latest && node dist/server.js` | Migrations + boot |
| Build | **GitHub Actions** (see below) | Oryx can't run pnpm monorepo reliably |

---

## External Service Setup Summary

### 1. Neon (PostgreSQL)
- Sign up at neon.tech with GitHub
- Create project → copy connection string (includes `?sslmode=require`)
- Free tier: 0.5 GB, 1 project, serverless compute

### 2. Upstash (Redis)
- Sign up at upstash.com
- Create Redis database → region: Asia Pacific → copy `rediss://` URL
- Free tier: 10K commands/day, 256 MB

### 3. Cloudflare R2 (Storage)
- Cloudflare dashboard → R2 → Create bucket `uniconnect-uploads`
- Enable "Allow public access" → note the `pub-<hash>.r2.dev` subdomain
- Manage API tokens → Create R2 token with Object Read & Write
- Free tier: 10 GB storage, 1M write ops, 10M read ops/month
- **CORS**: Add rule allowing PUT from your Vercel domain

### 4. Vercel (Frontend)
- Import GitHub repo → set root directory: `apps/web`
- Override build command: `npx pnpm --filter web build`
- Override output directory: `apps/web/dist`
- Or: use the existing `vercel.json` at root (already configured)
- Set the 3 VITE_ env vars above

### 5. Azure App Service
- Azure Portal → Create resource → Web App
- Fill in the settings from the table above
- **Enable Web Sockets**: Configuration → General settings → Web sockets → On
- Connect GitHub repo via Deployment Center → GitHub Actions

**GitHub Actions workflow** (`.github/workflows/deploy-api.yml`):
```yaml
- uses: actions/setup-node@v4
  with: { node-version: '20' }
- run: npm install -g pnpm
- run: pnpm install --frozen-lockfile
- run: pnpm --filter api build             # compiles to dist/
- uses: azure/webapps-deploy@v2
  with:
    app-name: <your-app-name>
    publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
    package: apps/api
```

---

## Post-Deploy Checklist

1. **Verify API health**: `GET https://<your-app>.azurewebsites.net/health` → `200 OK`
2. **Run migrations**: Already happens on startup via `db:migrate:prod`
3. **Seed demo data** (if needed): Azure Portal → App Service → SSH → `npx pnpm --filter api db:seed`
4. **Register admin**: `POST /auth/register` with `dev-invite` token → promote via `PATCH /admin/users/:id/role`
5. **Test Socket.io**: Open app on Vercel, confirm real-time notifications fire in chat
6. **Test file upload**: Upload a profile picture, verify it serves from R2 public URL
7. **Test email**: Register a new account, confirm OTP email arrives via Resend

---

## Cost Estimate

| Month | Azure spend | Remaining credit |
|---|---|---|
| 1 | ~$13 | ~$87 |
| 3 | ~$39 | ~$61 |
| 6 | ~$78 | ~$22 |
| 7 | ~$91 | ~$9 |

Credit lasts ~7 months. All other services (Neon, Upstash, Vercel, R2, Resend) stay free throughout.

---

## What Does NOT Change

- No new npm packages
- No changes to queue files (`apps/api/src/queues/`)
- No changes to Socket.io config
- No changes to auth flow
- No changes to `render.yaml` (keep it for fallback/reference)
- Frontend routing, pages, components — untouched
