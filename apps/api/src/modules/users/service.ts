import type { Knex } from 'knex'
import type { UserRole } from '@uniconnect/shared'
import { normalizeUsername } from '@uniconnect/shared'
import { db } from '../../config/db'
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors'
import { tokenService } from '../../services/token.service'
import { systemGroupsService } from '../groups/system-groups.service'
import {
  buildSectionVisibility,
  canViewSection,
  evaluateTier,
  loadPrivacy,
} from './privacy.service'
import { moderationService } from '../moderation/service'
import type {
  EducationInput,
  ExperienceInput,
  FeaturedInput,
  PaginationQuery,
  ReorderFeaturedInput,
  UpdateProfileInput,
  UserListQuery,
} from './schema'

interface UserProfileRow {
  id: string
  username: string
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
  is_open_to_msg: boolean
  location: string | null
  website_url: string | null
  github_url: string | null
  portfolio_url: string | null
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
    return toUserProfile(user, { includePhone: true, includeContactInfo: true })
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

    // Username lives on `users` (carries university_id for the tenant-scoped
    // unique index), so it's written separately from the profile fields below.
    // The DB index is the race-safe guard — translate its violation to a 409.
    if (input.username !== undefined) {
      const username = normalizeUsername(input.username)
      try {
        await db('users').where({ id: userId, university_id: universityId }).update({ username })
      } catch (err) {
        if (isUniqueViolation(err)) throw conflict('Username already taken', 'USERNAME_TAKEN')
        throw err
      }
    }

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
    if (input.location !== undefined) update.location = input.location
    if (input.websiteUrl !== undefined) update.website_url = input.websiteUrl
    if (input.githubUrl !== undefined) update.github_url = input.githubUrl
    if (input.portfolioUrl !== undefined) update.portfolio_url = input.portfolioUrl
    if (input.isOpenToMsg !== undefined) update.is_open_to_msg = input.isOpenToMsg

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

  /** Reversible self-deactivation: hides the account and revokes every session. Reactivated on next login. */
  async deactivateAccount(userId: string, universityId: string) {
    const affected = await db('users')
      .where({ id: userId, university_id: universityId })
      .update({ is_active: false, deactivated_at: db.fn.now() })
    if (affected === 0) throw notFound('User not found')

    await tokenService.revokeAllUserSessions(userId)
    return { deactivated: true }
  }

