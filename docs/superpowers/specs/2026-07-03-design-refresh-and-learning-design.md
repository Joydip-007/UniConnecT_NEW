# UniConnecT design refresh & learning platform — design spec

**Date:** 2026-07-03
**Status:** Draft for review
**Scope:** Brand/palette evolution, tenant theming, layout philosophy, learning features (skill paths, streaks, badges), role badges, motion system, component upgrades, and the audit fix list.

---

## 1. Goals

- Make UniConnecT feel confident and platform-first as a multi-tenant product, instead of a UIU-branded app.
- Reposition the product around **healthy engagement**: purposeful feed, no doomscrolling mechanics, learning built in.
- Bring interaction quality up to 2026 standards (View Transitions, purposeful micro-interactions, frosted surfaces) without violating the existing design system (tokens only, no shadows, 0.5px borders, weights 400/500, sentence case).
- Fix the concrete bugs and inconsistencies found in the audit (§8).

## 2. Brand model — platform brand + tenant accent

**Decision: strong UniConnecT brand with one tenant accent slot.**

- UniConnecT owns the core palette: surfaces, text, primary actions (indigo family), semantic colors. Identical across all universities.
- Each university gets exactly one accent token family: `--tenant-accent`, `--tenant-accent-l`, `--tenant-accent-bg`, `--tenant-accent-bdr` (dark + light values, stored in `university_settings`, applied at runtime on `:root` after `resolveUniversity`-equivalent bootstrap on the client).
- Tenant accent decorates **campus context only**: logo area, campus badges, event highlights, shuttle branding, avatar ring on the sidebar profile card. It never colors primary buttons, links, or role identity.
- UIU orange (`--uc-orange-*`) is demoted from global brand color to UIU's tenant accent. Existing orange usages migrate to either `--tenant-accent` (campus context) or a neutral/semantic token (everything else).

## 3. Core palette — evolved indigo-violet

**Decision: evolve, don't replace.** Keep the Warm Futuristic Dark navy foundation and the light theme structure. Changes:

- Push `--uc-indigo` toward a slightly more saturated, electric violet-blue (exact values tuned during implementation with AA checks in both themes; light theme keeps the darker-step pattern already documented in `tokens.css`).
- Add a warm **amber/gold family** (`--uc-amber`, `-l`, `-bg`, `-bdr`) reserved for achievements, streaks, and learning moments — the "reward" color, distinct from the tenant accent and from semantic mint/cyan/red.
- Add **duration tokens**: `--dur-fast: 150ms`, `--dur-med: 200ms`, `--dur-slow: 300ms` (easings already exist).
- Add **z-index tokens**: `--z-nav: 50`, `--z-popover: 100`, `--z-modal: 200`, `--z-toast: 300`, `--z-banner: 400`.
- Add **role token families** (§6) and **tenant accent family** (§2).

## 4. Layout philosophy — purposeful feed

**Decision: keep the feed, redesign it as a campus briefing.**

- Ranked highlights first (existing `hot_score` infrastructure), interleaved non-social cards: "your daily learning unit", upcoming event, mentorship nudge — at most one interleaved card per ~6 posts.
- **"You're all caught up"** end-state after ranked content is exhausted, with a one-time subtle celebration animation; below it, older content loads only on explicit "Show earlier posts" — no infinite autoload past the caught-up line.
- Feed column at a comfortable reading measure (~600px). Side rails visually quieter: smaller type, `--text-secondary`, fewer card borders (surface contrast instead).
- Sticky-smart top bar: hides on scroll-down, returns on scroll-up.
- Empty widgets hide entirely rather than rendering "No X right now" columns; learning-path card is the preferred fallback content for an empty right rail.

## 5. Learning features

### 5.1 Skill paths

Curated micro-learning tracks made of ordered 5–10 minute units.

**Data model (new tables):**
- `skill_paths` — title, description, category, difficulty, estimated days, `university_id` **nullable** (null = platform-wide path visible to all tenants), `badge_name`, `badge_icon`.
- `skill_path_units` — path FK, `display_order`, type (`read` | `video` | `exercise` | `quiz`), content JSONB, completion rule (quiz pass score or manual confirm).
- `skill_path_enrollments` — user × path, progress pointer, status (`active` | `completed` | `abandoned`).
- `unit_completions` — user × unit, timestamped (source of truth for streaks).

**Authoring tiers (rollout order):** 1) platform-seeded paths (interview prep, Git basics, etc.), 2) faculty/admin-authored per university via the admin panel, 3) (later) alumni-contributed with admin review.

**UX:** a "Learn" tab (left sidebar, Community group); enroll → today's unit surfaces as a card in the Learn tab and as the interleaved feed card. Pacing is deliberately ~one unit/day — units unlock sequentially.

### 5.2 Streaks

