# UniConnecT

> A private social network built for universities — connecting students, alumni, faculty, and staff in one place.

[![CI](https://github.com/team-mavericks/uniconnect/actions/workflows/ci.yml/badge.svg)](https://github.com/team-mavericks/uniconnect)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Team Mavericks · United International University · 2026–2027**

---

## What is UniConnecT?

UniConnecT is a multi-tenant university social platform that replaces the fragmented mess of WhatsApp groups, Facebook pages, and LinkedIn profiles with one verified, private network per university.

| Role | What they do |
|------|-------------|
| Student | Post updates, browse jobs, join groups, attend events, message alumni |
| Alumni | Post job opportunities, offer mentorship, stay connected with campus |
| Staff / Faculty | Share announcements, publish news, organize events |
| Admin | Manage users, configure platform settings, view analytics |

**Think:** LinkedIn + Facebook + Slack — purpose-built for South Asian campus life.

---

## Features

- **Social feed** — Posts, polls, announcements, reactions, comments, mentions
- **Job board** — Alumni and faculty post opportunities; students apply in-platform
- **Real-time chat** — Direct messages and group conversations via WebSockets
- **Events** — Create, RSVP, and manage campus events
- **Groups** — Department, club, batch, and interest communities
- **University news** — Official announcements separated from social posts
- **Live shuttle tracker** — Real-time GPS bus location
- **Lost & found** — Campus item recovery board
- **Mentorship** — Student–alumni mentorship request system
- **Gamification** — Badges and points for engagement milestones

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, TanStack Query, Zustand |
| Backend | Node.js, Express, TypeScript |
| Real-time | Socket.io |
| Database | PostgreSQL 16, Redis 7 |
| File storage | AWS S3 (Cloudinary in dev) |
| Background jobs | Bull (Redis-backed) |
| Auth | JWT access tokens, httpOnly refresh cookies, registration/reset OTP |
| Testing | Vitest, React Testing Library, MSW, Supertest |
| Infra | AWS EC2 / ECS, RDS, ElastiCache, CloudFront |

---

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- Docker & Docker Compose
- PostgreSQL client (`psql`) — optional, for manual inspection

---

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/team-mavericks/uniconnect.git
cd uniconnect
npx pnpm install

# 2. Start local infrastructure (Postgres, Redis, MinIO)
docker compose up -d

# 3. Configure environment
# Create/edit apps/api/.env and apps/web/.env.
# Local defaults used by the current codebase:
# apps/api/.env → PORT=4000, DATABASE_URL, REDIS_URL, JWT_SECRET, JWT_REFRESH_SECRET
# apps/web/.env → VITE_API_URL=http://localhost:4000, VITE_SOCKET_URL=http://localhost:4000, VITE_UNIVERSITY_DOMAIN=uiu.ac.bd

# 4. Set up the database
npx pnpm --filter api db:migrate
npx pnpm --filter api db:seed

# 5. Start development servers
npx pnpm dev
# API → http://localhost:4000
# Web → http://localhost:5173
```

---

## Development Scripts

```bash
npx pnpm dev                        # start all services concurrently
npx pnpm build                      # production build
npx pnpm test                       # run all tests
npx pnpm lint                       # ESLint / TypeScript checks
npx pnpm typecheck                  # TypeScript (no emit)
npx pnpm --filter api dev           # API server on :4000
npx pnpm --filter web dev           # Vite web server on :5173
npx pnpm --filter api db:migrate    # run pending migrations
npx pnpm --filter api db:rollback   # rollback last batch
npx pnpm --filter api db:seed       # seed development data
npx pnpm --filter api db:reset      # full reset (rollback → migrate → seed)
```

---

## Repository Structure

```
uniconnect/
├── apps/
│   ├── api/          # Express REST API + Socket.io
│   └── web/          # React SPA
├── packages/
│   └── shared/       # Types, Zod schemas, constants (shared by api + web)
├── docs/             # Architecture, API reference, deployment guides
├── docker-compose.yml
├── pnpm-workspace.yaml
├── AGENTS.md         # Codex operating rules
├── CODEX.md          # Living implementation snapshot
└── CLAUDE.md         # Claude Code project context
```

See [`docs/architecture.md`](docs/architecture.md) for detailed system design.

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | System design, data flow, component breakdown |
| [API Reference](docs/api.md) | All REST endpoints, request/response shapes |
| [Database](docs/database.md) | Schema, indexes, relationships, migration guide |
| [Socket Events](docs/socket-events.md) | Real-time event reference, rooms, payloads |
| [Deployment](docs/deployment.md) | AWS infra, CI/CD, environment configuration |
| [Design System](docs/design-system.md) | UI tokens, component patterns, brand guide |

---

## Current Implementation Snapshot

As of the latest local wiring pass:

- Existing-account login is password-only. OTP is used for registration verification and password reset, not normal login.
- The web client sends `x-university-domain` from `VITE_UNIVERSITY_DOMAIN`; local UIU development uses `uiu.ac.bd`.
- The backend exposes implemented REST modules for auth, users, upload presign, feed/posts, jobs, events, groups, conversations/messages, notifications, news, lost-found, shuttle, and courses.
- Socket.io authenticates with the access token and joins `uni:{universityId}`, `user:{userId}`, and conversation rooms when requested by the client.
- Frontend route-level pages are wired for feed, jobs/detail, events/detail, groups/detail, messages/conversation, notifications, news/detail, lost-found, shuttle, profile, login/register/OTP, and landing.
- `AdminPage`, `SearchPage`, and `MentorshipPage` remain simple placeholders.

See [`CODEX.md`](CODEX.md) for the living developer summary and recent compatibility notes.

---

## Contributing

1. Branch from `develop`: `git checkout -b feature/your-feature`
2. Make changes, write tests
3. `npx pnpm lint && npx pnpm typecheck && npx pnpm test`
4. Open a PR to `develop` — all CI checks must pass

Commit format: `feat(scope): description` · `fix(scope): description` · `chore(scope): description`

---

## Team

| Name | Role |
|------|------|
| Joydip Datta | Full-stack, architecture |
| Md. Saem Ferdous | Backend, API design |
| Md. Monnabur Hosen Bhuiyan | Frontend, real-time |
| Md. Mahfujur Rahman Himel Akon | Database, DevOps |

**University:** United International University, Dhaka, Bangladesh
**Supervisor:** UIU CSE Department, 2026–2027
