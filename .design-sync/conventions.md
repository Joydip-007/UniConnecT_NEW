# UniConnecT design system conventions

Default theme is **Warm Futuristic Dark**: navy surfaces, indigo interactive, orange identity accent. A light theme also exists (`[data-theme='light']`) but the shipped preview cards render dark by default — assume dark unless the user asks for light.

## Wrapping and setup

No root provider is required for styling — components read CSS custom properties directly, no ThemeProvider/context needed. Just render components inside a container with a real surface background (`background: var(--surface-page)` for the page canvas, `var(--surface-card)` for cards) — components rely on that ambient dark surface for contrast; several (buttons, badges) look broken on a plain white background because their text/border tokens are tuned for dark surfaces.

Some components need `react-router-dom` context (`TopNav`, sidebars, `MinimalPageFooter` use `<Link>`) or TanStack Query context (`useQuery`/`useMutation` in `RightSidebar`, `StickerDrawer`, etc.) — wrap any app assembled from these in a `<MemoryRouter>`/`<BrowserRouter>` and a `<QueryClientProvider>` the way any React Router + React Query app would.

## Styling idiom — CSS custom properties via Tailwind arbitrary values

No component-specific class names or a prop-based style API — style with Tailwind's arbitrary-value syntax referencing real CSS custom properties, e.g. `className="rounded-[var(--r-pill)] bg-[var(--uc-indigo)] text-[var(--on-accent)]"`. Never hardcode a hex color — always `var(--token-name)`.

Real token families (from `styles.css` / `_ds_bundle.css`):

| Family | Tokens |
|---|---|
| Surfaces | `--surface-page`, `--surface-card`, `--surface-raised`, `--surface-hover`, `--surface-glint` |
| Text | `--text-primary`, `--text-secondary`, `--text-tertiary`, `--on-accent` (text on a colored/filled surface) |
| Borders | `--border-default`, `--border-hover`, `--border-strong` — always `0.5px solid`, never `1px` |
| Radius | `--r-sm`, `--r-md`, `--r-lg`, `--r-xl`, `--r-pill` (buttons/chips are always `--r-pill`, never a sharp corner) |
| Brand accents | `--uc-indigo`, `--uc-orange`, `--uc-mint`, `--uc-cyan`, `--uc-amber`, `--uc-red` — each has `-l` (light variant for text-on-tint), `-bg` (tinted background), `-bdr` (tinted border) siblings, e.g. `--uc-indigo-l`, `--uc-indigo-bg`, `--uc-indigo-bdr` |
| Role colors | `--role-{student,alumni,faculty,admin,driver}` and `-bg`/`-bdr`/`-text` siblings, used by `RoleBadge` |
| Overlay/z-index | `--overlay-bg`, `--overlay-bg-soft`, `--overlay-bg-strong`, `--z-modal`, `--z-nav`, `--z-popover`, `--z-toast`, `--z-banner` |
| Motion | `--dur-fast`, `--dur-med`, `--dur-slow`, `--ease-out-expo`, `--ease-out-strong`, `--ease-in-out-strong`, `--ease-drawer` |
| Fonts | `--font-display` (Satoshi, loads via a remote `@import` already in the bundle), `--font-mono` (system monospace fallback stack) |

Rules that hold everywhere in this system: no `box-shadow` for depth — depth comes from surface stacking (`--surface-page` → `--surface-card` → `--surface-raised`); font-weight is only 400 or 500, never 600+; text is sentence case, never ALL CAPS or Title Case on labels/buttons; text on a colored/filled surface always uses the matching `-l` light token, never the plain `--text-*` tokens (which are tuned for surface backgrounds, not filled buttons/badges).

## Where the truth lives

- `styles.css` and its `@import` closure (`_ds_bundle.css`) — the full compiled token/utility set.
- Each component's `.prompt.md` — real prop shapes and usage examples.
- Compound families ship as separate exports rather than a dot-notation API: e.g. `PrimaryBtn`/`OrangeBtn`/`MintBtn`/`GhostBtn`/`ContextualBtn`/`ReactionBtn` are six distinct button components (not `Button.Primary`), and `FacebookIcon`/`GitHubIcon`/`InstagramIcon`/`LinkedInIcon`/`XIcon` are five distinct icon components.

## Example

```tsx
<div style={{ background: 'var(--surface-page)', padding: 24 }}>
  <div
    style={{
      background: 'var(--surface-card)',
      border: '0.5px solid var(--border-default)',
      borderRadius: 'var(--r-lg)',
      padding: 16,
    }}
  >
    <Badge variant="dept">Computer Science</Badge>
    <h2 style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: 15 }}>Weekly Sync</h2>
    <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Thursday, 4:00 PM · Engineering Building</p>
    <PrimaryBtn>RSVP</PrimaryBtn>
  </div>
</div>
```
