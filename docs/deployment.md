# Deployment

> For the full step-by-step setup runbook, see [`deployment-ins.md`](../deployment-ins.md) at the repo root.

UniConnecT runs on a lightweight managed stack, not self-hosted infrastructure. Production domain: `uniconnectt.me`.

---

## Architecture

```
uniconnectt.me / www.uniconnectt.me   ──→  Vercel (React SPA)
api.uniconnectt.me                    ──→  Azure App Service B1 (Express + Socket.io)
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
              Neon PostgreSQL           Redis Cloud               Cloudflare R2
              (serverless)          (Bull queues + Socket.io    (S3-compatible,
                                       pub/sub adapter)           media uploads)
```

Bull background workers (`email`, `notification`, `badge`, `group-digest`, `mentorship`, `push`, `content-sync`, `feed-ranking`) run **in-process** with the API server in production — there is no separate deployed worker service.

---

## Services and roles

| Service | Role |
|---|---|
| **Vercel** | Hosts the `apps/web` React SPA (Vite build). Serves `uniconnectt.me` / `www.uniconnectt.me`. |
| **Azure App Service (B1, Linux, Node 20)** | Runs the Express + Socket.io API (`apps/api`). "Always On" and "Web sockets" must be enabled for Socket.io to work. Serves `api.uniconnectt.me`. |
| **Neon PostgreSQL** | Primary database (serverless Postgres, scales to zero when idle). |
| **Redis Cloud** | Backs Bull job queues and the Socket.io Redis pub/sub adapter (`pubClient`/`subClient`). Connected via `rediss://` (TLS). |
| **Cloudflare R2** | S3-compatible object storage for file uploads (presigned PUT flow). Accessed with the existing `@aws-sdk/client-s3` client — no code changes needed versus real S3. |
| **Resend** | Transactional email (OTP, notifications). |
| **KLIPY** | Hosted stickers/GIFs API, proxied server-side through `/api/v1/klipy/*` so the API key never reaches the browser. |
| **Google Gemini** | Powers AI features (flashcards, quiz generation, course outlines) gated by `AI_CONTENT_ENABLED`. |

---

## Environment variables

Set on Azure App Service → Configuration → Application settings (API) and Vercel → Project → Settings → Environment Variables (frontend, `VITE_*` only).

### API (`apps/api`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `REDIS_URL` | Redis Cloud connection string (`rediss://` scheme) |
| `JWT_SECRET` | Access token signing secret |
| `JWT_REFRESH_SECRET` | Refresh token signing secret (must differ from `JWT_SECRET`) |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `RESEND_FROM_EMAIL` | Verified sender address |
| `CLIENT_URL` | Comma-separated list of allowed CORS origins |
| `AWS_S3_BUCKET` | R2 bucket name |
| `AWS_REGION` | `auto` for R2 |
| `AWS_ACCESS_KEY_ID` | R2 API token access key |
| `AWS_SECRET_ACCESS_KEY` | R2 API token secret |
| `AWS_ENDPOINT` | R2 endpoint URL (`https://<accountid>.r2.cloudflarestorage.com`) — enables R2 mode instead of real S3 |
| `AWS_PUBLIC_URL` | Public base URL for uploaded files (R2 public bucket URL or custom domain) |
| `KLIPY_API_KEY` | KLIPY sticker/GIF API key (server-side only) |
| `KLIPY_CONTENT_FILTER` | KLIPY content filter level (`off`/`low`/`medium`/`high`) |
| `GEMINI_API_KEY` | Google Gemini API key for AI content features |
| `AI_CONTENT_ENABLED` | `true`/`false` — enables the daily AI content cron |
| `AI_GROUP_POST_HOUR` | Hour (0–23, server time) the daily AI flashcard group-posting cron runs |

### Web (`apps/web`)

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | API base URL (`https://api.uniconnectt.me`) |
| `VITE_SOCKET_URL` | Socket.io base URL (same as `VITE_API_URL`) |
| `VITE_UNIVERSITY_DOMAIN` | Default `x-university-domain` header value |

Full acquisition steps for each value are in `deployment-ins.md`.

---

## Migrations

Migrations run automatically at API startup, before the server accepts traffic. The Azure App Service startup command is:

```
node dist/db/migrate.js latest && node dist/server.js
```

There is no separate migration step or task in CI — every deploy applies pending migrations before the new server process starts serving requests.

---

## CI/CD

GitHub Actions, both triggered on push to `main`:

| Workflow | Trigger paths | Target |
|---|---|---|
| `.github/workflows/deploy-api.yml` | `apps/api/**`, `packages/shared/**` | Azure App Service (publish-profile deploy) |
| `.github/workflows/deploy-web.yml` | `apps/web/**`, `packages/shared/**`, `vercel.json` | Vercel (production deploy) |

Required GitHub secrets: `AZURE_WEBAPP_PUBLISH_PROFILE`, `AZURE_WEBAPP_NAME` (API workflow), `VERCEL_TOKEN` (web workflow — project/org IDs are hardcoded in the workflow, not secret). If a workflow's secrets aren't configured, the manual CLI fallback (`npx vercel --prod --yes` for web; re-running the Actions workflow for the API) is documented in `deployment-ins.md`.

---

## Health and observability

`GET /health` on the API checks DB connectivity and Redis `PING`. Azure App Service → Log stream is the primary log source; there is no CloudWatch/Application Insights wiring in this stack today.

---

## Local development

Local infra (Postgres, Redis, MinIO for S3-compatible storage) runs via `docker compose up -d` at the repo root. See the root `CLAUDE.md` "Commands" and "Environment variables" sections for the full local dev flow.
