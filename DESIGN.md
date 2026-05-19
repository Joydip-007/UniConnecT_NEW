---
name: UniConnecT
description: The private campus social network for universities — dark-surface, role-aware, UIU-orange identity, mobile-first for South Asian campuses.
colors:
  # ── Surfaces (dark by default) ─────────────────────────────────
  surface-page:     "#060D1A"
  surface-card:     "#0A1628"
  surface-raised:   "#111D35"
  surface-hover:    "#1A2D4A"
  # ── Identity (UIU orange — "you / your actions") ───────────────
  uc-orange:        "#F05A28"
  uc-orange-l:      "#F5845A"
  uc-orange-bg:     "#F05A281A"
  uc-orange-bdr:    "#F05A2847"
  # ── Network (UC indigo — "peers / system / wayfinding") ────────
  uc-indigo:        "#5B5BD6"
  uc-indigo-l:      "#7C7CF0"
  uc-indigo-xl:     "#A5A5F8"
  uc-indigo-bg:     "#5B5BD61A"
  uc-indigo-bdr:    "#5B5BD647"
  # ── Indigo dot — decorative cover pattern only ─────────────────
  uc-indigo-dot:    "#5B5BD64D"
  # ── Library carrel navy (avatar fallback slot) ─────────────────
  uc-navy:          "#1E3A70"
  # ── Semantic ───────────────────────────────────────────────────
  uc-cyan:          "#06B6D4"
  uc-cyan-bg:       "#06B6D41A"
  uc-cyan-bdr:      "#06B6D447"
  uc-mint:          "#10B981"
  uc-mint-bg:       "#10B9811A"
  uc-mint-bdr:      "#10B98147"
  uc-red:           "#E11D48"
  uc-red-bg:        "#E11D4814"
  uc-red-bdr:       "#E11D4840"
  # ── Text ───────────────────────────────────────────────────────
  text-primary:     "#EEF2FF"
  text-secondary:   "#EEF2FF94"
  text-tertiary:    "#EEF2FF47"
  # ── Borders (hairlines) ────────────────────────────────────────
  border-default:   "#FFFFFF12"
  border-hover:     "#FFFFFF21"
  border-strong:    "#FFFFFF38"
  # ── Overlay ────────────────────────────────────────────────────
  overlay-bg:       "#060D1ABF"
typography:
  display:
    fontFamily: "Fraunces, Source Serif 4, Georgia, serif"
    fontSize: "clamp(2rem, 4.5vw, 3.25rem)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.005em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.72
    letterSpacing: "normal"
  meta:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.04em"
rounded:
  sm:   "8px"
  md:   "12px"
  lg:   "16px"
  xl:   "20px"
  pill: "999px"
spacing:
  hairline: "0.5px"
  xxs: "2px"
  xs:  "4px"
  sm:  "6px"
  md:  "10px"
  lg:  "14px"
  xl:  "18px"
  xxl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.uc-indigo}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    padding: "9px 20px"
  button-orange:
    backgroundColor: "{colors.uc-orange}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    padding: "9px 20px"
  button-mint:
    backgroundColor: "{colors.uc-mint}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    padding: "9px 20px"
  button-ghost:
    backgroundColor: "{colors.surface-page}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.pill}"
    padding: "8px 18px"
  button-contextual:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  badge-dept:
    backgroundColor: "{colors.uc-indigo-bg}"
    textColor: "{colors.uc-indigo-l}"
    rounded: "{rounded.pill}"
    padding: "2px 9px"
  badge-alumni:
    backgroundColor: "{colors.uc-mint-bg}"
    textColor: "{colors.uc-mint}"
    rounded: "{rounded.pill}"
    padding: "2px 9px"
  badge-pinned:
    backgroundColor: "{colors.uc-orange-bg}"
    textColor: "{colors.uc-orange-l}"
    rounded: "{rounded.pill}"
    padding: "2px 9px"
  card-surface:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input-pill:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  nav-item-active:
    backgroundColor: "{colors.uc-indigo-bg}"
    textColor: "{colors.uc-indigo-xl}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
  filter-tab-active:
    backgroundColor: "{colors.uc-orange-bg}"
    textColor: "{colors.uc-orange-l}"
    rounded: "{rounded.pill}"
    padding: "7px 14px"
---

# Design System: UniConnecT

## 1. Overview

**Creative North Star: "The After-Hours Campus"**

