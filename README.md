<p align="center">
  <img src="apps/web/src/assets/logo.svg" alt="UniConnecT vector logo" width="340" />
</p>

# UniConnecT

> Your campus. One place.

UniConnecT is a private, multi-tenant university social platform for students, alumni, faculty, staff, admins, and transport drivers. It brings campus communication, jobs, mentorship, groups, events, news, chat, lost-and-found, and shuttle tracking into one verified university network.


[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Team Mavericks - United International University - 2026-2027**

---

## What UniConnecT Does

UniConnecT replaces scattered WhatsApp groups, Facebook pages, notice boards, and LinkedIn fragments with one university-scoped app.

| Role | What they do |
| --- | --- |
| Student | Post updates, join groups, message peers, browse jobs, RSVP to events, request alumni mentorship, follow AI-generated learning paths, take daily quizzes |
| Alumni | Share jobs, mentor students, stay connected with campus groups and events |
| Faculty | Publish announcements, events, jobs, course outlines, gradebooks, modules, and assignments inside course groups |
| Admin | Manage users, invitations, reports, content sync, settings, shuttle data, and AI learning/quiz content approval |
| Driver | Broadcast shuttle GPS locations without access to the social app |

---

## Product Surface

- **Verified auth** with university-domain routing, invite-based registration, OTP verification, refresh cookies, and JWT access tokens
- **Social feed** with posts, comments, reactions, polls, saved posts, tags, drafts, ranking, and moderation reports
- **Profiles** with usernames, privacy controls, profile analytics, viewers, education, experience, featured links, skills, and connection graph
- **Messaging** with direct, group, and mentorship conversations over Socket.io
- **Groups** with private join requests, member roles, resources, pinned posts, rules, study sessions, and digest jobs
- **Jobs and events** with publishing workflows, applications, RSVPs, saved items, and detail pages
- **Mentorship** with alumni capacity, request lifecycle jobs, session tracking, points, rewards, and auto-created conversations
- **Search and explore** with Postgres full-text search, trigram fallback, discovery sections, and ranked results
- **Campus tools** for news, content sync, lost-and-found, courses, shuttle schedules, live shuttle GPS, and web push
- **Academic tools** for course groups: course outlines, gradebooks, modules, and assignment submissions with file uploads
- **AI learning** with generated learning paths, daily quiz slots with leaderboards, streaks, badges, and admin review/approval of AI-generated content before publish
- **Moderation** with user block/mute and content reporting
- **Admin panel** for stats, users, roles, bans, soft deletes, driver accounts, invitations, reports, deletion requests, content sync, shuttle management, and AI learning/quiz generation config

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite 5, TypeScript, TanStack Query, Zustand, React Router, Tailwind CSS, Framer Motion |
| Backend | Node.js 20, Express 5, TypeScript, Knex, Zod |
| Database | PostgreSQL via Neon in production; Knex migrations |
| Cache and queues | Redis via ioredis and Bull |
| Real-time | Socket.io with Redis adapter |
| Auth | JWT access tokens, httpOnly refresh cookies, bcryptjs, email OTP |
| Email | Resend |
| AI content | Google Gemini (learning path and quiz generation, admin-reviewed before publish) |
| GIFs and stickers | Klipy |
| Uploads | S3-compatible presigned uploads; Cloudflare R2 in production |
| Testing | Vitest, React Testing Library, MSW, Supertest |
| Deployment | Vercel frontend, Azure App Service API, Neon PostgreSQL, Redis Cloud, Cloudflare R2 |

---

## Live Deployment

| Surface | Host |
| --- | --- |
| Web app | `https://uniconnectt.me` and `https://www.uniconnectt.me` on Vercel |
| API | `https://api.uniconnectt.me` on Azure App Service |
| Temporary API fallback | `https://uniconnect-api.azurewebsites.net` |
| Database | Neon PostgreSQL, AWS `ap-southeast-1` |
| Cache and queues | Redis Cloud |
| File storage | Cloudflare R2 |

Frontend deployments are configured in [`.github/workflows/deploy-web.yml`](.github/workflows/deploy-web.yml). API deployments are configured in [`.github/workflows/deploy-api.yml`](.github/workflows/deploy-api.yml). Full production setup lives in [`deployment-ins.md`](deployment-ins.md).

---

## Monorepo Layout

```text
.
|-- apps/
|   |-- api/              # Express REST API, Socket.io, workers, migrations
|   `-- web/              # React SPA
|-- packages/
|   `-- shared/           # Shared types, Zod schemas, constants
|-- docs/                 # Architecture, API, database, design, deployment notes
|-- graphify-out/         # Knowledge graph for repo navigation
|-- pnpm-workspace.yaml
|-- package.json
|-- deployment-ins.md
|-- CLAUDE.md
`-- README.md
```

The package boundary is intentional: `apps/api` and `apps/web` do not import from each other. Cross-app contracts live in `packages/shared` and are imported as `@uniconnect/shared`.

---

## Prerequisites

- Node.js 20 or newer
- pnpm 9 or newer, usually run through `npx pnpm ...`
- PostgreSQL and Redis connection strings for local development
- Resend API key for real email delivery
- S3-compatible storage credentials for upload testing

---

## Quick Start

```bash
# 1. Install workspace dependencies
npx pnpm install

# 2. Configure environment files
# apps/api/.env
# apps/web/.env

# 3. Run database migrations and seed data
npx pnpm --filter api db:migrate
npx pnpm --filter api db:seed

# 4. Start both apps
npx pnpm dev
```

Default local services:

| Service | URL |
| --- | --- |
| Web | `http://localhost:5173` |
| API | `http://localhost:3001` |

Useful web environment values:

```env
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
VITE_UNIVERSITY_DOMAIN=uiu.ac.bd
```

Core API environment values:

```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
CLIENT_URL=http://localhost:5173
WEB_URL=http://localhost:5173
RESEND_API_KEY=...
RESEND_FROM_EMAIL=UniConnecT <noreply@uniconnectt.me>
AWS_S3_BUCKET=...
AWS_REGION=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_ENDPOINT=...
AWS_PUBLIC_URL=...
GEMINI_API_KEY=...
KLIPY_API_KEY=...
```

---

## Scripts

```bash
npx pnpm dev                         # start all workspaces in dev mode
npx pnpm build                       # build all workspaces
npx pnpm test                        # run all tests
npx pnpm lint                        # run workspace lint/type checks
npx pnpm typecheck                   # TypeScript check

npx pnpm --filter web dev            # Vite dev server
npx pnpm --filter web build          # web production build
npx pnpm --filter web test           # web tests

npx pnpm --filter api dev            # API server
npx pnpm --filter api worker         # background workers
npx pnpm --filter api build          # API production build
npx pnpm --filter api test           # API tests
npx pnpm --filter api db:migrate     # run pending migrations
npx pnpm --filter api db:rollback    # rollback last migration batch
npx pnpm --filter api db:seed        # seed development data
npx pnpm --filter api db:reset       # rollback all, migrate, seed
```

---

## Architecture Notes

- Every domain table is scoped by `university_id`; tenant isolation is enforced in the service layer.
- `resolveUniversity` derives the university from JWT claims or the `x-university-domain` header.
- Controllers handle HTTP only; services own database and Redis behavior.
- Socket.io events are emitted after successful writes and target rooms such as `uni:{universityId}`, `user:{userId}`, and `conv:{conversationId}`.
- Redis backs Bull queues, presence state, OTP state, and Socket.io scaling.
- OTPs are bcrypt-hashed in Redis with short TTLs; normal verified-user login is password-only.
- Workers process email, notifications, notification digests, badges, group digests, mentorship lifecycle jobs, push notifications, content sync, feed ranking, post lifecycle transitions, AI content generation, and quiz lifecycle jobs.

---

## Documentation

| Document | Description |
| --- | --- |
| [`docs/architecture.md`](docs/architecture.md) | System architecture and data flow |
| [`docs/api.md`](docs/api.md) | REST API reference |
| [`docs/database.md`](docs/database.md) | Schema, indexes, and migration notes |
| [`docs/socket-events.md`](docs/socket-events.md) | Real-time event contract |
| [`docs/design-system.md`](docs/design-system.md) | Design tokens, components, and logo guidance |
| [`docs/BACKEND.md`](docs/BACKEND.md) | Backend memory and implementation rules |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Product design direction |
| [`deployment-ins.md`](deployment-ins.md) | Current production deployment instructions |

This repo also includes a Graphify knowledge graph in `graphify-out/`. Use `graphify query "<question>"` for scoped architecture navigation.

---

## Brand Asset

The UniConnecT vector logo is committed at [`apps/web/src/assets/logo.svg`](apps/web/src/assets/logo.svg). It contains the U-shaped campus mark and the UniConnecT wordmark in UIU navy and orange. Keep the SVG as the canonical logo asset and avoid rasterizing it unless a platform requires bitmap output.

---

## Contributing

1. Branch from `main` unless the task specifies another base.
2. Keep changes scoped and preserve package boundaries.
3. Run `npx pnpm typecheck && npx pnpm lint` before handing off substantive code changes.
4. Add or update focused tests when behavior changes.
5. Open a PR with a concise summary, verification steps, and screenshots for UI work.

Commit format examples:

```text
feat(feed): add saved-post filter
fix(auth): preserve refresh cookie on silent retry
chore(docs): refresh deployment guide
```

---

## Team

| Name | Role |
| --- | --- |
| Joydip Datta | Full-stack, architecture |
| Md. Saem Ferdous | Backend, API design |
| Md. Monnabur Hosen Bhuiyan | Frontend, real-time |
| Md. Mahfujur Rahman Himel Akon | Database, DevOps |

**University:** United International University, Dhaka, Bangladesh  
**Supervisor:** UIU CSE Department, 2026-2027
