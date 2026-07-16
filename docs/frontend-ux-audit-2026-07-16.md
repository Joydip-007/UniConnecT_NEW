# Frontend UX & quality audit — apps/web

Date: 2026-07-16 · Method: `/impeccable audit` (register: **product**) — reference screenshots reviewed from a user's point of view (feed, profile, messages, explore, connections, mobile login), react-doctor diagnostics (866 findings) mined for measurable a11y/perf/theming data, and targeted code verification. **No code was changed.**

## Audit health score

| # | Dimension | Score | Key finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2/4 | 21 components remove focus outlines; 59 controls lack accessible labels; 83 sites of sub-12px text |
| 2 | Performance | 2/4 | 393 inline style objects rebuilt per render across 145 files; 4 layout-property (`height`) animations in RightSidebar |
| 3 | Responsive design | 3/4 | Mobile nav has proper 44px targets; tiny text hurts most on mobile; no tablet-width pass evident |
| 4 | Theming | 4/4 | Token system used consistently; only 5 hardcoded hex values outside tokens/tests; light theme defined |
| 5 | Anti-patterns | 3/4 | Mostly intentional design; identical card grids on Explore; empty right-rail modules |
| **Total** | | **14/20** | **Good — address weak dimensions** |

## Anti-patterns verdict

**Pass, with notes.** The app does not read as AI-generated: the warm navy + UIU orange identity, pill buttons, 0.5px borders, and sentence-case copy are consistent and deliberate. The tells that remain: the "People you may know" row on Explore is an identical-card grid (same size, avatar + name + button ×4), and the right rail stacks a progress module above two frequently-empty modules, which reads as template filler when they have no content.

## Executive summary

- Health score **14/20 (Good)**. No P0 blockers found.
- Issue counts: **P0: 0 · P1: 4 · P2: 7 · P3: 4**
- Top issues: removed focus outlines (keyboard users lose their place), unlabeled icon controls (screen readers announce "button"), 9–11px text under Bangladesh's high-mobile usage context, cold-start emptiness on Explore/right rail, and the duplicated onboarding checklist.
- The design system itself is healthy; the gaps are execution details (a11y hygiene) and first-week user experience (empty states, duplication).

## Detailed findings

### P1 — fix before release