UniConnecT is the campus after last bell. The quads are dim, the residence halls glow in their windows, and the people still moving — students between assignments, alumni catching up, faculty pinning tomorrow's notice — move with intention. The UI is the building that holds them. Dark navy surfaces are the walls. UIU orange is the institutional lamp that marks *you*: your post, your bookmark, your milestone. UC indigo is the network around you: the rooms you visit, the peers you find. The job of every screen is to recede so the people and the work surface; nothing in the chrome should clamor for attention.

This system explicitly rejects the consumer-social aesthetic ("Facebook with a UIU logo"), the SaaS-template look ("Notion beige + indigo brand"), and the engagement-bait gravity (algorithmic suggestion noise, infinite-scroll dark patterns, bright red "you have unread" dots screaming for taps). It also rejects the first-order AI reflexes for the social-product category: glassmorphism, gradient hero copy, identical icon-and-heading card grids, glow effects under buttons. Warmth comes from context-awareness and good defaults, not decoration.

Density is product-density: information-dense at small sizes, mobile-first, designed to survive mid-tier Android on slow campus 4G. Hairline 0.5px borders carry structure; pill radii (`999px`) carry interaction; sentence case carries voice. The system has two interactive accents (orange and indigo) with strictly assigned roles, six surface tints (page → card → raised → hover, plus two semantic), one body face (Inter), one display face (Fraunces). Variety happens through hierarchy and rhythm, never through new shapes.

**Key Characteristics:**
- Dark-surface only. Surface stacking, never shadows, for depth.
- Two-accent palette. Orange = self; indigo = peer/system. The roles are not interchangeable.
- 0.5px hairlines everywhere. 1px borders are reserved for badge counters and avatar gaps.
- Pill (`999px`) for every button. Card radius is `16px`. No sharp corners.
- Sentence case. Always. No `ALL CAPS`, no `Title Case On Buttons`.
- Weight 400 / 500 only. 600+ does not exist in this system.
- Mobile is not "responsive desktop". Layout collapses meaningfully (sidebars → bottom nav with a More sheet), not by hiding columns.

## 2. Colors: The After-Hours Palette

A dark-mode-only palette anchored to UIU's institutional orange. Surfaces stack from near-black (page) up through three slate tints; the lightest is reserved for hover. Two interactive accents (orange and indigo) carry meaning, not decoration.

### Primary
- **UIU Cinder Orange** (`#F05A28` / `oklch(67% 0.18 35)`): The brand identity. Reserved for things that are *yours*: your active filter tab, your saved-post bookmark, your progress milestones, your avatar ring on the profile mini-card. Surfaces this color does NOT touch: peer suggestions, others' content, system navigation. Rarity is the point — overdose dilutes the signal.
- **UIU Cinder Light** (`#F5845A` / `oklch(74% 0.13 35)`): Orange text on orange-tinted backgrounds. Use *only* on `--uc-orange-bg`; never on a card or page surface (poor contrast).
- **Orange Wash** (`#F05A281A` ≈ 10% alpha) + **Orange Edge** (`#F05A2847` ≈ 28% alpha): The two-stage tint used for filter pills, the announcement strip, and the first-post coachmark.

### Secondary
- **Campus Twilight Indigo** (`#5B5BD6` / `oklch(53% 0.17 280)`): The network color. Active liked-state, primary CTA fills on system surfaces (`PrimaryBtn`), event date boxes, trending tag pills, nav-item active background — anything that signals "this is the system / your peers", not "this is you".
- **Network Indigo Light** (`#7C7CF0`): Indigo text on indigo-tinted backgrounds.
- **Network Indigo Pale** (`#A5A5F8`): The lightest indigo step; used only for active-state text inside nav items where the background is `--uc-indigo-bg`.

### Tertiary (semantic — never decorative)
- **Verified Mint** (`#10B981`): Success. Used as the "Done" check on a milestone and as the alumni-verified badge color. Never used for a button.
- **Shuttle Beacon Cyan** (`#06B6D4`): The shuttle-live tool icon. The only place cyan appears.
- **Alert Crimson** (`#E11D48`): Unread badge dot on the mobile bottom nav. Destructive confirmations (when added).