  async getPublicProfile(currentUserId: string, targetUserId: string, universityId: string) {
    const user = await getUserProfileQuery()
      .where({ 'users.id': targetUserId, 'users.university_id': universityId })
      .first<UserProfileRow>()
    if (!user) throw notFound('User not found')
    // Deactivated accounts are hidden from everyone except their owner.
    if (!user.is_active && currentUserId !== targetUserId) throw notFound('User not found')

    // Moderation: a block in either direction hides the profile entirely (and skips the view record).
    if (currentUserId !== targetUserId && (await moderationService.isBlockedBetween(currentUserId, targetUserId))) {
      throw notFound('User not found')
    }

    // Upsert profile view (fire-and-forget, don't await)
    if (currentUserId !== targetUserId) {
      void db('profile_views').insert({
        viewer_id: currentUserId,
        viewed_id: targetUserId,
        university_id: universityId,
        viewed_at: db.fn.now(),
      })
      .onConflict(['viewer_id', 'viewed_id'])
      .merge({ viewed_at: db.fn.now() })
      .catch(() => {}) // silent fail
    }

    const [connections, pendingReceived, posts, connectionRow, mutualCount, mentorshipRow] = await Promise.all([
      // count accepted connections for target user
      countUserConnections(targetUserId, universityId),
      // count pending received (only meaningful for own profile — 0 for others)
      currentUserId === targetUserId
        ? db('connections').where({ addressee_id: targetUserId, status: 'pending' }).count<CountRow[]>({ count: '*' }).then(([r]) => Number(r.count))
        : Promise.resolve(0),
      db('posts').where({ author_id: targetUserId }).count<CountRow[]>({ count: '*' }).then(([r]) => Number(r.count)),
      // find connection row between currentUser and targetUser (either direction)
      currentUserId !== targetUserId
        ? db('connections').where(function() {
            this.where({ requester_id: currentUserId, addressee_id: targetUserId })
                .orWhere({ requester_id: targetUserId, addressee_id: currentUserId })
          }).first<{ id: string; requester_id: string; addressee_id: string; status: string } | undefined>()
        : Promise.resolve(null),
      // count mutual connections
      currentUserId !== targetUserId
        ? countMutualConnections(currentUserId, targetUserId, universityId)
        : Promise.resolve(0),
      // check accepted mentorship between these two users
      currentUserId !== targetUserId
        ? db('mentorship_requests').where(function() {
            this.where({ student_id: currentUserId, alumni_id: targetUserId })
                .orWhere({ student_id: targetUserId, alumni_id: currentUserId })
          }).andWhere('status', 'accepted').andWhere('university_id', universityId).andWhere('is_deleted', false).first<{ id: string } | undefined>()
        : Promise.resolve(null),
    ])

    // Derive connectionStatus from connectionRow
    type ConnectionStatus = 'none' | 'pending_sent' | 'pending_received' | 'connected'
    let connectionStatus: ConnectionStatus = 'none'
    let connectionId: string | null = null
    if (connectionRow) {
      connectionId = connectionRow.id
      if (connectionRow.status === 'accepted') {
        connectionStatus = 'connected'
      } else if (connectionRow.requester_id === currentUserId) {
        connectionStatus = 'pending_sent'
      } else {
        connectionStatus = 'pending_received'
      }
    }

    const isConnected = connectionStatus === 'connected' || !!mentorshipRow
    const isOwnProfile = currentUserId === targetUserId

    // Whether the viewer has muted this user's posts (drives the profile action menu).
    const isMutedByViewer = isOwnProfile
      ? false
      : Boolean(await db('user_mutes').where({ muter_id: currentUserId, muted_id: targetUserId }).first('id'))

    // Privacy: gate contact info by the target's `contact_info` tier, and return a
    // per-section visibility map so the client can render private states gracefully.
    const prefs = await loadPrivacy(targetUserId)
    const facts = { isOwner: isOwnProfile, isConnected }
    const canSeeContact = evaluateTier(prefs.sections.contact_info, facts)

    return {
      ...toUserProfile(user, {
        includePhone: canSeeContact,
        includeContactInfo: canSeeContact,
      }),
      stats: { connections, pendingReceived, posts },
      connectionStatus,
      connectionId,
      mutualConnections: mutualCount,
      isMutedByViewer,
      visibility: buildSectionVisibility(prefs, facts),
    }
  }

  /** Resolve a username (tenant-scoped) to the same payload as getPublicProfile. */
  async getPublicProfileByUsername(currentUserId: string, username: string, universityId: string) {
    const row = await db('users')
      .where('users.university_id', universityId)
      .whereRaw('lower(users.username) = ?', [normalizeUsername(username)])
      .select<{ id: string }>('users.id')
      .first()
    if (!row) throw notFound('User not found')
    return this.getPublicProfile(currentUserId, row.id, universityId)
  }

  /**
   * Availability for the settings form. Format/reserved checks happen in the
   * controller via usernameSchema; this only answers the uniqueness question,
   * treating the caller's own current username as available.
   */
  async isUsernameAvailable(userId: string, universityId: string, username: string) {
    const normalized = normalizeUsername(username)
    const existing = await db('users')
      .where('university_id', universityId)
      .whereRaw('lower(username) = ?', [normalized])
      .select<{ id: string }>('id')
      .first()
    return !existing || existing.id === userId
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
      items: rows.map((row) => toUserProfile(row, { includePhone: false, includeContactInfo: false })),
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
      .where('users.is_active', true)
      .whereNot('users.id', currentUserId)
      .modify((builder) => {
        excludeNonDiscoverable(builder)
        if (currentUser.department) {
          builder.where('profiles.department', currentUser.department)
        }
      })
      .whereNotExists(function excludeConnected() {
        this.select(db.raw('1'))
          .from('connections')
          .where(function() {
            this.where(function() {
              this.where('requester_id', currentUserId).andWhereRaw('addressee_id = users.id')
            }).orWhere(function() {
              this.where('addressee_id', currentUserId).andWhereRaw('requester_id = users.id')
            })
          })
      })
      .orderBy('profiles.full_name', 'asc')
      .limit(10) as UserProfileRow[]

    return rows.map((row) => toUserProfile(row, { includePhone: false, includeContactInfo: false }))
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

    const [postResult] = await db('posts')
      .where({ author_id: userId, university_id: universityId })
      .count<[{ count: string }]>({ count: '*' })
    const hasMadePost = Number(postResult.count) > 0

    const connectionCount = await countUserConnections(userId, universityId)

    const [expResult] = await db('profile_experiences')
      .where({ user_id: userId })
      .count<[{ count: string }]>({ count: '*' })
    const hasAddedExperience = Number(expResult.count) > 0

    const [eduResult] = await db('profile_education')
      .where({ user_id: userId })
      .count<[{ count: string }]>({ count: '*' })
    const hasAddedEducation = Number(eduResult.count) > 0

    const fields = [
      Boolean(row.bio),
      Boolean(row.headline),
      Boolean(row.department),
      Boolean(row.batch_year),
      Boolean(row.avatar_url),
      Array.isArray(row.skills) && row.skills.length >= 1,
      Boolean(row.linkedin_url),
      hasAddedExperience,
      hasAddedEducation,
    ]
    const profileScore = Math.round((fields.filter(Boolean).length / fields.length) * 100)

    return {
      profileScore,
      hasMadePost,
      connectionCount,
      isVerified: row.is_verified,
      hasAddedExperience,
      hasAddedEducation,
    }
  }

