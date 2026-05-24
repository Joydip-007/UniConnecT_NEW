# UniConnecT — Deployment Instructions

**Domain:** `uniconnectt.me`  
**Stack:** Azure App Service B1 · Neon PostgreSQL · Upstash Redis · Cloudflare R2 · Vercel  
**Estimated monthly Azure cost:** ~$13 → ~7 months on $100 student credit

---

## Architecture Overview

```
uniconnectt.me / www.uniconnectt.me   ──→  Vercel (React SPA, free)
api.uniconnectt.me                    ──→  Azure App Service B1 (Express + Socket.io)
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
              Neon PostgreSQL           Upstash Redis             Cloudflare R2
              (free, 0.5 GB)       (free, rediss:// TLS)      (free, 10 GB, S3)
```

---

## 1 — Neon PostgreSQL (Database)

### Sign up & create project

1. Go to [neon.tech](https://neon.tech) → **Sign up** (use GitHub)
2. **Create project** → name it `uniconnect` → region **AWS ap-southeast-1 (Singapore)**
3. Dashboard → **Connection string** tab → copy the URL

The URL looks like:
```
postgresql://user:password@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

> `?sslmode=require` is already in the URL — the API detects it automatically.

### Notes

- Free tier: **0.5 GB storage**, compute sleeps after 5 min idle (auto-wakes on connection, ~1 s delay)
- Migrations run automatically on every deploy via the `prestart` script (`node dist/db/migrate.js latest`)
- To seed demo data (one-time): see §6 Post-Deploy

---

## 2 — Upstash Redis

### Sign up & create database

1. Go to [upstash.com](https://upstash.com) → **Sign up** → **Create database**
2. Name: `uniconnect-redis` · Type: **Redis** · Region: **AWS ap-southeast-1 (Singapore)**
3. Click database → **Details** tab → copy the **Redis URL** (starts with `rediss://`)

The URL looks like:
```
rediss://default:AxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxAA==@xxx-xxx.upstash.io:6379
```

### Notes

- Free tier: **10,000 commands/day**, 256 MB — sufficient for a demo
- Used for: Bull job queues (email, notifications, badges, mentorship, digest) + Socket.io pub/sub adapter
- The API automatically enables TLS when the URL starts with `rediss://` (no extra config needed)

---

## 3 — Cloudflare R2 (File Storage)

### Create bucket

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **R2 Object Storage** → **Create bucket**
2. Name: `uniconnect-uploads` · Location: **APAC**
3. After creation → **Settings** → **Public access** → **Allow access** → note the public URL:
   ```
   https://pub-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.r2.dev
   ```

### Create API token

1. R2 → **Manage R2 API Tokens** → **Create API token**
2. Permissions: **Object Read & Write** · Bucket: `uniconnect-uploads`
3. Copy **Access Key ID** and **Secret Access Key**
4. Copy the **Endpoint URL**: `https://<accountid>.r2.cloudflarestorage.com`

### Set CORS policy

R2 → `uniconnect-uploads` → **Settings** → **CORS policy** → paste:

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

> Without the CORS policy, browser presigned-PUT uploads will be blocked.

### Notes

- Free tier: **10 GB storage**, 1M write ops, 10M read ops/month — well within demo limits
- Fully S3-compatible — uses the existing `@aws-sdk/client-s3` in the codebase
- Optional: add a custom domain (`files.uniconnectt.me`) in R2 → Settings → Custom domain

---

## 4 — Azure App Service (Backend API)

### Create the App Service

1. [portal.azure.com](https://portal.azure.com) → **Create a resource** → **Web App**
2. Fill in:

   | Field | Value |
   |---|---|
   | Resource Group | `uniconnect-rg` (create new) |
   | Name | `uniconnect-api` (becomes `uniconnect-api.azurewebsites.net`) |
   | Publish | **Code** |
   | Runtime stack | **Node 20 LTS** |
   | OS | **Linux** |
   | Region | **Southeast Asia (Singapore)** |
   | Plan | Create new → **B1 Basic** (~$13/month) |

3. **Review + create** → **Create**

### Enable required settings

Portal → `uniconnect-api` App Service:

**Configuration → General settings:**
- **Always On** → **On** ← critical for Socket.io
- **Web sockets** → **On** ← required for Socket.io
- **Startup command** → `node dist/db/migrate.js latest && node dist/server.js`

Click **Save**.

### Set environment variables

Portal → `uniconnect-api` → **Configuration → Application settings** → **+ New application setting** for each:

| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon connection string (§1) |
| `REDIS_URL` | Upstash `rediss://` URL (§2) |
| `JWT_SECRET` | Run `openssl rand -hex 32` → paste result |
| `JWT_REFRESH_SECRET` | Run `openssl rand -hex 32` → paste a **different** result |
| `CLIENT_URL` | `https://uniconnectt.me,https://www.uniconnectt.me` |
| `AWS_REGION` | `auto` |
| `AWS_S3_BUCKET` | `uniconnect-uploads` |
| `AWS_ACCESS_KEY_ID` | R2 Access Key ID (§3) |
| `AWS_SECRET_ACCESS_KEY` | R2 Secret Access Key (§3) |
| `AWS_ENDPOINT` | `https://<accountid>.r2.cloudflarestorage.com` (§3) |
| `AWS_PUBLIC_URL` | `https://pub-xxxx.r2.dev` (§3) or `https://files.uniconnectt.me` if custom domain |
| `RESEND_API_KEY` | From [resend.com](https://resend.com) dashboard |
| `RESEND_FROM_EMAIL` | `UniConnecT <noreply@uniconnectt.me>` |

Click **Save** → the app restarts automatically.

### Add custom domain (`api.uniconnectt.me`)

1. Portal → `uniconnect-api` → **Custom domains** → **Add custom domain**
2. Note the **outbound IP addresses** shown on the Custom domains page
3. In your domain registrar (or Cloudflare DNS): add an **A record**:
   ```
   api.uniconnectt.me  →  <Azure outbound IP>
   ```
4. Back in Azure: click **Validate** → **Add**
5. Add a **Managed Certificate** (free TLS) → **Add binding**

> Until the custom domain is set up, use `https://uniconnect-api.azurewebsites.net` as a temporary URL.

### Set up GitHub Actions deployment

1. Portal → `uniconnect-api` → **Overview** → **Get publish profile** → download the XML file
2. In your GitHub repo → **Settings → Secrets and variables → Actions** → **New repository secret**:
   - Name: `AZURE_WEBAPP_PUBLISH_PROFILE` · Value: paste the entire XML content
   - Name: `AZURE_WEBAPP_NAME` · Value: `uniconnect-api`
3. GitHub → **Settings → Environments** → **New environment** → name: `production`

The workflow at [.github/workflows/deploy-api.yml](.github/workflows/deploy-api.yml) fires automatically on every push to `main` that touches API or shared code.

**Manual first deploy:** push any small change to `main` (or re-run the workflow from the Actions tab).

---

## 5 — Vercel (Frontend)

### Import project

1. [vercel.com](https://vercel.com) → **Add new project** → **Import Git Repository** → select this repo
2. Set:

   | Field | Value |
   |---|---|
   | Framework preset | **Vite** |
   | Root directory | *(leave blank — uses vercel.json at root)* |
   | Build command | `npx pnpm --filter web build` |
   | Output directory | `apps/web/dist` |
   | Install command | `npx pnpm install --frozen-lockfile` |

3. **Environment variables** → add:

   | Name | Value |
   |---|---|
   | `VITE_API_URL` | `https://api.uniconnectt.me` (or `https://uniconnect-api.azurewebsites.net` temporarily) |
   | `VITE_SOCKET_URL` | same as `VITE_API_URL` |
   | `VITE_UNIVERSITY_DOMAIN` | `uiu.ac.bd` |

4. **Deploy**

### Add custom domains

Vercel → project → **Settings → Domains** → add:
- `uniconnectt.me`
- `www.uniconnectt.me`

Vercel will show DNS records to add. In your registrar:
- `uniconnectt.me` → **A record** → `76.76.21.21`
- `www.uniconnectt.me` → **CNAME** → `cname.vercel-dns.com`

> If your domain is on Cloudflare, set the proxy to **DNS only (grey cloud)** for the records Vercel requires, otherwise TLS verification fails.

### Re-deploying via CLI (manual trigger)

Use this whenever you need to push the frontend outside of CI/CD (e.g. urgent hotfix from a local machine).

**Prerequisites:** Node.js on PATH, `npx` available.

```bash
# Step 1 — Authenticate (first time on a new machine; opens browser OAuth)
npx vercel login

# Confirm you are logged in
npx vercel whoami   # should print: joydip-007

# Step 2 — Link this repo to the existing Vercel project (one-time per machine)
npx vercel link --project uniconnect --yes
# Output: Linked joydip-dattas-projects/uniconnect

# Step 3 — Deploy to production
npx vercel --prod --yes
```

The CLI will:
1. Upload the local source tree (~8.8 MB)
2. Build on Vercel's servers (`npx pnpm install` → `tsc -b && vite build`)
3. Alias the result to `uniconnectt.me` and `www.uniconnectt.me`

Deployment typically takes **~30 seconds** (build cache hit) or **~2 minutes** (cold build).

After deploy, verify with:
```bash
npx vercel inspect <deployment-url>
# Check: status ● Ready, target production
```

### GitHub Actions auto-deploy (CI/CD)

The workflow at [.github/workflows/deploy-web.yml](.github/workflows/deploy-web.yml) fires automatically on every push to `main` that touches `apps/web/**`, `packages/shared/**`, or `vercel.json`.

To activate it, add these secrets to **GitHub → Settings → Secrets and variables → Actions**:

| Secret name | How to get it |
|---|---|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) → **Create token** |
| `VERCEL_ORG_ID` | `cat .vercel/project.json` → `"orgId"` field (after running `vercel link`) |
| `VERCEL_PROJECT_ID` | `cat .vercel/project.json` → `"projectId"` field |
| `VITE_API_URL` | `https://api.uniconnectt.me` |
| `VITE_SOCKET_URL` | `https://api.uniconnectt.me` |
| `VITE_UNIVERSITY_DOMAIN` | `uiu.ac.bd` |

> Until these secrets are set, the workflow will fail. Use the CLI deploy above as the manual fallback.

---

## 6 — Post-Deploy Checklist

Run these after the first successful deploy.

### Verify API health

```bash
curl https://api.uniconnectt.me/health
# Expected: 200 OK
```

If 503: Portal → App Service → **Log stream** — check startup errors.

### Verify database migrations ran

In the Log stream, look for: `Batch N run: N migrations` or `Already up to date`.

If DB error: re-check `DATABASE_URL` in Application settings — ensure `?sslmode=require` is in the string.

### Register first admin user

```bash
# 1. Register with the dev invite token
curl -X POST https://api.uniconnectt.me/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -H "x-university-domain: uiu.ac.bd" \
  -d '{
    "email": "joydip.datta15@gmail.com",
    "password": "Joydip_2004",
    "fullName": "Admin User",
    "inviteToken": "dev-invite",
    "role": "admin"
  }'

# 2. Verify OTP (check email)
curl -X POST https://api.uniconnectt.me/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -H "x-university-domain: uiu.ac.bd" \
  -d '{"email": "admin@uiu.ac.bd", "otp": "123456"}'

# 3. Promote to admin via Portal SSH:
# Portal → App Service → SSH → Console
cd /home/site/wwwroot
node -e "
const knex = require('knex')({ client: 'pg', connection: process.env.DATABASE_URL + '?sslmode=require' });
knex('users').where({ email: 'admin@uiu.ac.bd' }).update({ role: 'admin' }).then(() => { console.log('done'); process.exit(0); });
"
```

### Seed demo data (optional)

Portal → App Service → **SSH → Console**:

```bash
cd /home/site/wwwroot
node dist/db/seed.js
```

> Seeds UIU university, roles, and sample users. Safe to run multiple times (upserts).

### Verify Socket.io

Open `https://uniconnectt.me` → log in → DevTools → **Network → WS tab** → confirm a WebSocket connection to `wss://api.uniconnectt.me/socket.io/...` with status **101 Switching Protocols**.

If WebSocket fails: confirm **Web sockets → On** in Portal → Configuration → General settings.

### Verify file upload

Profile → Edit → upload a profile picture. Confirm the displayed URL contains `r2.dev` (or your custom domain) — not `amazonaws.com`.

### Verify email delivery

Register a new account with a real UIU email. Confirm the OTP email arrives from `noreply@uniconnectt.me`.

If no email: check `RESEND_API_KEY` in App Settings and confirm the sender domain is verified in [resend.com](https://resend.com) → Domains.

---

## 7 — Ongoing Maintenance

### Deploy an update

| What changed | What fires | Workflow file |
|---|---|---|
| `apps/api/**` or `packages/shared/**` | Azure App Service deploy | [deploy-api.yml](.github/workflows/deploy-api.yml) |
| `apps/web/**` or `packages/shared/**` | Vercel frontend deploy | [deploy-web.yml](.github/workflows/deploy-web.yml) |

Both workflows trigger automatically on push to `main`.

If CI/CD is not yet configured (GitHub secrets missing), use the manual CLI fallback:
```bash
# Backend — re-run the workflow from Actions tab in GitHub
# Frontend — see §5 "Re-deploying via CLI"
npx vercel --prod --yes
```

### Monitor credit balance

Azure Portal → **Cost Management + Billing** → your subscription → check remaining credits.

At ~$13/month (App Service B1 only), the $100 credit lasts ~7 months. After credits expire, either:
- Add a payment method (B1 continues at ~$13/month)
- Downgrade to F1 free tier (Socket.io will stop working — cold starts)
- Migrate database to Azure PostgreSQL (~$12/month extra) if Neon free tier is limiting

### Run DB migrations manually

If a migration needs to run outside of a deploy:

```bash
# Portal → App Service → SSH → Console
cd /home/site/wwwroot
node dist/db/migrate.js latest
```

### Roll back a bad deploy

```bash
# Portal → App Service → Deployment Center → Deployments tab
# Click the previous successful deployment → Redeploy
```

---

## 8 — Dev Workflow (after this setup)

### First time after cloning

```bash
# Build shared package once (needed for ts-node-dev to find @uniconnect/shared)
npx pnpm --filter @uniconnect/shared build

# Start all services in parallel (shared tsc --watch + api ts-node-dev + web vite)
npx pnpm dev
```

### Environment files

`apps/api/.env`:
```env
DATABASE_URL=postgresql://postgres@localhost:5432/uniconnect_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-at-least-32-characters-long
JWT_REFRESH_SECRET=dev-refresh-secret-at-least-32-chars
AWS_REGION=ap-southeast-1
AWS_S3_BUCKET=uniconnect-local
```

`apps/web/.env`:
```env
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
VITE_UNIVERSITY_DOMAIN=uiu.ac.bd
```

Local infrastructure (Postgres, Redis, MinIO):
```bash
docker compose up -d
```

---

## Quick Reference

| Service | URL | Free limit | Cost from credits |
|---|---|---|---|
| Azure App Service B1 | `uniconnect-api.azurewebsites.net` | — | ~$13/month |
| Neon PostgreSQL | [console.neon.tech](https://console.neon.tech) | 0.5 GB | $0 |
| Upstash Redis | [console.upstash.com](https://console.upstash.com) | 10K cmds/day | $0 |
| Cloudflare R2 | [dash.cloudflare.com](https://dash.cloudflare.com) → R2 | 10 GB | $0 |
| Vercel (frontend) | `uniconnectt.me` | 100 GB bandwidth | $0 |
| Resend (email) | [resend.com](https://resend.com) | 100 emails/day | $0 |
