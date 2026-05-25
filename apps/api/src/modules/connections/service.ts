import type { Knex } from 'knex'
import { CONNECTION_EVENTS } from '@uniconnect/shared'
import { db } from '../../config/db'
import { notificationQueue } from '../../queues/notification.queue'
import { getIo } from '../../socket'
import { badRequest, conflict, notFound } from '../../utils/errors'
import type { PaginationQuery } from './schema'

interface CountRow {
  count: string | number
}

interface ConnectionRow {
  id: string
  requester_id: string
  addressee_id: string
  university_id: string
  note: string | null
  status: 'pending' | 'accepted'
  created_at: Date
  updated_at: Date
}

interface ConnectionWithProfile extends ConnectionRow {
  full_name: string
  avatar_url: string | null
  headline: string | null
  role: string
  department: string | null
}

interface MutualConnectionRow {
  id: string
  role: string
  full_name: string
  avatar_url: string | null
  headline: string | null
  department: string | null
}

export class ConnectionsService {
  async sendRequest(
    currentUserId: string,
    targetUserId: string,
    universityId: string,
    note?: string,
  ) {
    if (currentUserId === targetUserId) {
      throw badRequest('Cannot connect with yourself', 'SELF_CONNECT_NOT_ALLOWED')
    }

    await assertUserInUniversity(targetUserId, universityId)

    // Check for any existing relationship in either direction, scoped to university
    const existing = await db('connections')
      .where(function () {
        this.where({ requester_id: currentUserId, addressee_id: targetUserId }).orWhere({
          requester_id: targetUserId,
          addressee_id: currentUserId,
        })
      })
      .andWhere('university_id', universityId)
      .first<ConnectionRow>()

    if (existing) {
      throw conflict('Connection already exists', 'CONNECTION_ALREADY_EXISTS')
    }

    const [connection] = await db('connections')
      .insert({
        requester_id: currentUserId,
        addressee_id: targetUserId,
        university_id: universityId,
        note: note ?? null,
        status: 'pending',
      })
      .returning('*')

    const requesterName = await getUserName(currentUserId)

    await notificationQueue.add({
      universityId,
      userId: targetUserId,
      type: 'connection_request',
      actorId: currentUserId,
      referenceId: connection.id,
      referenceType: 'connection',
      content: `${requesterName} wants to connect with you`,
      payload: { connectionId: connection.id },
    })

    try {
      getIo().to(`user:${targetUserId}`).emit(CONNECTION_EVENTS.REQUEST_RECEIVED, {
        connectionId: connection.id,
        requesterId: currentUserId,
      })
    } catch {
      // Socket server may not be initialized in test environments — ignore
    }

    return connection
  }

  async withdrawRequest(currentUserId: string, targetUserId: string, universityId: string) {
    const connection = await db('connections')
      .where({
        requester_id: currentUserId,
        addressee_id: targetUserId,
        status: 'pending',
        university_id: universityId,
      })
      .first<ConnectionRow>()

    if (!connection) {
      throw notFound('Connection request not found', 'CONNECTION_REQUEST_NOT_FOUND')
    }

    await db('connections').where({ id: connection.id }).delete()

    return { withdrawn: true }
  }

  async acceptRequest(currentUserId: string, connectionId: string, universityId: string) {
    const connection = await db('connections')
      .where({
        id: connectionId,
        addressee_id: currentUserId,
        status: 'pending',
        university_id: universityId,
      })
      .first<ConnectionRow>()

    if (!connection) {
      throw notFound('Connection request not found', 'CONNECTION_REQUEST_NOT_FOUND')
    }

    const [updated] = await db('connections')
      .where({ id: connectionId })
      .update({ status: 'accepted', updated_at: db.fn.now() })
      .returning('*')

    const acceptorName = await getUserName(currentUserId)

    await notificationQueue.add({
      universityId,
      userId: connection.requester_id,
      type: 'connection_accepted',
      actorId: currentUserId,
      referenceId: connectionId,
      referenceType: 'connection',
      content: `${acceptorName} accepted your connection request`,
      payload: { connectionId },
    })

    try {
      getIo().to(`user:${connection.requester_id}`).emit(CONNECTION_EVENTS.ACCEPTED, {
        connectionId,
        acceptorId: currentUserId,
      })
    } catch {
      // Socket server may not be initialized in test environments — ignore
    }

    return updated
  }

  async declineRequest(currentUserId: string, connectionId: string, universityId: string) {
    const connection = await db('connections')
      .where({
        id: connectionId,
        addressee_id: currentUserId,
        status: 'pending',
        university_id: universityId,
      })
      .first<ConnectionRow>()

    if (!connection) {
      throw notFound('Connection request not found', 'CONNECTION_REQUEST_NOT_FOUND')
    }

    await db('connections').where({ id: connectionId }).delete()

    return { declined: true }
  }

