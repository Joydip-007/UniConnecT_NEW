# Theme toggle (Light / Dark / System) — design

**Date:** 2026-05-18
**Status:** Approved, ready for implementation plan
**Owner:** Joydip

## 1. Summary

Add a Light / Dark / System theme toggle to UniConnecT. Two UI surfaces share one engine:

- **Authenticated app** — submenu inside the existing profile dropdown in `TopNav` (top-right), with three radio options (Light / Dark / System).
- **Landing page** — a single sun/moon icon button placed to the left of the "Sign in" button in `LandingNav`. Cycles between Light and Dark only.

A global "curtain" animation (a colored overlay sweeping top-to-bottom, then retreating) plays whenever the *resolved* theme actually changes. The animation logic is adapted from the user-supplied `curtain-theme-toggle` reference, but rewritten to use our design tokens, our store, and our `data-theme` attribute mechanism — not the reference's hard-coded palette or its `.dark` class swap.

Theme preference is stored per-account on the backend (`users.theme_preference`), with `localStorage` as an instant cache for zero-flash bootstrap.

## 2. Goals & non-goals

**Goals**

- Three-mode preference (`light` | `dark` | `system`) for signed-in users.
- Per-account persistence: theme follows the user across devices.
- Zero flash of unstyled / wrong-themed content on page load.
- Landing page is themeable (and toggleable) for unauthenticated visitors.
- Curtain animation respects `prefers-reduced-motion`.
- No hard-coded hex values anywhere (CLAUDE.md compliance).

**Non-goals**

- Real-time theme sync across multiple tabs / sessions. Last write wins; reload reconciles.
- Custom user-defined palettes.
- High-contrast / accessibility-specific themes beyond Light and Dark.
- Per-route or per-section theme overrides.

## 3. Architecture & data flow

### Mode triplet

```
mode: 'light' | 'dark' | 'system'      // what the user picked
resolved: 'light' | 'dark'             // what is actually applied
```

`resolved` is derived from `mode`. If `mode === 'system'`, resolved comes from `window.matchMedia('(prefers-color-scheme: dark)')` and updates live when the OS preference changes. Otherwise resolved equals mode.

### Source-of-truth hierarchy

Resolved on app start, in order:

1. **Server profile** (`users.theme_preference`) — authoritative for signed-in users; applied after `/auth/me` resolves.
2. **localStorage** (`uc.theme`) — read synchronously by the pre-mount bootstrap script. Used as the instant cache and as the source for unauthenticated visitors.
3. **System preference** — fallback default for first-ever visit.

### Flow when the theme changes (either surface)

1. UI calls `themeStore.setMode(m)` (or `themeStore.toggle()` on the landing button).
2. If the resolved theme is unchanged, write store + localStorage + API and return — no animation.
3. Otherwise, run the curtain phase machine:
   - `phase = 'falling'`, `targetColor` set to the destination theme's `--surface-page`.
   - After ~550ms, swap `<html data-theme="…">`, update `mode`/`resolved`, write localStorage, fire debounced `PATCH /users/me/preferences`.
   - `phase = 'rising'` → after another ~550ms → `phase = 'idle'`.
4. API failure is logged via the existing winston logger; local state still wins.

### Login & logout

- **Login hydration:** `AuthLoader` calls `themeStore.hydrateFromProfile(user.themePreference)` once `/auth/me` resolves. If the value differs from local, server wins and localStorage is updated. No API call is fired by this hydration (we just received the value from the server).
- **Logout:** `authStore.clearAuth` does NOT clear `uc.theme`. The login screen keeps the current theme.

## 4. Tokens & CSS

`apps/web/src/styles/tokens.css` is restructured so the existing block becomes the dark theme, scoped to a dual selector, and a parallel light block is added.