### Neutral
- **Midnight Quad** (`#060D1A`): The page background. The darkest surface in the system.
- **Lecture-Hall Slate** (`#0A1628`): Card / widget background. One step up from page.
- **Window-Lit Slate** (`#111D35`): The "raised" tier — input fill, skeleton fill, mobile More-sheet tiles.
- **Reading-Lamp Slate** (`#1A2D4A`): Hover tier only. Never used as a resting surface.
- **Page Ivory** (`#EEF2FF`): Primary text.
- **Reading Ivory** (`#EEF2FF94` ≈ 58% alpha on page): Secondary text — body of posts when the headline is owned by names/roles, captions on event tiles.
- **Tertiary Ivory** (`#EEF2FF47` ≈ 28% alpha): Tertiary text only. Timestamps, eyebrows, faint metadata. Do not use for anything a user is meant to *read at length*; only for things they scan.
- **Frosted Glass** (`#FFFFFF12` ≈ 7%): Default 0.5px border. Separates cards from page, sections from each other, post rows from each other.
- **Stronger Glass** (`#FFFFFF21` ≈ 13%): Hover border + "All caught up" divider — one step more visible.
- **Etched Glass** (`#FFFFFF38` ≈ 22%): Reserved for the mobile More-sheet handle. The only border tier you can see without squinting.

### Library Carrel Navy
- **Library Carrel Navy** (`#1E3A70`): A neutral *outside* the surface stack — used only as the 5th avatar fallback color. Never appears as a background or border anywhere else.

### Decorative
- **Indigo Dot** (`#5B5BD64D` ≈ 30% alpha indigo): The dot-pattern color in the profile mini-card cover. Used exactly once in the system, as a `radial-gradient` against `--surface-raised`. Not a structural color; do not use as a fill, border, or text.

### Named Rules

**The Self / Network Rule.** Orange marks the user themselves (their identity, their content, their actions). Indigo marks the system and their peers. The two accents are not interchangeable. If you're about to put indigo on a "you saved this" affordance, or orange on a "peer suggestion", stop and pick again. Mixing the roles defeats the legibility the palette exists to deliver.

**The 28%-Alpha Floor.** Any text that the user is expected to *read* must use `--text-primary` or `--text-secondary`. The 28%-alpha `--text-tertiary` is for scannable metadata only (timestamps, eyebrows, "Done" labels), never for explanatory copy.

**The Hairline Rule.** Structural borders are `0.5px`, color `--border-default`. The only exceptions are: the 1.5px avatar-cover gap, the 2.5px avatar-ring on the profile mini-card (which is a coloured background, not a border), and the 1.5px white border around mobile-nav badge dots. There is no `1px solid` in this system.

## 3. Typography

**Display Font:** Fraunces (with Source Serif 4, Georgia, serif fallback)
**Body Font:** Inter (with `ui-sans-serif, system-ui, sans-serif` fallback)
**Label Font:** Inter (small caps via `letter-spacing: 0.04em`, no actual uppercase transform)

**Character:** Fraunces brings a humanist, slightly editorial warmth to headline moments without going decorative; its `opsz` axis lets headline weights stay readable at small sizes. Inter carries the workhorse body, captions, and labels; chosen specifically because it renders consistently on mid-tier Android browsers where San Francisco and Roboto Flex diverge. The pair is institutional without being stiff, and stays warm even at dark-mode contrast.

### Hierarchy
- **Display** (`weight 500`, `clamp(2rem, 4.5vw, 3.25rem)`, `line-height 1.1`, `letter-spacing -0.01em`): Hero headlines on landing, registration, OTP, and the empty-feed first-visit state. Never used inside the app shell itself.
- **Headline** (`Inter 500`, `20px`, `line-height 1.3`): Page titles inside the shell — "People you may know", "Upcoming events", section anchors. Tightened letter-spacing for a more deliberate read.
- **Title** (`Inter 500`, `15px`, `line-height 1.4`): Post author names, profile names, the create-post placeholder, nav-item labels at the larger end.
- **Body** (`Inter 400`, `15px`, `line-height 1.72`): Post content, comment content, long-form copy. Generous line-height for South Asian-script tolerance and dark-mode legibility. Cap at 65–75 characters per line.
- **Meta** (`Inter 400`, `12px`, `line-height 1.45`): Captions, departments-and-batch-year strings, post timestamps, helper copy beneath inputs.
- **Label** (`Inter 500`, `11px`, `letter-spacing 0.04em`): Eyebrows ("campus tools", "trending now"), badge text. Never `text-transform: uppercase` — letter-spacing alone gives the sense.

### Named Rules

**The Sentence-Case Rule.** All UI labels — buttons, nav items, badges, section headers — are sentence case. "Save" not "SAVE", "People you may know" not "People You May Know", "trending now" not "TRENDING NOW". The only place capital-letter prominence comes from is the letter-spaced label tier, and even there the visible characters stay lowercase.

