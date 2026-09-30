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

Bull background workers (`email`, `notification`, `notification-digest`, `badge`, `group-digest`, `mentorship`, `push`, `content-sync`, `feed-ranking`, `post-lifecycle`, `learning`, `ai-content`, plus the quiz worker) run **in-process** with the API server in production — there is no separate deployed worker service.

---

## Services and roles

| Service | Role |
|---|---|
| **Vercel** | Hosts the `apps/web` React SPA (Vite build). Serves `uniconnectt.me` / `www.uniconnectt.me`. |
| **Azure App Service (B1, Linux, `NODE\|22-lts`)** | Runs the Express + Socket.io API (`apps/api`). "Always On" must be enabled. The "Web sockets" toggle currently reads **off**, but WebSocket upgrades still succeed on this Linux plan (verified `101` on 2026-09-30); Socket.io also falls back to long-polling. Serves `api.uniconnectt.me`. |
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
| `GEMINI_MODELS` | Optional comma-separated model fallback chain. Google retires pinned versions (2.0-flash went dark in 2026), so this lets ops swap models from App Service settings without a deploy. Unset → the `-latest` aliases in `ai.service.ts` |
| `AI_CALLS_PER_MINUTE` | Default `12`. Throttles Gemini calls to the free-tier per-minute quota; past it, the AI worker sleeps out the rest of the minute |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push (VAPID) keys for the `push` worker |
| `SKYVERN_API_KEY` / `SKYVERN_BASE_URL` / `SKYVERN_CONTENT_WORKFLOW_ID` / `SKYVERN_RUN_TIMEOUT_MS` | Content-sync browser-automation fallback |
| `AI_CONTENT_ENABLED` | `true`/`false` — enables the hourly AI content crons |
| `AI_GROUP_POST_HOUR` | Deprecated / unused. The AI group-posting cron now runs hourly and each academic group is scheduled from its own `ai_settings.run_hour` (and `run_weekday` when weekly). Retained only for backward compatibility |

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

`GET /health` on the API checks DB connectivity and Redis `PING`.

### Application Insights (verified live 2026-09-30)

The App Insights resource is `uniconnect-api` in `uniconnect-rg` (southeastasia). It is workspace-based, sending to `DefaultWorkspace-…-SEA` in `DefaultResourceGroup-SEA`, with 90-day retention and no sampling. It is wired up **agent-only**: App Service auto-instrumentation (`ApplicationInsightsAgent_EXTENSION_VERSION=~3` plus `APPLICATIONINSIGHTS_CONNECTION_STRING`). The code has no App Insights or OpenTelemetry SDK.

What the agent captures, and what it misses:

| Signal | Captured? | Notes |
|---|---|---|
| Inbound HTTP requests (`AppRequests`) | ✅ | Route, status, duration. About 9.4k per week |
| Postgres queries (`AppDependencies`, type `postgres`) | ✅ | Full SQL text, via the `pg` driver. About 42k per week |
| Outbound calls via Node `http`/`https` | ✅ | e.g. `web-push` → `fcm.googleapis.com` |
| Performance counters and metrics | ✅ | CPU, memory, event loop |
| Outbound `fetch()` calls | ❌ | The agent doesn't instrument undici/global `fetch`. That hides **Gemini** (`@google/generative-ai`), **Resend**, **KLIPY**, **Skyvern** and the **WordPress** content-sync source |
| Redis / ioredis, Bull jobs | ❌ | Worker jobs, crons and queue latency are invisible |
| Socket.io traffic | ❌ | engine.io handles it before instrumentation. WebSockets do work (the live upgrade returns `101`) |
| Application logs | ✅ via diagnostic setting | The agent doesn't collect `console.*` (`AppTraces` stays empty); the `logger` lines arrive in `AppServiceConsoleLogs` instead |
| Exceptions (`AppExceptions`) | ❌ | `error-handler.ts` catches everything and logs it to the console, so nothing reaches App Insights as an exception. Zero rows |

**Where logs are:** since 2026-09-30 the diagnostic setting `uniconnect-api-logs` on the web app sends `AppServiceConsoleLogs` (every `logger` JSON line, including `Unhandled API error` stacks and `Gemini call failed` warnings), `AppServiceAppLogs` and `AppServicePlatformLogs` (container start and crash events) to the same workspace. They're kept for the workspace's 30-day retention. The live **Log stream** (`az webapp log tail -n uniconnect-api -g uniconnect-rg`) still works for tailing. Filesystem application logging remains off. Container start failures also land in `/home/LogFiles` under `StartupLogs/*_failure.log` (Kudu).

```kusto
// Recent API errors: the logger's JSON sits in ResultDescription
AppServiceConsoleLogs
| where TimeGenerated > ago(1d)
| extend log = parse_json(ResultDescription)
| where log.level == "error"
| project TimeGenerated, message = tostring(log.message), meta = log.meta
```

That only finds `logger` output. A process crash prints a plain-text Node stack (not JSON), so search those separately, e.g. `AppServiceConsoleLogs | where ResultDescription has_any ("Error:", "exit code")`. To see container stop/start and crash events, use `AppServicePlatformLogs`.

**Querying it:** the `az monitor app-insights query` path returns `BadArgumentError`, so query the workspace directly. Also, `last` is a reserved word in KQL, so don't use it as a column alias.

```bash
WS=$(az monitor log-analytics workspace show -g DefaultResourceGroup-SEA \
  -n DefaultWorkspace-7c751b89-faf4-49ff-aa36-48bb5e9269ad-SEA --query customerId -o tsv)
az monitor log-analytics query -w "$WS" --timespan P1D -o table --analytics-query \
  "AppRequests | where Success == false | summarize n=count() by Name, ResultCode | order by n desc"
```

**Closing the gaps**, cheapest first:
1. ~~**Retain console logs**~~: **done 2026-09-30** (diagnostic setting `uniconnect-api-logs`, see above). The workspace is on `PerGB2018` with no daily cap; total ingestion was about 0.4 GB/month before this, well under the 5 GB/month free allowance.
2. **Exceptions:** additionally report errors from `error-handler.ts` and the workers through an SDK (`applicationinsights` or `@azure/monitor-opentelemetry`).
3. **`fetch`, Redis and Bull:** replace the agent with `@azure/monitor-opentelemetry` initialised first in `server.ts`, plus the undici and ioredis instrumentations. Remove the agent app setting at the same time, or telemetry is double-counted.

Snapshot from 2026-09-23 to 2026-09-30:
- The slowest routes are `POST /admin/learning/paths/draft` (about 9 s, a Gemini round-trip, not visible as a dependency), `POST /auth/login` (p95 about 4.1 s; bcrypt plus a cold Neon pooler) and profile sub-resources (about 1.5 s).
- The top failures are repeated requests for one missing conversation id (61×, 404) and `GET /search/people` returning 422 (25×).
- Only 2 failed Postgres queries, both a `lost_and_found` select on 2026-09-25.

---

## Local development

Local infra (Postgres, Redis, MinIO for S3-compatible storage) runs via `docker compose up -d` at the repo root. See the root `CLAUDE.md` "Commands" and "Environment variables" sections for the full local dev flow.
