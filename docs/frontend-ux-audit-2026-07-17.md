# Frontend UX & quality audit — apps/web (re-audit)

Date: 2026-07-17 · Method: `/impeccable audit` — code-level re-check against the baseline audit (`frontend-ux-audit-2026-07-16.md`) after completing its full recommended-action queue (`harden` → `typeset` → `onboard` → `clarify` → `optimize` → `polish`). Based on a fresh full-category `react-doctor` scan (624 findings, down from 866) and direct verification of every P1–P3 finding from the baseline report. No new screenshots were captured this session, so anti-pattern/responsive re-scoring is grounded in code-level verification of the baseline's specific findings, not a fresh end-to-end visual pass.

## Audit health score

| # | Dimension | Score (was) | Score (now) | Key finding |
|---|-----------|:---:|:---:|-------------|
| 1 | Accessibility | 2/4 | **4/4** | All 5 P1 a11y rules (`no-outline-none`, `control-has-associated-label`, `label-has-associated-control`, `no-tiny-text`, `click-events-have-key-events`/`no-static-element-interactions`) are fully clear repo-wide. Only the 4 known false positives remain (`<dialog>` misread as non-interactive). |
| 2 | Performance | 2/4 | **3/4** | Both flagged perf issues addressed: RightSidebar's 4 height animations now use framer-motion's `layout` prop (transform-based); PostCard/ChatView's static inline styles hoisted to module scope. Broader repo-wide perf debt (`no-giant-component`, `use-lazy-motion`, memoization) was outside this audit's scope and remains untouched — not a regression, just unaddressed. |
| 3 | Responsive design | 3/4 | 3/4 | Unchanged from baseline; no responsive-specific work was in scope this pass beyond the onboarding checklist's new mobile/desktop split (verified correct — see Onboarding below). |
| 4 | Theming | 4/4 | 4/4 | Unchanged — still only the same 5 pre-existing hex values (PDF export template, shuttle-map brand fallback, intentional black letterbox), all justified exceptions noted in the baseline. |
| **Total** | | **14/20** | **18/20** | **Excellent — minor polish remaining** |

## Anti-patterns verdict

