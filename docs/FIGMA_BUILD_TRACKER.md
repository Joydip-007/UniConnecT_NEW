# UniConnecT — Figma Design Build Tracker

> **For Claude Code sessions:** Read this file at the start of any Figma design session.
> Update the Session Log and page/component statuses after every session.
> This is your memory across context windows.

---

## How to resume in a new session

1. Read this file fully.
2. Check **Current Queue** to know exactly what to build next.
3. Open the Figma file using the File ID below (or create one if missing).
4. Invoke `Skill("figma-use")` before any `use_figma` call.
5. Match all colors **exactly** from the Token Reference table — never guess hex values.
6. After session ends: update Session Log, flip statuses, set new Current Queue.

---

## Figma Project Info

| Field | Value |
|---|---|
| Initial Verification | ✅ done |
| Figma File ID | `4NDXOk9K2S2VRqFL8qFGun` |
| Figma File URL | `https://www.figma.com/design/4NDXOk9K2S2VRqFL8qFGun` |
| Figma File Name | `UniConnecT — Design System & Prototypes` |
| Figma Team / Project | `TEAM_MAVERICKS_WEB` (key: `team::1611063647095441882`) |
| Primary Theme | Warm Futuristic Dark (dark is default; light is secondary) |
| Font | Satoshi (display), JetBrains Mono (code/mono) |
| Frame sizes | Desktop: 1440×900, Mobile: 390×844 |

---

## Design Token Reference (exact hex — source: `apps/web/src/styles/tokens.css`)

### Dark Theme (default)

| Token | Value |
|---|---|
| `--surface-page` | `#060D1A` |
| `--surface-card` | `#0A1628` |
| `--surface-raised` | `#111D35` |
| `--surface-hover` | `#1A2D4A` |
| `--uc-indigo` | `#5B5BD6` |
| `--uc-indigo-l` | `#7C7CF0` |
| `--uc-indigo-xl` | `#A5A5F8` |
| `--uc-indigo-bg` | `rgba(91,91,214,0.10)` |
| `--uc-indigo-bdr` | `rgba(91,91,214,0.28)` |
| `--uc-orange` | `#F05A28` |
| `--uc-orange-l` | `#F5845A` |
| `--uc-orange-bg` | `rgba(240,90,40,0.10)` |
| `--uc-orange-bdr` | `rgba(240,90,40,0.28)` |
| `--uc-navy` | `#1E3A70` |
| `--uc-cyan` | `#06B6D4` |
| `--uc-cyan-bg` | `rgba(6,182,212,0.10)` |
| `--uc-mint` | `#10B981` |
| `--uc-mint-bg` | `rgba(16,185,129,0.10)` |
| `--uc-red` | `#E11D48` |
| `--uc-red-bg` | `rgba(225,29,72,0.08)` |
| `--overlay-bg` | `rgba(6,13,26,0.75)` |
| `--text-primary` | `#EEF2FF` |
| `--text-secondary` | `rgba(238,242,255,0.58)` |
| `--text-tertiary` | `rgba(238,242,255,0.28)` |
| `--border-default` | `rgba(255,255,255,0.07)` |
| `--border-hover` | `rgba(255,255,255,0.13)` |
| `--border-strong` | `rgba(255,255,255,0.22)` |

### Light Theme overrides

| Token | Value |
|---|---|
| `--surface-page` | `#FAF7F2` |
| `--surface-card` | `#FFFFFF` |
| `--surface-raised` | `#F4F0E8` |
| `--surface-hover` | `#EDE7DA` |
| `--uc-indigo` | `#4747C2` |
| `--uc-orange` | `#D44A1F` |
| `--text-primary` | `#1A1F2E` |
| `--text-secondary` | `rgba(26,31,46,0.62)` |
| `--text-tertiary` | `rgba(26,31,46,0.36)` |
| `--border-default` | `rgba(0,0,0,0.08)` |

### Radius & Easing

| Token | Value |
|---|---|
| `--r-sm` | `8px` |
| `--r-md` | `12px` |
| `--r-lg` | `16px` |
| `--r-xl` | `20px` |
| `--r-pill` | `999px` |
| Borders | `0.5px solid var(--border-*)` — never `1px` |
| Font weight | `400` and `500` only — never 600/700/800 |
| Text case | Sentence case — no ALL CAPS or Title Case |
| Buttons | `border-radius: var(--r-pill)` exclusively |

---

## Component Library Status

