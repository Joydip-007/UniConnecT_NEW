import { PRESENCE_EVENTS, type OnlineVisibilityTier, type PresenceEntry } from '@uniconnect/shared'
import { db } from '../../config/db'
import { PRESENCE_TTL_SECONDS, redis } from '../../config/redis'
import { getIo } from '../../socket'
import { logger } from '../../utils/logger'
import { loadPrivacy } from '../users/privacy.service'

const countKey = (userId: string) => `presence:count:${userId}`
const onlineSetKey = (universityId: string) => `presence:online:${universityId}`

async function ensureRedis() {
  if (redis.status === 'wait') await redis.connect()
}

// ── Socket-facing lifecycle ──────────────────────────────────────────────────

/** Returns true when this is the user's first socket (0→1 transition). */
export async function registerConnect(userId: string, universityId: string): Promise<boolean> {
  await ensureRedis()
  const n = await redis.incr(countKey(userId))
  await redis.expire(countKey(userId), PRESENCE_TTL_SECONDS)
  if (n === 1) {
    await redis.sadd(onlineSetKey(universityId), userId)
    await redis.expire(onlineSetKey(universityId), PRESENCE_TTL_SECONDS)
    return true
  }
  return false
}

export async function refreshHeartbeat(userId: string, universityId: string): Promise<void> {
  await ensureRedis()
  // Only refresh if the key still exists (a live socket); never resurrect a 0 count.
  await redis.expire(countKey(userId), PRESENCE_TTL_SECONDS)
  // Refresh the set's own TTL too, so a crashed process without a clean disconnect
  // can't leave stale members in it forever — worst case it expires and gets rebuilt.
  await redis.expire(onlineSetKey(universityId), PRESENCE_TTL_SECONDS)
}

/** Returns the last-seen timestamp when this was the user's last socket (1→0 transition), else null. */
export async function registerDisconnect(
  userId: string,
  universityId: string,
): Promise<Date | null> {
  await ensureRedis()
  const n = await redis.decr(countKey(userId))
  if (n <= 0) {
    await redis.del(countKey(userId))
    await redis.srem(onlineSetKey(universityId), userId)
    const lastSeenAt = new Date()
    await db('users').where({ id: userId }).update({ last_seen_at: lastSeenAt })
    return lastSeenAt
  }
  return null
}

// ── Lookup (privacy-gated) ───────────────────────────────────────────────────

async function onlineFlags(userIds: string[]): Promise<Record<string, boolean>> {
  await ensureRedis()
  const pipeline = redis.pipeline()
  for (const id of userIds) pipeline.exists(countKey(id))
  const results = await pipeline.exec()
  const out: Record<string, boolean> = {}
  userIds.forEach((id, i) => {
    out[id] = (results?.[i]?.[1] as number | undefined) === 1
  })
  return out
}

/** Set of target ids the viewer is an accepted connection of (one batched query). */
async function connectedSet(viewerId: string, targetIds: string[], universityId: string) {
  if (targetIds.length === 0) return new Set<string>()
  const rows = await db('connections')
    .where('status', 'accepted')
    .andWhere('university_id', universityId)
    .andWhere(function () {
      this.where(function () {
        this.where('requester_id', viewerId).whereIn('addressee_id', targetIds)
      }).orWhere(function () {
        this.where('addressee_id', viewerId).whereIn('requester_id', targetIds)
      })
    })
    .select('requester_id', 'addressee_id')
  const set = new Set<string>()
  for (const r of rows) set.add(r.requester_id === viewerId ? r.addressee_id : r.requester_id)
  return set
}

function visibleToViewer(
  tier: OnlineVisibilityTier,
  facts: { isSelf: boolean; isConnected: boolean },
): boolean {
  if (facts.isSelf) return true
  if (tier === 'everyone') return true
  if (tier === 'connections') return facts.isConnected
  return false // only_me
}

/**
 * Batch presence for the viewer. Online state from Redis, last-seen from Postgres,
 * each entry filtered by the target's `online_visibility` tier.
 */
export async function lookupPresence(
  viewerId: string,
  targetIds: string[],
  universityId: string,
): Promise<PresenceEntry[]> {
  const ids = [...new Set(targetIds)].filter(Boolean)
  if (ids.length === 0) return []

  try {
    // Restrict to same-university users (never leak cross-tenant presence).
    const sameUni = await db('users')
      .whereIn('id', ids)
      .andWhere('university_id', universityId)
      .select<{ id: string; last_seen_at: Date | null }[]>('id', 'last_seen_at')
    const sameUniIds = sameUni.map((u) => u.id)
    const lastSeenById = new Map(sameUni.map((u) => [u.id, u.last_seen_at]))

    const [flags, connected] = await Promise.all([
      onlineFlags(sameUniIds),
      connectedSet(viewerId, sameUniIds, universityId),
    ])

    const entries = await Promise.all(
      sameUniIds.map(async (id): Promise<PresenceEntry> => {
        const isSelf = id === viewerId
        const prefs = await loadPrivacy(id)
        const visible = visibleToViewer(prefs.online_visibility, {
          isSelf,
          isConnected: connected.has(id),
        })
        if (!visible) return { userId: id, status: 'offline', lastSeenAt: null }
        const online = flags[id] ?? false
        const lastSeen = lastSeenById.get(id) ?? null
        return {
          userId: id,
          status: online ? 'online' : 'offline',
          lastSeenAt: online ? null : lastSeen ? new Date(lastSeen).toISOString() : null,
        }
      }),
    )
    return entries
  } catch (error) {
    // Fail soft: presence is non-critical, never error the page.
    logger.error('Presence lookup failed', { error })
    return ids.map((id) => ({ userId: id, status: 'offline' as const, lastSeenAt: null }))
  }
}

/**
 * Push a presence change to the user's accepted connections. Bounded fan-out:
 * we never broadcast to the whole university, and `only_me` users are invisible.
 */
export async function broadcastPresence(
  userId: string,
  universityId: string,
  status: 'online' | 'offline',
  lastSeenAt: Date | null,
): Promise<void> {
  try {
    const prefs = await loadPrivacy(userId)
    if (prefs.online_visibility === 'only_me') return

    const rows = await db('connections')
      .where('status', 'accepted')
      .andWhere('university_id', universityId)
      .andWhere(function () {
        this.where('requester_id', userId).orWhere('addressee_id', userId)
      })
      .select('requester_id', 'addressee_id')
    const partnerIds = rows.map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id))
    if (partnerIds.length === 0) return

    const io = getIo()
    const payload = {
      userId,
      status,
      lastSeenAt: lastSeenAt ? lastSeenAt.toISOString() : null,
    }
    for (const partnerId of partnerIds) {
      io.to(`user:${partnerId}`).emit(PRESENCE_EVENTS.UPDATE, payload)
    }
  } catch (error) {
    // Socket may be uninitialised (tests) or Redis/db hiccup — presence is best-effort.
    logger.warn('broadcastPresence skipped', { error })
  }
}

/** Ids of the viewer's connections that are currently online (privacy-gated). */
export async function onlineConnections(viewerId: string, universityId: string): Promise<string[]> {
  const rows = await db('connections')
    .where('status', 'accepted')
    .andWhere('university_id', universityId)
    .andWhere(function () {
      this.where('requester_id', viewerId).orWhere('addressee_id', viewerId)
    })
    .select('requester_id', 'addressee_id')
  const partnerIds = rows.map((r) => (r.requester_id === viewerId ? r.addressee_id : r.requester_id))
  const entries = await lookupPresence(viewerId, partnerIds, universityId)
  return entries.filter((e) => e.status === 'online').map((e) => e.userId)
}
