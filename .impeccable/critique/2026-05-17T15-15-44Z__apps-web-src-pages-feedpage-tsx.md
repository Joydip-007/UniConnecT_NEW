---
target: apps/web/src/pages/FeedPage.tsx + FeedLayout + sidebars
total_score: 23
p0_count: 0
p1_count: 2
timestamp: 2026-05-17T15-15-44Z
slug: apps-web-src-pages-feedpage-tsx
---
# Feed page critique (FeedPage + FeedLayout + LeftSidebar + RightSidebar)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeletons + socket "Reconnecting…" exist; no feedback after Save/Like |
| 2 | Match System / Real World | 3 | Copy is natural; "Get verified" with a lock reads as cryptic gating |
| 3 | User Control and Freedom | 2 | No undo on Save/Like; poll vote irreversible the moment you click |
| 4 | Consistency and Standards | 4 | Token discipline is excellent — 0.5px borders, sentence case, pill radii enforced |
| 5 | Error Prevention | 2 | No confirmation on poll vote; nothing protects accidental Save |
| 6 | Recognition Rather Than Recall | 3 | Icon + label always paired; role badges; readable filter tabs |
| 7 | Flexibility and Efficiency | 1 | Zero keyboard shortcuts; mobile drops 7+ nav items to 4-icon bottom bar |
| 8 | Aesthetic and Minimalist Design | 2 | 12+ stacked cards; UIU orange identity barely present |
| 9 | Error Recovery | 2 | "Reconnecting…" good; no visible network-error UI in feed |
| 10 | Help and Documentation | 1 | No help affordance anywhere |
| **Total** | | **23/40** | Functional but unremarkable |

## Anti-Patterns Verdict

Does NOT look obviously AI-generated — token system has clear opinions and they are enforced. But falls into the first-order category reflex: deep-navy + indigo + accent-orange is the social/community AI default. UIU orange identity is functionally absent — counted ~4 orange touches on the rendered feed. Page is a stack of cards: 12+ rounded rectangles with the same 0.5px border before scrolling.

Deterministic scan: 2 warnings, both `transition: width` on progress-bar fills (PostCard.tsx:116, RightSidebar.tsx:350). Acceptable tradeoff for fill bars where transform-scale warps content.

## Priority Issues

- **[P1] Right rail = 4 widgets stacked; Progress (the activation driver) is below the fold.** Trending widget duplicates content (pinned post repeats the inline Announcement). Fix: reorder by intent, kill the duplication. Suggested: `/impeccable distill` on RightSidebar.
- **[P1] UIU orange identity is functionally absent.** Indigo carries everything. Pick one structural role for orange (self / your content / your actions) and commit. Suggested: `/impeccable colorize`.
- **[P2] Card-on-card-on-card rhythm.** Demote secondary widgets to borderless sections, keep one hero card per column. Suggested: `/impeccable layout` on FeedLayout + sidebars.
- **[P2] Mobile loses ~70% of nav** (11 items → 4 bottom-bar icons). In a mobile-first context, gating Groups/Events/Jobs/News/Shuttle/Lost-and-found behind a missing path is a real loss. Suggested: `/impeccable adapt`.
- **[P3] No help, no first-run guidance, no keyboard shortcuts.** Suggested: `/impeccable onboard` then `/impeccable harden`.

## Persona Red Flags

**Faiyaz, CS student on a mid-tier Android during the shuttle ride:** Can't reach Lost & Found from bottom nav. Progress widget buried below fold. Sub-12px event location text strains readability.

**Dr. Ahmed, faculty posting an announcement:** His announcement appears in two places (feed top + Trending sidebar) — looks like thin content recycling. No faculty-specific create flow despite "role-awareness is a feature".

**Alex, power user:** No j/k navigation, no `c` to compose, no digit shortcuts for filter tabs.

## Minor Observations

- Save button outweighs Like and Comment visually
- "All caught up" divider uses tertiary text on near-black — almost invisible
- `scrollbarWidth: 'none'` on both sidebars hides the scroll affordance entirely
- Multiple sub-12px text instances (event location 11px, month 10px) won't survive mid-tier Android
- Poll fill bar at 600ms transition feels sluggish for vote acknowledgement; drop to 250ms
