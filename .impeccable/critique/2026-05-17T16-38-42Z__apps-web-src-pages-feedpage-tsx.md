---
target: apps/web/src/pages/FeedPage.tsx + FeedLayout + TopNav + sidebars
total_score: 28
p0_count: 0
p1_count: 2
timestamp: 2026-05-17T16-38-42Z
slug: apps-web-src-pages-feedpage-tsx
---
# Feed page critique (authenticated feed)

Target: apps/web/src/pages/FeedPage.tsx + FeedLayout + TopNav + sidebars  
Visual inputs: .impeccable/critique/shots/feed-auth-desktop-1440.png and feed-auth-mobile-390.png

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Loading skeletons, socket reconnect banner, save toast, and progress state exist; like/comment feedback is still mostly local and quiet. |
| 2 | Match system / real world | 3 | Campus language is natural and the feed feels institution-native; "Get verified" and progress copy still lack enough context. |
| 3 | User control and freedom | 3 | Undo exists for save and shortcuts help can be dismissed; poll voting is still irreversible and quick actions are easy to mis-tap. |
| 4 | Consistency and standards | 4 | Strong token discipline: hairlines, pill buttons, sentence case, restrained weights, and no shadow-based depth in the feed. |
| 5 | Error prevention | 2 | Poll votes submit on first tap with no review; mobile header overflow can cause accidental/hidden targets. |
| 6 | Recognition rather than recall | 3 | Labels accompany nav/actions and shortcut help exists; mobile relies on More for many routes. |
| 7 | Flexibility and efficiency | 3 | j/k, c, ?, and number shortcuts materially improve desktop efficiency. |
| 8 | Aesthetic and minimalist design | 3 | The feed is calmer and more purposeful than before; mobile top chrome is crowded and desktop still leans card-stack heavy. |
| 9 | Error recovery | 2 | Network failure handling exists but feed-level failed loads and failed poll votes are not visible enough. |
| 10 | Help and documentation | 2 | Keyboard shortcut help exists, but no contextual help for progress, verification, or first-run role-aware actions. |
| **Total** | | **28/40** | **Good foundation, with mobile layout risk** |

## Anti-Patterns Verdict

Does this look AI-generated? Not immediately. The feed has a coherent design system: dark navy surfaces, UIU orange for self/action cues, indigo for network/system cues, hairline borders, and restrained weight usage. It avoids the obvious slop tells: no gradient text, no glass cards, no decorative shadows, no side-stripe cards, no identical icon-grid marketing blocks in the product surface.

The remaining AI-ish pattern is structural: the desktop page still reads as a familiar three-column social dashboard with stacked rounded rectangles. The stronger project-specific signal is now in the orange announcement strip, profile ring, progress bars, active filter, and save actions, which helps. The bigger problem is not taste, it is mobile fit: the fresh mobile screenshot shows the top nav wider than the viewport, cutting off the right avatar and truncating search.

Deterministic scan: 2 warnings, both layout-property animations:
- apps/web/src/components/RightSidebar.tsx:356, progress bar uses transition: width.
- apps/web/src/features/feed/components/PostCard.tsx:117, poll fill uses transition: width.

These are warnings, not release blockers. Progress-fill width animation is understandable, but use transform scaleX if possible.

## Overall Impression

The feed is now a credible campus product surface. It feels quieter, more role-aware, and less generic than the previous critique. The single biggest opportunity is mobile chrome: for a mobile-first South Asian campus app, the header cannot horizontally overflow or crop controls.

## What's Working

1. The system has real opinions. The UI uses orange for self/action states and indigo for peer/system states, and the desktop screenshot shows that distinction more clearly than before.

2. The feed now has better efficiency hooks. j/k navigation, c compose, number filters, and ? help make the surface more usable for repeat users.

3. The right rail is less noisy than a typical social sidebar. Progress, people, events, and trends are visually separated without nesting cards everywhere.

## Priority Issues

**[P1] Mobile top nav overflows horizontally**  
Why it matters: The authenticated mobile screenshot shows the logo, search, message icon, and avatar competing in one fixed row. The avatar is clipped off the right edge and search text truncates mid-placeholder. This violates the mobile-first premise and makes primary navigation feel broken.  
Fix: At <=480px, collapse the header to logo + compact search icon, or logo + search pill + no avatar. Move message/avatar access to bottom nav/More sheet. Add a hard overflow check: body/clientWidth must equal viewport width.  
Suggested command: /impeccable adapt apps/web/src/components/TopNav.tsx

**[P1] Mobile primary content is visually oversized**  
Why it matters: On 390px, the announcement card dominates the first screen. The post body is readable, but it delays scanning and reduces feed throughput for commute usage.  
Fix: Reduce mobile post body size/line-height slightly, compress header metadata, and consider a pinned-announcement compact variant with expandable details after 4-5 lines.  
Suggested command: /impeccable layout apps/web/src/features/feed/components/PostCard.tsx

**[P2] Progress widget explains the unlock poorly**  
Why it matters: "Finish your profile to unlock the campus directory" appears even when First post and Get verified are done, while 10 connections is the remaining blocker. Users need the next action, not a generic milestone list.  
Fix: Generate contextual next-step copy from the incomplete milestone: "Connect with 6 more people to unlock the campus directory." Make the incomplete row actionable.  
Suggested command: /impeccable clarify apps/web/src/components/RightSidebar.tsx

**[P2] Poll vote is a one-tap irreversible action**  
Why it matters: Poll options look like harmless list rows, but one tap immediately locks the user in and silently posts to the API. This is risky on mobile.  
Fix: After tap, show a selected state plus a compact "Vote" / "Change" affordance, or allow changing vote until the request succeeds.  
Suggested command: /impeccable harden apps/web/src/features/feed/components/PostCard.tsx

**[P3] Width animations are still flagged**  
Why it matters: The detector caught two layout-property transitions. They are low severity, but they can still cause jank on low-end Android devices.  
Fix: Use an inner fill at width: 100% and animate transform: scaleX(...) with transform-origin: left.  
Suggested command: /impeccable optimize

## Persona Red Flags

**Casey, distracted mobile user:** The top nav is too wide for the phone viewport. The avatar is partially off-screen, and the search field consumes the row while bottom navigation already owns route access. Casey will treat the clipped chrome as broken.

**Alex, repeat campus user:** The keyboard shortcuts are a clear win now. Remaining friction: no shortcut shown inline until ? is discovered, and no fast save/comment shortcut per focused post.

**Sam, accessibility-dependent user:** Focus indicators are present globally, nav buttons are labeled, and shortcut help is a proper dialog. Remaining risk: poll state change is visual-first, and progress lock/done status should be announced more explicitly with text tied to the row.

**Faiyaz, UIU student on a mid-tier Android:** The feed is readable, but the first announcement consumes too much vertical space and the header crop undermines trust. He needs a denser scan path between lectures.

## Minor Observations

- Desktop top nav is balanced; mobile top nav needs a separate composition, not a scaled desktop row.
- The active feed filter uses orange correctly.
- The announcement strip is doing useful institutional work; keep it rare.
- The desktop right rail is much improved from the older critique, but progress copy is too generic.
- The visible mobile screenshot does not show bottom nav because the first posts fill the viewport; verify bottom safe-area spacing after the header fix.

## Questions to Consider

- Should mobile search be a full-screen search mode instead of a persistent wide input?
- What is the one next action the progress widget wants from Joydip right now?
- Should official announcements have a compact collapsed mode on mobile?