**Pass, improved.** The baseline's two concrete anti-pattern tells are both resolved:
- The "People you may know" identical-card grid (Explore) is now a dense list (avatar, name, department, one-tap connect) — matches the existing `PersonRow` pattern used elsewhere in the app.
- Cold-start emptiness (Explore's five discovery sections, RightSidebar) no longer renders stacked "nothing here" headers — empty sections hide entirely, with a single actionable fallback when a whole page is empty.

## Executive summary

- Health score **18/20 (Excellent)**, up from 14/20. No P0 or P1 issues remain open.
- All four baseline P1s closed: focus outlines restored, 59+ controls now labeled, sub-12px text raised to 12px+ repo-wide, keyboard access gaps closed.
- All five baseline P2s closed: onboarding de-duplicated, Explore/rail cold-starts fixed, messages list preview text fixed, login register-path duplication removed, RightSidebar height animations mitigated, PostCard/ChatView inline styles hoisted.
- Three of four baseline P3s closed (dialog semantics, alt text, autofocus); the identical-card grid was also fixed as part of `/impeccable polish`.
- Remaining open item: 4 `no-noninteractive-element-interactions` false positives on native `<dialog>` elements — not real issues, just a react-doctor limitation. Candidates for `.react-doctor/false-positives.md` (not auto-added, per playbook).

## What changed since the baseline (2026-07-16)

### Accessibility — closed
- **Focus outlines**: 21 `outline: none` sites restored to the project's global `:focus-visible` styling.
- **Unlabeled controls**: `aria-label` added to icon-only buttons; `htmlFor`/`id` pairs added to form fields (59 + 17 sites).
- **Sub-12px text**: all 83 sites raised to 12px+ (LeftSidebar and MobileBottomNav first, per baseline's own priority order, then the remaining ~37 sites across RightSidebar, EventCard, ResourcesTab, ChatView, AdminPage, and others).
- **Keyboard access gaps**: clickable divs converted to real `<button>`/`<a>` elements or given `role`/`tabIndex`/key handlers (35 sites).

### UX — closed
- **Duplicated onboarding**: the feed's "Welcome to UniConnecT" card now hides once the user has made progress *and* the desktop right rail (which carries the compact checklist) is visible — avoiding two trackers stacked at once, while staying the sole progress surface on mobile where the rail doesn't render. The "Say hi to your campus" banner now only fires when first-post really is the next incomplete step (profile/headline/bio already done), not just whenever the user hasn't posted.
- **Cold-start emptiness**: Explore's five discovery sections and RightSidebar's modules hide entirely when empty instead of printing "no X yet" headers; a single actionable empty state shows when a whole page has nothing yet.
- **Messages list**: conversations with no messages now show "No messages yet" instead of a blank line (was silently rendering a stray non-breaking space).
- **Mobile login duplication**: removed the redundant inline invite-code form on `/login` — a single "Have an invitation? Create your account" link now points to the register flow's own invite-code step. (Note: the "circular tropical-island graphic" mentioned in the baseline could not be located in current source — may already have been removed prior to this session.)

### Performance — closed (in scope)
- **RightSidebar height animations** (4 sites): switched to framer-motion's `layout` prop so the collapse/reflow uses a transform-based FLIP animation instead of animating the `height` CSS property directly. Note: react-doctor's static analyzer still flags these textually (it can't detect the `layout` prop's runtime effect), so they still appear in a raw diagnostic count — this is a tooling limitation, not an unresolved issue.
- **Inline style objects**: hoisted every prop/state-independent `style={{...}}` literal in `PostCard.tsx` (~35 sites) and `ChatView.tsx`'s `MessageBubble`/`DateDivider` (~15 sites, the true per-message hot path) to module scope. The baseline's "393 inline style objects, 145 files" figure covers the whole repo; this pass targeted the two hottest paths the baseline itself named as priority ("PostCard, feed list, ChatView"). `prefer-module-scope-static-value` findings in those two files are now zero.

### Polish — closed
- **Autofocus**: removed the page-load `autoFocus` on `ForgotPasswordPage`'s reset-password field. Left `EmojiPicker`'s `autoFocus` in place — it's a third-party popover prop firing only after an explicit user click, not the page-load anti-pattern the baseline flagged.
- **Redundant alt text / dialog semantics**: both already clear at scan time — resolved during the `harden` pass before this audit-order reached them explicitly.
- **Identical card grid**: see Anti-patterns above.

## Remaining known items

- **4 `no-noninteractive-element-interactions` false positives** on `ImageLightbox.tsx:62`, `MobileBottomNav.tsx:224`, `ShortcutHelp.tsx:31`, `AdminPage.tsx:476` — all native `<dialog>` elements the rule doesn't recognize as interactive. Not a real defect; candidate false-positive entries left for the user to add if desired.
- **Broader repo-wide perf/architecture debt** (`no-giant-component`: 20, `use-lazy-motion`: 18, `button-has-type`: 58, `no-array-index-as-key`: 13, circular dependencies: 13, etc.) was never in scope for this audit cycle — it wasn't flagged in the baseline's P0–P3 findings, so it isn't counted against the health score here, but it's worth a dedicated pass if the team wants to keep pushing performance/architecture further.

## Positive findings (still holding)

- Theming discipline remains excellent — token system used consistently, only the same 5 justified hex exceptions.
- MobileBottomNav's touch targets, feed keyboard shortcuts, and onboarding's contextual design all remain intact and unaffected by this cycle's changes.

## Recommended next steps

No P0/P1/P2 work remains. Optional, lower-priority follow-ups if the team wants to keep going:

1. **[P3]** Add the 4 known `<dialog>` false positives to `.react-doctor/false-positives.md` (user action, not auto-edited).
2. **[P3] `/impeccable optimize`** (broader scope): tackle repo-wide architecture/perf debt (`no-giant-component`, `use-lazy-motion`, `no-array-index-as-key`) if the team wants to keep pushing past this audit's original scope.

> Score moved from **14/20 (Good)** to **18/20 (Excellent)**.