- Streak = consecutive days with ≥1 unit completion (any path). Denormalised `current_streak`, `longest_streak`, `last_activity_date` in a `learning_stats` row per user, updated on completion.
- Day boundary computed in the **university's local timezone**, not UTC.
- **Streak freezes**: 2 free per month, consumed automatically on a missed day.
- Nightly Bull cron (new `learning` queue) resets streaks / consumes freezes and enqueues at most one gentle "keep your streak" push per day via the existing `push` queue.
- **No streak leaderboard** (deliberate — avoids time-spent competition). Quiz/path leaderboards are acceptable later.

### 5.3 Badges (extends the existing badge system)

Extend existing badges tables with `category` and award rules; awards evaluated on the existing `badge` Bull queue, never inline.

| Category | Trigger | Examples |
|---|---|---|
| Path completion | Finish a path (per-path badge) | "Git Graduate" |
| Streak milestone | 7 / 30 / 100 days | "Week One", "Scholar", "Centurion" |
| Volume | N total unit completions | "Curious Mind" (10), "Deep Diver" (50) |
| Social learning | Deck contributions, quiz wins | ties groups/quiz into the same economy |

- Rarity tiers (common/rare/epic) derived from holder counts.
- Profile gets a `ProfileBadges` section; the user picks **one showcased badge** shown beside their name (right slot, §6). Uses the amber reward color family.

### 5.4 Study groups 2.0 & daily quiz (later phases, agreed direction)

- Groups module gains flashcard decks + shared notes with spaced-repetition review (study sessions/RSVP already exist).
- Daily campus quiz per department with per-university leaderboard.
- Both feed the badge economy. Detailed specs deferred to their own design docs.

## 6. Role badges

Role identity beside every display name, platform-global (same meaning at every university).

| Role | Color direction | Glyph | Hover animation |
|---|---|---|---|
| student | Indigo | Graduation cap | cap tips |
| alumni | Amber/gold | Laurel/medal | shimmer sweep |
| faculty | Teal/cyan | Open book | subtle open/flip |
| admin | Warm red-orange | Shield | slow pulse ring |
| driver | Neutral slate | Bus/wheel | micro-rotation |

- New `RoleBadge` component (`src/components/`, props: `role`, `size`, `showTooltip`), token families `--role-{role}` / `-bg` / `-bdr` / `-text` with dark + light values (light steps darker for AA).
- 14–16px badge left of the name; the name itself uses the role's text token at weight 400/500.
- Hover (or tap on touch): badge animates + a pill tooltip slides in (~200ms, `--ease-out-expo`) with the role name in sentence case, tinted with the role's `-bg`/`-bdr`.
- **Idle-calm rule:** badges never animate at rest — hover/interaction only. CSS-only, transform/opacity, `prefers-reduced-motion` guarded.
- Two name slots, never more: role badge (left, always) + one showcased achievement badge (right, optional).
- Replaces the "Alumni · verified" conflation — role and verification are separate signals.

## 7. Motion & interaction system

### 7.1 System infrastructure (build first)