  // ─── Experience ─────────────────────────────────────────────────────────────

  async getUserExperience(currentUserId: string, targetUserId: string, universityId: string) {
    // Verify target user exists in university
    const target = await db('users').where({ id: targetUserId, university_id: universityId }).first()
    if (!target) throw notFound('User not found')

    // Privacy-gated by the `experience` tier.
    if (currentUserId !== targetUserId) {
      const allowed = await canViewSection(currentUserId, targetUserId, 'experience', universityId)
      if (!allowed) return []
    }
    return db('profile_experiences')
      .where({ user_id: targetUserId })
      .orderBy('start_date', 'desc')
  }

  async createExperience(userId: string, universityId: string, input: ExperienceInput) {
    const [row] = await db('profile_experiences')
      .insert({
        user_id: userId,
        university_id: universityId,
        title: input.title,
        company: input.company,
        location: input.location,
        start_date: input.startDate,
        end_date: input.endDate,
        description: input.description,
      })
      .returning('*')
    return row
  }

  async updateExperience(userId: string, entryId: string, universityId: string, input: Partial<ExperienceInput>) {
    const existing = await db('profile_experiences').where({ id: entryId, user_id: userId, university_id: universityId }).first()
    if (!existing) throw notFound('Experience entry not found')
    const update: Record<string, unknown> = { updated_at: db.fn.now() }
    if (input.title !== undefined) update.title = input.title
    if (input.company !== undefined) update.company = input.company
    if (input.location !== undefined) update.location = input.location
    if (input.startDate !== undefined) update.start_date = input.startDate
    if (input.endDate !== undefined) update.end_date = input.endDate
    if (input.description !== undefined) update.description = input.description
    const [row] = await db('profile_experiences')
      .where({ id: entryId, user_id: userId, university_id: universityId })
      .update(update)
      .returning('*')
    return row
  }

  async deleteExperience(userId: string, entryId: string) {
    const deleted = await db('profile_experiences').where({ id: entryId, user_id: userId }).delete()
    if (deleted === 0) throw notFound('Experience entry not found')
    return { deleted: true }
  }

  // ─── Education ──────────────────────────────────────────────────────────────

  async getUserEducation(currentUserId: string, targetUserId: string, universityId: string) {
    // Verify target user exists in university
    const target = await db('users').where({ id: targetUserId, university_id: universityId }).first()
    if (!target) throw notFound('User not found')

    // Privacy-gated by the `education` tier.
    if (currentUserId !== targetUserId) {
      const allowed = await canViewSection(currentUserId, targetUserId, 'education', universityId)
      if (!allowed) return []
    }
    return db('profile_education')
      .where({ user_id: targetUserId })
      .orderBy('start_year', 'desc')
  }

  async createEducation(userId: string, universityId: string, input: EducationInput) {
    const [row] = await db('profile_education')
      .insert({
        user_id: userId,
        university_id: universityId,
        institution: input.institution,
        degree: input.degree,
        field_of_study: input.fieldOfStudy,
        start_year: input.startYear,
        end_year: input.endYear,
        grade: input.grade,
        description: input.description,
      })
      .returning('*')
    return row
  }