Status codes: `✅ done` · `🔄 in progress` · `⬜ not started` · `⚠️ partial`

| Component | Status | Quality (1–5) | Notes |
|---|---|---|---|
| **Foundations** | | | |
| Color styles / tokens | ✅ | 5 | 23 primitives + 18 semantic (Dark/Light), Spacing ×10, Radius ×5 |
| Text styles (H1–H4, body, caption, mono) | ✅ | 5 | 9 styles: Display/32, H1–H3, Body/md, Body/sm, Caption, Label, Mono |
| Effect styles (overlays, glints) | ⬜ | — | |
| **Navigation** | | | |
| Sidebar (desktop) | ✅ | 4 | Rebuilt session 4: profile card (avatar/name/dept/stats) + grouped nav (Main/Community/You/campus tools) + active indigo pill. Node: `15:2` |
| Top bar (desktop) | ✅ | 4 | New session 4: logo left + pill search center + chat/bell/avatar right. 1440×56. Node: `74:2` |
| Top bar (mobile) | ⬜ | — | |
| Bottom nav bar (mobile) | ⬜ | — | |
| **Atoms** | | | |
| Button — primary (indigo, pill) | ✅ | 4 | Fixed session 4: fill changed orange→indigo to match live app. Node: `10:2` |
| Button — secondary (indigo, pill) | ✅ | 4 | Part of Button component set. Node: `10:4` |
| Button — ghost | ✅ | 4 | Part of Button component set. Node: `10:6` |
| Button — icon only | ⬜ | — | |
| Input field | ✅ | 4 | 4 states: Default, Focus (indigo border), Error (red), Disabled. Node: `13:14` |
| Textarea | ⬜ | — | |
| Badge / chip | ✅ | 5 | 4 colors: Indigo, Orange, Mint, Red. Node: `12:10` |
| Avatar (S/M/L with fallback initials) | ✅ | 4 | 3 sizes SM/MD/LG, initials. Node: `11:8` |
| Tag (explore tags) | ⬜ | — | |
| Dropdown / select | ⬜ | — | |
| Modal shell | ⬜ | — | |
| Toast / notification banner | ⬜ | — | |
| Skeleton loader | ⬜ | — | |
| **Molecules** | | | |
| Post card (feed) | ✅ | 4 | Updated session 4: action row now "Like 14 · Comment 5 · Save" (was "14 likes · 5 comments · Share"). Node: `27:2` |
| Job card | ⬜ | — | |
| Event card | ⬜ | — | |
| Group card | ⬜ | — | |
| News card | ⬜ | — | |
| Connection card | ⬜ | — | |
| Notification item | ⬜ | — | |
| Message preview row | ⬜ | — | |
| User suggestion card | ✅ | 4 | Standalone component on 🧩 Components page. Node: `30:2` |
| Mentorship request card | ⬜ | — | |
| Profile viewer row | ⬜ | — | |

---

## Page Frames Status

Status codes: `✅ done` · `🔄 in progress` · `⬜ not started` · `⚠️ partial (needs rework)`

Quality score: **1** = rough placeholder · **3** = accurate layout, close colors · **5** = pixel-accurate, prototype-linked

