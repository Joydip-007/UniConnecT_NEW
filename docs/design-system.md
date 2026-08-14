# Design System

UniConnecT's UI is built with React 18, Vite, and Tailwind CSS. The design language is **Graphite Ledger Dark** — graphite surfaces, study-mauve identity moments, periwinkle interactive elements, and a Gen Z-first aesthetic.

Reference files: `apps/web/src/assets/logo.svg` · `apps/web/src/styles/tokens.css` · `apps/web/src/components/`

---

## Color Tokens

Define these at the root of `apps/web/src/styles/tokens.css`. Import before Tailwind base. Always reference variables in component code — never raw hex.

```css
/* apps/web/src/styles/tokens.css */
:root {
  /* ── Surfaces (dark-mode default) ─────────────────── */
  --surface-page:     #1A1A1A;   /* outermost canvas */
  --surface-card:     #242424;   /* post cards, sidebars */
  --surface-raised:   #2E2E2E;   /* nested surfaces, job details */
  --surface-hover:    #383838;   /* hover / active states */

  /* ── Brand — ledger periwinkle (primary interactive) ── */
  --uc-indigo:        #4E62BF;
  --uc-indigo-l:      #93A0D8;
  --uc-indigo-xl:     #B3BDE6;
  --uc-indigo-bg:     rgba(78, 98, 191, 0.12);
  --uc-indigo-bdr:    rgba(78, 98, 191, 0.30);

  /* ── Brand — study mauve (identity & attention) ────── */
  --uc-orange:        #7B5E64;
  --uc-orange-l:      #C79FAA;
  --uc-orange-bg:     rgba(123, 94, 100, 0.18);
  --uc-orange-bdr:    rgba(123, 94, 100, 0.40);

  /* ── Semantic ─────────────────────────────────────── */
  --uc-cyan:          #6FA3B8;   /* live / real-time */
  --uc-cyan-bg:       rgba(111, 163, 184, 0.11);
  --uc-mint:          #77AC6D;   /* positive outcomes */
  --uc-mint-bg:       rgba(119, 172, 109, 0.11);

  /* ── Text ─────────────────────────────────────────── */
  --text-primary:     #EBEBEB;
  --text-secondary:   rgba(235, 235, 235, 0.58);
  --text-tertiary:    rgba(235, 235, 235, 0.30);

  /* ── Borders ──────────────────────────────────────── */
  --border-default:   rgba(255, 255, 255, 0.07);
  --border-hover:     rgba(255, 255, 255, 0.13);
  --border-strong:    rgba(255, 255, 255, 0.22);

  /* ── Radius ───────────────────────────────────────── */
  --r-sm:   8px;    /* inputs, chips */
  --r-md:   12px;   /* inner cards */
  --r-lg:   16px;   /* cards, panels */
  --r-xl:   20px;   /* modals, sheets */
  --r-pill: 999px;  /* buttons, badges */
}
```

### When to use which token

| Situation | Token |
|-----------|-------|
| Page background | `--surface-page` |
| Any card or panel | `--surface-card` |
| Nested detail block (job details, event cover) | `--surface-raised` |
| Hover / active state background | `--surface-hover` |
| Primary CTA button, active nav, selected tab | `--uc-indigo` |
| UIU brand moment: pinned post, FAB, urgent CTA | `--uc-orange` |
| Online indicator, chat bubble, shuttle tracker | `--uc-cyan` |
| Success: verified badge, job accepted, RSVP confirmed | `--uc-mint` |
| All body text | `--text-primary` |
| Timestamps, meta, subtitles | `--text-secondary` |
| Placeholders, hints | `--text-tertiary` |

---

## Typography

**Rule:** Two weights only — regular (400) and medium (500). Weight 600+ is too heavy in the dark theme and must not be used. Sentence case always — no ALL CAPS, no Title Case on buttons.

| Role | Size | Weight | Line height |
|------|------|--------|-------------|
| Page headline | 22px | 500 | 1.3 |
| Section heading | 18px | 500 | 1.35 |
| Card title | 16px | 500 | 1.4 |
| Author name, UI label | 14px | 500 | 1.4 |
| Body / post content | 14–16px | 400 | 1.72 |
| Meta (timestamp, dept) | 12–13px | 400 | 1.5 |
| Badge / chip | 11px | 500 | 1 |

