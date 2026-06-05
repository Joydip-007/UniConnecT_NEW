# Live Shuttle Map — Design Spec

**Date:** 2026-06-05
**Status:** Approved for planning
**Module:** `campus` (shuttle sub-domain) · `apps/web/src/features/shuttle` · `packages/shared`
**Migration:** `073_add_driver_role_and_shuttle_estimation`

---

## 1. Summary

UIU's `/shuttle` page is live but feature-incomplete: it shows a **linear progress bar** (`ProgressTrack`), not a geographic map. This spec adds a **free, realistic, map-based live shuttle tracker** with a moving UIU-branded bus, a highlighted route line, sort and toggle controls, and an opt-in **driver broadcast mode** backed by a new least-privilege `driver` role.

The defining design decision: **the server only ever stores real GPS beacons; estimated positions are computed in the browser.** Each route already ships its stops (lat/lng) + schedule to the client, so the browser interpolates the bus along the route every second with zero server cron, zero estimation writes, and zero cost. A route shows movement *today* (estimated) and upgrades to true GPS the moment a driver broadcasts.

### Goals
- A real map (Leaflet + OpenStreetMap, no API key, no per-load billing).
- A moving, UIU-orange, logo-stamped bus marker that glides and rotates to heading.
- The active route highlighted in its own color; stops marked.
- Sort (Nearest to me · Soonest departure · Live first) and toggles (Map ⇄ List · Live only ⇄ All · All routes ⇄ Focus one).
- Opt-in driver broadcast mode for transport staff, with a clean least-privilege role.

### Non-goals (YAGNI)
- Crowdsourced rider positions.
- Road-snapped polylines (straight segments first; can upgrade later).
- Pre-assigning drivers to routes (drivers self-pick at broadcast start).
- Forcing first-login password change for drivers (deferred nice-to-have).
- Locking down *every* social endpoint against drivers (frontend wall-off + gating the sensitive writes is enough day one; drivers are trusted staff, not attackers).

---

## 2. Architecture

```
                      ┌──────────────────────────────────────────────┐
                      │  apps/web — /shuttle  (Live Map page)         │
                      │                                               │
  GET /shuttle/routes ──►  routes[]  (stops lat/lng, schedule, color, │
                      │                est_duration_min, cycle_minutes)│
  GET /shuttle/locations ─► real beacons (latest per route)           │
  socket "shuttle:location" ─► live beacon stream (room uni:{uniId})  │
                      │                                               │
                      │  useShuttleLiveState(routes, beacons):        │
                      │    per route, every 1s (requestAnimationFrame)│
                      │      beacon fresh (<90s)? → LIVE   (source=gps)│
                      │      else → estimateAlongPath(route, now)      │
                      │                          → ESTIMATED          │
                      │    → bus marker glides between positions      │
                      └──────────────────────────────────────────────┘
        ▲ broadcast (opt-in, driver role only)
        │
  /shuttle/drive  (driver shell)
    navigator.geolocation.watchPosition → POST /shuttle/locations  (~every 10s)
```

**Server responsibility:** store + serve **real** beacons only. **Client responsibility:** merge beacons with schedule-estimated positions and animate.

The backend schema and most endpoints already exist (migration `020_create_campus_tools`). This spec adds: a `driver` role, an estimation-params column pair on `shuttle_routes`, an access-gate change on the broadcast endpoint, and an admin "create driver account" action.

---

## 3. Roles & access (driver identity)

### 3.1 New `driver` role
Add `'driver'` to `UserRole` as a **least-privilege service account** sitting *below* `student`. A driver can do exactly one write — broadcast GPS — and nothing else. Default-deny everywhere; we grant one narrow capability rather than subtracting from a broad role.

