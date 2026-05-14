import type { Knex } from 'knex'
import type { UserRole } from '@uniconnect/shared'
import { db } from '../../config/db'
import { badRequest, conflict, notFound } from '../../utils/errors'
import type { PaginationQuery, UpdateProfileInput, UserListQuery } from './schema'

interface UserProfileRow {
  id: string
  university_id: string
  email: string
  role: UserRole
  is_verified: boolean
  is_active: boolean
  last_active_at: Date | null
  created_at: Date
  full_name: string
  avatar_url: string | null
  cover_url: string | null
  bio: string | null
  department: string | null
  batch_year: string | null
  headline: string | null
  linkedin_url: string | null
  phone: string | null
  skills: string[] | null
  is_open_to_work: boolean
}

interface CountRow {
  count: string | number
}

export class UsersService {
  async getCurrentUser(userId: string, universityId: string) {
    const user = await getUserProfileQuery()
      .where({
        'users.id': userId,
        'users.university_id': universityId,
      })
      .first<UserProfileRow>()

    if (!user) throw notFound('User not found')
    return toUserProfile(user, { includePhone: true })
  }

  async updateCurrentUser(userId: string, universityId: string, input: UpdateProfileInput) {
    const exists = await db('users').where({ id: userId, university_id: universityId }).first()
    if (!exists) throw notFound('User not found')

    await db('profiles')
      .where({ user_id: userId })
      .update({
        ...input,
        updated_at: db.fn.now(),
      })

    return this.getCurrentUser(userId, universityId)
  }

  async getPublicProfile(currentUserId: string, targetUserId: string, universityId: string) {
    const user = await getUserProfileQuery()
      .where({
        'users.id': targetUserId,
        'users.university_id': universityId,
      })
      .first<UserProfileRow>()

    if (!user) throw notFound('User not found')
    return toUserProfile(user, { includePhone: currentUserId === targetUserId })
  }

  async listUsers(universityId: string, query: UserListQuery) {
    const baseQuery = getUserProfileQuery().where('users.university_id', universityId)
    applyUserFilters(baseQuery, query)

    const countQuery = db('users')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where('users.university_id', universityId)
    applyUserFilters(countQuery, query)

    const [{ count }] = await countQuery.count<CountRow[]>({ count: '*' })
    const total = Number(count)
    const offset = (query.page - 1) * query.limit

    const rows = await baseQuery
      .orderBy('profiles.full_name', 'asc')
      .limit(query.limit)
      .offset(offset) as UserProfileRow[]

    return {
      items: rows.map((row) => toUserProfile(row, { includePhone: false })),
      total,
      page: query.page,
      limit: query.limit,
    }
  }

