import type { Knex } from 'knex'
import type { UserRole } from '@uniconnect/shared'
import { db } from '../../config/db'
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors'
import { systemGroupsService } from '../groups/system-groups.service'
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
  theme_preference: 'light' | 'dark' | 'system'
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
  is_open_to_mentorship: boolean
  mentorship_points: number
  max_mentees: number
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
    const existing = await db('users')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where({ 'users.id': userId, 'users.university_id': universityId })
      .select<{ role: UserRole; department: string | null; batch_year: string | null }[]>(
        'users.role',
        'profiles.department',
        'profiles.batch_year',
      )
      .first()
    if (!existing) throw notFound('User not found')

    const update: Record<string, unknown> = { updated_at: db.fn.now() }
    if (input.fullName !== undefined) update.full_name = input.fullName
    if (input.bio !== undefined) update.bio = input.bio
    if (input.headline !== undefined) update.headline = input.headline
    if (input.department !== undefined) update.department = input.department
    if (input.batchYear !== undefined) update.batch_year = input.batchYear
    if (input.linkedinUrl !== undefined) update.linkedin_url = input.linkedinUrl
    if (input.phone !== undefined) update.phone = input.phone
    if (input.skills !== undefined) update.skills = input.skills
    if (input.avatarUrl !== undefined) update.avatar_url = input.avatarUrl
    if (input.coverUrl !== undefined) update.cover_url = input.coverUrl
    if (input.isOpenToWork !== undefined) update.is_open_to_work = input.isOpenToWork
    if (input.isOpenToMentorship !== undefined) update.is_open_to_mentorship = input.isOpenToMentorship
    if (input.maxMentees !== undefined) {
      if (existing.role !== 'alumni') {
        throw forbidden('Only alumni can set max mentees', 'MAX_MENTEES_ALUMNI_ONLY')
      }
      update.max_mentees = input.maxMentees
    }

    await db('profiles').where({ user_id: userId }).update(update)

    const needsGroupSync =
      (input.department !== undefined && input.department !== existing.department) ||
      (input.batchYear !== undefined && input.batchYear !== existing.batch_year)

    if (needsGroupSync) {
      await systemGroupsService.syncUserMembership(
        userId,
        universityId,
        { role: existing.role, department: existing.department, batchYear: existing.batch_year },
        {
          role: existing.role,
          department: input.department ?? existing.department,
          batchYear: input.batchYear ?? existing.batch_year,
        },
      )
    }

    return this.getCurrentUser(userId, universityId)
  }

  async updatePreferences(
    userId: string,
    universityId: string,
    input: { themePreference?: 'light' | 'dark' | 'system' },
  ) {
    const update: Record<string, unknown> = {}
    if (input.themePreference !== undefined) {
      update.theme_preference = input.themePreference
    }

    const affected = await db('users')
      .where({ id: userId, university_id: universityId })
      .update(update)

    if (affected === 0) throw notFound('User not found')

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

    const [followers, following, posts, isFollowingRow] = await Promise.all([
      countFollows('following_id', targetUserId, universityId),
      countFollows('follower_id', targetUserId, universityId),
      db('posts').where({ author_id: targetUserId }).count<CountRow[]>({ count: '*' }).then(([r]) => Number(r.count)),
      currentUserId !== targetUserId
        ? db('follows').where({ follower_id: currentUserId, following_id: targetUserId }).first()
        : Promise.resolve(null),
    ])

    return {
      ...toUserProfile(user, { includePhone: currentUserId === targetUserId }),
      stats: { followers, following, posts },
      isFollowing: !!isFollowingRow,
    }
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

  async getProgress(userId: string, universityId: string) {
    const row = await db('users')
      .join('profiles', 'profiles.user_id', 'users.id')
      .select(
        'users.is_verified',
        'profiles.bio',
        'profiles.headline',
        'profiles.department',
        'profiles.batch_year',
        'profiles.avatar_url',
        'profiles.skills',
        'profiles.linkedin_url',
      )
      .where({ 'users.id': userId, 'users.university_id': universityId })
      .first<{
        is_verified: boolean
        bio: string | null
        headline: string | null
        department: string | null
        batch_year: string | null
        avatar_url: string | null
        skills: string[] | null
        linkedin_url: string | null
      }>()

    if (!row) throw notFound('User not found')

    const fields = [
      Boolean(row.bio),
      Boolean(row.headline),
      Boolean(row.department),
      Boolean(row.batch_year),
      Boolean(row.avatar_url),
      Array.isArray(row.skills) && row.skills.length >= 1,
      Boolean(row.linkedin_url),
    ]
    const profileScore = Math.round((fields.filter(Boolean).length / fields.length) * 100)

    const [postResult] = await db('posts')
      .where({ author_id: userId, university_id: universityId })
      .count<[{ count: string }]>({ count: '*' })
    const hasMadePost = Number(postResult.count) > 0

    const [followerResult] = await db('follows')
      .join('users', 'users.id', 'follows.follower_id')
      .where({ 'follows.following_id': userId, 'users.university_id': universityId })
      .count<[{ count: string }]>({ count: '*' })
    const followerCount = Number(followerResult.count)

    return {
      profileScore,
      hasMadePost,
      followerCount,
      isVerified: row.is_verified,
    }
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
      'users.theme_preference',
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
      'profiles.is_open_to_mentorship',
      'profiles.mentorship_points',
      'profiles.max_mentees',
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
    themePreference: row.theme_preference,
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
      isOpenToMentorship: row.is_open_to_mentorship,
      mentorshipPoints: row.mentorship_points,
      maxMentees: row.max_mentees,
    },
  }
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}
