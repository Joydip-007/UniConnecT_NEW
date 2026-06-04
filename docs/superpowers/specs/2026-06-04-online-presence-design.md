# Online Presence — Design Spec

**Date:** 2026-06-04
**Status:** Draft design, pre-implementation
**Scope:** Real-time online/offline + last-seen presence for users, tracked across the multi-instance Socket.io cluster via Redis, surfaced in messages, profiles, and connection lists — gated by the privacy feature's `online_visibility` tier.

> Sub-project 3 of the 6-feature decomposition. Reuses the existing Socket.io + Redis pub/sub adapter (`apps/api/src/socket/index.ts`). The "who can see my online status" control is **owned by** [profile privacy controls](2026-06-04-profile-privacy-controls-design.md) (`online_visibility` tier); this spec consumes it.

---

## 1. Goals

1. Track whether each user is **online** (≥1 connected socket on any API instance) in a way that is correct across the horizontally-scaled, Redis-adapter Socket.io cluster.
2. Persist **last-seen** for offline users.
3. Push presence changes in real time to the people allowed to see them (the user's connections), and offer a **batch lookup** for initial render.
4. Surface presence in the UI: conversation list, chat header, profile header, connection cards.
5. Respect `online_visibility` (`everyone` | `connections` | `only_me`) — `only_me` means *appear offline to everyone*.

Non-goals: rich presence ("in a call", "away/idle" auto-detection beyond a simple idle timeout — deferred), presence history/analytics, typing indicators (already implemented separately), cross-university presence.

---

## 2. Decisions log

| Decision | Choice |
|---|---|
| Source of truth (online now) | **Redis**, not Postgres — presence is ephemeral and write-heavy; Redis already backs the socket adapter |
| Multi-socket correctness | Per-user **socket reference count** in Redis (a user with 3 tabs goes offline only when the 3rd disconnects) |
| Ungraceful disconnect | TTL on the presence key + client **heartbeat** refresh; expiry ⇒ offline |
| Last-seen persistence | Written to Postgres `users.last_seen_at` only on the **online→offline transition** (count hits 0 / TTL expiry), never per-heartbeat |
| Fan-out target | Emit changes to the user's **accepted connections** (`user:{id}` rooms), not the whole university — bounded + privacy-aligned |
| Privacy gate | Honour `online_visibility`; `only_me` ⇒ never broadcast, batch lookup returns `offline` |
| Idle | Optional simple client-driven `away` after N min of no focus; server just relays it (no v1 server idle logic) |

---

## 3. Presence mechanics

### 3.1 Redis keys

```
presence:count:{userId}        -> integer, INCR on connect / DECR on disconnect, EXPIRE refreshed by heartbeat
presence:online:{universityId} -> SET of online userIds (SADD on 0→1, SREM on 1→0)   [for "who's online" / counts]
```

A user is **online** iff `presence:count:{userId} > 0`. The per-university SET is a convenience index for aggregate/online-list queries, kept consistent with the counter transitions.

### 3.2 Connection lifecycle (in `socket/index.ts`)

```
on 'connection':
  n = INCR presence:count:{userId};  EXPIRE presence:count:{userId} TTL
  if n === 1:                       // 0 -> 1 transition
    SADD presence:online:{uni} userId
    broadcastPresence(userId, 'online')

on 'presence:ping' (heartbeat, every ~25s):
  EXPIRE presence:count:{userId} TTL   // keep alive

on 'disconnect':
  n = DECR presence:count:{userId}
  if n <= 0:                        // 1 -> 0 transition
    DEL presence:count:{userId};  SREM presence:online:{uni} userId
    users.last_seen_at = now()     // single Postgres write
    broadcastPresence(userId, 'offline', lastSeenAt)
```

`TTL ≈ 60s` with a `~25s` client heartbeat (2× margin). A crashed client's key expires within the TTL; a lazy sweep (see §3.4) reconciles the per-university SET if a key expired without a clean `disconnect`.

> TTL is centralised in `src/config/redis.ts` (per the project's "never hardcode TTL" rule), e.g. `PRESENCE_TTL_SECONDS`.

### 3.3 Fan-out (`broadcastPresence`)

```
if online_visibility(userId) === 'only_me': return            // invisible
targets = acceptedConnectionIds(userId)
if online_visibility(userId) === 'everyone': also allow non-connection lookups (but still emit only to connections to bound fan-out)
for each connId in targets: io.to(`user:${connId}`).emit('presence:update', { userId, status, lastSeenAt })
```

Real-time push is limited to connections regardless of tier (bounded fan-out). `everyone`-tier visibility to non-connections is served on demand by the batch lookup (§4), not pushed.

### 3.4 TTL-expiry reconciliation

Socket.io's `disconnect` normally fires, but a hard crash can leave a stale SET member. Mitigation: when answering a presence query, treat a userId in `presence:online:{uni}` whose `presence:count:{userId}` key no longer exists as offline, and lazily `SREM` it. No cron needed for v1; a periodic Bull sweep is a noted future hardening.

---

## 4. Backend

### 4.1 Migration `070_add_last_seen_to_users.ts`

```
users
  + last_seen_at  timestamptz null
  index (university_id, last_seen_at)   -- optional, for "recently active" surfaces
```

> Confirm the next free migration number at implementation (latest committed is `067`).

### 4.2 Presence module (new `apps/api/src/modules/presence/`)

Standard module shape.

- `GET /api/v1/presence?userIds=a,b,c` — batch status for up to N ids. For each: `{ userId, status: 'online' | 'offline', lastSeenAt: string | null }`, **filtered by privacy** — if the *target's* `online_visibility` excludes the requester, return `status: 'offline', lastSeenAt: null`. Online derived from Redis (`presence:count` existence), last-seen from Postgres.
- `GET /api/v1/presence/online` — ids of the requester's connections currently online (for a "connections online" widget); privacy-filtered.

Router: `resolveUniversity` + `requireAuth`. Redis access via the shared client; never trust `userIds` for university scoping — intersect against same-university users.

### 4.3 Socket events (additions to `socket/index.ts`)

- Client → server: `presence:ping` (heartbeat), optional `presence:away` / `presence:active`.
- Server → client: `presence:update` `{ userId, status, lastSeenAt }`.
- The connection/disconnect counter logic in §3.2 is added to the existing `io.on('connection', …)` handler and a new `socket.on('disconnect', …)`.

---

## 5. Shared package additions (`packages/shared`)

- `src/constants/socket.ts` (extend) — `PRESENCE_EVENTS = { UPDATE: 'presence:update', PING: 'presence:ping', AWAY: 'presence:away', ACTIVE: 'presence:active' }`.
- `src/schemas/presence.ts` — `presenceLookupSchema` (`{ userIds: string[] }` / query parse). Types via `z.infer`. `PresenceStatus = 'online' | 'offline' | 'away'`.

---

## 6. Frontend (`apps/web`)

### 6.1 State + transport

- New `presenceStore` (Zustand) — `Map<userId, { status, lastSeenAt }>`.
- `usePresence(userIds: string[])` hook: on mount, batch-`GET /presence` to seed the store (TanStack Query, key `['presence', sortedIds]`); subscribe to `presence:update` socket events to patch the store live. The hook reads from the store so many components share one subscription.
- Heartbeat: the existing `useSocket`/socket singleton emits `presence:ping` on an interval while connected (and on `visibilitychange` → active).

### 6.2 Surfaces

- **Messages** — green dot on conversation-list avatars and the chat header; "Active now" / "Active 5m ago" (relative last-seen) under the header name.
- **Profile header** — online dot + "Active …" line when permitted.
- **Connections / connection cards** — online dot.
- Degrade silently to no-dot when presence is unknown or privacy-hidden (never render "offline" aggressively for `only_me` — just omit the indicator).

### 6.3 Appearance/Privacy control

The `online_visibility` selector lives in `/settings/privacy` (owned by the privacy spec). No separate presence settings UI; an optional "appear offline" quick-toggle could later live in the header menu (out of scope v1).

---

## 7. Multi-tenancy & security

- All presence keys are namespaced by `universityId`; batch lookups intersect requested ids with same-university users — a user can never probe presence across tenants.
- Privacy (`online_visibility`) is enforced **server-side** on both the push fan-out and the batch lookup; the client indicator is a hint only.
- `presence:ping` carries no payload trusted for identity — the socket's authenticated `socket.data.user` is the only source of `userId`.

---

## 8. Testing

**API / socket (integration):**
- Connect one socket ⇒ `presence:count` = 1, SET contains user, `presence:update online` emitted to a connection's room; not emitted to a non-connection.
- Two sockets, close one ⇒ still online; close second ⇒ offline + `last_seen_at` written once.
- TTL expiry path (mock expiry) ⇒ treated offline, SET reconciled on next lookup.
- `online_visibility = only_me` ⇒ batch lookup returns offline for everyone; no push emitted.
- `connections` tier ⇒ a connection sees online, a stranger sees offline.
- Batch lookup rejects/ignores cross-university ids.

**Web (RTL + MSW + mocked socket):**
- `usePresence` seeds from batch fetch then patches on `presence:update`.
- Dot renders for online, relative last-seen for offline, nothing for hidden.

---

## 9. Risks & open items

- **Redis as single source of truth** — if Redis is briefly unavailable, presence reads should fail soft (treat everyone offline / omit indicators) rather than error the page. Wrap lookups defensively.
- **Reconnect storms** — token refresh causes socket reconnects (existing `TOKEN_EXPIRED` flow); the counter handles transient 0→1→… correctly, but verify last-seen isn't written on every refresh blip (debounce the offline write by a few seconds before committing the transition if needed).
- **Heartbeat cost** — one tiny `EXPIRE` per client per 25s; negligible, but confirm interval vs. mobile background throttling (browsers throttle timers in background tabs — TTL margin must tolerate that).
- **Idle/away** — left client-driven for v1; server idle detection deferred.
- **Migration number** — confirm next free `NNN` (latest committed is `067`).

---

## 10. Out of scope (future specs)

Rich/custom presence statuses · server-side idle detection · presence history & "active hours" analytics · cross-university presence · presence in group member lists beyond a simple dot.