| Page | Route | Desktop Frame | Mobile Frame | Prototype Links | Quality | Session # | Notes |
|---|---|---|---|---|---|---|---|
| **Auth** | | | | | | | |
| Landing | `/` | ⬜ | ⬜ | ⬜ | — | — | |
| Login | `/login` | ✅ | ✅ | ⬜ | 4 | 1–3 | Desktop: `16:2` rebuilt session 3 to match live app (single-col centered, indigo btn, invite card). Mobile: `33:2` |
| Register | `/register` | ✅ | ⬜ | ⬜ | 4 | 2–3 | Node: `31:2` rebuilt session 3 to match live app (invite-code step, centered, indigo Continue btn) |
| OTP verification | `/otp` | ✅ | ⬜ | ⬜ | 4 | 2 | Node: `32:2` on 🔐 Login page |
| Forgot password | `/forgot-password` | ⬜ | ⬜ | ⬜ | — | — | |
| **Core** | | | | | | | |
| Feed | `/feed` | ✅ | ⬜ | ⬜ | 4 | 1,5 | Node: `17:2` on 📱 Feed page — session 5: TopBar + Sidebar/Desktop instances, main-feed expanded to 832px |
| Explore | `/explore` | ⬜ | ⬜ | ⬜ | — | — | |
| Explore (tag) | `/explore/tag/:tag` | ⬜ | ⬜ | ⬜ | — | — | |
| **People** | | | | | | | |
| Profile | `/profile/:id` | ✅ | ⬜ | ⬜ | 4 | 2,5 | Node: `35:3` on 👤 Profile page — session 5: TopBar + Sidebar/Desktop instances added, "My profile" active in nav |
| Connections | `/connections` | ✅ | ⬜ | ⬜ | 4 | 6 | Node: `42:3` on 🔗 Connections page — TopBar + Sidebar (My network active), 4-tab row, 2-col connection cards, right panel "People you may know" |
| **Content** | | | | | | | |
| Jobs list | `/jobs` | ⬜ | ⬜ | ⬜ | — | — | |
| Job detail | `/jobs/:id` | ⬜ | ⬜ | ⬜ | — | — | |
| Events list | `/events` | ⬜ | ⬜ | ⬜ | — | — | |
| Event detail | `/events/:id` | ⬜ | ⬜ | ⬜ | — | — | |
| News list | `/news` | ⬜ | ⬜ | ⬜ | — | — | |
| News detail | `/news/:id` | ⬜ | ⬜ | ⬜ | — | — | |
| **Community** | | | | | | | |
| Groups list | `/groups` | ⬜ | ⬜ | ⬜ | — | — | |
| Group detail | `/groups/:id` | ⬜ | ⬜ | ⬜ | — | — | Posts, members, sessions, resources, rules |
| **Messaging** | | | | | | | |
| Messages list | `/messages` | ✅ | ⬜ | ⬜ | 4 | 6 | Node: `95:3` on 💬 Messages page — TopBar + Sidebar (Messages active), left conv list (search/filters/5 rows w/ DM/Group/Mentorship badges), right chat area (header + 5 bubbles + input bar) |
| Conversation | `/messages/:id` | ⬜ | ⬜ | ⬜ | — | — | |
| **Campus** | | | | | | | |
| Lost & found | `/lost-found` | ⬜ | ⬜ | ⬜ | — | — | |
| Shuttle schedule | `/shuttle` | ⬜ | ⬜ | ⬜ | — | — | |
| **Other** | | | | | | | |
| Mentorship | `/mentorship` | ⬜ | ⬜ | ⬜ | — | — | Points economy, sessions, gift cards |
| Notifications | `/notifications` | ⬜ | ⬜ | ⬜ | — | — | |
| Admin | `/admin` | ⬜ | ⬜ | ⬜ | — | — | Stats, users, invites, reports, domains |
| 404 | `*` | ⬜ | ⬜ | ⬜ | — | — | |

**Total pages: 27** · Done: 8 / 27 · In progress: 0 / 27

---

## Prototype Flows Status

| Flow | Status | Frames covered | Notes |
|---|---|---|---|
| Auth flow (landing → login → feed) | ⚠️ | Login, Register, OTP, Feed frames | Cross-page prototype links not supported in Figma Plugin API — all auth frames must be on same page to link; see Known Deviations |
| Registration flow (register → OTP → feed) | ⬜ | — | |
| Post creation (feed → compose modal → feed) | ⬜ | — | |
| Job application flow | ⬜ | — | |
| Connection request flow | ⬜ | — | |
| Mentorship request flow | ⬜ | — | |
| Group join-request flow | ⬜ | — | |
| Message thread navigation | ⬜ | — | |
| Profile edit modal flow | ⬜ | — | |

---

## Session Log

> Append a new entry here at the end of every session. Never edit past entries.