```css
:root,
:root[data-theme='dark'] {
  /* existing dark tokens — unchanged */
  --surface-page:   #060D1A;
  --surface-card:   #0A1628;
  --surface-raised: #111D35;
  --surface-hover:  #1A2D4A;
  /* …everything else unchanged… */
}

:root[data-theme='light'] {
  /* Warm neutral light — mirrors dark contrast hierarchy */
  --surface-page:    #FAF7F2;
  --surface-card:    #FFFFFF;
  --surface-raised:  #F4F0E8;
  --surface-hover:   #EDE7DA;

  --uc-indigo:       #4747C2;
  --uc-indigo-l:     #5B5BD6;
  --uc-indigo-xl:    #7C7CF0;
  --uc-indigo-bg:    rgba(71, 71, 194, 0.08);
  --uc-indigo-bdr:   rgba(71, 71, 194, 0.22);

  --uc-orange:       #D44A1F;
  --uc-orange-l:     #F05A28;
  --uc-orange-bg:    rgba(212, 74, 31, 0.10);
  --uc-orange-bdr:   rgba(212, 74, 31, 0.28);

  --uc-navy:         #1E3A70;

  --uc-cyan:         #0891B2;
  --uc-cyan-bg:      rgba(8, 145, 178, 0.08);
  --uc-cyan-bdr:     rgba(8, 145, 178, 0.25);
  --uc-mint:         #059669;
  --uc-mint-bg:      rgba(5, 150, 105, 0.08);
  --uc-mint-bdr:     rgba(5, 150, 105, 0.25);
  --uc-red:          #BE123C;
  --uc-red-bg:       rgba(190, 18, 60, 0.08);
  --uc-red-bdr:      rgba(190, 18, 60, 0.22);

  --overlay-bg:        rgba(250, 247, 242, 0.78);
  --overlay-bg-soft:   rgba(250, 247, 242, 0.56);
  --overlay-bg-strong: rgba(250, 247, 242, 0.90);
  --overlay-media:     rgba(20, 20, 20, 0.50);
  --uc-indigo-dot:     rgba(71, 71, 194, 0.28);
  --surface-glint:     rgba(0, 0, 0, 0.04);

  --text-primary:    #1A1F2E;
  --text-secondary:  rgba(26, 31, 46, 0.62);
  --text-tertiary:   rgba(26, 31, 46, 0.36);

  --border-default:  rgba(0, 0, 0, 0.08);
  --border-hover:    rgba(0, 0, 0, 0.14);
  --border-strong:   rgba(0, 0, 0, 0.22);

  /* Radii, easing, typography — unchanged (theme-invariant) */
}

html[data-theme] body {
  transition: background-color 280ms var(--ease-out-strong),
              color 280ms var(--ease-out-strong);
}

@media (prefers-reduced-motion: reduce) {
  html[data-theme] body { transition: none; }
}
```

`<meta name="color-scheme" content="dark light">` is added to `apps/web/index.html` so the browser styles native scrollbars and form controls for each mode.

`apps/web/src/styles/landing.css` is swept for hard-coded `#rrggbb` values; any found are replaced with the matching token. If the file already uses tokens throughout, no change is required.

No component files are modified for theming. Every existing component already reads `var(--surface-page)`, `var(--text-primary)`, etc., so the whole app re-themes automatically when `<html data-theme>` flips.

## 5. Backend

### Migration

`apps/api/src/database/migrations/{YYYYMMDDHHMMSS}_add_theme_preference_to_users.ts`:

- Adds column `theme_preference text not null default 'system'` on `users`.
- Adds a check constraint: value must be one of `'light'`, `'dark'`, `'system'`.
- No index — the column is never queried by, only read with the user record.

### Shared schema

In `packages/shared/src/schemas/users.ts` (extend, or create if absent):

```ts
export const themePreferenceSchema = z.enum(['light', 'dark', 'system'])
export type ThemePreference = z.infer<typeof themePreferenceSchema>

export const updateUserPreferencesSchema = z.object({
  themePreference: themePreferenceSchema.optional(),
})
```

The user-account TS type (the object returned at `auth.user`, alongside `email`, `id`, `role`) gains `themePreference: ThemePreference`. Lives on the user root, not on `user.profile` — it is an account-level preference, not a profile field.