- `src/lib/motion.ts` — exported framer-motion presets: `popoverIn` (scale 0.96 + fade, `--dur-med`), `modalIn`, `drawerIn` (slide-up, `--ease-drawer`), `listStagger` (30–40ms). All components import these; no inline transition objects.
- Shared **`Modal`** primitive (`src/components/Modal.tsx`): overlay (fade + `backdrop-filter: blur(8px)`), panel scale-from-0.96, focus trap, Escape, scroll lock, focus return, `AnimatePresence`; exits ~25% faster than entrances. All existing modals (ConnectionRequest, CreateGroup, Apply, EditProfile, Experience, Education, Featured, Invite, NewConversation, Redemption, Request, Report, PostItem, SharePost) become thin content children.
- Shared **`Drawer`** primitive for CommentDrawer / StickerDrawer.
- Global **toast-with-undo** system (promote mentorship's ToastContainer to `src/components/`).
- `useReducedMotion` respected in all framer-driven animation.
- Hard rules: transform/opacity only; ≤300ms interactions, ≤400ms route transitions; idle screens are still.

### 7.2 Navigation

- **View Transitions API** for route changes (progressive enhancement): card→detail shared-element morphs via `view-transition-name`; list routes cross-fade 200–250ms.
- Skeletons match final layout and shimmer with `--surface-glint`.
- Staggered card entrance on first page load only.

### 7.3 Component upgrades

**TopNav:** frosted translucent bar (semi-transparent surface + blur 12px); hide/reveal on scroll; search expands on focus (400→520px) with ⌘K/Ctrl-K shortcut chip; badge counts pop (existing `uc-reaction-pop`) with digit-roll on change; animated sun↔moon theme toggle; reconnecting banner slides in/out and flashes a brief "Connected" success state.

**LeftSidebar:** sliding active-nav indicator (framer `layoutId`); icon nudge + color lift on hover; profile mini-card fully clickable with surface-lift hover; stats count-up on load; avatar ring → `--tenant-accent`; (optional, phase 2) collapse to 68px icon rail.

**RightSidebar:** staggered widget entrance; dismissable suggestions with exit animation (✕ on hover, height-collapse via `AnimatePresence`); "See all" hover arrow; progress-widget completion moment (check-draw + brief shimmer, then animated collapse) instead of silently disappearing; event date-box hover lift.

**Popups:** NotificationDropdown, MessagesPopup, SearchPanel standardize on `popoverIn`; notification items stagger 20ms; unread-dot animates out on read; SearchPanel uses framer `layout` for smooth height changes between queries.

**Buttons/feedback:** `:active` scale 0.97; primary-button hover sheen (masked gradient, GPU-only); optimistic UI on connect/RSVP/like with button-state morphs (e.g. "Connect" → "Pending" width-animated crossfade); inline validation via border-color transition (never shake).

### 7.4 Landing page

- Hero: oversized kinetic typography (staggered word entrance) + muted autoplaying product loop (10–15s WebM/MP4, poster fallback, lazy, pauses off-screen) showing real app flows.
- Scroll-driven section reveals via CSS `animation-timeline: view()` — no scroll-jacking.
- One signature interaction: the multi-tenant section morphs a campus crest through several universities as `--tenant-accent` sweeps the section.

## 8. Audit fix list (correctness & consistency)

**Bugs:**
1. `CommentDrawer.tsx:682` — `var(--shadow-lg)` undefined → remove (no-shadow rule).
2. `AccountSection.tsx:299,323` — `var(--uc-green, #2e9e5b)` undefined token; use `--uc-mint`.
3. Own-profile shows Connect button and "Connect to see featured items" lock — verify/fix the self-view conditional.
4. Stray floating palm-tree element bottom-right on feed/profile — identify and remove if not intentional.

**Text/casing:** sidebar section labels to consistent sentence case ("Campus tools", "Trending now"); remove `textTransform: uppercase` in `StudySessionsTab`, `LandingFooter`, `hover-footer` (ResumeExportButton print stylesheet exempt); split "Alumni · verified" into role + separate verification signal.

**Color/theme:** replace hardcoded hexes — `ShuttleTab.tsx:66` (#5B5BD6), `ShuttleMap.tsx:249` (#F05A28 → tenant accent), `MediaGrid.tsx:108` (#fff → `--on-accent`; black media backdrop may stay, documented); replace hardcoded rgba shadows in `ImageLightbox`, `ReactionBar`, `RadialOrbitalTimeline` with a themed elevation token if the floating-over-media exception is kept, else remove.

**Layout/responsive:** hide empty right-rail widgets; centralize z-index tokens; add `overflow-wrap: anywhere` to post bodies; verify popup overflow at 768–1100 widths; tablet gets right-rail content as horizontal strips atop the feed (or the icon-rail collapse frees width).

**UX-principle gaps to close:** toast-with-undo for dismiss/remove actions (reversal); success/closure states on form submits and the progress widget (closure); ⌘K as the first keyboard shortcut (expert shortcuts); explicit privacy explanations when an action is blocked ("Only connections can message X") instead of silent hiding (conceptual model).

**Acceptance step:** live screenshot pass of every page, both themes, at 390/768/1280 widths (extend `scripts/screenshot.cjs` with a light-mode + width matrix).

## 9. Implementation phases

1. **Foundations** — new tokens (durations, z-index, amber, roles, tenant accent), motion presets, shared Modal/Drawer/Toast, audit bug fixes. Everything else depends on this.
2. **Component polish** — TopNav/sidebars/popups upgrades, View Transitions, feed "caught up" state, casing/color fixes.
3. **Role badges** — tokens + `RoleBadge` + rollout across name renders.
4. **Learning MVP** — skill paths + streaks + badge categories (new `learning` module: migrations from `077_`, module under `apps/api/src/modules/learning/`, feature bundle `src/features/learning/`, `/learn` route).
5. **Landing page refresh** — hero video, kinetic type, scroll reveals.
6. **Later** — study groups 2.0 decks, daily quiz, sidebar icon-rail collapse (each gets its own spec).

Each phase independently shippable; phases 2–5 can be reordered by priority.

## 10. Error handling & testing notes

- Tenant accent falls back to the indigo family if a university has no accent configured.
- View Transitions and `animation-timeline` are progressive enhancements — feature-detect, fall back to instant navigation / static sections.
- Learning: unit completion writes are idempotent (unique user×unit); streak cron is timezone-aware and covered by unit tests around day boundaries and freeze consumption; badge awards deduplicated in the worker.
- Frontend: Modal primitive gets focus-trap/Escape/scroll-lock tests once (deleting per-modal duplicates); motion respects `prefers-reduced-motion` in both CSS and framer paths (test with matchMedia mock).
- All API work follows existing module conventions (router/controller/service/schema, `asyncHandler`, `sendSuccess`, Zod in `packages/shared`).
