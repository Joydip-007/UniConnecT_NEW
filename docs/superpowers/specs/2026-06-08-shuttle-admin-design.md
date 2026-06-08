# Shuttle admin management — design spec

**Date:** 2026-06-08  
**Project:** UniConnecT  
**Scope:** New "Shuttle" tab in the admin panel for full CRUD on shuttle routes, stops, and schedules.

---

## 1. Goal

Give admins a self-service UI to create, edit, and delete shuttle routes — including their stops (with lat/lng coordinates) and timetables — without touching the database directly. Changes are immediately reflected on the student-facing `/shuttle` map page.

---

## 2. Architecture

### No DB migration needed

The existing `shuttle_routes` schema already covers all required fields:

| Column | Type | Purpose |
|---|---|---|
| `name` | varchar(100) | Route display name, e.g. "Notun Bazar ↔ UIU" |
| `color` | varchar(7) | Hex color for map polyline, e.g. `#3B82F6` |
| `is_active` | boolean | Controls visibility on student page |
| `stops` | JSONB | Array of `{ id, name, orderIndex, lat, lng }` |
| `schedule` | JSONB | `fixed` or `continuous` schedule object |
| `est_duration_min` | integer, nullable | One-way trip duration for fixed routes |
| `cycle_minutes` | integer, nullable | Round-trip cycle for continuous routes |

### One new API endpoint

```
DELETE /campus/shuttle/routes/:routeId
```

- Auth: `requireRole('faculty', 'admin')`
- Returns 204 on success, 404 if not found or wrong university
- Existing: `POST /campus/shuttle/routes` and `PATCH /campus/shuttle/routes/:routeId` already exist

### New service method

`CampusService.listAllShuttleRoutes(universityId)` — same as `listShuttleRoutes` but without the `is_active: true` filter, so admins see inactive routes too.

### Frontend location

| File | Change |
|---|---|
| `apps/api/src/modules/campus/router.ts` | Add `DELETE /shuttle/routes/:routeId` route |
| `apps/api/src/modules/campus/controller.ts` | Add `deleteShuttleRoute` controller |
| `apps/api/src/modules/campus/service.ts` | Add `deleteShuttleRoute` + `listAllShuttleRoutes` methods |
| `apps/web/src/pages/admin/ShuttleTab.tsx` | New component (main deliverable) |
| `apps/web/src/pages/AdminPage.tsx` | Add `'shuttle'` tab to `TABS` array and render `<ShuttleTab />` |

No new npm dependencies — react-leaflet is already installed.

---

## 3. Component structure

### `ShuttleTab.tsx`

All state is local to this component. Two-column layout:

```
┌─────────────────┬──────────────────────────────────┐
│  Route list     │  Route editor                    │
│  (~280px fixed) │  (flex-1)                        │
└─────────────────┴──────────────────────────────────┘
```

**Left panel — route list:**
- "New route" button at the top
- Each route row shows: colored dot, name, active/inactive badge
- Clicking a row loads that route into the editor
- Selected row is highlighted

**Right panel — route editor:**
Shown when a route is selected or "New route" is clicked. Blank for new, pre-filled for existing.

| Field | Input type | Validation | Notes |
|---|---|---|---|
| Name | text | required, max 100 chars | e.g. "Notun Bazar ↔ UIU" |
| Color | `<input type="color">` + hex text | must be valid `#rrggbb` | color swatch preview |
| Active | toggle | — | off = hidden from students |
| Schedule type | select: `fixed` / `continuous` | required | toggles fields below |
| Outbound times | textarea | one `HH:MM` per line | only when `fixed` |
| Inbound times | textarea | one `HH:MM` per line | only when `fixed` |
| Operating hours start | time input | `HH:MM` | only when `continuous` |
| Operating hours end | time input | `HH:MM` | only when `continuous` |
| Est. duration (min) | number input | positive integer, nullable | only when `fixed` |
| Cycle minutes | number input | positive integer, nullable | only when `continuous` |
| Stops list | ordered rows | see below | `+ Add stop` appends blank row |

**Stop row fields:**
- Name (text input, required)
- Lat (number input, −90 to 90, required)
- Lng (number input, −180 to 180, required)
- Remove button (trash icon)

`orderIndex` is derived from array position at save time — no manual drag ordering. Each new stop gets a client-generated UUID for the `id` field (matching the `ShuttleStop` type).

**Map preview** (below stop list):
- ~280px tall `MapContainer` using react-leaflet
- Re-renders whenever the stops array changes
- Shows a `Polyline` in the selected route color connecting all valid stops in order
- Each stop rendered as a `CircleMarker` with a `Tooltip` showing its name
- Auto-fits bounds to current stop set
- Read-only (no click handlers)

**Footer buttons:**
- **Save** — `POST /campus/shuttle/routes` for new, `PATCH /campus/shuttle/routes/:routeId` for existing. Disabled while pending.
- **Delete** — only shown for existing routes. Calls `DELETE /campus/shuttle/routes/:routeId`. Shows inline confirmation text ("Are you sure? This cannot be undone.") before firing — no modal.
- **Cancel** — clears the editor and deselects the route.

### Query keys

| Query | Key |
|---|---|
| Admin: all routes (incl. inactive) | `['admin', 'shuttle', 'routes']` |
| Student: active routes | `['shuttle', 'routes']` |

No cache collision between admin tab and student page.

---

## 4. API payload shape

`POST /campus/shuttle/routes` and `PATCH /campus/shuttle/routes/:routeId` accept the existing `ShuttleRouteSchema`:

```ts
{
  name: string,
  color: string,             // "#rrggbb"
  is_active: boolean,
  stops: ShuttleStop[],      // [{ id, name, orderIndex, lat, lng }]
  schedule: ShuttleSchedule, // { type, departures? } or { type, operatingHours? }
  est_duration_min: number | null,
  cycle_minutes: number | null,
}
```

No schema changes needed.

---

## 5. Student-facing page integration

No changes to the student shuttle page (`/shuttle`) or any of its hooks/components.

- `GET /campus/shuttle/routes` already filters `is_active = true`
- Admin creates/edits/deletes → students see the result on next query refetch
- Admin sets `is_active = false` → route disappears from student map immediately on refetch

---

## 6. Error handling

- Save failure → inline error message below the Save button ("Failed to save. Please try again.")
- Delete failure → inline error below Delete button
- No route selected → right panel shows an empty state ("Select a route to edit, or create a new one.")
- Empty stop lat/lng → Save button disabled; invalid fields highlighted with `var(--uc-orange-bdr)` border

---

## 7. Design system compliance

Follows existing `AdminPage.tsx` conventions throughout:
- `var(--surface-card)` / `var(--surface-raised)` for panel backgrounds
- `0.5px solid var(--border-default)` borders, `var(--r-lg)` / `var(--r-md)` radius
- Font weight 400/500 only; sentence case labels
- `var(--uc-indigo-bg)` for selected/active states
- `var(--uc-orange-l)` for errors; `var(--uc-red)` for destructive (delete) actions
- Pill-radius buttons (`var(--r-pill)`)