| # | Date | What was built | Pages/components touched | Quality achieved | Token approx | Next session starts at |
|---|---|---|---|---|---|---|
| 1 | 2026-05-30 | Foundations: 56 variables (color, spacing, radius), 9 text styles, Button/Avatar/Badge/Input components, Desktop Sidebar, Login page (desktop), Feed page (desktop) | 🧩 Components, 🔐 Login, 📱 Feed | 4/5 overall | ~120k | Register page (desktop + mobile), then Profile page |
| 2 | 2026-05-30 | Fixed Login glow blob; extracted Post Card (27:2) + Suggestion Card (30:2) as standalone components; Register desktop (31:2); OTP desktop (32:2); Login mobile (33:2); Profile desktop (35:3) with cover/header/tabs/About+Skills | 🧩 Components, 🔐 Login, 👤 Profile (new page) | 4/5 overall | ~95k | Connections page, then Messages page; also migrate auth frames to single page for prototype flows |
| 3 | 2026-05-30 | Initial Verification pass + Figma corrections: rebuilt Login `16:2` and Register `31:2` to match live app exactly (single-col centered layout, indigo buttons, invite card). Added "live app is source of truth" rule to skill. | 🔐 Login | 4/5 | ~60k | Connections page desktop, Messages page desktop; also fix Feed `17:2` top nav bar + sidebar to match live app |
| 4 | 2026-05-30 | Components redesign pass: (1) Fixed Button primary fill orange→indigo. (2) Rebuilt Sidebar/Desktop `15:2` with profile card (avatar + name + dept + stats) + 4 grouped nav sections (Main/Community/You/campus tools) + indigo active pill. (3) Created new TopBar/Desktop `74:2` component (1440×56) with logo/search/actions. (4) Updated Post Card `27:2` action row: verb-first format + Share→Save. | 🧩 Components | 4/5 | ~50k | Update Feed `17:2` and Profile `35:3` to add TopBar and replace inline sidebar with Sidebar/Desktop component instance; then build Connections page |
| 5 | 2026-05-30 | Applied new components to page frames: Feed `17:2` — removed inline top-nav-bar + sidebar, added TopBar/Desktop instance + Sidebar/Desktop instance, expanded main-feed to 832px wide. Profile `35:3` — removed inline sidebar, added TopBar + Sidebar instances, disabled horizontal auto-layout (was causing off-canvas placement), repositioned main-area + right-panel, overrode active nav item to "My profile". | 📱 Feed, 👤 Profile | 4/5 | ~35k | Build Connections page desktop, then Messages page desktop |
| 6 | 2026-05-30 | Built Connections desktop `42:3` (4-tab row, 2-col connection cards w/ avatar/name/role/mutual/buttons, right panel w/ 4 suggestion cards + Connect btn). Built Messages desktop `95:3` on new 💬 Messages page (conv list w/ search/filter chips/5 rows/type badges/unread counts, chat area w/ header/5 bubbles/input bar). Overrode sidebar active: My network on Connections, Messages on Messages. Debugged + fixed pre-existing nodes on Connections page and off-canvas duplicate frame. | 🔗 Connections, 💬 Messages (new page) | 4/5 | ~90k | Profile mobile, Connections mobile, then Messages mobile |

---

## Current Queue (what to build next)

**Session 7 — Mobile frames + next desktop pages**

Step-by-step:
1. **Profile mobile** (390×844) on 👤 Profile page — top cover + avatar + name/dept, stats row, tab strip (About/Experience/Education/Skills), section cards below
2. **Connections mobile** (390×844) on 🔗 Connections page — bottom nav bar, tab strip, stacked connection cards
3. **Messages mobile** (390×844) — conv list only (full screen, tap to open thread)
4. **Jobs list desktop** (1440×900) — new page — job cards grid, filter sidebar, right panel job detail preview

---

## Known Deviations / Issues

> Log anything that doesn't match the live app exactly so future sessions know what to fix.