  async removeConnection(currentUserId: string, targetUserId: string, universityId: string) {
    const connection = await db('connections')
      .where(function () {
        this.where({ requester_id: currentUserId, addressee_id: targetUserId }).orWhere({
          requester_id: targetUserId,
          addressee_id: currentUserId,
        })
      })
      .andWhere('status', 'accepted')
      .andWhere('university_id', universityId)
      .first<ConnectionRow>()

    if (!connection) {
      throw notFound('Connection not found', 'CONNECTION_NOT_FOUND')
    }

    await db('connections').where({ id: connection.id }).delete()

    return { removed: true }
  }

  async listConnections(userId: string, universityId: string, query: PaginationQuery) {
    const baseWhere = (builder: Knex.QueryBuilder) => {
      builder
        .where(function () {
          this.where('connections.requester_id', userId).orWhere('connections.addressee_id', userId)
        })
        .andWhere('connections.status', 'accepted')
        .andWhere('connections.university_id', universityId)
    }

    const [{ count }] = await db('connections')
      .where(function () {
        this.where('requester_id', userId).orWhere('addressee_id', userId)
      })
      .andWhere('status', 'accepted')
      .andWhere('university_id', universityId)
      .count<CountRow[]>({ count: '*' })

    const total = Number(count)
    const offset = (query.page - 1) * query.limit

    const rows = await db('connections')
      .modify(baseWhere)
      .join('users', function () {
        this.on(function () {
          this.on('users.id', '=', db.raw('CASE WHEN connections.requester_id = ? THEN connections.addressee_id ELSE connections.requester_id END', [userId]))
        })
      })
      .join('profiles', 'profiles.user_id', 'users.id')
      .select<ConnectionWithProfile[]>(
        'connections.id',
        'connections.requester_id',
        'connections.addressee_id',
        'connections.university_id',
        'connections.note',
        'connections.status',
        'connections.created_at',
        'connections.updated_at',
        'profiles.full_name',
        'profiles.avatar_url',
        'profiles.headline',
        'users.role',
        'profiles.department',
      )
      .orderBy('connections.updated_at', 'desc')
      .limit(query.limit)
      .offset(offset)

    return {
      items: rows.map((row) => toConnectionWithUser(row, userId)),
      total,
      page: query.page,
      limit: query.limit,
    }
  }

