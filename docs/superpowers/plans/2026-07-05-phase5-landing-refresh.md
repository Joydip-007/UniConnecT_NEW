# Phase 5 — landing refresh implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the public landing experience so UniConnecT feels like a confident platform-first product: a kinetic hero with a muted product loop, a tighter scroll-reveal section rhythm, and an updated `/about` companion page that shares the same visual language.

**Architecture:** Pure frontend work in `apps/web`. The landing feature bundle at `apps/web/src/features/landing/` and the `/about` route are the only surfaces in scope. Motion comes from `@/lib/motion` and CSS progressive enhancement; no API, DB, or shared-package changes.

**Tech Stack:** React 18, TypeScript, CSS custom properties, framer-motion presets already in the repo, CSS `animation-timeline` / `view()` progressive enhancement, Puppeteer-driven screenshot capture.

**Branch:** `feature/landing-refresh` off `main` (phases 1–4 are already merged to `main` via PRs #19–#23).

## Global Constraints

- Design tokens only: no hardcoded hex in component code; colors must come from `var(--token)` or theme-aware computed values already in the repo.
- Borders stay `0.5px solid var(--border-*)`; no `box-shadow`; buttons keep `border-radius: var(--r-pill)`; font weights remain 400/500; sentence case everywhere.
- Motion must use `@/lib/motion` presets where framer is involved; transform/opacity only; respect `prefers-reduced-motion`; landing scroll effects must degrade cleanly when `animation-timeline` is unavailable.
- `npx pnpm` is required for every package command; `pnpm` is not on PATH.
- Repo-wide verification may keep the pre-existing `ShuttleMap.test.tsx` failure only; everything else should be green.
- No `any`; named exports; keep the landing feature and `/about` page consistent with the existing app conventions.

### Task 1: Hero refresh with kinetic type and product loop

**Files:**
- Modify: `apps/web/src/features/landing/components/HeroSection.tsx`
- Modify: `apps/web/src/features/landing/components/LandingNav.tsx`
- Modify: `apps/web/src/styles/landing.css`
- Test: `apps/web/src/features/landing/components/HeroSection.test.tsx`

**Interfaces:**
- Produces a hero that replaces the current demo-modal pattern with an inline muted autoplaying product loop, poster fallback, offscreen pause/resume, and oversized kinetic headline treatment.

- [ ] **Step 1:** Replace the YouTube demo modal flow in `HeroSection.tsx` with an inline looping product media rail that uses a local video source or existing app asset, is muted/playsInline/autoplay by default, and falls back to a static poster when motion is reduced.
- [ ] **Step 2:** Rework the hero copy and headline composition so the hero reads as a platform briefing, not a generic product pitch; keep the CTA pair sentence case and ensure the secondary CTA points into the refreshed story/about flow.
- [ ] **Step 3:** Update `LandingNav.tsx` only as needed to fit the new hero rhythm and scrolling behavior, without introducing new navigation states or backend dependencies.
- [ ] **Step 4:** Add a focused hero test that asserts the new CTA labels and the presence of the inline media fallback path.
- [ ] **Step 5: Verify** — run the hero test, then `npx pnpm typecheck && npx pnpm lint`.
- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/landing/components/HeroSection.tsx apps/web/src/features/landing/components/LandingNav.tsx apps/web/src/styles/landing.css apps/web/src/features/landing/components/HeroSection.test.tsx
git commit -m "feat(web): refresh landing hero with kinetic type and product loop"
```

---

### Task 2: Landing section rhythm and scroll-reveal system

**Files:**
- Modify: `apps/web/src/features/landing/components/TickerStrip.tsx`
- Modify: `apps/web/src/features/landing/components/StatsSection.tsx`
- Modify: `apps/web/src/features/landing/components/FeaturesSection.tsx`
- Modify: `apps/web/src/features/landing/components/HowItWorks.tsx`
- Modify: `apps/web/src/features/landing/components/UniversitiesSection.tsx`
- Modify: `apps/web/src/features/landing/components/TestimonialsSection.tsx`
- Modify: `apps/web/src/features/landing/components/PricingSection.tsx`
- Modify: `apps/web/src/features/landing/components/CtaSection.tsx`
- Modify: `apps/web/src/features/landing/hooks/useScrollReveal.ts`
- Modify: `apps/web/src/styles/landing.css`

**Interfaces:**
- Produces a landing stack that reads as a campus briefing: quieter section headers, stronger content hierarchy, CSS view-timeline reveals where supported, and one signature multi-tenant accent sweep in the universities section.

- [ ] **Step 1:** Replace the current JS-heavy reveal choreography with CSS progressive enhancement using `animation-timeline: view()` where supported, while keeping a reduced-motion fallback that leaves the page stable and readable.
- [ ] **Step 2:** Recompose the landing sections into a tighter editorial rhythm: shorter lead-in copy, clearer section contrasts, and more deliberate spacing so the feed, jobs, events, and community themes feel platform-first rather than marketing-generic.
- [ ] **Step 3:** Turn `UniversitiesSection.tsx` into the signature interaction for the page by animating the campus crest / tenant-accent treatment across multiple universities, with a static fallback for browsers that do not support the progressive enhancement path.
- [ ] **Step 4:** Keep `TickerStrip`, `StatsSection`, `FeaturesSection`, `HowItWorks`, `TestimonialsSection`, `PricingSection`, and `CtaSection` visually consistent with the new hero and about-page treatment, without changing the underlying content model.
- [ ] **Step 5:** Add or update a landing-page smoke test only if it is needed to pin the section order or the hero/section anchor structure; otherwise rely on visual verification in Task 4.
- [ ] **Step 6: Verify** — run `npx pnpm typecheck && npx pnpm lint`.
- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/landing/components/TickerStrip.tsx apps/web/src/features/landing/components/StatsSection.tsx apps/web/src/features/landing/components/FeaturesSection.tsx apps/web/src/features/landing/components/HowItWorks.tsx apps/web/src/features/landing/components/UniversitiesSection.tsx apps/web/src/features/landing/components/TestimonialsSection.tsx apps/web/src/features/landing/components/PricingSection.tsx apps/web/src/features/landing/components/CtaSection.tsx apps/web/src/features/landing/hooks/useScrollReveal.ts apps/web/src/styles/landing.css
git commit -m "feat(web): rework landing section rhythm and scroll reveals"
```

---

### Task 3: About route and shared landing chrome refresh

**Files:**
- Modify: `apps/web/src/features/landing/components/AboutStory.tsx`
- Modify: `apps/web/src/features/landing/components/LandingNav.tsx`
- Modify: `apps/web/src/features/landing/components/LandingFooter.tsx`
- Modify: `apps/web/src/pages/AboutPage.tsx`
- Modify: `apps/web/src/styles/landing.css`

**Interfaces:**
- Produces a refreshed `/about` page that matches the new landing language and keeps the shared landing chrome visually aligned across both public routes.

- [ ] **Step 1:** Rework `AboutStory.tsx` so the story panels use the refreshed spacing, hierarchy, and motion timing from the landing page while keeping the existing factual narrative intact.
- [ ] **Step 2:** Update `LandingNav.tsx` and `LandingFooter.tsx` to match the new brand tone: stronger identity, calmer surface treatment, and consistent link / label rhythm between landing and about.
- [ ] **Step 3:** Keep `AboutPage.tsx` thin, but verify it still composes the same landing chrome around the updated story content and does not introduce page-specific overrides that drift from the landing treatment.
- [ ] **Step 4:** Add or refresh a small about-page smoke test only if needed to guard the heading order or story-section presence; otherwise rely on screenshot verification.
- [ ] **Step 5: Verify** — run `npx pnpm typecheck && npx pnpm lint`.
- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/landing/components/AboutStory.tsx apps/web/src/features/landing/components/LandingNav.tsx apps/web/src/features/landing/components/LandingFooter.tsx apps/web/src/pages/AboutPage.tsx apps/web/src/styles/landing.css
git commit -m "feat(web): refresh about route and shared landing chrome"
```

---

### Task 4: Final verification + screenshots

**Files:**
- Modify: `scripts/screenshot.cjs`
- Modify: `CLAUDE.md` if the screenshot reference table needs the new public routes documented
- Screenshots: `screenshots/landing.png`, `screenshots/about.png`

**Interfaces:**
- Produces the final public-page reference captures and confirms the landing refresh against the repo’s screenshot harness.

- [ ] **Step 1:** Extend `scripts/screenshot.cjs` with `landing` and `about` route entries and a small width/theme matrix so the public pages can be captured at the acceptance sizes used by the spec.
- [ ] **Step 2:** Update the screenshot reference table in `CLAUDE.md` if the new public-page captures should be listed alongside the existing auth-gated captures.
- [ ] **Step 3:** Capture the refreshed landing and about screenshots and confirm the hero loop, section rhythm, and shared chrome all read correctly in the captures.
- [ ] **Step 4:** Run the repo-wide validation pass: `npx pnpm typecheck && npx pnpm lint`, then the web test suite, accepting only the pre-existing `ShuttleMap.test.tsx` failure if it is still present.
- [ ] **Step 5: Commit**

```bash
git add scripts/screenshot.cjs CLAUDE.md screenshots/landing.png screenshots/about.png
git commit -m "chore(web): refresh landing and about screenshots"
```