Font stack: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Helvetica, sans-serif`

---

## Border System

All borders are `0.5px`. This is the core rule of the design — `1px` borders feel corporate.

```css
/* Default */
border: 0.5px solid var(--border-default);

/* Hover state */
border: 0.5px solid var(--border-hover);

/* Strong emphasis */
border: 0.5px solid var(--border-strong);

/* Featured card accent — only exception: 1.5px */
border: 1.5px solid var(--uc-indigo);
```

No `box-shadow` for depth. Depth is achieved by stacking surfaces (`page → card → raised`).

---

## Button System

All buttons use `border-radius: var(--r-pill)` — pill shape exclusively. No sharp-cornered buttons.

```tsx
/* Primary — CTA, join, post */
<button className="btn-primary">Join community</button>

/* Orange — brand moment, urgent */
<button className="btn-orange">Post a job</button>

/* Ghost — secondary action */
<button className="btn-ghost">Explore feed</button>

/* Contextual — icon + label */
<button className="btn-ctx">
  <BriefcaseIcon size={15} /> Apply now
</button>

/* Reaction — like, comment, save */
<button className={`btn-rxn ${liked ? 'active' : ''}`}>
  <ThumbsUpIcon size={15} /> Like
</button>
```

```css
/* apps/web/src/styles/buttons.css */
.btn-primary {
  background: var(--uc-indigo); color: #fff; border: none;
  border-radius: var(--r-pill); padding: 9px 20px;
  font-size: 13px; font-weight: 500; cursor: pointer;
  transition: opacity 0.15s, transform 0.15s;
}
.btn-primary:hover  { opacity: 0.9; transform: translateY(-1px); }
.btn-primary:active { transform: scale(0.97); }

.btn-orange  { background: var(--uc-orange); color: #fff; border: none; border-radius: var(--r-pill); padding: 9px 20px; font-size: 13px; font-weight: 500; cursor: pointer; }
.btn-ghost   { background: transparent; border: 0.5px solid var(--border-hover); color: var(--text-secondary); border-radius: var(--r-pill); padding: 8px 18px; font-size: 13px; font-weight: 500; cursor: pointer; }
.btn-ctx     { display: flex; align-items: center; gap: 7px; background: var(--surface-raised); border: 0.5px solid var(--border-default); color: var(--text-secondary); border-radius: var(--r-pill); padding: 8px 16px; font-size: 13px; font-weight: 500; cursor: pointer; }
.btn-rxn     { display: flex; align-items: center; gap: 5px; padding: 6px 10px; border-radius: var(--r-sm); font-size: 13px; font-weight: 500; color: var(--text-secondary); background: transparent; border: none; cursor: pointer; transition: background 0.15s; }
.btn-rxn:hover  { background: var(--surface-raised); }
.btn-rxn.active { color: var(--uc-indigo); }
```

---

## Badge / Chip System

```tsx
/* Role and status badges */
<span className="badge badge-dept">CSE · 2022</span>
<span className="badge badge-alumni">Alumni · verified</span>
<span className="badge badge-pinned">Announcement</span>
<span className="badge badge-live">Live</span>
<span className="badge badge-neutral">Staff</span>
```

```css
.badge { font-size: 11px; padding: 2px 9px; border-radius: var(--r-pill); font-weight: 500; }
.badge-dept    { background: var(--uc-indigo-bg); color: var(--uc-indigo-l); }
.badge-alumni  { background: var(--uc-mint-bg);   color: var(--uc-mint); }
.badge-pinned  { background: var(--uc-orange-bg); color: var(--uc-orange-l); }
.badge-live    { background: var(--uc-cyan-bg);   color: var(--uc-cyan); }
.badge-neutral { background: var(--surface-raised); color: var(--text-secondary); }
```

---

## Card Anatomy

```
┌─────────────────────────────────────────────────┐  surface-card
│  ┌──── Post header ───────────────────────────┐ │
│  │  [Avatar] [Author name] [Badge] [Timestamp] │ │
│  └────────────────────────────────────────────┘ │
│  ┌──── Post body ─────────────────────────────┐ │
│  │  Text content (14px, line-height 1.72)     │ │
│  └────────────────────────────────────────────┘ │
│  ┌──── Nested block (optional) ──────────────┐  │
│  │  [Job card / Event cover / Poll]          │  │  surface-raised
│  │  background: surface-raised               │  │
│  └───────────────────────────────────────────┘  │
│─────────────────────────────────── border-default│
│  [Like]  [Comment]  [Share]  [Save]              │
└─────────────────────────────────────────────────┘
```

```css
.post-card {
  background:    var(--surface-card);
  border:        0.5px solid var(--border-default);
  border-radius: var(--r-lg);
  transition:    border-color 0.2s;
}
.post-card:hover { border-color: var(--border-hover); }

.post-nested {
  background:    var(--surface-raised);
  border:        0.5px solid var(--border-default);
  border-radius: var(--r-md);
  padding:       14px;
  margin:        0 16px 14px;
}
```

---

## Avatar Component

```tsx
// apps/web/src/components/Avatar.tsx
interface AvatarProps {
  initials: string;
  color: string;       // one of the UC brand colors or surface-raised
  size?: number;       // default 40
  online?: boolean;
}

export function Avatar({ initials, color, size = 40, online = false }: AvatarProps) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: size * 0.34, fontWeight: 500,
      color: '#fff', flexShrink: 0, position: 'relative',
    }}>
      {initials}
      {online && (
        <div style={{
          position: 'absolute', bottom: 1, right: 1,
          width: size * 0.27, height: size * 0.27,
          borderRadius: '50%', background: 'var(--uc-mint)',
          border: '2px solid var(--surface-card)',
        }} />
      )}
    </div>
  );
}
```

---

## Animation System

```css
/* Page load — staggered entry */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Floating elements (hero cards on landing page) */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-10px); }
}