  async listPendingReceived(userId: string, universityId: string, query: PaginationQuery) {
    const [{ count }] = await db('connections')
      .where({
        addressee_id: userId,
        status: 'pending',
        university_id: universityId,
      })
      .count<CountRow[]>({ count: '*' })

    const total = Number(count)
    const offset = (query.page - 1) * query.limit

    const rows = await db('connections')
      .where({
        'connections.addressee_id': userId,
        'connections.status': 'pending',
        'connections.university_id': universityId,
      })
      .join('users', 'users.id', 'connections.requester_id')
      .join('profiles', 'profiles.user_id', 'users.id')
      .select<ConnectionWithProfile[]>(
        'connections.id',
        'connections.requester_id',
        'connections.addressee_id',
        'connections.university_id',
        'connections.note',
        'connections.status',
        'connections.created_at',
        'connections.updated_at',
        'profiles.full_name',
        'profiles.avatar_url',
        'profiles.headline',
        'users.role',
        'profiles.department',
      )
      .orderBy('connections.created_at', 'desc')
      .limit(query.limit)
      .offset(offset)

    // ── Batch mutual-connection counts (fix N+1) ────────────────────────────
    // Get my accepted partner IDs (one query)
    const myPartnerRows = await db('connections')
      .where(function () {
        this.where('requester_id', userId).orWhere('addressee_id', userId)
      })
      .andWhere('status', 'accepted')
      .select<{ requester_id: string; addressee_id: string }[]>('requester_id', 'addressee_id')

    const myPartnerIds = new Set(
      myPartnerRows.map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id)),
    )

    // Get all requesters' accepted partner IDs in one batched query
    const requesterIds = rows.map((r) => r.requester_id)
    const theirPartnerRows = await db('connections')
      .where(function () {
        this.whereIn('requester_id', requesterIds).orWhereIn('addressee_id', requesterIds)
      })
      .andWhere('status', 'accepted')
      .select<{ requester_id: string; addressee_id: string }[]>('requester_id', 'addressee_id')

    // Build map: requesterId → Set of their partner IDs
    const partnerMap = new Map<string, Set<string>>()
    for (const r of theirPartnerRows) {
      for (const rid of requesterIds) {
        if (r.requester_id === rid || r.addressee_id === rid) {
          if (!partnerMap.has(rid)) partnerMap.set(rid, new Set())
          const partnerId = r.requester_id === rid ? r.addressee_id : r.requester_id
          partnerMap.get(rid)!.add(partnerId)
        }
      }
    }

    // Compute mutual count per requester via JS intersection
    const mutualCounts = new Map(
      requesterIds.map((rid) => {
        const theirPartners = partnerMap.get(rid) ?? new Set<string>()
        let count = 0
        for (const pid of myPartnerIds) {
          if (theirPartners.has(pid)) count++
        }
        return [rid, count]
      }),
    )
    // ────────────────────────────────────────────────────────────────────────

    const items = rows.map((row) => ({
      ...toConnectionRequest(row),
      requester: {
        id: row.requester_id,
        fullName: row.full_name,
        avatarUrl: row.avatar_url,
        headline: row.headline,
        role: row.role,
        department: row.department,
        mutualConnections: mutualCounts.get(row.requester_id) ?? 0,
      },
    }))

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
    }
  }

  async listPendingSent(userId: string, universityId: string, query: PaginationQuery) {
    const [{ count }] = await db('connections')
      .where({
        requester_id: userId,
        status: 'pending',
        university_id: universityId,
      })
      .count<CountRow[]>({ count: '*' })

    const total = Number(count)
    const offset = (query.page - 1) * query.limit

    const rows = await db('connections')
      .where({
        'connections.requester_id': userId,
        'connections.status': 'pending',
        'connections.university_id': universityId,
      })
      .join('users', 'users.id', 'connections.addressee_id')
      .join('profiles', 'profiles.user_id', 'users.id')
      .select<ConnectionWithProfile[]>(
        'connections.id',
        'connections.requester_id',
        'connections.addressee_id',
        'connections.university_id',
        'connections.note',
        'connections.status',
        'connections.created_at',
        'connections.updated_at',
        'profiles.full_name',
        'profiles.avatar_url',
        'profiles.headline',
        'users.role',
        'profiles.department',
      )
      .orderBy('connections.created_at', 'desc')
      .limit(query.limit)
      .offset(offset)

    return {
      items: rows.map((row) => ({
        ...toConnectionRequest(row),
        addressee: {
          id: row.addressee_id,
          fullName: row.full_name,
          avatarUrl: row.avatar_url,
          headline: row.headline,
          role: row.role,
          department: row.department,
        },
      })),
      total,
      page: query.page,
      limit: query.limit,
    }
  }

  async getMutualConnections(
    currentUserId: string,
    targetUserId: string,
    universityId: string,
    query: PaginationQuery,
  ) {
    await assertUserInUniversity(targetUserId, universityId)

    // Use SQL intersection via subqueries to avoid in-memory fan-out
    const myConnectionsSub = db('connections')
      .where(function () {
        this.where('requester_id', currentUserId).orWhere('addressee_id', currentUserId)
      })
      .andWhere('status', 'accepted')
      .select(
        db.raw(
          `CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END as partner_id`,
          [currentUserId],
        ),
      )

    const targetConnectionsSub = db('connections')
      .where(function () {
        this.where('requester_id', targetUserId).orWhere('addressee_id', targetUserId)
      })
      .andWhere('status', 'accepted')
      .select(
        db.raw(
          `CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END as partner_id`,
          [targetUserId],
        ),
      )

    const mutualRows = await db
      .from(myConnectionsSub.as('mine'))
      .join(targetConnectionsSub.as('theirs'), 'mine.partner_id', 'theirs.partner_id')
      .select<{ partner_id: string }[]>('mine.partner_id')

    const mutualIds = mutualRows.map((r) => r.partner_id)
    const total = mutualIds.length
    const offset = (query.page - 1) * query.limit
    const pageIds = mutualIds.slice(offset, offset + query.limit)

    if (pageIds.length === 0) {
      return { count: total, items: [], page: query.page, limit: query.limit }
    }

    const rows = await db('users')
      .join('profiles', 'profiles.user_id', 'users.id')
      .whereIn('users.id', pageIds)
      .andWhere('users.university_id', universityId)
      .select<MutualConnectionRow[]>(
        'users.id',
        'users.role',
        'profiles.full_name',
        'profiles.avatar_url',
        'profiles.headline',
        'profiles.department',
      )

    return {
      count: total,
      items: rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        avatarUrl: row.avatar_url,
        headline: row.headline,
        role: row.role,
        department: row.department,
      })),
      page: query.page,
      limit: query.limit,
    }
  }
}

export const connectionsService = new ConnectionsService()

// ── Helpers ──────────────────────────────────────────────────────────────────

async function assertUserInUniversity(userId: string, universityId: string) {
  const user = await db('users').where({ id: userId, university_id: universityId }).first()
  if (!user) throw notFound('User not found')
}

async function getUserName(userId: string): Promise<string> {
  const row = await db('profiles')
    .where({ user_id: userId })
    .select<{ full_name: string }[]>('full_name')
    .first()
  return row?.full_name ?? 'Someone'
}

function toConnectionWithUser(row: ConnectionWithProfile, currentUserId: string) {
  const otherUserId = row.requester_id === currentUserId ? row.addressee_id : row.requester_id
  return {
    id: row.id,
    requesterId: row.requester_id,
    addresseeId: row.addressee_id,
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user: {
      id: otherUserId,
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
      headline: row.headline,
      role: row.role,
      department: row.department,
    },
  }
}

function toConnectionRequest(row: ConnectionWithProfile) {
  return {
    id: row.id,
    requesterId: row.requester_id,
    addresseeId: row.addressee_id,
    note: row.note,
    createdAt: row.created_at,
  }
}
