# Sidebar icon rail collapse — design spec

**Date:** 2026-07-05
**Status:** Approved for Phase 6 implementation
**Scope:** First independent Phase 6 slice from the design-refresh initiative: collapse the desktop left sidebar into a 68px icon rail while preserving the existing full sidebar, mobile bottom navigation, active indicator, tenant accent avatar treatment, and navigation semantics.

---

## 1. Goal

Make the primary app shell more flexible on laptop and tablet widths by giving `LeftSidebar` a compact 68px icon-rail mode. The rail should free horizontal room for the feed and learning surfaces without hiding primary navigation behind a menu. This is a frontend-only change: no API, database, auth, or route behavior changes.

## 2. Background

The master design-refresh spec defers the LeftSidebar collapse to Phase 6 (§7.3 and §9). Phase 2 already added the sliding active-nav indicator, hover icon nudge, clickable profile card, stats count-up, and tenant-accent avatar ring. This phase must keep those upgrades intact and add a compact presentation layer rather than replacing the sidebar model.

Current implementation anchors:

- `apps/web/src/components/LeftSidebar.tsx` owns grouped navigation, profile mini-card, campus tools, active-state matching, notification badges, and profile stats.
- `apps/web/src/components/FeedLayout.tsx` composes the left rail, main content, and right rail.
- `apps/web/src/styles/index.css` defines the 232px / content / 272px desktop grid, hides the right rail below 1100px, and hides the left rail below 768px when `MobileBottomNav` takes over.

## 3. Product Decision

Build a **persistent user-controlled collapse** for desktop/tablet app screens:

- Expanded width remains `232px`.
- Collapsed width is exactly `68px`.
- Users toggle the rail with an icon button at the top of the sidebar.
- The preference persists in `localStorage` so repeated sessions keep the user's chosen density.
- At mobile widths (`max-width: 767px`), the left sidebar remains hidden and the existing bottom nav remains the only primary navigation.

The rail is not auto-collapsed solely by viewport width. Auto-collapse can surprise users and complicate screenshots. The grid should, however, support the collapsed width cleanly at all desktop/tablet widths where the sidebar is visible.

## 4. UX Behavior

### Expanded Mode

Expanded mode should look and behave like the current sidebar with one addition: a compact collapse toggle in the top profile/header area. The toggle uses a familiar sidebar/panel icon from `lucide-react`, has an accessible label, and sits on the same visual rhythm as the existing profile mini-card. The current profile mini-card remains fully clickable, and connection/pending count-up stats remain visible.

### Collapsed Mode

Collapsed mode is a true icon rail, not a squeezed text sidebar:

- The rail width is `68px`.
- Nav items render centered icons in stable square hit targets.
- Group labels are visually hidden, not removed from the semantic structure.
- Text labels are hidden visually but exposed through `aria-label` and `title`.
- Active state keeps the existing `layoutId="nav-active-pill"` sliding indicator, sized to the compact item.
- Message badge and dot indicators remain visible on the icon.
- Profile entry reduces to the avatar ring button.
- Campus tools reduce to icon buttons with labels available via accessible name and tooltip/title.
- The expand toggle remains visible at the top and has a distinct accessible label.

The rail must not use hover-only disclosure as the primary way to identify items. Tooltips/titles are helpful, but screen reader names and stable route order carry the core usability.

## 5. Layout Behavior

`FeedLayout` should pass the collapsed state into the grid shell using a class or data attribute. `index.css` then switches the first grid column between `232px` and `68px`.

Desktop:

- Expanded: `grid-template-columns: 232px 1fr 272px`.
- Collapsed: `grid-template-columns: 68px 1fr 272px`.

Medium widths where the right rail is hidden:

- Expanded: `grid-template-columns: 232px 1fr`.
- Collapsed: `grid-template-columns: 68px 1fr`.

Mobile:

- Unchanged: `grid-template-columns: 1fr`; `.feed-layout-left { display: none; }`.

The sidebar itself should receive a width prop/state-derived style so the sticky `aside` and the CSS grid agree. The transition between widths uses transform/width-compatible CSS only, respects reduced motion, and stays within the existing duration token limits.

## 6. State And Interfaces

Add a small dedicated hook:

```ts
export function useSidebarRailPreference(): {
  isCollapsed: boolean
  toggleCollapsed: () => void
}
```

The hook:

- Initializes from `localStorage['uc:left-sidebar-collapsed'] === 'true'`.
- Defaults to expanded when storage is unavailable or unset.
- Writes `'true'` / `'false'` after user toggles.
- Avoids server assumptions; this is Vite client code, but tests still need a safe storage guard.

Component contract:

```tsx
<LeftSidebar collapsed={isCollapsed} onToggleCollapsed={toggleCollapsed} />
```

`LeftSidebar` remains responsible for rendering navigation and profile data. `FeedLayout` owns the layout state because it also controls the grid shell.

## 7. Accessibility

- Toggle button labels: `Collapse sidebar` in expanded mode and `Expand sidebar` in collapsed mode.
- Every collapsed nav/campus tool button has `aria-label={label}` and `title={label}`.
- Active route keeps `aria-current="page"`.
- The collapsed profile avatar button has `aria-label="View my profile"`.
- Hidden labels use CSS utility behavior equivalent to visually hidden text, not `display: none`, where the text is needed for assistive tech.
- Focus rings and keyboard tab order remain visible and logical.

## 8. Visual Constraints

- Use design tokens only: no hardcoded hex colors in component code.
- Borders remain `0.5px solid var(--border-*)`.
- No `box-shadow`.
- Font weights stay 400/500.
- Motion must be idle-calm and triggered only by toggle, hover, or active-route changes.
- Use `DUR` / `EASE_OUT_EXPO` or CSS duration tokens; no ad hoc animation timings.
- Text stays sentence case.
- The collapsed rail should feel quiet and utilitarian, not decorative.

## 9. Error Handling

If `localStorage` throws, the sidebar should still render expanded and toggling should update React state for the current session. If the profile query is still loading, collapsed mode shows the same avatar fallback initials as expanded mode.

## 10. Testing And Verification

Automated tests:

- Hook/unit test: default expanded when storage is empty.
- Hook/unit test: initializes collapsed when storage contains `'true'`.
- Hook/unit test: toggling writes the expected value.
- Component test: collapsed sidebar hides visual text labels while preserving accessible button names.
- Layout/component test: `FeedLayout` applies a collapsed class/data attribute after toggling.

Manual and browser verification:

- Run `npx pnpm --filter web test` for the relevant sidebar/layout tests.
- Run `npx pnpm --filter web typecheck` and `npx pnpm --filter web lint`.
- Use Playwright after implementation to verify desktop expanded, desktop collapsed, 768px collapsed, and mobile bottom-nav behavior.
- Confirm no text overlaps in the 68px rail and badge/dot indicators stay inside icon hit targets.

## 11. Out Of Scope

- Auto-collapsing based on viewport width.
- New navigation destinations.
- Backend preference persistence.
- RightSidebar changes.
- Study groups flashcards or daily campus quiz work.
- Redesigning the profile card beyond its collapsed avatar representation.