**The Two-Weight Rule.** This system has exactly two weights: regular (400) for body copy and meta, medium (500) for titles, labels, and emphasis. Weights 600 / 700 / 800 do not exist. If you reach for one, increase the size instead.

**The Hierarchy-Through-Scale Rule.** The scale ratio between adjacent steps is ≥1.25. Flat scales (`13px → 14px → 15px → 16px`) read as decoration; the ratio is what makes hierarchy legible without color.

## 4. Elevation

**The Flat-By-Default Rule.** This system has no `box-shadow` for depth. Surfaces stack through a four-tier tint progression (`--surface-page` → `--surface-card` → `--surface-raised` → `--surface-hover`) — each tier two to three OKLCH lightness steps above the one below. Cards lift off the page through tint difference and a 0.5px hairline; modals lift off cards through the overlay (`--overlay-bg`, 75% opacity over page); the mobile More sheet lifts through tint + a hairline top border. The only `box-shadow` permitted in the system is the 2px ring used on `:focus-visible` (`box-shadow: 0 0 0 2px var(--uc-indigo-l)`), and that's an accessibility indicator, not depth.

### Surface Stack

| Token | Hex | Role |
|---|---|---|
| `--surface-page`   | `#060D1A` | The page background. Lowest tier. |
| `--surface-card`   | `#0A1628` | Cards, sidebar widgets, posts, mobile bottom nav. |
| `--surface-raised` | `#111D35` | Inputs, skeleton fills, More-sheet tiles, raised inline elements. |
| `--surface-hover`  | `#1A2D4A` | Hover-only. Never used at rest. |

### Named Rules

**The No-Shadow Rule.** `box-shadow` is reserved for `:focus-visible` rings. If you need depth, climb the surface stack. If you need hover feedback, change the border to `--border-hover` or the background to `--surface-hover`. Do not introduce ambient shadows, glow effects under buttons, drop shadows on cards, or "soft elevation".

**The Ghost-Border Fallback.** Where a 0.5px border at `--border-default` is too quiet (a sticky toolbar, an alert, an inline-error pane), step the *border* to `--border-hover` (`#FFFFFF21`) before reaching for anything stronger. Background lift is the next step after that; new colors are the step after *that*.

## 5. Components

The whole system is small. Each component is plain CSS-in-JS or Tailwind utility — there is no Radix, no shadcn, no shared component-library import path. Shared primitives live in `apps/web/src/components/`.

### Shared interaction utilities

Two utility classes carry the system's interaction conventions; apply them on every interactive element rather than re-implementing the same micro-feedback inline.

- **`.press-feedback`** — Press scales the element to `0.94` over `120ms` with `--ease-out-strong`, alongside transitions on `background`, `color`, and `border-color`. Use on any icon-button, nav row, or chip that has no other background change on press.
- **`.interactive-surface`** — Combines the press-feedback timing with a hover treatment (`@media (hover: hover) and (pointer: fine)` only): subtle background lift to `--surface-hover`. Use on rows that *are* the affordance — campus-tool tiles, event minis, the More-sheet tiles.

Pair them: a button can have `className="press-feedback row-hover-bg"` to compose the press feedback with the hover-row background utility.

### Buttons