**[P1] Focus outlines removed on 21 interactive components**
- Location: `outline: none` in StickerDrawer, CommentDrawer, CreatePost, PostCard, SharePostModal, group/jobs/mentorship modals, ConnectionsPage, EventsPage, GroupsPage (full list in react-doctor `no-outline-none` output)
- Category: Accessibility · WCAG 2.4.7 (Focus visible)
- Impact: keyboard users (and the feed's own j/k/c shortcut users) cannot see where focus is. The feed page ships keyboard shortcuts, so the product clearly expects keyboard users — then hides their cursor.
- Recommendation: replace every `outline: none` with a `:focus-visible` style using `var(--uc-indigo-l)`; never remove without replacement.

**[P1] 59 controls without accessible labels + 17 orphan `<label>`s**
- Location: repo-wide (`control-has-associated-label`, `label-has-associated-control`)
- Category: Accessibility · WCAG 4.1.2 / 1.3.1
- Impact: icon-only buttons (close ×, emoji, attach, share) announce as just "button" in screen readers; form fields lose the tap-the-label affordance on mobile.
- Recommendation: `aria-label` on every icon-only button; `htmlFor`/`id` pairs on form fields. Mechanical sweep, low risk.

**[P1] Sub-12px text at 83 sites (9–11px)**
- Location: worst offenders LeftSidebar (9–11px), MobileBottomNav (9–10px labels), plus 71 more files
- Category: Accessibility / Responsive · WCAG 1.4.4 spirit
- Impact: PRODUCT.md names high mobile usage on mid-range devices; 9px labels on a 5.5-inch screen are illegible outdoors. The bottom-nav labels are the single highest-traffic instance.
- Recommendation: raise floor to 11–12px for labels, 13–14px for body. Do LeftSidebar + MobileBottomNav first, then sweep per screen.

**[P1] Keyboard access gaps on clickable elements (18 + 17 sites)**
- Location: `click-events-have-key-events`, `no-static-element-interactions` — clickable `div`s without key handlers/roles
- Category: Accessibility · WCAG 2.1.1
- Impact: rows and cards that open detail views are mouse/touch-only.
- Recommendation: swap clickable `div`s for `<button>`/`<a>`, or add `role`, `tabIndex`, and Enter/Space handlers.

### P2 — next pass

**[P2] Duplicated onboarding checklist on the feed**
- Location: feed page — "Welcome to UniConnecT" card (center, 5 items) + "Your progress" rail (right, 4 near-identical items), and the "Say hi to your campus" banner directly below makes a third prompt for the same first-post action
- Category: UX / Anti-pattern
- Impact: three modules ask the new user for the same actions above the fold; the actual feed content starts ~900px down. Also inconsistent: rail says "Profile complete 70/100" unchecked while the card shows headline/bio struck through as done.
- Recommendation: one onboarding surface. Keep the rail's compact checklist, drop the welcome card once ≥1 item is done, and only show the "Say hi" banner if "first post" is the next incomplete step.

**[P2] Cold-start emptiness on Explore and the right rail**
- Location: ExplorePage ("Trending — No trending posts yet", "Upcoming events — No upcoming events"), RightSidebar ("People you may know — No suggestions right now", "Upcoming events — No upcoming events")
- Category: UX / Onboarding
- Impact: on a young network, Explore renders as a stack of "nothing here" headers — the page teaches users it's not worth visiting.
- Recommendation: hide empty modules instead of rendering their headers, or replace with a single actionable prompt (e.g. "Invite classmates" / "Browse groups"). Empty states should point at the one action that fills them.

**[P2] Messages: conversation rows lack unread/read signal and the third row lacks a timestamp/preview**
- Location: messages list (screenshot: "Asif Abrar" row has no preview or time; no unread badges anywhere)
- Category: UX
- Impact: users can't triage which conversation needs attention — the core job of a message list.
- Recommendation: unread count badge + bold last-message for unread; always render a timestamp; fall back to "No messages yet" as preview.

**[P2] Mobile login: two competing register paths + stray decorative image**
- Location: `/login` mobile — "Have an invitation? Enter your invite code" card with a `Register` button, followed by "Or go to register page", plus an unexplained circular tropical-island graphic floating bottom-right over the footer
- Category: UX / Clarity
- Impact: two entry points to the same registration flow force a choice the user can't reason about; the floating graphic looks like a leftover sticker and undermines the "focused, precise" brand voice.
- Recommendation: single register CTA (invite code collected inside the register flow); remove or justify the island graphic.

**[P2] Height animations in RightSidebar (4 sites)**
- Location: `RightSidebar.tsx:167, 564, 581, 593`
- Category: Performance
- Impact: animating `height` re-runs layout every frame — visible jank on the mid-range Android devices the product targets.
- Recommendation: framer-motion `layout` prop or transform-based reveal. (Carried over from the bug report; still open.)

**[P2] 393 inline style objects rebuilt per render (145 files)**
- Location: repo-wide pattern — large `style={{...}}` literals
- Category: Performance / Maintainability
- Impact: each render allocates hundreds of objects; on long feeds this adds GC pressure precisely on low-end devices. Also blocks any future CSS-level theming/refactor.
- Recommendation: migration-scale — extract static style objects to module scope (react-doctor's `prefer-module-scope-static-value` recipe) in the hottest paths first: PostCard, feed list, ChatView.

### P3 — polish

- **[P3] Explore "People you may know" identical-card grid** — four same-shape cards; a denser list (avatar, name, dept, one-tap connect) would fit the product register better and show more people.
- **[P3] `prefer-html-dialog` (4 modals)** — custom modal divs; native `<dialog>` gives focus trapping and Esc for free.
- **[P3] Redundant alt text (3 imgs)** — "photo/image" inside alt attributes (ImageLightbox, LostFoundCard, EditProfileModal).
- **[P3] `autofocus` on 2 inputs** — disorienting for screen-reader users; focus programmatically after user intent instead.

## Patterns & systemic issues

1. **A11y is the systemic gap, not the design.** All four P1s are the same root cause: visual design was built mouse-first and the a11y layer (labels, focus, key handlers, sizes) wasn't part of the component definition-of-done. A per-component checklist (label? focus-visible? 44px? ≥12px?) would prevent recurrence.
2. **Inline styles as the styling mechanism** (145 files) is both the perf warning cluster and the reason one-off values (9px text, hex colors) slip through — there's no shared `Text`/`Label` primitive enforcing the floor.
3. **Empty-state strategy is per-module, not per-page.** Each widget handles "no data" by printing a sentence; nobody owns what the page as a whole looks like on day one of a new campus.

## Positive findings

- **Theming is genuinely strong**: token discipline is near-total (5 stray hex values in the whole app), light theme exists, and the identity (navy + UIU orange, pill buttons, 0.5px borders, sentence case) is applied consistently — the design-system rules in CLAUDE.md are actually being followed.
- **MobileBottomNav gets touch targets right** (44px min-heights) and the app has a real mobile navigation pattern, not a shrunken desktop.
- **Onboarding exists and is contextual** (progress checklist, verified badge, first-post nudge) — it just needs de-duplication, not rebuilding.
- **Empty states have copy with intent** ("Message alumni for career advice…") rather than bare "No data".
- **Feed keyboard shortcuts (j/k/c/?)** are a power-user touch rare in campus apps — once focus outlines return, they'll be fully usable.

## Recommended actions (priority order)

1. **[P1] `/impeccable harden`** — a11y sweep: restore `:focus-visible` on the 21 outline-none sites, label the 59 unlabeled controls, add key handlers to clickable divs
2. **[P1] `/impeccable typeset`** — raise the type floor (9–11px → 12px+), starting with LeftSidebar and MobileBottomNav
3. **[P2] `/impeccable onboard`** — consolidate the triple onboarding prompt on feed; design real cold-start states for Explore and the right rail
4. **[P2] `/impeccable clarify`** — mobile login register-path duplication; messages list read/unread signaling
5. **[P2] `/impeccable optimize`** — RightSidebar height animations; module-scope static styles in PostCard/ChatView hot paths
6. **[P3] `/impeccable polish`** — dialog semantics, alt text, autofocus, Explore card grid density

> Re-run `/impeccable audit` after fixes to see the score improve.
