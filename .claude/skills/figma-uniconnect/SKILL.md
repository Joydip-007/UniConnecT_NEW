---
name: figma-uniconnect
description: Use when starting any Figma design session for the UniConnecT webapp — creating frames, components, or prototypes — OR when verifying that a live app page matches its Figma design. Triggers on "build Figma", "design in Figma", "create frames", "continue Figma session", "verify design", "compare with Figma", "check [page] against design", or any request to design or visually verify a UniConnecT page.
---

# figma-uniconnect

## Session Start — do this before ANY other action

```
1. Read docs/FIGMA_BUILD_TRACKER.md          ← file ID, node IDs, resume state, hex values
2. Load use_figma tool schema:
   ToolSearch(query="select:mcp__claude_ai_Figma__use_figma,mcp__claude_ai_Figma__create_new_file")
3. Announce exactly what you are building    ← from tracker's Current Queue section
4. If Figma File ID is "TBD": call whoami → create_new_file → update tracker
```

Never skip step 1. It is the only cross-session memory.

---

## Source of Truth Rule (non-negotiable)

**The live app is the source of truth. Figma follows the app — never the other way around.**

When a verification pass finds mismatches between the live app and a Figma frame:
- **Fix the Figma frame** to match what the live app actually does.
- **Never touch the codebase** to make the app match Figma.
- The codebase is owned by engineers. Figma is the design artifact.

---

**After reading the tracker, check `Initial Verification` in Figma Project Info:**

- `⬜ pending` → **before any design work**, verify every already-built page. For each: `Read(file_path:'screenshots/<name>.png')`, fetch matching Figma frame with `get_screenshot`, compare, log deviations in tracker Known Deviations. When all built pages are checked, flip tracker field to `✅ done`. Then proceed to design work.
- `✅ done` → skip verification. Design first, verify after as normal.

---

## Figma Plugin API — Critical Rules (embedded, replaces figma-use load)

Use `figma-uniconnect` as the `skillNames` value on every `use_figma` call.

### Non-negotiable API rules

| # | Rule | Detail |
|---|---|---|
| 1 | **`return` is your only output** | Never `figma.closePlugin()`, never `console.log()`. Return a value — it's JSON-serialized automatically. |
| 2 | **No IIFE wrapper** | Code runs in an auto-wrapped async context. Write top-level `await` directly. |
| 3 | **Colors are 0–1 range** | `{r:1,g:0,b:0}` = red. Divide hex channel by 255. Never pass 0–255 values. |
| 4 | **No `figma.notify()`** | Throws "not implemented". Remove it entirely — use `return` for progress. |
| 5 | **Fills/strokes are read-only** | Clone before modifying: `const f = [...node.fills]; f[0] = ...; node.fills = f` |
| 6 | **Load fonts before any text write** | `await figma.loadFontAsync({family, style})` before EVERY text mutation. Covers `characters`, `fontSize`, `fontName` — any text property. |
| 7 | **Page context resets each call** | `figma.currentPage` starts on page 1 every `use_figma` call. Always `await figma.setCurrentPageAsync(page)` at the top of scripts targeting other pages. |
| 8 | **Switch page at most once per script** | Never loop over pages and switch inside the loop. Fan multi-page work into parallel `use_figma` calls (one per page, one message). |
| 9 | **FILL after appendChild** | `layoutSizingHorizontal/Vertical = 'FILL'` is only valid on children of auto-layout frames. Always `parent.appendChild(child)` FIRST, then set `'FILL'`. `'HUG'` only on the auto-layout frame itself or on TEXT children. |
| 10 | **Return ALL node IDs** | Every script that creates or mutates nodes must `return { createdNodeIds: [...], mutatedNodeIds: [...] }`. Subsequent scripts need these IDs. |
| 11 | **Scripts are atomic** | A failed script makes ZERO changes. Stop on error, read the message, fix, retry. Never retry without understanding the failure. |
| 12 | **Sequential only** | Never run two `use_figma` calls in parallel. Figma state mutations must be strictly sequential. |
| 13 | **Auto-layout for structure** | Use `figma.createAutoLayout('VERTICAL'|'HORIZONTAL')` whenever children have a structural relationship. Not `createFrame()` with absolute x/y for internal children. |
| 14 | **Increment, never batch** | Max ~10 logical operations per `use_figma` call. Build top-down with placeholders; validate with `await node.screenshot()` after each major step. |
| 15 | **`node.set({...})`** | Batch-set multiple properties in one call instead of one line per property. |
| 16 | **`node.query('selector')`** | CSS-like node search within a subtree. Replaces verbose `findAll` loops. |
| 17 | **`combineAsVariants`** | `figma.combineAsVariants([comp1, comp2, ...], page)` to create component sets. Components must be appended to `page` first. |
| 18 | **`lineHeight`/`letterSpacing` format** | Always `{unit: 'PIXELS', value: N}` — never a bare number. |
| 19 | **Position new top-level nodes away from (0,0)** | Scan existing children to find a clear canvas position. Only applies to page-level nodes. |
| 20 | **`setBoundVariableForPaint` returns a new paint** | Capture and reassign: `const newPaint = node.setBoundVariableForPaint(paint, 'color', variable); node.fills = [newPaint]` |