  async updateEducation(userId: string, entryId: string, universityId: string, input: Partial<EducationInput>) {
    const existing = await db('profile_education').where({ id: entryId, user_id: userId, university_id: universityId }).first()
    if (!existing) throw notFound('Education entry not found')
    const update: Record<string, unknown> = { updated_at: db.fn.now() }
    if (input.institution !== undefined) update.institution = input.institution
    if (input.degree !== undefined) update.degree = input.degree
    if (input.fieldOfStudy !== undefined) update.field_of_study = input.fieldOfStudy
    if (input.startYear !== undefined) update.start_year = input.startYear
    if (input.endYear !== undefined) update.end_year = input.endYear
    if (input.grade !== undefined) update.grade = input.grade
    if (input.description !== undefined) update.description = input.description
    const [row] = await db('profile_education')
      .where({ id: entryId, user_id: userId, university_id: universityId })
      .update(update)
      .returning('*')
    return row
  }

  async deleteEducation(userId: string, entryId: string) {
    const deleted = await db('profile_education').where({ id: entryId, user_id: userId }).delete()
    if (deleted === 0) throw notFound('Education entry not found')
    return { deleted: true }
  }

  // ─── Featured ───────────────────────────────────────────────────────────────

  async getUserFeatured(currentUserId: string, targetUserId: string, universityId: string) {
    const target = await db('users').where({ id: targetUserId, university_id: universityId }).first()
    if (!target) throw notFound('User not found')

    if (currentUserId !== targetUserId) {
      const connected = await isConnected(currentUserId, targetUserId, universityId)
      if (!connected) return []
    }
    return db('profile_featured')
      .where({ user_id: targetUserId })
      .orderBy('display_order', 'asc')
  }

  async createFeatured(userId: string, universityId: string, input: FeaturedInput) {
    const [countResult] = await db('profile_featured')
      .where({ user_id: userId })
      .count<[{ count: string }]>({ count: '*' })
    const count = Number(countResult.count)
    if (count >= 5) throw badRequest('Maximum 5 featured items allowed', 'FEATURED_LIMIT_REACHED')

    const [row] = await db('profile_featured')
      .insert({
        user_id: userId,
        university_id: universityId,
        type: input.type,
        post_id: input.postId,
        link_url: input.linkUrl,
        link_title: input.linkTitle,
        link_description: input.linkDescription,
        display_order: count,
      })
      .returning('*')
    return row
  }

  async deleteFeatured(userId: string, entryId: string) {
    const deleted = await db('profile_featured').where({ id: entryId, user_id: userId }).delete()
    if (deleted === 0) throw notFound('Featured item not found')
    return { deleted: true }
  }

  async reorderFeatured(userId: string, input: ReorderFeaturedInput) {
    // Update display_order for each ID in order
    await Promise.all(
      input.order.map((id, index) =>
        db('profile_featured')
          .where({ id, user_id: userId })
          .update({ display_order: index, updated_at: db.fn.now() }),
      ),
    )
    return db('profile_featured').where({ user_id: userId }).orderBy('display_order', 'asc')
  }

  // ─── Analytics ──────────────────────────────────────────────────────────────

  async getMyAnalytics(userId: string, universityId: string) {
    const now = new Date()
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

    const [views7, views30, views90, reactions, comments] = await Promise.all([
      db('profile_views').where('viewed_id', userId).andWhere('profile_views.university_id', universityId).andWhere('viewed_at', '>=', d7).count<CountRow[]>('*'),
      db('profile_views').where('viewed_id', userId).andWhere('profile_views.university_id', universityId).andWhere('viewed_at', '>=', d30).count<CountRow[]>('*'),
      db('profile_views').where('viewed_id', userId).andWhere('profile_views.university_id', universityId).andWhere('viewed_at', '>=', d90).count<CountRow[]>('*'),
      db('reactions')
        // reactions are polymorphic (target_type/target_id), not a direct post_id FK.
        .join('posts', 'posts.id', 'reactions.target_id')
        .where('reactions.target_type', 'post')
        .andWhere('posts.author_id', userId)
        .andWhere('posts.university_id', universityId)
        .count<CountRow[]>('*'),
      db('comments').join('posts', 'posts.id', 'comments.post_id').where('posts.author_id', userId).andWhere('posts.university_id', universityId).count<CountRow[]>('*'),
    ])

    return {
      profileViews: {
        last7d: Number(views7[0].count) || 0,
        last30d: Number(views30[0].count) || 0,
        last90d: Number(views90[0].count) || 0,
      },
      postReach: {
        reactions: Number(reactions[0].count) || 0,
        comments: Number(comments[0].count) || 0,
        total: (Number(reactions[0].count) || 0) + (Number(comments[0].count) || 0),
      },
    }
  }

