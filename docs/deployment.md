# Deployment

UniConnecT runs on AWS. The staging and production environments mirror each other — the only differences are instance sizes, replica counts, and environment variables.

---

## Environments

| Environment | Branch | URL | Notes |
|------------|--------|-----|-------|
| Local | any | `localhost:5173` / `localhost:4000` | Docker Compose infra |
| Staging | `develop` | `staging.uniconnect.app` | Auto-deploys on merge to `develop` |
| Production | `main` | `uniconnect.app` | Manual trigger after staging sign-off |

---

## Infrastructure Overview

```
Route 53 (DNS)
    │
CloudFront (CDN)
    ├── /          → S3 bucket (React SPA static files)
    └── /api/*     → ALB (Application Load Balancer)
                          │
                   ECS Fargate cluster
                          │
                   ┌──────┴──────────┐
                   │  API task        │ (Node.js, 512MB / 0.25 vCPU staging)
                   │  api:latest      │ (Node.js, 2GB / 1 vCPU production)
                   └──────┬──────────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
         RDS Postgres  ElastiCache  S3 bucket
         (Multi-AZ     Redis        (media uploads)
          production)  cluster
```

**Socket.io note:** ALB sticky sessions (`AWSALB` cookie) must be enabled to keep WebSocket connections pinned to the same ECS task. Set `stickiness.enabled = true` on the target group.

---

## AWS Services

| Service | Usage |
|---------|-------|
| ECS Fargate | API container runtime |
| ECR | Docker image registry |
| RDS PostgreSQL 16 | Primary database |
| ElastiCache Redis 7 | Session store, queues, cache |
| S3 | Media uploads + SPA static files |
| CloudFront | CDN for SPA + media |
| ALB | Load balancer with sticky sessions for Socket.io |
| Route 53 | DNS |
| ACM | TLS certificates |
| SES | Transactional email |
| CloudWatch | Logs, metrics, alarms |
| Secrets Manager | Production secrets |

---

## Docker

### Local development infrastructure only
```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: uniconnect
      POSTGRES_USER: uniconnect
      POSTGRES_PASSWORD: localpassword
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports: ["9000:9000", "9001:9001"]
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: minio123
    volumes: ["miniodata:/data"]
```

### Production container
```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN corepack enable && pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm --filter shared build && pnpm --filter api build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
ENV NODE_ENV=production
CMD ["node", "dist/server.js"]
```

---

## CI / CD Pipeline

### GitHub Actions — `ci.yml` (runs on every PR and push)

```yaml
jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env: { POSTGRES_DB: uniconnect_test, POSTGRES_USER: test, POSTGRES_PASSWORD: test }
      redis:
        image: redis:7-alpine
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter api db:migrate
        env: { DATABASE_URL: postgres://test:test@localhost/uniconnect_test }
      - run: pnpm test
        env: { TEST_DATABASE_URL: postgres://test:test@localhost/uniconnect_test }
```

### GitHub Actions — `deploy-staging.yml` (runs on merge to `develop`)

```yaml
on:
  push:
    branches: [develop]
jobs:
  deploy:
    steps:
      - name: Build & push Docker image
        run: |
          aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY
          docker build -t $ECR_REGISTRY/uniconnect-api:$GITHUB_SHA -f apps/api/Dockerfile .
          docker push $ECR_REGISTRY/uniconnect-api:$GITHUB_SHA

      - name: Update ECS service
        run: |
          aws ecs update-service \
            --cluster uniconnect-staging \
            --service api \
            --force-new-deployment

      - name: Run migrations
        run: |
          aws ecs run-task \
            --cluster uniconnect-staging \
            --task-definition uniconnect-migrate \
            --overrides '{"containerOverrides":[{"name":"api","command":["node","dist/db/migrate.js"]}]}'

      - name: Deploy SPA to S3 + invalidate CloudFront
        run: |
          pnpm --filter web build
          aws s3 sync apps/web/dist s3://$S3_BUCKET --delete
          aws cloudfront create-invalidation --distribution-id $CF_DIST_ID --paths "/*"
```

---

## Environment Variables

### `apps/api/.env` (local) · AWS Secrets Manager (staging / production)