/* Online / live indicators */
@keyframes livePulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.3; }
}

/* Scroll reveal */
.reveal {
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 0.7s cubic-bezier(0.2, 0, 0.3, 1),
              transform 0.7s cubic-bezier(0.2, 0, 0.3, 1);
}
.reveal.visible { opacity: 1; transform: translateY(0); }
.reveal.d1 { transition-delay: 0.1s; }
.reveal.d2 { transition-delay: 0.2s; }
.reveal.d3 { transition-delay: 0.3s; }
```

---

## Component File Map

| Component | Path | Notes |
|-----------|------|-------|
| PostCard | `features/feed/components/PostCard.tsx` | Handles all post types |
| JobCard | `features/jobs/components/JobCard.tsx` | |
| EventCard | `features/events/components/EventCard.tsx` | |
| PollBlock | `features/feed/components/PollBlock.tsx` | |
| Avatar | `components/Avatar.tsx` | Shared |
| Badge | `components/Badge.tsx` | Shared |
| Button | `components/Button.tsx` | Exports Btn, GhostBtn, OrangeBtn |
| NavItem | `components/NavItem.tsx` | Left sidebar nav |
| TopNav | `components/TopNav.tsx` | Sticky header |
| NotificationBell | `components/NotificationBell.tsx` | Dropdown |

---

## Logo

The UniConnecT logo has two components:
- **Mark:** U-shaped shield in UIU navy (`#1E3A70`) with orange graduation cap (`#F05A28`) and network nodes.
- **Wordmark:** `Uni` in navy · `ConnecT` in orange. The T has a circuit/node styling.

The SVG mark is at `apps/web/src/assets/logo.svg`. Import it as a React component with `?react` in Vite:

```tsx
import { ReactComponent as LogoMark } from '@/assets/logo.svg';
```

Never resize the logo below 24px height. Minimum clearspace is 8px on all sides.

---

## Design Rules (non-negotiable)

1. **No hardcoded hex** in component files — always `var(--token-name)`.
2. **All borders are `0.5px`** — never `1px` for structural borders.
3. **Sentence case** on all UI text — no ALL CAPS, no Title Case.
4. **Pill buttons only** — `border-radius: var(--r-pill)` on all interactive buttons.
5. **No drop shadows** — depth comes from surface stacking.
6. **Text on coloured background** must use the matching text token — e.g. `--uc-orange-l` on `--uc-orange-bg`.
7. **Font weights 400 and 500 only** — never 600, 700, or 800 in component CSS.
