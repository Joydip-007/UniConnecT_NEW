## What I implemented

- Replaced the hero's demo-modal/orbital-timeline pattern with an inline product loop built from existing UniConnecT screenshots, including offscreen pause/resume via `IntersectionObserver`.
- Added a reduced-motion fallback that swaps the animated loop for a static poster image.
- Reworked the hero copy into a platform-briefing structure with an oversized kinetic headline, updated CTA pair, and compact scope/audience/outcome briefing cards.
- Updated the landing nav to align with the new story/about flow by renaming the route link to `Story` and tightening the scrolled-state threshold.
- Added a focused hero test covering the refreshed CTAs, product-loop region, and reduced-motion poster fallback.

## Tests run and results

- `npx pnpm exec vitest run src/features/landing/components/HeroSection.test.tsx` from `apps/web`: passed (`2` tests).
- `npx pnpm typecheck` from repo root: passed.
- `npx pnpm lint` from repo root: passed.
- Note: an initial attempt with `npx pnpm --filter web test -- src/features/landing/components/HeroSection.test.tsx` executed the broader web suite and exposed an unrelated pre-existing failure in `src/features/shuttle/components/ShuttleMap.test.tsx` (`No QueryClient set`). The scoped hero test itself passed when rerun directly.

## Files changed

- `apps/web/src/features/landing/components/HeroSection.tsx`
- `apps/web/src/features/landing/components/LandingNav.tsx`
- `apps/web/src/styles/landing.css`
- `apps/web/src/features/landing/components/HeroSection.test.tsx`

## Self-review findings

- The new hero stays within the requested token/border/radius/motion constraints in the scoped files.
- Reduced motion is handled both in render logic and in landing CSS, so the hero degrades to a static still cleanly.
- Offscreen pause/resume is applied to both the kinetic headline and the product loop.
- I did not find a local video asset in the repo, so the loop uses existing screenshot assets already present in the workspace instead of a video source.

## Any issues or concerns

- `graphify update .` failed in this environment with `Operation not permitted`, so I could not refresh `graphify-out/` after the code changes.
- The hero currently imports screenshot assets from the repo-level `screenshots/` directory; that works for this task surface, but a dedicated landing/media asset location inside `apps/web` would be cleaner if the landing is packaged independently later.

## Fixes after review

- Replaced the screenshot-only hero rail with a real inline `<video>` loop using a new local asset at `apps/web/src/assets/landing/product-loop.webm`, with `muted`, `playsInline`, `autoPlay`, `loop`, `poster`, and `IntersectionObserver`-driven pause/resume wiring in `HeroSection.tsx`.
- Moved the landing hero poster and related screenshot stills into `apps/web/src/assets/landing/` so the landing surface no longer depends on repo-root screenshot imports for this Task 1 media path.
- Removed the inline nav background from `LandingNav.tsx` so `.uc-landing-nav.nav-scrolled` can visibly change the nav background from CSS.
- Tightened the focused hero test to cover the inline video properties and the reduced-motion poster-only fallback path.

### Exact verification results

- `graphify update .` from repo root: failed with `Operation not permitted`.
- `npx pnpm exec vitest run src/features/landing/components/HeroSection.test.tsx` from `apps/web`: passed (`2` tests).
- `npx pnpm typecheck` from repo root: passed.
- `npx pnpm lint` from repo root: passed.