**Rejected alternatives (recorded so we don't relitigate):**
- *Driver as a subset of `admin`* — inverts least-privilege; every admin feature would be default-allowed to drivers and need a negative check. Fragile.
- *Single `staff` role + `staff_type` flag merging faculty + driver* — faculty (member, near-admin, default-allow) and driver (service, default-deny) sit at opposite privilege ends; merging forces role-AND-subtype checks at every gate and re-touches the already-wired `faculty` role. Rejected.

**Chosen model:** `faculty` and `driver` stay **distinct roles**. "Staff" is a conceptual grouping only, expressed in the admin UI (§3.3), not in the DB.

### 3.2 Member vs service roles
- **Member roles:** `student`, `alumni`, `faculty`, `admin` — full social app.
- **Service role:** `driver` — no social app; driver shell only.

Frontend: a `driver` login lands on a dedicated **driver shell** (`/shuttle/drive` only — no nav, no feed) via a new `DriverRoute` guard + post-login redirect. Backend: `POST /shuttle/locations` requires `role === 'driver'` (admin allowed for testing); that is the only write a driver can make. We do **not** add a blanket `requireMember` middleware across every social router on day one (YAGNI) — the frontend wall-off plus gating sensitive writes is sufficient for trusted staff.

### 3.3 Provisioning (admin panel)
Two **separate buttons** in the admin user-management area; "staff" is the mental umbrella, not a code construct:

- **Invite faculty** — *existing* invitation flow unchanged (invite token + email OTP + allowed university domain). Faculty are real members.
- **Add driver** — admin **pre-creates the account directly**: enters name + email (any email; domain check skipped) + a temp password, creating a `driver`-role `users` row + a `profiles` row (for the map's driver name label). No invitation, no OTP. Recorded in `university_audit_log` like other admin actions.

### 3.4 Backend changes for roles
- `packages/shared/src/types/user.ts` — `UserRole = 'student' | 'alumni' | 'faculty' | 'admin' | 'driver'`.
- `packages/shared/src/schemas/users.ts` — `userRoleSchema` enum + `'driver'`.
- `packages/shared/src/schemas/connections.ts` (two inline enums) and `schemas/profile.ts` — these enumerate *member* roles for social features; **leave them as member-only** (`student/alumni/faculty/admin`) so drivers can't appear in connections/profile role pickers. Document this divergence in the migration/PR description.
- Migration `073`: drop + recreate `users_role_check` to `('student','alumni','faculty','admin','driver')`. (Constraint currently `('student','alumni','faculty','admin')` after migration `025_rename_staff_to_faculty`.)
- New admin endpoint: `POST /api/v1/admin/users/driver` (admin role only) → create driver account. Add to the `admin` module (router/controller/service/schema), Zod `createDriverSchema` (name, email, password). Audit-logged.

---

## 4. Data model

### 4.1 `shuttle_routes` (existing) — add estimation params
Migration `073` adds two nullable columns used by client-side estimation:

| Column | Type | Meaning |
|---|---|---|
| `est_duration_min` | `integer` null | Estimated one-way trip duration for **fixed-trip** routes. If null, derived client-side from schedule gaps. |
| `cycle_minutes` | `integer` null | Round-trip cycle length for **continuous** routes (e.g. Kuril BRTC) with no fixed timetable. |

Existing columns unchanged: `name`, `color (char 7)`, `stops jsonb`, `schedule jsonb`, `is_active`, `university_id`, timestamps.

`stops` jsonb item shape (already consumed by the web `ShuttleStop` type): `{ id, name, orderIndex, lat, lng }`.

`schedule` jsonb shape (per route): a structure the client can read for departures, e.g.
```json
{ "type": "fixed", "departures": { "outbound": ["07:30", "09:25", ...], "inbound": ["10:05", ...] } }
```
or `{ "type": "continuous", "operatingHours": { "start": "07:30", "end": "17:00" } }`.
The Zod `ShuttleRouteSchema` already accepts `stops`/`schedule` as open records; we tighten the **client-side** parser, not the API contract.

### 4.2 `shuttle_locations` (existing) — beacons only
No schema change. Columns: `route_id` FK, `driver_id`, `lat double`, `lng double`, `speed_kmh decimal(5,2)`, `heading_deg decimal(5,2)`, `updated_at`. The existing "latest per route" query in `CampusService.listShuttleLocations` stands.

**Staleness is a client concern.** Beacons persist; `listShuttleLocations` returns the latest even if hours old. The client treats a beacon as live only if `now - updatedAt < BEACON_FRESH_MS (90_000)`. When a driver stops broadcasting, the last beacon goes stale after 90s and the route falls back to estimated — no server signal required. (Optional future: an explicit driver "end shift" beacon flag.)

---

## 5. Backend (`campus` module)

### 5.1 Endpoint changes
- `POST /shuttle/locations` — change gate from `requireRole('faculty','admin')` to **`requireRole('driver','admin')`** in `campus/router.ts`. Body unchanged (`ShuttleLocationSchema`: `route_id`, `lat`, `lng`, `speed_kmh?`, `heading_deg?`). Driver **self-selects `route_id`** in driver mode — no pre-assignment.
- `GET /shuttle/routes` — now also returns `est_duration_min` and `cycle_minutes` (extend `ShuttleRouteRow` + `toShuttleRoute`).
- `GET /shuttle/locations` — unchanged (latest beacon per route).

### 5.2 Socket (existing, unchanged)
On beacon insert, `createShuttleLocation` already emits `shuttle:location` to `uni:{universityId}`. Client `shuttle:watch`/`shuttle:unwatch` rooms remain. Beacons emitted **after** DB write, from the service (per project rules).

### 5.3 Admin module
- `POST /api/v1/admin/users/driver` (admin only): create `users` row (`role='driver'`, hashed temp password) + `profiles` row (`full_name`), bypassing allowed-domain check. Returns the created user. Audit-logged to `university_audit_log`.

---

## 6. Estimation (the free "worthy" core)

`apps/web/src/features/shuttle/lib/estimatePosition.ts` — a **pure, network-free, unit-tested** function:

```
estimateAlongPath(route, now) → { lat, lng, headingDeg, source: 'estimated', confidence } | null
```

Algorithm:
1. Build a polyline from `route.stops` sorted by `orderIndex` (straight segments).
2. Precompute cumulative **haversine** distances → total route length.
3. **Fixed-trip routes** (`schedule.type === 'fixed'`): find the active trip whose departure ≤ `now` and whose `departure + estDuration ≥ now`. `f = (now - departure) / estDuration`, clamp `0..1`. Map `f` onto the polyline by cumulative distance → position + heading from the current segment bearing. `estDuration = est_duration_min ?? derive from schedule gaps`. Outside any active trip window → return `null` (bus off-duty / parked; no marker).
4. **Continuous routes** (`schedule.type === 'continuous'`): `phase = ((now - dayStart) mod cycle) / cycle`, ping-ponged (out then back) so the bus traverses the route both directions. `cycle = cycle_minutes ?? sensible default`.
5. `confidence` is a coarse hint (e.g. lower near trip boundaries) used only for UI copy, never presented as GPS truth.

Determinism: pure function of `(route, now)` — trivially unit-testable with fixed timestamps. No `Date.now()` inside; caller passes `now`.

---

## 7. Frontend

### 7.1 Live-state hook
`apps/web/src/features/shuttle/hooks/useShuttleLiveState.ts` (supersedes the merge logic in `useShuttleData`, which is retained for routes/REST fetching):
- Pulls `routes` (TanStack Query) + `beacons` (REST + socket, existing `useShuttleData` plumbing).
- A `requestAnimationFrame`-driven 1s tick recomputes per route:
  - Fresh beacon (`now - updatedAt < 90_000`) → `{ ...beacon, source: 'live' }`.
  - Else → `estimateAlongPath(route, now)` → `source: 'estimated'` (or hidden if `null`).
- Exposes `routeStates: Record<routeId, { lat, lng, headingDeg, source, route }>` for the map + list.

### 7.2 Map
`apps/web/src/features/shuttle/components/ShuttleMap.tsx` — **Leaflet via `react-leaflet`**, OSM raster tiles (free, no key). Per route:
- **Polyline** in `route.color` (the highlighted route line). Focused route full-opacity; others dimmed.
- **Stop dots** at each stop.
- **Bus marker** (`BusMarker.tsx`).
- A **"you are here"** dot from browser geolocation (when permission granted).

### 7.3 Bus marker (realistic UIU bus)
`apps/web/src/features/shuttle/components/BusMarker.tsx`:
- **Body color = `var(--uc-orange)`** (`#F05A28`, the UIU brand orange — already a design token). The bus is UIU-orange on **all** routes for instant brand recognition; per-route DB `color` is used for the **line**, not the bus. (Switching the bus to per-route color is a one-line change if desired later.)
- **UIU logo badge** = `apps/web/src/assets/logo.svg` in a small white circular chip on the bus body. Low zoom → orange dot; higher zoom → bus glyph + logo.
- **Heading rotation** — marker rotates to `headingDeg`.
- **Live vs estimated by treatment, not color:** LIVE = solid orange + soft pulse ring; ESTIMATED = hollow/dashed orange outline + "Estimated" chip. Color stays UIU-orange either way.
- **Glide** — `requestAnimationFrame` tween between previous and next position so the marker slides rather than jumps.

> Note on bus color provenance: UIU does **not** publicly document its physical bus livery (no bus photos/specs on official transport pages). We deliberately use the **verifiable UIU brand orange** (`--uc-orange`) for consistency with the app identity, rather than fabricating a paint color. If a real livery color is later confirmed, it's a single token swap.

### 7.4 Controls
`apps/web/src/features/shuttle/components/ShuttleControls.tsx`:
- **Sort** dropdown: *Nearest to me* (browser geolocation → distance to closest stop) · *Soonest departure* (next scheduled departure from `schedule`) · *Live first* (real-beacon routes float to top).
- **Toggles:**
  - *Map ⇄ List* — List reuses existing `LiveTrackerCard` / `ProgressTrack` (kept, not discarded).
  - *Live only ⇄ All* — filter to routes currently broadcasting a real beacon.
  - *All routes ⇄ Focus one* — overlay every route, or isolate/highlight one (dim the rest).

### 7.5 Route list panel
Each row: color chip, route name, **Live/Estimated** status, next departure, ETA to selected stop. Tapping a row flies the map to that route and focuses it.

### 7.6 Driver shell
`apps/web/src/pages/ShuttleDrivePage.tsx` + `DriverRoute` guard + `paths.ts` entry `/shuttle/drive`:
- One-purpose, glanceable screen. Driver **self-picks their route** from a list, taps **Start broadcast** → `navigator.geolocation.watchPosition` streams `lat/lng/heading/speed` to `POST /shuttle/locations` ~every 10s. **Stop** ends it.
- Handles geolocation-permission-denied and no-route states explicitly.
- `driver`-role users are redirected here on login; they cannot reach member pages.

---

## 8. Files

| Layer | File | Change |
|---|---|---|
| shared | `src/types/user.ts` | add `'driver'` to `UserRole` |
| shared | `src/schemas/users.ts` | add `'driver'` to `userRoleSchema` |
| api | `database/migrations/073_add_driver_role_and_shuttle_estimation.ts` | role check constraint + `est_duration_min`/`cycle_minutes` |
| api | `modules/campus/router.ts` | gate `POST /shuttle/locations` → `driver`/`admin` |
| api | `modules/campus/service.ts` | return estimation params in `toShuttleRoute` |
| api | `modules/admin/*` | `POST /admin/users/driver` (create driver account) |
| web | `features/shuttle/lib/estimatePosition.ts` | **new** — pure estimation math |
| web | `features/shuttle/hooks/useShuttleLiveState.ts` | **new** — beacon+estimate merge, 1s tick |
| web | `features/shuttle/components/ShuttleMap.tsx` | **new** — Leaflet map + polylines |
| web | `features/shuttle/components/BusMarker.tsx` | **new** — orange + logo + heading + glide |
| web | `features/shuttle/components/ShuttleControls.tsx` | **new** — sort + toggles |
| web | `pages/ShuttleDrivePage.tsx` | **new** — driver broadcast shell |
| web | `router/index.tsx`, `router/paths.ts`, `router/DriverRoute.tsx` | driver guard + redirect |
| web | `features/admin/...` | "Add driver" button + form (alongside "Invite faculty") |
| web | `scripts/screenshot.cjs` + screenshots | add `shuttle` (updated) + `shuttle-drive` rows |

**Dependencies (all MIT, free, no keys):** `leaflet`, `react-leaflet`. Watch the pnpm `allowBuilds` trap if any new package ships a post-install script.

---

## 9. Design-system compliance
- No hardcoded hex in components — bus uses `var(--uc-orange)`; route line uses the DB `color` value (data, not a literal in code).
- Borders `0.5px`, pill buttons, surface stacking (no shadows except the marker's functional pulse), sentence case, font-weight 400/500 only.
- Map tiles + Leaflet default CSS imported once; Leaflet's own marker styles overridden to match tokens.

---

## 10. Testing
- **Unit (web):** `estimatePosition.test.ts` — fixed-trip interpolation, continuous ping-pong, off-duty `null`, heading/bearing, polyline distance mapping (fixed `now`, no real clock).
- **Unit (web):** live-state merge — fresh beacon wins; stale beacon (>90s) falls back to estimate.
- **Integration (api):** `POST /shuttle/locations` rejects member roles, accepts `driver`; `POST /admin/users/driver` admin-only, creates driver + profile, audit-logged; every request sets `x-university-domain`.
- **Component (web):** `ShuttleControls` sort/toggle behaviour; `BusMarker` live vs estimated treatment.

---

## 11. Cost & honesty guarantees
- **Map:** OSM tiles + Leaflet — no API key, no per-load billing (vs Google/Mapbox).
- **Estimation:** pure browser math — no server cron, no estimation writes, no third-party calls.
- **Beacons:** only real GPS is stored; estimated buses are visually marked "Estimated" and never presented as GPS-accurate.
- Every route shows movement today; routes upgrade to true live the moment a driver broadcasts — no hardware required to ship.