  // ─── Viewers ────────────────────────────────────────────────────────────────

  async getMyViewers(userId: string, universityId: string, query: PaginationQuery) {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

    const [totalResult] = await db('profile_views')
      .where('viewed_id', userId)
      .andWhere('profile_views.university_id', universityId)
      .andWhere('viewed_at', '>=', cutoff)
      .count<CountRow[]>({ count: '*' })
    const total = Number(totalResult.count)

    const rows = await db('profile_views')
      .join('users', 'users.id', 'profile_views.viewer_id')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where('profile_views.viewed_id', userId)
      .andWhere('profile_views.university_id', universityId)
      .andWhere('profile_views.viewed_at', '>=', cutoff)
      .select(
        'profile_views.viewer_id',
        'profile_views.viewed_at',
        'users.role',
        'profiles.full_name',
        'profiles.avatar_url',
        'profiles.headline',
        'profiles.department',
      )
      .orderBy('profile_views.viewed_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    // For each viewer, determine if they're connected to show identity
    const viewerIds = rows.map((r) => r.viewer_id as string)
    const connectedViewerIds = new Set<string>()
    if (viewerIds.length > 0) {
      const connRows = await db('connections')
        .where('status', 'accepted')
        .where(function() {
          this.where('requester_id', userId).whereIn('addressee_id', viewerIds)
             .orWhere('addressee_id', userId).whereIn('requester_id', viewerIds)
        })
        .select('requester_id', 'addressee_id')
      for (const r of connRows) {
        connectedViewerIds.add(r.requester_id === userId ? r.addressee_id : r.requester_id)
      }
    }

    return {
      items: rows.map((row) => {
        const connected = connectedViewerIds.has(row.viewer_id as string)
        if (connected) {
          return {
            viewedAt: row.viewed_at,
            anonymous: false,
            id: row.viewer_id,
            fullName: row.full_name,
            avatarUrl: row.avatar_url,
            headline: row.headline,
            role: row.role,
            department: row.department,
          }
        }
        return {
          viewedAt: row.viewed_at,
          anonymous: true,
          role: row.role,
          department: row.department,
        }
      }),
      total,
      page: query.page,
      limit: query.limit,
    }
  }

  // ─── Connections list ────────────────────────────────────────────────────────

  async getUserConnections(currentUserId: string, targetUserId: string, universityId: string, query: PaginationQuery) {
    // Verify target user exists in university
    const target = await db('users').where({ id: targetUserId, university_id: universityId }).first()
    if (!target) throw notFound('User not found')

    // Privacy-gated by the `connections_list` tier.
    if (currentUserId !== targetUserId) {
      const allowed = await canViewSection(currentUserId, targetUserId, 'connections_list', universityId)
      if (!allowed) {
        // Return count only, not the list
        const total = await countUserConnections(targetUserId, universityId)
        return { items: [], total, page: 1, limit: query.limit, listHidden: true }
      }
    }

    const baseQuery = getUserProfileQuery()
      .join('connections', function() {
        this.on(function() {
          this.on('connections.requester_id', '=', 'users.id').andOnVal('connections.addressee_id', targetUserId)
        }).orOn(function() {
          this.on('connections.addressee_id', '=', 'users.id').andOnVal('connections.requester_id', targetUserId)
        })
      })
      .where('connections.status', 'accepted')
      .whereNot('users.id', targetUserId)
      .where('users.university_id', universityId)

    const [{ count }] = await db('connections')
      .where(function() {
        this.where('requester_id', targetUserId).orWhere('addressee_id', targetUserId)
      })
      .andWhere('status', 'accepted')
      .count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const rows = await baseQuery
      .orderBy('profiles.full_name', 'asc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit) as UserProfileRow[]

    return {
      items: rows.map((row) => toUserProfile(row, { includePhone: false, includeContactInfo: false })),
      total,
      page: query.page,
      limit: query.limit,
      listHidden: false,
    }
  }
}

export const usersService = new UsersService()

function getUserProfileQuery() {
  return db('users')
    .join('profiles', 'profiles.user_id', 'users.id')
    .select(
      'users.id',
      'users.username',
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
      'profiles.is_open_to_msg',
      'profiles.location',
      'profiles.website_url',
      'profiles.github_url',
      'profiles.portfolio_url',
    )
}

function applyUserFilters(query: Knex.QueryBuilder, filters: Partial<UserListQuery>) {
  query.where('users.is_active', true) // hide deactivated accounts from discovery
  excludeNonDiscoverable(query)
  if (filters.role) query.where('users.role', filters.role)
  if (filters.department) query.where('profiles.department', filters.department)
  if (filters.batch_year) query.where('profiles.batch_year', filters.batch_year)
  if (filters.search) query.whereILike('profiles.full_name', `%${filters.search}%`)
}

/** Exclude users who set privacy `discoverable = false` (default true when absent). */
function excludeNonDiscoverable(query: Knex.QueryBuilder) {
  query.whereNotExists(function () {
    this.select(db.raw('1'))
      .from('user_settings')
      .whereRaw('user_settings.user_id = users.id')
      .whereRaw("user_settings.privacy_preferences->>'discoverable' = 'false'")
  })
}

/** Postgres unique-violation (SQLSTATE 23505), surfaced through Knex's error. */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505'
}

async function assertUserInUniversity(userId: string, universityId: string) {
  const user = await db('users').where({ id: userId, university_id: universityId }).first()
  if (!user) throw notFound('User not found')
}

// Keep assertUserInUniversity to avoid unused variable warning
void assertUserInUniversity

function toUserProfile(row: UserProfileRow, options: { includePhone: boolean; includeContactInfo: boolean }) {
  return {
    id: row.id,
    username: row.username,
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
      isOpenToMsg: row.is_open_to_msg,
      location: row.location,
      websiteUrl: options.includeContactInfo ? row.website_url : null,
      githubUrl: options.includeContactInfo ? row.github_url : null,
      portfolioUrl: options.includeContactInfo ? row.portfolio_url : null,
    },
  }
}