| Issue | Affected frame | Severity | Fixed in session |
|---|---|---|---|
| Satoshi font unavailable in Figma → using Plus Jakarta Sans (closest geometric equivalent) | All frames | Low — visually near-identical | Permanent workaround; add note when handing off to devs |
| Login page glow blob is positioned as a sibling on the root frame instead of inside the left panel | Login `16:2` | Low — visual only | ✅ Session 2 |
| Post card & suggestion card built inline in Feed frame — not extracted as standalone reusable components | Feed `17:2` | Medium — will cause duplication in other pages | ✅ Session 2 |
| Figma Plugin API `NAVIGATE` prototype links only work within the same page — cross-page links rejected | All auth frames, Feed | Medium — prototype flows can't span pages via Plugin API | Session 3: consolidate auth frames onto a single page, then wire flows |
| Profile page inline sidebar is a redraw (not an instance of `Sidebar/Desktop` component `15:2`) | Profile `35:3` | Low — inconsistency, no visual impact | Session 3 |
| **[Session 3 verification]** Login page layout was two-column in Figma but single-column centered in live app | Login `16:2` | Major | ✅ Session 3 — Figma `16:2` rebuilt to match live app (single-col, indigo btn, invite card) |
| **[Session 3 verification]** Login/Register buttons were orange in Figma but indigo in live app | Login `16:2`, Register `31:2` | Critical | ✅ Session 3 — Figma frames updated to indigo to match live app |
| **[Session 3 verification]** Register Figma showed full form; live app shows invite-code step only | Register `31:2` | Major | ✅ Session 3 — Figma `31:2` rebuilt to show invite-code step matching live app |
| **[Session 3 verification]** All authenticated pages (Feed, Profile) have a fixed top navigation bar (logo + search + icons) in the live app; Figma uses sidebar-only layout with NO top bar | Feed `17:2`, Profile `35:3` | Major — pervasive across all authenticated pages | ⚠️ TopBar/Desktop component created (session 4, node `74:2`); page frames not yet updated — do in session 5 |
| **[Session 3 verification]** Live sidebar has a user profile card at top and grouped nav (Main/Community/You/campus tools); Figma sidebar was simple dot+text nav | All authenticated frames | Major | ✅ Session 4 — Sidebar/Desktop `15:2` fully rebuilt with profile card + grouped nav + campus tools |
| **[Session 3 verification]** Nav item labels differ: live uses "Home/My network" whereas Figma used "Feed/Connections" | All authenticated frames | Minor | ✅ Session 4 — Sidebar rebuilt with correct labels (Home, Explore, My network, Messages, etc.) |
| **[Session 4]** Button primary component (`10:2`) fill was orange; live app uses indigo | Button component set | Critical | ✅ Session 4 — fill updated to #5B5BD6 |
| **[Session 4]** Post Card action row used "14 likes · 5 comments · Share"; live app uses verb-first + Save | Post Card `27:2` | Minor | ✅ Session 4 — updated to "Like 14 · Comment 5 · Save" |
| **[Session 4]** Page frames Feed `17:2` and Profile `35:3` still use inline sidebar redraws; TopBar not yet present on those frames | Feed, Profile pages | Major | ✅ Session 5 — both frames now use Sidebar/Desktop + TopBar/Desktop instances |
| **[Session 5]** Profile frame `35:3` was horizontal auto-layout — required `layoutMode = 'NONE'` before absolute positioning could work | Profile `35:3` | Low — fixed | ✅ Session 5 — auto-layout disabled, all children repositioned correctly |
| **[Session 6]** Connections page (42:2) had pre-existing nodes (old Sidebar/Desktop 42:4, Content Area 42:46) inside frame 42:3; also a duplicate offscreen frame 88:73 at y=1124 was created. Cleaned up in session 6. | Connections `42:3` | Low — fixed | ✅ Session 6 — deleted old nodes, rebuilt on correct frame |
| **[Session 6]** Connection card and suggestion card avatar initials text nodes leaked to page level (not appended to card). Fixed by rebuilding cards with `layoutMode='NONE'` absolute positioning. | Connections `42:3` | Medium | ✅ Session 6 — cards rebuilt with absolute layout |
| **[Session 6]** Chat area in Messages was HUG height (164px) instead of fixed 844px — messagesArea.layoutSizingVertical='FILL' had no effect. Fixed by explicitly resizing chatArea to 844px. | Messages `95:3` | Major | ✅ Session 6 — chatArea.resize(880, 844) applied |
| **[Session 6]** Message bubbles use fixed 440px width for both sent and received — live app uses content-width bubbles. Acceptable design approximation for Figma prototype. | Messages `95:3` | Minor | Carry forward — low priority |

---

## Architecture Notes (for design accuracy)

- **Sidebar** is always present on desktop for authenticated pages. It has: user profile card at top (avatar/name/dept/stats), grouped nav sections (Main / Community / You / campus tools), indigo active pill state. Logo lives in the TopBar, NOT the sidebar.
- **TopBar** is always present on desktop for authenticated pages. It has: logo left, pill search center, chat+bell+avatar right. 1440×56, dark page bg.
- **Multi-tenant**: university name/logo should be a component variant — default shows "UIU" in frames.
- **Messages** has 3 conversation types: `direct` (DM), `group`, `mentorship` (auto-created on mentorship accept, has orange accent).
- **Connections** replaced "follows" — bidirectional, LinkedIn-style. No follow button anywhere.
- **Mentorship** has a points balance visible on the mentorship page (orange badge).
- **Admin** page only accessible to `admin` / `faculty` role users — show a locked state variant.
- **Profile** has sub-sections: about, experience, education, skills, featured (max 5), analytics (7/30/90d views), viewers list.
- **Groups** private vs public: private groups show a "join request" state on the card, not "join" directly.