### Escape hatch for deep errors

If you hit an error not covered by the rules above, load the full figma-use reference:
```
ReadMcpResourceTool(server="claude.ai Figma", uri="skill://figma/figma-use/SKILL.md")
```
This costs ~15k tokens. Only do it when the embedded rules above are insufficient.

---

## UniConnecT Design Rules (non-negotiable every frame)

| Rule | Correct | Wrong |
|---|---|---|
| Colors | Always from tracker Token Reference table | Never guess or approximate hex |
| Borders | `0.5px solid` + border token | Never `1px` for structural borders |
| Buttons | `cornerRadius: 999` (pill) exclusively | No sharp corners, no `8px` |
| Font weight | `400` Regular or `500` Medium only | Never 600, 700, or 800 |
| Text case | Sentence case everywhere | No ALL CAPS, no Title Case |
| Surfaces | page → card → raised (no shadows) | No `box-shadow` / `effects` for depth |
| Text on color | Use `*-l` light variant (e.g. `#F5845A` on orange bg) | Never raw white on colored bg |
| Theme | Dark theme default for all frames | Light = secondary variant only |
| Frame sizes | Desktop 1440×900 · Mobile 390×844 | No other base sizes |
| Font | Plus Jakarta Sans (display), JetBrains Mono (mono) | Satoshi unavailable — PJS is the approved substitute |

---

## Token Quick-Lookup (dark theme)

```
Page bg:          #060D1A     Card surface:     #0A1628
Raised surface:   #111D35     Hover surface:    #1A2D4A
Primary text:     #EEF2FF     Secondary text:   rgba(238,242,255,0.58)
Tertiary text:    rgba(238,242,255,0.28)
Indigo:           #5B5BD6     Indigo light:     #7C7CF0
Indigo bg:        rgba(91,91,214,0.10)    Indigo border: rgba(91,91,214,0.28)
Orange:           #F05A28     Orange light:     #F5845A
Orange bg:        rgba(240,90,40,0.10)    Orange border: rgba(240,90,40,0.28)
Navy:             #1E3A70     Cyan:             #06B6D4
Mint:             #10B981     Red:              #E11D48
Border default:   rgba(255,255,255,0.07)
Border hover:     rgba(255,255,255,0.13)
Border strong:    rgba(255,255,255,0.22)
```

Light theme overrides and full rgba values → `docs/FIGMA_BUILD_TRACKER.md` Token Reference.

Hex→0–1 helper: `const h=hex=>{const n=parseInt(hex.slice(1),16);return{r:((n>>16)&255)/255,g:((n>>8)&255)/255,b:(n&255)/255}}`

---

## Existing Figma File State