  async followUser(currentUserId: string, targetUserId: string, universityId: string) {
    if (currentUserId === targetUserId) {
      throw badRequest('You cannot follow yourself', 'SELF_FOLLOW_NOT_ALLOWED')
    }

    await assertUserInUniversity(targetUserId, universityId)

    try {
      await db('follows').insert({
        follower_id: currentUserId,
        following_id: targetUserId,
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict('Already following this user', 'ALREADY_FOLLOWING')
      }
      throw error
    }

    return { following: true }
  }

  async unfollowUser(currentUserId: string, targetUserId: string, universityId: string) {
    await assertUserInUniversity(targetUserId, universityId)
    await db('follows').where({ follower_id: currentUserId, following_id: targetUserId }).delete()
    return { following: false }
  }

  async listFollowers(targetUserId: string, universityId: string, query: PaginationQuery) {
    await assertUserInUniversity(targetUserId, universityId)

    const baseQuery = getUserProfileQuery()
      .join('follows', 'follows.follower_id', 'users.id')
      .where({
        'follows.following_id': targetUserId,
        'users.university_id': universityId,
      })

    const total = await countFollows('following_id', targetUserId, universityId)
    const rows = await baseQuery
      .orderBy('follows.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit) as UserProfileRow[]

    return {
      items: rows.map((row) => toUserProfile(row, { includePhone: false })),
      total,
      page: query.page,
      limit: query.limit,
    }
  }

  async listFollowing(targetUserId: string, universityId: string, query: PaginationQuery) {
    await assertUserInUniversity(targetUserId, universityId)

    const baseQuery = getUserProfileQuery()
      .join('follows', 'follows.following_id', 'users.id')
      .where({
        'follows.follower_id': targetUserId,
        'users.university_id': universityId,
      })

    const total = await countFollows('follower_id', targetUserId, universityId)
    const rows = await baseQuery
      .orderBy('follows.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit) as UserProfileRow[]

    return {
      items: rows.map((row) => toUserProfile(row, { includePhone: false })),
      total,
      page: query.page,
      limit: query.limit,
    }
  }

  async getSuggestions(currentUserId: string, universityId: string) {
    const currentUser = await db('users')
      .join('profiles', 'profiles.user_id', 'users.id')
      .select('profiles.department')
      .where({ 'users.id': currentUserId, 'users.university_id': universityId })
      .first<{ department: string | null }>()

    if (!currentUser) throw notFound('User not found')

    const rows = await getUserProfileQuery()
      .where('users.university_id', universityId)
      .whereNot('users.id', currentUserId)
      .modify((builder) => {
        if (currentUser.department) {
          builder.where('profiles.department', currentUser.department)
        }
      })
      .whereNotExists(function excludeFollowed() {
        this.select(db.raw('1'))
          .from('follows')
          .whereRaw('follows.following_id = users.id')
          .andWhere('follows.follower_id', currentUserId)
      })
      .orderBy('profiles.full_name', 'asc')
      .limit(10) as UserProfileRow[]

    return rows.map((row) => toUserProfile(row, { includePhone: false }))
  }
}

export const usersService = new UsersService()

function getUserProfileQuery() {
  return db('users')
    .join('profiles', 'profiles.user_id', 'users.id')
    .select(
      'users.id',
      'users.university_id',
      'users.email',
      'users.role',
      'users.is_verified',
      'users.is_active',
      'users.last_active_at',
      'users.created_at',
      'profiles.full_name',
      'profiles.avatar_url',
      'profiles.cover_url',
      'profiles.bio',
      'profiles.department',
      'profiles.batch_year',
      'profiles.headline',
      'profiles.linkedin_url',
      'profiles.phone',
      'profiles.skills',
      'profiles.is_open_to_work',
    )
}

function applyUserFilters(query: Knex.QueryBuilder, filters: Partial<UserListQuery>) {
  if (filters.role) query.where('users.role', filters.role)
  if (filters.department) query.where('profiles.department', filters.department)
  if (filters.batch_year) query.where('profiles.batch_year', filters.batch_year)
  if (filters.search) query.whereILike('profiles.full_name', `%${filters.search}%`)
}

async function assertUserInUniversity(userId: string, universityId: string) {
  const user = await db('users').where({ id: userId, university_id: universityId }).first()
  if (!user) throw notFound('User not found')
}

async function countFollows(column: 'follower_id' | 'following_id', userId: string, universityId: string) {
  const [{ count }] = await db('follows')
    .join('users', `users.id`, `follows.${column === 'follower_id' ? 'following_id' : 'follower_id'}`)
    .where(`follows.${column}`, userId)
    .andWhere('users.university_id', universityId)
    .count<CountRow[]>({ count: '*' })

  return Number(count)
}

function toUserProfile(row: UserProfileRow, options: { includePhone: boolean }) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    universityId: row.university_id,
    isVerified: row.is_verified,
    isActive: row.is_active,
    lastActiveAt: row.last_active_at,
    createdAt: row.created_at,
    profile: {
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
      coverUrl: row.cover_url,
      bio: row.bio,
      department: row.department,
      batchYear: row.batch_year,
      headline: row.headline,
      linkedinUrl: row.linkedin_url,
      phone: options.includePhone ? row.phone : null,
      skills: row.skills ?? [],
      isOpenToWork: row.is_open_to_work,
    },
  }
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}