```bash
# Database
DATABASE_URL=postgres://uniconnect:localpassword@localhost:5432/uniconnect
TEST_DATABASE_URL=postgres://test:test@localhost:5432/uniconnect_test

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=change-me-min-32-chars-random-string
JWT_REFRESH_SECRET=change-me-different-from-jwt-secret

# AWS
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=...           # not needed in ECS — use IAM task role
AWS_SECRET_ACCESS_KEY=...       # not needed in ECS — use IAM task role
AWS_S3_BUCKET=uniconnect-media-staging
AWS_CLOUDFRONT_DOMAIN=dxxx.cloudfront.net

# Email
EMAIL_FROM=no-reply@uniconnect.app
SMTP_HOST=email-smtp.ap-southeast-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=AKIAIOSFODNN7EXAMPLE
SMTP_PASS=...

# App
NODE_ENV=development
PORT=4000
API_URL=http://localhost:4000
WEB_URL=http://localhost:5173
LOG_LEVEL=debug             # debug | info | warn | error

# Dev overrides
CLOUDINARY_URL=cloudinary://...   # replaces S3 in local dev
```

### `apps/web/.env`

```bash
VITE_API_URL=http://localhost:4000
VITE_SOCKET_URL=http://localhost:4000
VITE_CLOUDFRONT_DOMAIN=dxxx.cloudfront.net
```

---

## Database Migrations in Production

Migrations run as a one-off ECS task before the new API version is promoted. The task definition `uniconnect-migrate` shares the same image and environment as the API but overrides the command to `node dist/db/migrate.js`.

**Zero-downtime migration rules:**
1. Migrations must be backwards-compatible with the previous API version (additive only in the same deploy).
2. Column renames and type changes require a two-step deploy: add new column → backfill → switch code → remove old column.
3. Never lock the table by adding a NOT NULL column without a default on a large table. Add nullable first, backfill, then add constraint.

---

## Monitoring & Alerts

| Signal | Tool | Alert threshold |
|--------|------|----------------|
| Application logs | CloudWatch Logs | ERROR rate > 1% / min |
| API latency | CloudWatch Metrics (ALB) | p99 > 2s |
| DB connections | RDS Enhanced Monitoring | > 80% of max_connections |
| Redis memory | ElastiCache Metrics | > 75% used |
| CPU (ECS) | CloudWatch Metrics | > 80% sustained 5 min |
| Failed deployments | GitHub Actions | Slack webhook notification |

### Health check endpoint
`GET /health` — returns `200 { status: "ok", db: "ok", redis: "ok" }`. ALB uses this for target health checks. The endpoint checks a lightweight DB ping (`SELECT 1`) and Redis `PING`.

---

## Rollback Procedure

```bash
# 1. Re-deploy previous image tag
aws ecs update-service \
  --cluster uniconnect-production \
  --service api \
  --task-definition uniconnect-api:<previous-revision>

# 2. If migration must be rolled back
aws ecs run-task \
  --cluster uniconnect-production \
  --task-definition uniconnect-migrate \
  --overrides '{"containerOverrides":[{"name":"api","command":["node","dist/db/rollback.js"]}]}'

# 3. Invalidate CloudFront cache if SPA was also rolled back
aws cloudfront create-invalidation --distribution-id $CF_DIST_ID --paths "/*"
```

---

## Scaling Notes

- **ECS:** Set desired count to 2+ in production. ALB distributes traffic; sticky sessions keep Socket.io connections consistent.
- **Redis:** Use a Redis cluster or Sentinel for production HA. Bull queues continue to function across Redis restarts with `removeOnComplete: false`.
- **Postgres:** RDS Multi-AZ provides automatic failover. Read replicas can be added for analytics queries — route them through a separate Knex pool.
- **Socket.io at scale:** If running multiple API instances, configure Socket.io with the Redis adapter (`@socket.io/redis-adapter`) so events emitted on one instance reach clients connected to another.

```typescript
// apps/api/src/sockets/index.ts — Redis adapter for multi-instance
import { createAdapter } from '@socket.io/redis-adapter';
import { pubClient, subClient } from '../config/redis';
io.adapter(createAdapter(pubClient, subClient));
```
