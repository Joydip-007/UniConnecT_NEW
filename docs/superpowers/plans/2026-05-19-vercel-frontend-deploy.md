# Vercel Frontend Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the `apps/web` Vite + React SPA to Vercel from the pnpm monorepo, with correct SPA routing, environment variables, and a repeatable CI/CD pipeline via GitHub integration.

**Architecture:** `vercel.json` at the repo root tells Vercel to build only the `apps/web` workspace using `npx pnpm --filter web build`, output from `apps/web/dist`, and rewrite all routes to `index.html` for client-side React Router. The `@uniconnect/shared` workspace package exports TypeScript directly, so Vite transpiles it inline — no separate shared-package build step needed.

**Tech Stack:** Vite 5, React 18, pnpm workspaces, Vercel CLI, react-router-dom v6

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `vercel.json` | Monorepo build config + SPA rewrites |
| Modify | `apps/web/src/lib/socket.ts` | Guard against missing `VITE_SOCKET_URL` at build time |

---

### Task 1: Add `vercel.json` at the repo root

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Create the file**

```json
{
  "buildCommand": "npx pnpm --filter web build",
  "outputDirectory": "apps/web/dist",
  "installCommand": "npx pnpm install --frozen-lockfile",
  "framework": "vite",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

`rewrites` is the critical piece for React Router — without it, Vercel returns 404 for any deep link or browser refresh on a non-root route.

- [ ] **Step 2: Verify the build command works locally**

```bash
npx pnpm --filter web build
```

Expected: `apps/web/dist/` directory created, no TypeScript or Vite errors. The output should include `index.html`, hashed JS/CSS bundles, and any static assets.

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "chore(deploy): add vercel.json for monorepo frontend deployment"
```

---

### Task 2: Install and authenticate the Vercel CLI

**Files:** none — CLI only

- [ ] **Step 1: Install the Vercel CLI globally**

```bash
npm install -g vercel
```

Expected: `vercel --version` prints something like `Vercel CLI 44.x.x`.

- [ ] **Step 2: Log in to your Vercel account**

```bash
vercel login
```

Choose "Continue with GitHub" or email login. The browser will open for OAuth. Once complete the terminal prints `Logged in as <your-email>`.

---

### Task 3: Link the repository to a new Vercel project

**Files:** `.vercel/project.json` (auto-generated, gitignored)

- [ ] **Step 1: Run `vercel` from the repo root**

```bash
vercel
```

Answer the prompts exactly:

| Prompt | Answer |
|--------|--------|
| Set up and deploy? | `Y` |
| Which scope? | Your personal account or team |
| Link to existing project? | `N` (first time) |
| Project name | `uniconnect-web` (or your preference) |
| In which directory is your code located? | `.` (repo root — vercel.json already specifies the build) |

Expected: Vercel runs a preview build and prints a deployment URL like `https://uniconnect-web-<hash>.vercel.app`.

- [ ] **Step 2: Add `.vercel` to `.gitignore`**

Open `.gitignore` at the repo root and add at the bottom:

```
.vercel
```

Commit:

```bash
git add .gitignore
git commit -m "chore: ignore .vercel directory"
```

---

### Task 4: Configure environment variables in Vercel

**Files:** none — Vercel Dashboard or CLI

The app reads three env vars at build time (all `VITE_` prefixed — Vite bakes them into the JS bundle at build time, they are not runtime secrets).

- [ ] **Step 1: Set variables via CLI**

Replace `<PRODUCTION_API_URL>` with your deployed backend URL (e.g. `https://api.uniconnect.app`):

```bash
vercel env add VITE_API_URL
# Prompted for value: https://api.uniconnect.app
# Select environments: Production, Preview (select both with spacebar)

vercel env add VITE_SOCKET_URL
# Value: https://api.uniconnect.app
# Environments: Production, Preview

vercel env add VITE_UNIVERSITY_DOMAIN
# Value: uiu.ac.bd
# Environments: Production, Preview
```

- [ ] **Step 2: Verify variables are registered**

```bash
vercel env ls
```

Expected output shows all three vars under Production and Preview environments.

- [ ] **Step 3: Trigger a rebuild so the new vars are baked in**

```bash
vercel
```

This redeploys a preview build. Check the output URL — open it in a browser and verify:
- The landing page loads
- No console errors about `VITE_API_URL` being undefined
- React Router works: navigate to `/login`, then hard-refresh the page — it must not return 404

---

### Task 5: Connect GitHub for automatic deployments (CI/CD)

**Files:** none — Vercel Dashboard

- [ ] **Step 1: Go to Vercel Dashboard → your project → Settings → Git**

Connect the GitHub repository if not already connected during `vercel` init.

- [ ] **Step 2: Set branch mappings**

| Git branch | Vercel environment |
|------------|--------------------|
| `main` | Production |
| `develop` | Preview |
| All other branches | Preview (automatic) |

These are the defaults; verify they are correct in the UI.

- [ ] **Step 3: Push a commit to `develop` to verify auto-deploy**

```bash
git push origin feature/theme-toggle
```

Go to Vercel Dashboard and confirm a deployment is triggered. Wait for it to finish and open the Preview URL.

---

### Task 6: Verify the production deploy

- [ ] **Step 1: Promote the latest Preview to Production (or merge to `main`)**

Either:
```bash
vercel --prod
```

Or merge your branch to `main` — Vercel auto-deploys `main` to Production once GitHub is connected.

- [ ] **Step 2: Smoke-test the production URL**

Open the production URL (e.g. `https://uniconnect-web.vercel.app`) and check:

1. Landing page renders with correct styles (tokens.css loaded)
2. Navigate to `/login` — page loads without 404
3. Hard-refresh on `/login` — still loads (SPA rewrite working)
4. Open DevTools → Console — no errors about missing `VITE_*` env vars
5. Open DevTools → Network — verify API calls go to the correct `VITE_API_URL`, not `localhost:4000`

- [ ] **Step 3: Done**

The frontend is live. Future pushes to `main` will auto-deploy to Production; pushes to any other branch create Preview deployments.

---

## Troubleshooting Reference

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Build fails: `Cannot find module '@uniconnect/shared'` | `pnpm install` did not resolve workspace symlinks | Make sure install command is `npx pnpm install --frozen-lockfile`, not `npm install` |
| Build fails: `tsc` type errors | TypeScript strict errors exist | Run `npx pnpm --filter web typecheck` locally and fix errors before deploying |
| 404 on page refresh | SPA rewrite missing | Confirm `vercel.json` `rewrites` array is present and committed |
| API calls fail with CORS | `VITE_API_URL` pointing to localhost | Confirm env vars are set for Production environment in Vercel Dashboard |
| `VITE_*` is `undefined` at runtime | Env vars added after last build | Redeploy — Vite bakes vars at build time, so a new deploy is required after any env var change |