- **Shape:** Pill (`border-radius: 999px`) for every button. There is no rectangular button.
- **Primary (`PrimaryBtn`):** `--uc-indigo` background, `--text-primary` text, `padding: 9px 20px`, `font-size: 13px`, `font-weight: 500`. Used for system-driven primary actions: Sign in, Post, Send invite. Hover: opacity 90%. Press: `scale(0.97)`.
- **Orange (`OrangeBtn`):** Same shape and size; `--uc-orange` background. Used when the action is *yours and consequential* — primary post-submit on first-post coachmark, "Confirm" on a profile-completion modal. Strictly rarer than indigo; orange-as-CTA is for self-anchored moments only.
- **Mint (`MintBtn`):** Same shape; `--uc-mint` background. Used only for success confirmations (a verification flow's final step).
- **Ghost (`GhostBtn`):** Transparent background, `0.5px solid var(--border-hover)` border, `--text-secondary` text. Used for secondary actions paired with a primary: Cancel, Discard, Skip.
- **Contextual (`ContextualBtn`):** `--surface-raised` background, `0.5px solid var(--border-default)` border, `--text-secondary` text. Used for inline tool-attaches inside the CreatePost expanded form (Photo / Poll mode toggles).
- **Reaction (`ReactionBtn`):** No background, no border; padding `6px 10px`, `--r-sm` radius (`8px`). On hover background steps to `--surface-raised`. Active state takes either `--uc-indigo` (Like — peer reaction) or `--uc-orange-l` (Save — self action) via the `activeTone` prop. The split is intentional; do not collapse the two.

### Chips / Badges

The `Badge` component carries five variants — `dept`, `alumni`, `pinned`, `live`, `neutral` — each pairing a `--*-bg` tint with the matching `--*-l` (or solid) text color. Padding is uniformly `2px 9px`. Used for role tags ("Student", "Alumni · verified", "Admin"), the "Pinned" banner eyebrow, and any short status tag inline with a title. Hashtag chips in the trending strip share the same shape but live in `--uc-indigo-bg` with a 0.5px `--uc-indigo-bdr` border, sized one tier larger (`3px 9px` padding).

### Cards / Containers

- **Corner Style:** `--r-lg` (`16px`).
- **Background:** `--surface-card`.
- **Border:** `0.5px solid var(--border-default)`. Hover (when interactive) transitions to `--border-hover` via the `card-hover-border` utility class.
- **Shadow:** None (see Elevation).
- **Internal padding:** `16px` standard. Posts use `14px 16px 12px` to account for the announcement strip flush against the top.
- **Nesting:** Forbidden. A card never contains another card. Sections inside a card are separated by `0.5px solid var(--border-default)` row dividers, not nested chrome.

### Inputs / Fields

- **Pill input (CreatePost trigger):** `40px` height, `--surface-raised` background, `0.5px solid var(--border-hover)` border, `--r-pill` radius. Used for one-shot fields where the entire purpose is single-line entry (search bar, "What's on your mind").
- **Block input (CreatePost expanded textarea):** Borderless, `--surface-card` background, `15px` body type. The 0.5px hairline lives on the wrapping container instead.
- **Focus:** `box-shadow: 0 0 0 3px var(--uc-indigo-bg)` plus border shift to `--uc-indigo`. Same focus treatment across pill and block inputs.

### Navigation

- **LeftSidebar nav item:** `8px 10px` padding, `--r-sm` corner. Resting state is transparent with `--text-secondary` text. Active state takes `--uc-indigo-bg` background and `--uc-indigo-xl` text (the only place Network Indigo Pale appears). Hover lifts to `--surface-hover` *except* on the active item.
- **MobileBottomNav:** Fixed bottom strip, 5 slots (Home, Explore, Messages, Alerts, More), `font-size: 10px` labels under `22px` icons. Active uses `--uc-orange-l` (self-state for "where you are"). Badge dots are `--uc-red`-filled, 15px diameter, with a 1.5px `--surface-card` border to punch them off the chrome.
- **More sheet:** Slides up from bottom; full-width, `--r-xl` top corners; tinted handle bar in `--border-strong`; a 4-column grid of icon-tiles, each tile being a `--surface-raised` square (`44×44px`, `--r-md`) with the label `11px / 500 / center` underneath. Active tile inherits orange like the parent bottom-nav.

### Signature: Announcement Strip (`PinnedBar`)

A 7×16px-padded strip flush against the top of an announcement or pinned post card. Background `--uc-orange-bg`; a single `0.5px solid var(--uc-orange-bdr)` *bottom* border (never side-stripe). Inside, a single `11px / 500` "Announcement" label in `--uc-orange-l`. The whole card stays in `--surface-card`. This is the only place in the system where a tinted strip sits inside a card; it is the *institutional voice* marker (faculty / admin posts), and its rarity is what makes it readable.

### Signature: Profile Mini-Card (`LeftSidebar` head)

A two-tone widget at the top of the desktop left rail. Top 60px is a `radial-gradient` dot-pattern over `--surface-raised`; bottom is the profile content (avatar pulled up over the cover via negative margin, name, dept · batch year, follower / following stats). The avatar wears a 1.5px UIU-orange background ring with a 2px `--surface-card` gap inside — *the only structural use of orange in the chrome*, and the single most legible signal that you are looking at *your own* mini-card.

### Signature: Progress Hero (`RightSidebar`, conditional)

Shown only when the user has incomplete milestones. Card-bodied (only card in the right rail when present), surfacing four checkable milestones with `--uc-orange-l` in-progress icons and `--uc-mint` done icons. Progress bars fill in `--uc-orange` over `--surface-raised`. Hides itself completely on full completion — not greyed out, hidden, because the activation moment is gone.

## 6. Do's and Don'ts

These guardrails enforce the strategic line from PRODUCT.md (anti-references quoted directly) and the impeccable absolute bans.

### Do:
- **Do** use UIU Cinder Orange (`#F05A28`) for things that are *yours* — your active filter, your saved bookmark, your progress, your avatar ring. The brand identity must be visible on every screen, but always in this role.
- **Do** use Campus Twilight Indigo (`#5B5BD6`) for the network around you — peer suggestions, primary CTAs, nav active states, event date boxes, trending tags.
- **Do** keep every border `0.5px solid var(--border-default)` unless there's a specific reason to step up. `1px` is loud in this system.
- **Do** climb the surface stack for depth: `--surface-page → --surface-card → --surface-raised → --surface-hover`. Tint, not shadow.
- **Do** use pill (`999px`) radii on every button and every chip. Card radius is `16px` (`--r-lg`).
- **Do** write all UI labels in sentence case. "Save" not "SAVE", "People you may know" not "People You May Know".
- **Do** use weight 400 for body and 500 for emphasis. There are no other weights.
- **Do** keep `--text-tertiary` (28% alpha) for *scannable* metadata only — timestamps, eyebrows, faint counters. Anything a user reads at length uses `--text-secondary` (58%) or `--text-primary`.
- **Do** design mobile-first behavior, not "responsive desktop". Sidebars collapse to a real More sheet that exposes every route, not to icon-only stubs.
- **Do** render skeletons that preserve final layout (sized boxes shaped like the data they'll be replaced by) — not generic shimmering blobs.
- **Do** respect `prefers-reduced-motion` — global rule in `index.css` already disables all animation/transition duration for users who request it.

### Don't:
- **Don't** look like consumer social (Facebook / Instagram). PRODUCT.md is explicit: no engagement-bait patterns, no algorithmic suggestion noise, no blue-heavy identity. UIU orange is not negotiable as the identity color.
- **Don't** look like SaaS-template UI. No SaaS-cream light mode, no Notion-style beige, no "productivity tool" indigo-with-glow look.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe. The announcement banner uses a *full-width tinted strip with a bottom border*, never a side stripe. Side-stripe borders are the absolute ban in this system.
- **Don't** use `background-clip: text` with a gradient. No gradient headlines, no gradient buttons, no gradient anything in the brand surface. The accent colors are flat by design.
- **Don't** use glassmorphism. No `backdrop-filter: blur(...)` on cards, modals, or chrome. The overlay uses a flat `--overlay-bg` token (75% opacity over page).
- **Don't** use `box-shadow` for depth. Focus rings only. If you reach for `box-shadow` outside `:focus-visible`, you've broken the Flat-By-Default Rule.
- **Don't** nest cards. A card containing a card is always wrong here. Use 0.5px row dividers inside a card if you need sectioning.
- **Don't** use `Title Case` or `ALL CAPS` on labels. The letter-spaced 11px label tier is the only place "uppercase-feeling" emphasis is permitted, and even there the visible characters stay lowercase.
- **Don't** use weights 600, 700, or 800. If a step needs more weight, increase the size instead.
- **Don't** put gray text on a coloured background. Text on `--uc-orange-bg` uses `--uc-orange-l`. Text on `--uc-indigo-bg` uses `--uc-indigo-l` or `--uc-indigo-xl`. Never `--text-secondary` over a tint.
- **Don't** hide the scrollbar entirely (`scrollbar-width: none`). Use the `.rail-scroll` utility — thin, tinted, invisible-until-hover, but always discoverable.
- **Don't** ship a feature without empty / loading / error states matched to the filter or query context. Generic "Nothing here yet" copy is the *all-filters* fallback; the others get filter-specific titles + a "Show everything" recovery action.
- **Don't** use `transition: width` or `transition: height` for state changes. Width-fill on plain progress bars (Your progress milestones) is the one exception. For any fill that overlaps content (poll-option bars, vote tallies), use a `transform: scaleX()` underlay with `transform-origin: left center` instead — the content sits in a relative z-stack above and isn't distorted. The pattern is in `PollBlock` (`apps/web/src/features/feed/components/PostCard.tsx`).
- **Don't** introduce em dashes (—) into UI copy. Use a colon, a comma, a period, or parentheses. PRODUCT.md voice is "direct without being terse"; em dashes belong to a different voice.
