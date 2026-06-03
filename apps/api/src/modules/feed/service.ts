import type { Knex } from 'knex'
import type { UserRole } from '@uniconnect/shared'
import { db } from '../../config/db'
import { getIo } from '../../socket'
import { badRequest, forbidden, notFound } from '../../utils/errors'
import { logger } from '../../utils/logger'
import type { CreateCommentInput, CreatePostInput, PaginationQuery, PostListQuery, UpdatePostInput } from './schema'
import { notificationsService } from '../notifications/service'

type PostType = 'post' | 'announcement' | 'lost_found' | 'news' | 'event_promo'
type ReactionType = 'like' | 'love' | 'insightful' | 'celebrate'

// ── Hashtag helpers ───────────────────────────────────────────────────────────

function extractHashtags(content: string): string[] {
  return [...new Set((content.match(/#[\w]+/gi) ?? []).map((t) => t.slice(1).toLowerCase()))].slice(0, 10)
}

interface AuthContext {
  userId: string
  universityId: string
  role: UserRole
}

interface CountRow {
  count: string | number
}

interface PostRow {
  id: string
  university_id: string
  author_id: string
  type: PostType
  content: string
  media_urls: string[] | null
  group_id: string | null
  is_pinned: boolean
  is_published: boolean
  view_count: number
  created_at: Date
  updated_at: Date
  author_full_name: string
  author_avatar_url: string | null
  author_headline: string | null
  author_department: string | null
  author_batch_year: string | null
  author_role: UserRole
  reaction_counts: unknown
  comment_count: string | number
  own_reaction: ReactionType | null
  is_saved: boolean | null
  is_connected: number | null
}

interface CommentRow {
  id: string
  post_id: string
  author_id: string
  parent_id: string | null
  content: string
  created_at: Date
  updated_at: Date
  author_full_name: string
  author_avatar_url: string | null
  author_headline: string | null
  reaction_counts: unknown
  own_reaction: ReactionType | null
}

interface PollRow {
  id: string
  post_id: string
  question: string
  expires_at: Date | null
}

interface PollOptionRow {
  id: string
  poll_id: string
  option_text: string
  display_order: number
  vote_count: string | number
}

interface ReactionCountRow {
  reaction_type: ReactionType
  count: string | number
}

interface SavedPostRow {
  is_saved: boolean
}

export class FeedService {
  async listPosts(universityId: string, userId: string, query: PostListQuery) {
    // Drafts (is_published = false) never appear in the public feed — only in the author's Drafts view.
    const countQuery = db('posts').where('posts.university_id', universityId).andWhere('posts.is_published', true)
    if (query.type) countQuery.andWhere('posts.type', query.type)
    if (query.authorId) countQuery.andWhere('posts.author_id', query.authorId)

    const [{ count }] = await countQuery.count<CountRow[]>({ count: '*' })
    const total = Number(count)
    const offset = (query.page - 1) * query.limit

    const rows = (await postSelectQuery(db, userId, universityId)
      .where('posts.university_id', universityId)
      .andWhere('posts.is_published', true)
      .modify((builder) => {
        if (query.type) builder.andWhere('posts.type', query.type)
        if (query.authorId) builder.andWhere('posts.author_id', query.authorId)
      })
      .orderBy('posts.is_pinned', 'desc')
      .orderByRaw('is_connected DESC NULLS LAST')
      .orderBy('posts.created_at', 'desc')
      .limit(query.limit)
      .offset(offset)) as PostRow[]

    const posts = await this.attachPolls(rows.map(toPost), rows.map((row) => row.id), userId)
    return { items: posts, total, page: query.page, limit: query.limit }
  }

  async listGroupPosts(universityId: string, userId: string, groupId: string, query: PaginationQuery) {
    const [{ count }] = await db('posts')
      .where({ university_id: universityId, group_id: groupId, is_published: true })
      .count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const rows = (await postSelectQuery(db, userId)
      .where({ 'posts.university_id': universityId, 'posts.group_id': groupId, 'posts.is_published': true })
      .orderBy('posts.is_pinned', 'desc')
      .orderBy('posts.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)) as PostRow[]

    const posts = await this.attachPolls(rows.map(toPost), rows.map((row) => row.id), userId)
    return { items: posts, total, page: query.page, limit: query.limit }
  }

  async createPost(context: AuthContext, input: CreatePostInput) {
    assertCanUsePostType(context.role, input.type)

    const postId = await db.transaction(async (trx) => {
      const [post] = await trx('posts')
        .insert({
          university_id: context.universityId,
          author_id: context.userId,
          type: input.type,
          content: input.content,
          media_urls: input.media_urls,
          group_id: input.group_id ?? null,
          is_published: input.is_published ?? true,
        })
        .returning<{ id: string }[]>('id')

      if (!post) throw badRequest('Post could not be created', 'POST_CREATE_FAILED')

      if (input.poll) {
        const [poll] = await trx('polls')
          .insert({
            post_id: post.id,
            question: input.poll.question,
            expires_at: input.poll.expires_at ? new Date(input.poll.expires_at) : null,
          })
          .returning<{ id: string }[]>('id')

        if (!poll) throw badRequest('Poll could not be created', 'POLL_CREATE_FAILED')

        await trx('poll_options').insert(
          input.poll.options.map((option, index) => ({
            poll_id: poll.id,
            option_text: option,
            display_order: index,
          })),
        )
      }

      // ── Hashtag extraction ────────────────────────────────────────────────
      const hashtags = extractHashtags(input.content)
      if (hashtags.length > 0) {
        await trx('tags')
          .insert(hashtags.map((name) => ({ id: trx.raw('uuid_generate_v4()'), university_id: context.universityId, name })))
          .onConflict(['university_id', 'name'])
          .ignore()
        const tagRows = await trx('tags')
          .where('university_id', context.universityId)
          .whereIn('name', hashtags)
          .select<{ id: string }[]>('id')
        if (tagRows.length > 0) {
          await trx('post_tags')
            .insert(tagRows.map((t) => ({ post_id: post.id, tag_id: t.id })))
            .onConflict(['post_id', 'tag_id'])
            .ignore()
        }
      }

      return post.id
    })

    const post = await this.getPost(context.universityId, context.userId, postId, { incrementView: false })
    // Drafts are not broadcast to the feed — only published posts reach other users.
    if (post.isPublished) {
      const io = getIo()
      io.to(`uni:${context.universityId}`).emit('post:created', post)
      io.to(`uni:${context.universityId}`).emit('feed:post:new', { post })
    }
    return post
  }

  async getPost(
    universityId: string,
    userId: string,
    postId: string,
    options: { incrementView?: boolean } = { incrementView: true },
  ) {
    const row = await postSelectQuery(db, userId)
      .where({ 'posts.id': postId, 'posts.university_id': universityId })
      .first<PostRow>()

    if (!row) throw notFound('Post not found', 'POST_NOT_FOUND')
    // A draft post is visible only to its author.
    if (!row.is_published && row.author_id !== userId) throw notFound('Post not found', 'POST_NOT_FOUND')

    if (options.incrementView !== false) {
      void db('posts')
        .where({ id: postId, university_id: universityId })
        .increment('view_count', 1)
        .catch((error: unknown) => logger.warn('Failed to increment post view count', { error, postId }))
    }

    const [post] = await this.attachPolls([toPost(row)], [row.id], userId)
    return post
  }

  async updatePost(context: AuthContext, postId: string, input: UpdatePostInput) {
    const post = await assertPostInUniversity(postId, context.universityId)
    assertCanMutatePost(context, post.author_id)
    if (input.type) assertCanUsePostType(context.role, input.type)

    await db('posts')
      .where({ id: postId, university_id: context.universityId })
      .update({
        ...pickDefined({
          content: input.content,
          media_urls: input.media_urls,
          type: input.type,
          group_id: input.group_id,
          is_pinned: input.is_pinned,
          is_published: input.is_published,
        }),
        updated_at: db.fn.now(),
      })

    // Publishing a draft for the first time broadcasts it to the feed.
    const publishingNow = input.is_published === true && !post.is_published

    // Re-sync hashtags when content is being updated
    if (input.content !== undefined) {
      await db('post_tags').where('post_id', postId).delete()
      const hashtags = extractHashtags(input.content)
      if (hashtags.length > 0) {
        await db('tags')
          .insert(hashtags.map((name) => ({ id: db.raw('uuid_generate_v4()'), university_id: context.universityId, name })))
          .onConflict(['university_id', 'name'])
          .ignore()
        const tagRows = await db('tags')
          .where('university_id', context.universityId)
          .whereIn('name', hashtags)
          .select<{ id: string }[]>('id')
        if (tagRows.length > 0) {
          await db('post_tags')
            .insert(tagRows.map((t) => ({ post_id: postId, tag_id: t.id })))
            .onConflict(['post_id', 'tag_id'])
            .ignore()
        }
      }
    }

    const updated = await this.getPost(context.universityId, context.userId, postId, { incrementView: false })
    if (publishingNow) {
      const io = getIo()
      io.to(`uni:${context.universityId}`).emit('post:created', updated)
      io.to(`uni:${context.universityId}`).emit('feed:post:new', { post: updated })
    }
    return updated
  }

  async deletePost(context: AuthContext, postId: string) {
    const post = await assertPostInUniversity(postId, context.universityId)
    assertCanMutatePost(context, post.author_id)

    await db.transaction(async (trx) => {
      const comments = await trx('comments').select<{ id: string }[]>('id').where({ post_id: postId })
      const commentIds = comments.map((comment) => comment.id)

      await trx('reactions').where({ target_id: postId, target_type: 'post' }).delete()
      if (commentIds.length > 0) {
        await trx('reactions').whereIn('target_id', commentIds).andWhere('target_type', 'comment').delete()
      }
      await trx('posts').where({ id: postId, university_id: context.universityId }).delete()
    })

    return { deleted: true }
  }

  async upsertReaction(context: AuthContext, postId: string, reactionType: ReactionType) {
    await assertPostInUniversity(postId, context.universityId)

    await db('reactions')
      .insert({
        user_id: context.userId,
        target_id: postId,
        target_type: 'post',
        reaction_type: reactionType,
      })
      .onConflict(['user_id', 'target_id', 'target_type'])
      .merge({
        reaction_type: reactionType,
        created_at: db.fn.now(),
      })

    const reactionCounts = await getReactionCounts(postId, 'post')
    const payload = { postId, userId: context.userId, reactionType, reactionCounts }
    const io = getIo()
    io.to(`uni:${context.universityId}`).emit('post:reaction', payload)
    io.to(`uni:${context.universityId}`).emit('feed:reaction:updated', { postId, reactionCounts })

    // Notify post author (fire-and-forget)
    const post = await db('posts')
      .select<{ author_id: string }>('author_id')
      .where({ id: postId })
      .first()
    if (post && post.author_id !== context.userId) {
      const actorName = await notificationsService.getActorName(context.userId)
      notificationsService
        .createNotification({
          userId: post.author_id,
          type: 'post_reaction',
          actorId: context.userId,
          referenceId: postId,
          referenceType: 'post',
          content: `${actorName} reacted to your post`,
        })
        .catch((err: unknown) => logger.warn('Failed to create reaction notification', { err }))
    }

    return payload
  }

  async removeReaction(context: AuthContext, postId: string) {
    await assertPostInUniversity(postId, context.universityId)

    await db('reactions')
      .where({
        user_id: context.userId,
        target_id: postId,
        target_type: 'post',
      })
      .delete()

    const reactionCounts = await getReactionCounts(postId, 'post')
    const payload = { postId, userId: context.userId, reactionType: null, reactionCounts }
    const io = getIo()
    io.to(`uni:${context.universityId}`).emit('post:reaction', payload)
    io.to(`uni:${context.universityId}`).emit('feed:reaction:updated', { postId, reactionCounts })
    return payload
  }

  async listComments(universityId: string, userId: string, postId: string, query: PaginationQuery) {
    await assertPostInUniversity(postId, universityId)

    const [{ count }] = await db('comments')
      .where({ post_id: postId, parent_id: null })
      .count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const roots = await commentSelectQuery(db, userId)
      .where({ 'comments.post_id': postId, 'comments.parent_id': null })
      .orderBy('comments.created_at', 'asc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    const rootIds = roots.map((comment) => comment.id)
    const replies =
      rootIds.length === 0
        ? []
        : await commentSelectQuery(db, userId)
            .where('comments.post_id', postId)
            .whereIn('comments.parent_id', rootIds)
            .orderBy('comments.created_at', 'asc')

    const replyMap = new Map<string, ReturnType<typeof toComment>[]>()
    for (const reply of replies) {
      const mapped = toComment(reply)
      const parentReplies = replyMap.get(reply.parent_id ?? '') ?? []
      parentReplies.push(mapped)
      replyMap.set(reply.parent_id ?? '', parentReplies)
    }

    const items = roots.map((root) => ({
      ...toComment(root),
      replies: replyMap.get(root.id) ?? [],
    }))

    return { items, total, page: query.page, limit: query.limit }
  }

  async createComment(context: AuthContext, postId: string, input: CreateCommentInput) {
    await assertPostInUniversity(postId, context.universityId)

    if (input.parent_id) {
      const parent = await db('comments').where({ id: input.parent_id, post_id: postId }).first()
      if (!parent) throw notFound('Parent comment not found', 'PARENT_COMMENT_NOT_FOUND')
    }

    const commentId = await db.transaction(async (trx) => {
      const [comment] = await trx('comments')
        .insert({
          post_id: postId,
          author_id: context.userId,
          parent_id: input.parent_id ?? null,
          content: input.content,
        })
        .returning<{ id: string }[]>('id')

      if (!comment) throw badRequest('Comment could not be created', 'COMMENT_CREATE_FAILED')
      return comment.id
    })

    const row = await commentSelectQuery(db, context.userId).where('comments.id', commentId).first<CommentRow>()
    if (!row) throw notFound('Comment not found', 'COMMENT_NOT_FOUND')

    const comment = toComment(row)
    const io = getIo()
    io.to(`uni:${context.universityId}`).emit('post:comment', { postId, comment })
    io.to(`uni:${context.universityId}`).emit('feed:comment:new', { postId, comment })

    // Notify post author (fire-and-forget)
    const postForNotif = await db('posts')
      .select<{ author_id: string }>('author_id')
      .where({ id: postId })
      .first()
    if (postForNotif && postForNotif.author_id !== context.userId) {
      const actorName = await notificationsService.getActorName(context.userId)
      notificationsService
        .createNotification({
          userId: postForNotif.author_id,
          type: 'post_comment',
          actorId: context.userId,
          referenceId: postId,
          referenceType: 'post',
          content: `${actorName} commented on your post`,
        })
        .catch((err: unknown) => logger.warn('Failed to create comment notification', { err }))
    }

    return comment
  }

  async deleteComment(context: AuthContext, postId: string, commentId: string) {
    const comment = await db('comments')
      .select<{ id: string; author_id: string }>('id', 'author_id')
      .where({ id: commentId, post_id: postId })
      .first()
    if (!comment) throw notFound('Comment not found', 'COMMENT_NOT_FOUND')
    if (comment.author_id !== context.userId && context.role !== 'admin') {
      throw forbidden('Cannot delete this comment', 'COMMENT_FORBIDDEN')
    }
    await db('reactions').where({ target_id: commentId, target_type: 'comment' }).delete()
    await db('comments').where({ id: commentId }).delete()
    const io = getIo()
    io.to(`uni:${context.universityId}`).emit('feed:comment:deleted', { postId, commentId })
    return { deleted: true }
  }

  async upsertCommentReaction(context: AuthContext, postId: string, commentId: string, reactionType: ReactionType) {
    await assertPostInUniversity(postId, context.universityId)
    const comment = await db('comments').where({ id: commentId, post_id: postId }).first()
    if (!comment) throw notFound('Comment not found', 'COMMENT_NOT_FOUND')

    await db('reactions')
      .insert({ user_id: context.userId, target_id: commentId, target_type: 'comment', reaction_type: reactionType })
      .onConflict(['user_id', 'target_id', 'target_type'])
      .merge({ reaction_type: reactionType, created_at: db.fn.now() })

    return { reacted: true }
  }

  async removeCommentReaction(context: AuthContext, postId: string, commentId: string) {
    await assertPostInUniversity(postId, context.universityId)
    await db('reactions')
      .where({ user_id: context.userId, target_id: commentId, target_type: 'comment' })
      .delete()
    return { removed: true }
  }

  async votePoll(context: AuthContext, postId: string, input: { poll_option_id: string }) {
    const post = await assertPostInUniversity(postId, context.universityId)

    const result = await db.transaction(async (trx) => {
      const option = await trx('poll_options')
        .join('polls', 'polls.id', 'poll_options.poll_id')
        .select<{ id: string; poll_id: string; expires_at: Date | null; post_id: string }[]>(
          'poll_options.id',
          'poll_options.poll_id',
          'polls.expires_at',
          'polls.post_id',
        )
        .where({ 'poll_options.id': input.poll_option_id, 'polls.post_id': post.id })
        .first()

      if (!option) throw notFound('Poll option not found', 'POLL_OPTION_NOT_FOUND')
      if (option.expires_at && option.expires_at.getTime() <= Date.now()) {
        throw badRequest('Poll has expired', 'POLL_EXPIRED')
      }

      const options = await trx('poll_options').select<{ id: string }[]>('id').where({ poll_id: option.poll_id })
      const optionIds = options.map((pollOption) => pollOption.id)

      if (optionIds.length > 0) {
        await trx('poll_votes').where({ user_id: context.userId }).whereIn('poll_option_id', optionIds).delete()
      }

      await trx('poll_votes').insert({
        poll_option_id: input.poll_option_id,
        user_id: context.userId,
      })

      return getPollVoteCounts(trx, option.poll_id)
    })

    const payload = { postId, poll: result }
    const io = getIo()
    io.to(`uni:${context.universityId}`).emit('poll:vote', payload)
    io.to(`uni:${context.universityId}`).emit('feed:poll:updated', {
      pollId: result.id,
      options: result.options,
    })
    return payload
  }

  async votePollByPollId(context: AuthContext, pollId: string, input: { poll_option_id: string }) {
    const poll = await db('polls')
      .join('posts', 'posts.id', 'polls.post_id')
      .select<{ post_id: string }[]>('polls.post_id')
      .where({ 'polls.id': pollId, 'posts.university_id': context.universityId })
      .first()

    if (!poll) throw notFound('Poll not found', 'POLL_NOT_FOUND')
    return this.votePoll(context, poll.post_id, input)
  }

  async savePost(context: AuthContext, postId: string) {
    await assertPostInUniversity(postId, context.universityId)
    await db('saved_posts')
      .insert({
        user_id: context.userId,
        post_id: postId,
      })
      .onConflict(['user_id', 'post_id'])
      .ignore()

    return { saved: true }
  }

  async unsavePost(context: AuthContext, postId: string) {
    await assertPostInUniversity(postId, context.universityId)
    await db('saved_posts').where({ user_id: context.userId, post_id: postId }).delete()
    return { saved: false }
  }

  private async attachPolls<T extends { id: string }>(posts: T[], postIds: string[], userId: string) {
    if (postIds.length === 0) return posts.map((post) => ({ ...post, poll: null }))

    const polls = await db('polls').select<PollRow[]>('id', 'post_id', 'question', 'expires_at').whereIn('post_id', postIds)
    if (polls.length === 0) return posts.map((post) => ({ ...post, poll: null }))

    const pollIds = polls.map((poll) => poll.id)
    const options = await getPollOptionsWithCounts(db, pollIds)
    const optionsByPoll = groupBy(options, (option) => option.poll_id)

    const allOptionIds = options.map((o) => o.id)
    const userVotes = allOptionIds.length > 0
      ? await db('poll_votes')
          .select<{ poll_option_id: string }[]>('poll_option_id')
          .where({ user_id: userId })
          .whereIn('poll_option_id', allOptionIds)
      : []
    const votedOptionIds = new Set(userVotes.map((v) => v.poll_option_id))

    const pollByPost = new Map(
      polls.map((poll) => {
        const pollOptions = (optionsByPoll.get(poll.id) ?? []).map(toPollOption)
        const myVote = pollOptions.find((o) => votedOptionIds.has(o.id))?.id ?? null
        const totalVotes = pollOptions.reduce((sum, o) => sum + o.voteCount, 0)
        return [
          poll.post_id,
          {
            id: poll.id,
            question: poll.question,
            expiresAt: poll.expires_at,
            options: pollOptions,
            myVote,
            totalVotes,
          },
        ]
      }),
    )

    return posts.map((post) => ({ ...post, poll: pollByPost.get(post.id) ?? null }))
  }

  async getTrending(universityId: string) {
    const tagRows = await db('tags')
      .join('post_tags', 'post_tags.tag_id', 'tags.id')
      .join('posts', 'posts.id', 'post_tags.post_id')
      .select('tags.name')
      .count('post_tags.post_id as post_count')
      .where('tags.university_id', universityId)
      .where('posts.university_id', universityId)
      .where('posts.created_at', '>', db.raw("NOW() - INTERVAL '7 days'"))
      .groupBy('tags.id', 'tags.name')
      .orderByRaw('COUNT(post_tags.post_id) DESC')
      .limit(5) as Array<{ name: string; post_count: string }>

    return {
      trendingTags: tagRows.map((t) => ({
        name: t.name,
        postCount: Number(t.post_count),
      })),
    }
  }
}

export const feedService = new FeedService()

function postSelectQuery(knex: Knex, userId: string, universityId?: string) {
  return knex('posts')
    .join('users', 'users.id', 'posts.author_id')
    .join('profiles', 'profiles.user_id', 'users.id')
    .leftJoin<SavedPostRow>('saved_posts', function joinSaved() {
      this.on('saved_posts.post_id', '=', 'posts.id').andOn('saved_posts.user_id', '=', knex.raw('?', [userId]))
    })
    .select<PostRow[]>(
      'posts.id',
      'posts.university_id',
      'posts.author_id',
      'posts.type',
      'posts.content',
      'posts.media_urls',
      'posts.group_id',
      'posts.is_pinned',
      'posts.is_published',
      'posts.view_count',
      'posts.created_at',
      'posts.updated_at',
      'profiles.full_name as author_full_name',
      'profiles.avatar_url as author_avatar_url',
      'profiles.headline as author_headline',
      'profiles.department as author_department',
      'profiles.batch_year as author_batch_year',
      'users.role as author_role',
      knex.raw(
        `COALESCE(
          (
            SELECT jsonb_object_agg(reaction_type, total)
            FROM (
              SELECT reaction_type, COUNT(*)::int AS total
              FROM reactions
              WHERE target_id = posts.id AND target_type = 'post'
              GROUP BY reaction_type
            ) reaction_totals
          ),
          '{}'::jsonb
        ) AS reaction_counts`,
      ),
      knex.raw(
        `(SELECT COUNT(*)::int FROM comments WHERE comments.post_id = posts.id) AS comment_count`,
      ),
      knex.raw(
        `(SELECT reaction_type FROM reactions WHERE target_id = posts.id AND target_type = 'post' AND user_id = ? LIMIT 1) AS own_reaction`,
        [userId],
      ),
      knex.raw('saved_posts.user_id IS NOT NULL AS is_saved'),
      universityId
        ? knex.raw(
            `CASE WHEN posts.author_id IN (
              SELECT CASE
                WHEN c.requester_id = ? THEN c.addressee_id
                ELSE c.requester_id
              END
              FROM connections c
              WHERE (c.requester_id = ? OR c.addressee_id = ?)
                AND c.status = 'accepted'
                AND c.university_id = ?
            ) THEN 1 ELSE 0 END AS is_connected`,
            [userId, userId, userId, universityId],
          )
        : knex.raw('NULL AS is_connected'),
    )
}

function commentSelectQuery(knex: Knex, userId: string) {
  return knex('comments')
    .join('users', 'users.id', 'comments.author_id')
    .join('profiles', 'profiles.user_id', 'users.id')
    .select<CommentRow[]>(
      'comments.id',
      'comments.post_id',
      'comments.author_id',
      'comments.parent_id',
      'comments.content',
      'comments.created_at',
      'comments.updated_at',
      'profiles.full_name as author_full_name',
      'profiles.avatar_url as author_avatar_url',
      'profiles.headline as author_headline',
      knex.raw(
        `COALESCE(
          (
            SELECT jsonb_object_agg(reaction_type, total)
            FROM (
              SELECT reaction_type, COUNT(*)::int AS total
              FROM reactions
              WHERE target_id = comments.id AND target_type = 'comment'
              GROUP BY reaction_type
            ) reaction_totals
          ),
          '{}'::jsonb
        ) AS reaction_counts`,
      ),
      knex.raw(
        `(SELECT reaction_type FROM reactions WHERE target_id = comments.id AND target_type = 'comment' AND user_id = ? LIMIT 1) AS own_reaction`,
        [userId],
      ),
    )
}

async function assertPostInUniversity(postId: string, universityId: string) {
  const post = await db('posts')
    .select<{ id: string; author_id: string; university_id: string; is_published: boolean }[]>(
      'id',
      'author_id',
      'university_id',
      'is_published',
    )
    .where({ id: postId, university_id: universityId })
    .first()

  if (!post) throw notFound('Post not found', 'POST_NOT_FOUND')
  return post
}

function assertCanMutatePost(context: AuthContext, authorId: string) {
  if (context.userId === authorId || context.role === 'admin') return
  throw forbidden('You do not have permission to modify this post', 'POST_FORBIDDEN')
}

function assertCanUsePostType(role: UserRole, type: PostType) {
  if (type !== 'announcement') return
  if (role === 'faculty' || role === 'admin') return
  throw forbidden('Only faculty and admins can create announcements', 'ANNOUNCEMENT_FORBIDDEN')
}

async function getReactionCounts(targetId: string, targetType: 'post' | 'comment') {
  const rows = (await db('reactions')
    .select<ReactionCountRow[]>('reaction_type')
    .count({ count: '*' })
    .where({ target_id: targetId, target_type: targetType })
    .groupBy('reaction_type')) as ReactionCountRow[]

  return rows.reduce<Record<ReactionType, number>>(
    (counts, row) => {
      counts[row.reaction_type] = Number(row.count)
      return counts
    },
    { like: 0, love: 0, insightful: 0, celebrate: 0 },
  )
}

async function getPollOptionsWithCounts(knex: Knex, pollIds: string[]) {
  if (pollIds.length === 0) return []

  const rows = await knex('poll_options')
    .leftJoin('poll_votes', 'poll_votes.poll_option_id', 'poll_options.id')
    .select(
      'poll_options.id',
      'poll_options.poll_id',
      'poll_options.option_text',
      'poll_options.display_order',
    )
    .count({ vote_count: 'poll_votes.user_id' })
    .whereIn('poll_options.poll_id', pollIds)
    .groupBy('poll_options.id')
    .orderBy('poll_options.display_order', 'asc')

  return rows as PollOptionRow[]
}

async function getPollVoteCounts(knex: Knex, pollId: string) {
  const options = await getPollOptionsWithCounts(knex, [pollId])
  return {
    id: pollId,
    options: options.map(toPollOption),
  }
}

function toPost(row: PostRow) {
  return {
    id: row.id,
    universityId: row.university_id,
    authorId: row.author_id,
    type: row.type,
    content: row.content,
    mediaUrls: row.media_urls ?? [],
    groupId: row.group_id,
    isPinned: row.is_pinned,
    isPublished: row.is_published,
    viewCount: row.view_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: {
      id: row.author_id,
      fullName: row.author_full_name,
      role: row.author_role,
      profile: {
        avatarUrl: row.author_avatar_url,
        headline: row.author_headline,
        department: row.author_department,
        batchYear: row.author_batch_year,
      },
    },
    reactionCounts: normalizeReactionCounts(row.reaction_counts),
    commentCount: Number(row.comment_count),
    myReaction: row.own_reaction,
    isSaved: Boolean(row.is_saved),
  }
}

function toComment(row: CommentRow) {
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    parentId: row.parent_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: {
      id: row.author_id,
      fullName: row.author_full_name,
      avatarUrl: row.author_avatar_url,
      headline: row.author_headline,
    },
    reactionCounts: normalizeReactionCounts(row.reaction_counts),
    ownReaction: row.own_reaction,
  }
}

function toPollOption(row: PollOptionRow) {
  return {
    id: row.id,
    text: row.option_text,
    displayOrder: row.display_order,
    voteCount: Number(row.vote_count),
  }
}

function normalizeReactionCounts(value: unknown) {
  const source = typeof value === 'object' && value !== null ? (value as Partial<Record<ReactionType, unknown>>) : {}
  return {
    like: Number(source.like ?? 0),
    love: Number(source.love ?? 0),
    insightful: Number(source.insightful ?? 0),
    celebrate: Number(source.celebrate ?? 0),
  }
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = getKey(item)
    const group = groups.get(key) ?? []
    group.push(item)
    groups.set(key, group)
  }
  return groups
}

function pickDefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined))
}
