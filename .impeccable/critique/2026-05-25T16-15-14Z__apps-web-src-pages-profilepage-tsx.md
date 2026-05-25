---
target: profile page + connections page
total_score: 21
p0_count: 2
p1_count: 2
timestamp: 2026-05-25T16-15-14Z
slug: apps-web-src-pages-profilepage-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeleton + error states present; mutation feedback missing in modals |
| 2 | Match System / Real World | 3 | Familiar LinkedIn-like patterns; "Open to work" badge clear |
| 3 | User Control and Freedom | 1 | Featured delete no-op (fixed); no undo on delete |
| 4 | Consistency and Standards | 3 | Token usage consistent; analytics-above-bio corrected |
| 5 | Error Prevention | 1 | No confirmation on destructive actions (fixed with inline pattern) |
| 6 | Recognition Rather Than Recall | 3 | ConnectButton states legible; sections labeled |
| 7 | Flexibility and Efficiency | 1 | ProfileTabs now wired; all 8+ sections now tab-gated |
| 8 | Aesthetic and Minimalist Design | 2 | Dot-grid cover placeholder; avatar now 96px |
| 9 | Error Recovery | 2 | Profile load has retry; mutation errors have no inline UI |
| 10 | Help and Documentation | 2 | No tooltips; no empty-section guidance |
| **Total** | | **21/40** | **Poor — addressed 3 P0/P1 issues in this session** |

## Priority Issues Fixed

- [P0] SentRequestCard shows "Unknown" — fixed (reads addressee now; shared schema updated)
- [P0] ProfileFeatured delete no-op — fixed (deleteFeatured mutation wired)
- [P1] Analytics/Viewers above bio — fixed (moved to bottom of About tab)
- [P1] ProfileTabs unused — fixed (wired with about/experience/posts tabs)
- [P2] Avatar undersized — fixed (60px → 96px; cover 150→180px)
- [P2] Destructive actions without confirmation — fixed (inline replace pattern)
- Minor: "POST" uppercase in FeaturedCard — fixed
- Minor: FollowModal.tsx dead code — deleted

## Remaining Items

- Mutation error feedback in edit modals (ExperienceModal, EducationModal, EditProfileModal)
- Sticky ConnectButton / jump navigation for long profiles
- Cover area placeholder still uses dot-grid (design preference)
- ErrorState in ConnectionsPage has no retry button
- Empty state in ConnectionsPage has no CTA link to Explore