| Item | Value |
|---|---|
| File ID | Read from tracker — `docs/FIGMA_BUILD_TRACKER.md` |
| Pages | 🎨 Foundations · 🧩 Components · 🔐 Login · 📱 Feed |
| Variable collections | Primitives (23), Color Dark/Light (18), Spacing (10), Radius (5) |
| Text styles | Display/32, H1/24, H2/20, H3/16, Body/md/14, Body/sm/13, Caption/12, Label/11, Mono/13 |
| Component sets built | Button (3v), Avatar (3v), Badge (4v), Input (4v), Sidebar/Desktop |
| Pages built | Login desktop (node `16:2`), Feed desktop (node `17:2`) |

---

## Build Order (default, always defer to tracker Current Queue)

1. Fix deviations logged in tracker Known Deviations
2. Extract inline molecules → standalone components (Post Card, Suggestion Card)
3. Auth pages: Register → OTP → Login mobile
4. Core pages: Profile → My Network → Messages
5. Content: Jobs → Events → News → Groups
6. Campus/utility: Mentorship → Notifications → Admin → Explore
7. Prototypes: link flows after all frames exist

---

## Architecture Reminders

- **Sidebar** on every authenticated desktop page: orange dot + "UniConnecT", 10 nav items (indigo active), user avatar pill at bottom.
- **Messages** 3 types: `direct`, `group`, `mentorship` (mentorship uses orange accent).
- **Connections** LinkedIn-style bidirectional — no "follow" button anywhere.
- **Profile** sections: about · experience · education · skills · featured (max 5) · analytics (7/30/90d) · viewers.
- **Groups** private: show "Request to join" not "Join".
- **Mentorship** page: points balance shown as orange badge.
- **Admin**: show locked/denied state for non-admin role viewer.
- University branding: default "UIU" / UIU orange throughout.

---

## Building from Screenshots

Pre-captured screenshots of every built page live in `screenshots/`. Use them as the primary reference when building or updating Figma frames — no Puppeteer needed during the session.

**Load a reference before building a frame:**
```
Read(file_path: 'screenshots/feed.png')
Read(file_path: 'screenshots/login.png')
```

Available: `feed` · `login` · `login-mob` · `register` · `otp` · `profile`

Screenshots stay current automatically — CLAUDE.md instructs Claude to re-run `node scripts/screenshot.cjs <name>` after any UI change. If a screenshot looks stale, re-run before the session.

---

## Verification

Trigger: "verify design", "compare [page] with Figma", "check [page] against design".

1. `Read(file_path:'screenshots/<name>.png')` — live app reference (already on disk, no Puppeteer)
2. `ToolSearch(query="select:mcp__claude_ai_Figma__get_screenshot")` → `get_screenshot(fileId:FILE_ID, nodeId:NODE_ID)` — Figma frame (IDs from tracker)
3. Compare both against UniConnecT Design Rules above
4. Log deviations in tracker Known Deviations: `| date | page | element | live | expected | Critical/Major/Minor | ⬜ |`

Severity: **Critical** (wrong token, shadow, missing sidebar) · **Major** (font weight 600+, 1px border, sharp button) · **Minor** (spacing ≤8px off, icon size). Fix Critical before session ends; carry rest to Current Queue.

---

## Session End Protocol (mandatory before closing)

```
Update docs/FIGMA_BUILD_TRACKER.md:
  a. Session Log     — append one row (date, built, quality 1–5, ~tokens)
  b. Page status     — flip ⬜ → 🔄 or ✅ for touched pages
  c. Component status — same
  d. Known Deviations — log anything not matching the live app
  e. Current Queue   — rewrite with specific next steps for the next session
  f. File ID         — update if newly created this session
```

Never close a session without updating the tracker. It is the only cross-session memory.

---

## Quality Reference

| Score | Meaning |
|---|---|
| 1 | Placeholder only, colors wrong |
| 2 | Correct layout, colors approximate |
| 3 | Accurate layout + correct token colors |
| 4 | Close to production — spacing, states, components correct |
| 5 | Pixel-accurate, prototype-linked, all states covered |

Target 4+ for core pages. 3+ acceptable for first pass.