### Endpoint — `PATCH /api/v1/users/me/preferences`

- Route declared in `apps/api/src/modules/users/router.ts`, behind `requireAuth`.
- Controller validates the body against `updateUserPreferencesSchema`.
- Service updates the `users` row scoped by `req.user.id` AND `req.university.id` (multi-tenant invariant).
- Response shape: `{ data: { themePreference: ThemePreference } }`.
- A dedicated `/preferences` sub-resource (instead of overloading `PATCH /users/me`) leaves room for future per-user preferences without churn.

### Existing endpoints to update

- `GET /api/v1/auth/me` — include `themePreference` in the returned user object.
- `POST /api/v1/auth/login` — include `themePreference` in the returned user object.
- Any other endpoint that returns the current user's full record.

### No socket event

Theme is a per-user preference. Multi-tab consistency is not worth the round-trip cost; last write wins on reload.

### Tests

`apps/api/tests/routes/users.preferences.test.ts`:

- Authenticated `PATCH` with each valid value (`light`, `dark`, `system`) → 200, value persisted, included in subsequent `GET /me`.
- Invalid value → 400 with Zod error.
- Unauthenticated `PATCH` → 401.
- Cross-university isolation: user A cannot affect user B (asserted by checking only user A's row is touched).

## 6. Frontend — store, bootstrap, plumbing

### Bootstrap script

Inlined in `<head>` of `apps/web/index.html`, before any module script tag:

```html
<script>
  (function () {
    try {
      var stored = localStorage.getItem('uc.theme');
      var mode = (stored === 'light' || stored === 'dark' || stored === 'system')
        ? stored : 'system';
      var resolved = mode === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : mode;
      document.documentElement.setAttribute('data-theme', resolved);
      document.documentElement.setAttribute('data-theme-mode', mode);
    } catch (e) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  })();
</script>
```

Runs synchronously before React paints → no flash. `data-theme-mode` is informational; the store re-derives mode on construction.

### `themeStore` — `apps/web/src/stores/themeStore.ts`

```ts
type ThemeMode = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'
type CurtainPhase = 'idle' | 'falling' | 'rising'

interface ThemeState {
  mode: ThemeMode
  resolved: ResolvedTheme
  phase: CurtainPhase
  targetColor: string | null

  setMode: (mode: ThemeMode) => void
  toggle: () => void                          // landing-page 2-way flip
  hydrateFromProfile: (mode: ThemeMode) => void

  // internal
  _onSystemChange: () => void
}
```

Responsibilities:

- Constructor reads `data-theme-mode` from `<html>` to mirror the bootstrap value. No second read of `localStorage`.
- `setMode(m)`:
  1. Compute next resolved.
  2. If next resolved equals current resolved, write store + `localStorage['uc.theme']` + debounced API, return.
  3. Otherwise run the curtain phase machine described in §3.
- `toggle()`: produces only `'light'` or `'dark'`. If `mode === 'system'` and resolved is dark, calls `setMode('light')`; vice versa. The landing button never produces `'system'`.
- `hydrateFromProfile(m)`: called once after auth hydration. If `m` differs from current local mode, applies it (with curtain animation if resolved changes) but **without** firing the outgoing API call (the value just came from the server). Implementation note: a private `_skipApiOnce` flag inside the store, set true before the internal `setMode` call.
- `_onSystemChange`: bound to `matchMedia('(prefers-color-scheme: dark)').addEventListener('change', …)` only when `mode === 'system'`. Recomputes resolved and triggers a curtain transition.

### API debounce

A 300ms trailing debounce inside the store. Rapid toggling collapses to a single `PATCH`. Failure is silently swallowed and logged via the existing logger; local state still wins. UI never blocks on the network.

### Hydration call site

In `apps/web/src/components/AuthLoader.tsx`, after `/auth/me` resolves:

```ts
useThemeStore.getState().hydrateFromProfile(user.themePreference)
```

### Axios call

`apps/web/src/lib/api/users.ts` gains:

```ts
export async function updateUserPreferences(p: { themePreference: ThemePreference }) {
  const { data } = await api.patch('/users/me/preferences', p)
  return data.data
}
```

Uses the same axios instance (so the refresh-token interceptor applies).

### Logout

`authStore.clearAuth` is unchanged — it does NOT touch `uc.theme`.

### Tests

- `themeStore.test.ts`: `setMode` flips `<html data-theme>`, writes localStorage, schedules debounced API call. `toggle()` flips resolved. `hydrateFromProfile` with the same value is a store + DOM update but no API call. `_onSystemChange` only fires when mode is system.
- `AuthLoader.test.tsx`: extend the existing test to assert `hydrateFromProfile` is invoked with the value from `/auth/me`.

## 7. Frontend — UI surfaces

### A. `ThemeToggleButton` — `apps/web/src/components/ThemeToggleButton.tsx`

Single icon button, ~36px diameter. Used on the landing page.

- Reads `resolved` from `themeStore`. Shows `<Moon />` when resolved is `'light'` (i.e., click → go dark), `<Sun />` when resolved is `'dark'`. Icons from `lucide-react`.
- All colors via tokens: `background: var(--surface-page)`, `color: var(--text-primary)`, `box-shadow: 0 0 0 0.5px var(--border-strong)`. Hover background `var(--surface-hover)`. Press scales to 0.96. Border-radius `var(--r-pill)` (50%).
- On click → `themeStore.toggle()`. The curtain is rendered globally (see GlobalCurtain), not by this component.
- ARIA: `aria-label="Switch to {target} mode"`, `aria-pressed={resolved === 'dark'}`. Keyboard: Enter/Space activates.

### B. `GlobalCurtain` — `apps/web/src/components/GlobalCurtain.tsx`

A single instance mounted once in `App.tsx` at root. Reads `phase` and `targetColor` from `themeStore`.

- Renders a fixed full-viewport div: `position: fixed; inset: 0; z-index: 9997; pointer-events: none; transform-origin: top; background: var(--target)`.
- During `phase === 'falling'`: `transform: scaleY(1)` via `transition: transform 550ms cubic-bezier(0.76, 0, 0.24, 1)`.
- During `phase === 'rising'`: `transform: scaleY(0)` via the same transition curve (origin reflects upward).
- `phase === 'idle'`: `transform: scaleY(0)`, no transition (hidden, ready).
- `targetColor` is taken from a literal token map in the store: `{ light: '#FAF7F2', dark: '#060D1A' }` — the destination theme's `--surface-page` value, captured from §4. (Reading via `getComputedStyle` on a non-attached element is brittle; a frozen literal in the store keeps it simple and correct.)
- Under `prefers-reduced-motion: reduce`, the curtain stays hidden and `themeStore.setMode` falls through to instant-swap without phase transitions.

### C. Landing-page integration — `LandingNav.tsx`

Insert `<ThemeToggleButton />` in the right cluster, to the left of `Sign in`:

```tsx
<div style={{ display: 'flex', gap: 10, flexShrink: 0, marginLeft: 'auto', alignItems: 'center' }}>
  <ThemeToggleButton />
  <GhostBtn onClick={() => navigate(PATHS.LOGIN)}>Sign in</GhostBtn>
  <OrangeBtn onClick={…}>Join free</OrangeBtn>
</div>
```

Mobile drawer (`uc-nav-mobile-drawer`) gets the same button as a single-line row at the top of the drawer.

### D. Authenticated dropdown — `TopNav.tsx`

The existing profile dropdown gains a "Theme" section between the user-info header and the existing menu items:

```
─────────────────────────
{user name}
{user email}
─────────────────────────
[Sun]     Light    ✓
[Moon]    Dark
[Monitor] System
─────────────────────────
[User]   View profile
[Logout] Sign out
```

- Each theme row is a `<button role="menuitemradio" aria-checked={…}>`. The three buttons share an implicit radio group.
- Click → `themeStore.setMode(value)`. The dropdown stays open (so the user sees the curtain run, and can close manually).
- The selected mode shows a `<Check size={14} />` at the right edge.
- Icons (`Sun`, `Moon`, `Monitor`) from `lucide-react`.
- Reuses the existing `menuItemStyle` and `row-hover-bg` class. No new visual tokens.
- The existing arrow-key navigation in `TopNav` is extended: the query selector becomes `'[role="menuitem"], [role="menuitemradio"]'` so arrow keys cycle through theme rows alongside the existing items.

### Tests

- `ThemeToggleButton.test.tsx`: renders `<Moon />` when resolved is light, `<Sun />` when dark; click dispatches `themeStore.toggle`; respects `prefers-reduced-motion` (no curtain phase).
- `TopNav.test.tsx`: dropdown shows three radio rows after open; the row matching `mode` has `aria-checked="true"`; clicking each row calls the matching `setMode`; arrow-key navigation includes theme rows.
- `GlobalCurtain.test.tsx`: applies `scaleY(1)` during falling, `scaleY(0)` during idle / rising end-state.

## 8. Files affected

**New**

- `apps/api/src/database/migrations/{ts}_add_theme_preference_to_users.ts`
- `apps/web/src/stores/themeStore.ts` (+ test)
- `apps/web/src/components/ThemeToggleButton.tsx` (+ test)
- `apps/web/src/components/GlobalCurtain.tsx` (+ test)
- `apps/web/src/lib/api/users.ts` (or extend existing)
- `apps/api/tests/routes/users.preferences.test.ts`

**Modified**

- `apps/web/src/styles/tokens.css` — split dark / light blocks, transitions.
- `apps/web/src/styles/landing.css` — replace any hard-coded hex with tokens (only if needed).
- `apps/web/index.html` — inline bootstrap script, `color-scheme` meta.
- `apps/web/src/App.tsx` — mount `<GlobalCurtain />`.
- `apps/web/src/components/AuthLoader.tsx` — `hydrateFromProfile` call.
- `apps/web/src/components/TopNav.tsx` — theme submenu in dropdown.
- `apps/web/src/features/landing/components/LandingNav.tsx` — toggle button placement.
- `apps/api/src/modules/users/router.ts` — `PATCH /me/preferences` route.
- `apps/api/src/modules/users/controller.ts` — handler.
- `apps/api/src/modules/users/service.ts` — `updatePreferences` service.
- `apps/api/src/modules/users/schema.ts` — preferences schema.
- `apps/api/src/modules/auth/service.ts` — include `themePreference` in user payloads.
- `packages/shared/src/schemas/users.ts` (or new file) — shared zod schema + type.
- `packages/shared/src/types/*` — `UserProfile.themePreference` field.

## 9. Risks & open questions

- **Curtain color is frozen as a literal.** If the light/dark `--surface-page` token values are ever changed in `tokens.css`, the literals in `themeStore` must be updated alongside. Accepted because the alternative (live `getComputedStyle`) is brittle for a non-attached probe and adds little value.
- **Two tabs of the same account.** Theme change in tab A is not pushed to tab B. Reload reconciles. Considered acceptable (see §3).
- **Reduced-motion users get no animation but still get the theme change.** Intentional.

## 10. Acceptance checklist

- [ ] Migration runs cleanly; rollback restores prior schema.
- [ ] `theme_preference` defaults to `system` for existing users.
- [ ] Logged-in user sees Light / Dark / System submenu in profile dropdown; selection persists across reloads and across devices.
- [ ] Unauthenticated visitor on landing page can toggle Light ⇄ Dark via the icon button; choice persists in localStorage across reloads.
- [ ] No flash of wrong theme on cold load (bootstrap script runs before paint).
- [ ] Curtain animation plays only when the *resolved* theme actually changes.
- [ ] `prefers-reduced-motion: reduce` disables the curtain; theme swap is instant.
- [ ] No hard-coded hex values introduced in any component file (CLAUDE.md compliance).
- [ ] `npx pnpm typecheck && npx pnpm lint && npx pnpm test` all pass.