async function countUserConnections(userId: string, universityId: string): Promise<number> {
  const [{ count }] = await db('connections')
    .where(function() {
      this.where('requester_id', userId).orWhere('addressee_id', userId)
    })
    .andWhere('status', 'accepted')
    .andWhere('university_id', universityId)
    .count<CountRow[]>({ count: '*' })
  return Number(count)
}

async function countMutualConnections(userA: string, userB: string, universityId: string): Promise<number> {
  const myPartnerRows = await db('connections')
    .where(function() { this.where('requester_id', userA).orWhere('addressee_id', userA) })
    .andWhere('status', 'accepted')
    .andWhere('university_id', universityId)
    .select('requester_id', 'addressee_id')
  const myIds = new Set(myPartnerRows.map((r) => r.requester_id === userA ? r.addressee_id : r.requester_id))

  const theirPartnerRows = await db('connections')
    .where(function() { this.where('requester_id', userB).orWhere('addressee_id', userB) })
    .andWhere('status', 'accepted')
    .andWhere('university_id', universityId)
    .select('requester_id', 'addressee_id')
  const theirIds = new Set(theirPartnerRows.map((r) => r.requester_id === userB ? r.addressee_id : r.requester_id))

  let count = 0
  for (const id of myIds) { if (theirIds.has(id)) count++ }
  return count
}

async function isConnected(userA: string, userB: string, universityId: string): Promise<boolean> {
  const connection = await db('connections')
    .where(function() {
      this.where({ requester_id: userA, addressee_id: userB })
          .orWhere({ requester_id: userB, addressee_id: userA })
    })
    .andWhere('status', 'accepted')
    .andWhere('university_id', universityId)
    .first()
  if (connection) return true

  // Accepted mentorship also grants profile visibility
  const mentorship = await db('mentorship_requests')
    .where(function() {
      this.where({ student_id: userA, alumni_id: userB })
          .orWhere({ student_id: userB, alumni_id: userA })
    })
    .andWhere('status', 'accepted')
    .andWhere('university_id', universityId)
    .andWhere('is_deleted', false)
    .first()
  return !!mentorship
}
