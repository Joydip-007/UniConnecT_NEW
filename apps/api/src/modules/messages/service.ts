import type { Knex } from 'knex'
import {
  MESSAGE_EVENTS,
  isAllowedAttachment,
  type ChatTheme,
  type MessageAttachment,
  type UserRole,
} from '@uniconnect/shared'
import { db } from '../../config/db'
import { enqueuePush } from '../push/service'
import { getIo } from '../../socket'
import { AppError, badRequest, forbidden, notFound } from '../../utils/errors'
import { moderationService } from '../moderation/service'
import type {
  ConversationPreferencesInput,
  CreateConversationInput,
  CreateMessageInput,
  MessageListQuery,
  SharedFilesQuery,
  UpdateConversationInput,
  UpdateMessageInput,
} from './schema'

type MessageType = 'text' | 'image' | 'file' | 'system'
type MessageContentType = MessageType | 'sticker'

interface AuthContext {
  userId: string
  universityId: string
  role: UserRole
}

interface ConversationRow {
  id: string
  university_id: string
  name: string | null
  is_group: boolean
  type: 'direct' | 'group' | 'mentorship'
  avatar_url: string | null
  created_by: string
  created_at: Date
  last_read_at: Date | null
  is_muted: boolean
  is_pinned: boolean
  pinned_at: Date | null
  chat_theme: ChatTheme
  quick_emoji: string
  is_request: boolean
  group_id: string | null
  group_name: string | null
  group_type: string | null
  group_member_count: number | null
  joined_at: Date
  last_message_id: string | null
  last_message_content: string | null
  last_message_type: MessageType | null
  last_message_content_type: MessageContentType | null
  last_message_view_once: boolean | null
  last_message_is_deleted: boolean | null
  last_message_sender_id: string | null
  last_message_created_at: Date | null
  unread_count: string | number
}

interface ConversationAccessRow {
  id: string
  university_id: string
  name: string | null
  is_group: boolean
  type: 'direct' | 'group' | 'mentorship'
  avatar_url: string | null
  created_by: string
  created_at: Date
  last_read_at: Date | null
  is_muted: boolean
  joined_at: Date
}

interface ParticipantRow {
  user_id: string
  last_read_at: Date | null
  is_muted: boolean
  joined_at: Date
  email: string
  role: UserRole
  full_name: string | null
  avatar_url: string | null
  headline: string | null
}

interface UserRow {
  id: string
  university_id: string
}

interface MessageRow {
  id: string
  conversation_id: string
  sender_id: string
  content: string | null
  media_urls: string[] | null
  reply_to_id: string | null
  type: MessageType
  content_type: MessageContentType | null
  sticker_url: string | null
  attachments: MessageAttachment[] | null
  view_once: boolean
  edited_at: Date | null
  is_deleted: boolean
  created_at: Date
  viewer_once_viewed_at?: Date | null
  once_opened_by_other?: boolean | null
  sender_email: string
  sender_role: UserRole
  sender_full_name: string | null
  sender_avatar_url: string | null
  sender_headline: string | null
}

interface MessageOwnerRow {
  id: string
  conversation_id: string
  sender_id: string
}

export class MessagesService {
  async listConversations(context: AuthContext) {
    const rows = (await conversationListQuery(context)
      .orderByRaw('COALESCE(last_message.created_at, conversations.created_at) DESC')) as ConversationRow[]

    const participants = await getParticipantsForConversations(rows.map((row) => row.id))
    return rows.map((row) => toConversation(row, participants.get(row.id) ?? [], context.userId))
  }

  async createConversation(context: AuthContext, input: CreateConversationInput) {
    if (input.is_group) {
      return { data: await this.createGroupConversation(context, input), created: true }
    }

    if (!input.participantId) {
      throw badRequest('participantId is required for direct conversations', 'PARTICIPANT_REQUIRED')
    }
    if (input.participantId === context.userId) {
      throw badRequest('You cannot create a conversation with yourself', 'SELF_CONVERSATION_NOT_ALLOWED')
    }

    await assertUsersInUniversity([input.participantId], context.universityId)

    // Moderation: a block in either direction blocks direct messaging.
    if (await moderationService.isBlockedBetween(context.userId, input.participantId)) {
      throw forbidden('You cannot message this user', 'USER_BLOCKED')
    }

    // Direct conversations are gated by the target's `messages` privacy tier.
    // Backward-compat: when the tier was never explicitly set, derive it from the
    // legacy `is_open_to_msg` boolean (true → everyone, false → connections).
    if (!input.is_group) {
      const isAdmin = context.role === 'admin'
      if (!isAdmin) {
        const [targetProfile, settingsRow] = await Promise.all([
          db('profiles')
            .where({ user_id: input.participantId })
            .select('is_open_to_msg')
            .first<{ is_open_to_msg: boolean }>(),
          db('user_settings')
            .where({ user_id: input.participantId })
            .select<{ privacy_preferences: { messages?: 'everyone' | 'connections' | 'only_me' } | null }[]>(
              'privacy_preferences',
            )
            .first(),
        ])

        const tier =
          settingsRow?.privacy_preferences?.messages ??
          (targetProfile?.is_open_to_msg ? 'everyone' : 'connections')

        if (tier === 'only_me') {
          throw forbidden('This user is not accepting messages', 'MESSAGES_DISABLED')
        }

        if (tier === 'connections') {
          const connection = await db('connections')
            .where(function () {
              this.where({ requester_id: context.userId, addressee_id: input.participantId }).orWhere({
                requester_id: input.participantId,
                addressee_id: context.userId,
              })
            })
            .andWhere('status', 'accepted')
            .andWhere('university_id', context.universityId)
            .first()

          if (!connection) {
            throw forbidden('You must be connected to message this person', 'NOT_CONNECTED')
          }
        }
      }
    }

    const existing = await findDirectConversation(context.userId, input.participantId, context.universityId)
    if (existing) return { data: await this.getConversation(context, existing.id), created: false }

    const conversationId = await db.transaction(async (trx) => {
      const [conversation] = await trx('conversations')
        .insert({
          university_id: context.universityId,
          is_group: false,
          created_by: context.userId,
        })
        .returning<{ id: string }[]>('id')

      if (!conversation) throw badRequest('Conversation could not be created', 'CONVERSATION_CREATE_FAILED')

      await trx('conversation_participants').insert([
        { conversation_id: conversation.id, user_id: context.userId },
        { conversation_id: conversation.id, user_id: input.participantId },
      ])

      return conversation.id
    })

    return { data: await this.getConversation(context, conversationId), created: true }
  }

  async getConversation(context: AuthContext, convId: string) {
    const row = await conversationListQuery(context).where('conversations.id', convId).first<ConversationRow>()
    if (!row) throw notFound('Conversation not found', 'CONVERSATION_NOT_FOUND')

    const participants = await getParticipantsForConversations([row.id])
    return toConversation(row, participants.get(row.id) ?? [], context.userId)
  }

  async updateConversation(context: AuthContext, convId: string, input: UpdateConversationInput) {
    const conversation = await assertParticipant(context, convId)
    if (!conversation.is_group) {
      throw badRequest('Only group conversations can be updated', 'DIRECT_CONVERSATION_UPDATE_FORBIDDEN')
    }

    await db('conversations')
      .where({ id: convId, university_id: context.universityId })
      .update({
        ...pickDefined({
          name: input.name,
          avatar_url: input.avatar_url,
        }),
      })

    return this.getConversation(context, convId)
  }

  async leaveConversation(context: AuthContext, convId: string) {
    await assertParticipant(context, convId)
    await db('conversation_participants').where({ conversation_id: convId, user_id: context.userId }).delete()
    return { left: true }
  }

  async listMessages(context: AuthContext, convId: string, query: MessageListQuery) {
    await assertParticipant(context, convId)

    const messageQuery = messageSelectQuery(context.userId)
      .where('messages.conversation_id', convId)
      .andWhere((q) => q.whereNull('viewer_state.is_hidden').orWhere('viewer_state.is_hidden', false))
      .orderBy('messages.created_at', 'desc')
      .limit(query.limit)

    if (query.before) {
      const before = await db('messages')
        .select<{ created_at: Date }[]>('created_at')
        .where({ id: query.before, conversation_id: convId })
        .first()

      if (!before) throw notFound('Message cursor not found', 'MESSAGE_CURSOR_NOT_FOUND')
      messageQuery.andWhere('messages.created_at', '<', before.created_at)
    }

    const rows = ((await messageQuery) as MessageRow[]).reverse()

    await db('conversation_participants')
      .where({ conversation_id: convId, user_id: context.userId })
      .update({ last_read_at: db.fn.now() })

    const reactions = await getReactionsForMessages(rows.map((row) => row.id))
    return rows.map((row) => ({ ...toMessage(row, context.userId), reactions: reactions.get(row.id) ?? {} }))
  }

  async createMessage(context: AuthContext, convId: string, input: CreateMessageInput) {
    const conversation = await assertParticipant(context, convId)

    // Re-check connection for direct conversations (handles post-disconnect edge case)
    if (!conversation.is_group && conversation.type === 'direct') {
      const otherParticipants = (await getParticipantsForConversations([convId]))
        .get(convId)
        ?.filter((p) => p.userId !== context.userId) ?? []

      // Moderation: a block in either direction stops messaging (applies to all roles).
      for (const other of otherParticipants) {
        if (await moderationService.isBlockedBetween(context.userId, other.userId)) {
          throw forbidden('You cannot message this user', 'USER_BLOCKED')
        }
      }

      if (context.role !== 'admin') {
        for (const other of otherParticipants) {
          // Replying is always allowed: someone who already wrote to you in this thread
          // opened it themselves, so answering their request is not a cold DM.
          const theyWroteFirst = await db('messages')
            .where({ conversation_id: convId, sender_id: other.userId })
            .first('id')
          if (theyWroteFirst) continue

          const targetProfile = await db('profiles')
            .where({ user_id: other.userId })
            .select('is_open_to_msg')
            .first<{ is_open_to_msg: boolean }>()

          if (!targetProfile?.is_open_to_msg) {
            const connection = await db('connections')
              .where(function () {
                this.where({ requester_id: context.userId, addressee_id: other.userId }).orWhere({
                  requester_id: other.userId,
                  addressee_id: context.userId,
                })
              })
              .andWhere('status', 'accepted')
              .andWhere('university_id', context.universityId)
              .first()

            if (!connection) {
              throw forbidden('You must be connected to message this person', 'NOT_CONNECTED')
            }
          }
        }
      }
    }

    if (input.reply_to_id) {
      const reply = await db('messages').where({ id: input.reply_to_id, conversation_id: convId }).first()
      if (!reply) throw notFound('Reply message not found', 'REPLY_MESSAGE_NOT_FOUND')
    }

    for (const attachment of input.attachments) {
      if (!isAllowedAttachment(attachment.name, attachment.mimeType)) {
        throw badRequest(`"${attachment.name}" is not an allowed file type`, 'ATTACHMENT_TYPE_NOT_ALLOWED')
      }
    }

    // `messages.type` predates stickers and structured attachments, and its CHECK only
    // admits text/image/file/system — so a sticker is stored as an image row and the
    // precise kind lives in `content_type` (migration 082).
    const allImages =
      input.attachments.length > 0 && input.attachments.every((a) => a.mimeType.startsWith('image/'))
    const contentType: MessageContentType =
      input.type === 'sticker'
        ? 'sticker'
        : input.attachments.length > 0
          ? allImages
            ? 'image'
            : 'file'
          : input.type
    const rowType: MessageType = contentType === 'sticker' ? 'image' : contentType

    const messageId = await db.transaction(async (trx) => {
      const [message] = await trx('messages')
        .insert({
          conversation_id: convId,
          sender_id: context.userId,
          content: input.content ?? null,
          media_urls: [...input.media_urls, ...input.attachments.map((a) => a.url)],
          attachments: JSON.stringify(input.attachments),
          view_once: input.view_once,
          reply_to_id: input.reply_to_id ?? null,
          type: rowType,
          content_type: contentType,
          sticker_url: contentType === 'sticker' ? input.sticker_url : null,
        })
        .returning<{ id: string }[]>('id')

      if (!message) throw badRequest('Message could not be created', 'MESSAGE_CREATE_FAILED')
      return message.id
    })

    const message = await getMessageById(messageId, context.userId)
    if (!message) throw notFound('Message not found', 'MESSAGE_NOT_FOUND')

    const mapped = { ...toMessage(message, context.userId), reactions: {} }
    const lastMessage = toLastMessage(message)
    const io = getIo()
    io.to(`conv:${convId}`).emit('message:new', mapped)
    io.to(`conv:${convId}`).emit('conv:message:new', { conversationId: convId, message: mapped })
    io.to(`conv:${convId}`).emit('conversation:updated', { convId, lastMessage })
    await emitToParticipants(convId, MESSAGE_EVENTS.ACTIVITY, { conversationId: convId })

    await enqueueMessagePush(context, convId, mapped)

    return mapped
  }

  async updateMessage(context: AuthContext, convId: string, msgId: string, input: UpdateMessageInput) {
    await assertParticipant(context, convId)
    const message = await getMessageOwner(convId, msgId)
    if (!message) throw notFound('Message not found', 'MESSAGE_NOT_FOUND')
    if (message.sender_id !== context.userId) {
      throw forbidden('Only the sender can edit this message', 'MESSAGE_SENDER_REQUIRED')
    }
    const current = await getMessageById(msgId, context.userId)
    if (!current || current.is_deleted) throw notFound('Message not found', 'MESSAGE_NOT_FOUND')
    if ((current.content_type ?? current.type) !== 'text') {
      throw badRequest('Only text messages can be edited', 'MESSAGE_NOT_EDITABLE')
    }

    await db('messages')
      .where({ id: msgId, conversation_id: convId })
      .update({ content: input.content, edited_at: db.fn.now() })

    const updated = await getMessageById(msgId, context.userId)
    if (!updated) throw notFound('Message not found', 'MESSAGE_NOT_FOUND')
    const reactions = await getReactionsForMessages([msgId])
    const mapped = { ...toMessage(updated, context.userId), reactions: reactions.get(msgId) ?? {} }
    getIo().to(`conv:${convId}`).emit(MESSAGE_EVENTS.UPDATED, { conversationId: convId, message: mapped })
    return mapped
  }

  async deleteMessage(context: AuthContext, convId: string, msgId: string) {
    const conversation = await assertParticipant(context, convId)
    const message = await getMessageOwner(convId, msgId)
    if (!message) throw notFound('Message not found', 'MESSAGE_NOT_FOUND')
    if (message.sender_id !== context.userId && conversation.created_by !== context.userId) {
      throw forbidden('Only the sender or conversation creator can delete this message', 'MESSAGE_DELETE_FORBIDDEN')
    }

    // Scrub the payload too, not just the flag: a removed message must not keep
    // serving its attachment or sticker URLs to anyone still holding the row.
    await db('messages').where({ id: msgId, conversation_id: convId }).update({
      is_deleted: true,
      content: 'This message was deleted',
      media_urls: [],
      attachments: JSON.stringify([]),
      sticker_url: null,
    })

    const deleted = await getMessageById(msgId, context.userId)
    if (!deleted) throw notFound('Message not found', 'MESSAGE_NOT_FOUND')
    getIo().to(`conv:${convId}`).emit('conv:message:deleted', { conversationId: convId, messageId: msgId })
    return { ...toMessage(deleted, context.userId), reactions: {} }
  }

  /** The viewer's own settings for one thread: pin, mute, bubble theme, quick emoji. */
  async updatePreferences(context: AuthContext, convId: string, input: ConversationPreferencesInput) {
    await assertParticipant(context, convId)

    await db('conversation_participants')
      .where({ conversation_id: convId, user_id: context.userId })
      .update(
        pickDefined({
          is_pinned: input.isPinned,
          pinned_at: input.isPinned === undefined ? undefined : input.isPinned ? db.fn.now() : null,
          is_muted: input.isMuted,
          chat_theme: input.chatTheme,
          quick_emoji: input.quickEmoji,
        }),
      )

    return this.getConversation(context, convId)
  }

  /** Groups both people in a direct/mentorship thread belong to. Empty for group chats. */
  async listCommonGroups(context: AuthContext, convId: string) {
    const conversation = await assertParticipant(context, convId)
    if (conversation.is_group) return []

    const other = await db('conversation_participants')
      .where({ conversation_id: convId })
      .whereNot({ user_id: context.userId })
      .select<{ user_id: string }[]>('user_id')
      .first()
    if (!other) return []

    const rows = await db('groups')
      .join('group_members as mine', function joinMine() {
        this.on('mine.group_id', '=', 'groups.id').andOn('mine.user_id', '=', db.raw('?', [context.userId]))
      })
      .join('group_members as theirs', function joinTheirs() {
        this.on('theirs.group_id', '=', 'groups.id').andOn('theirs.user_id', '=', db.raw('?', [other.user_id]))
      })
      .where('groups.university_id', context.universityId)
      .select<{ id: string; name: string; type: string; avatar_url: string | null; member_count: number | null }[]>(
        'groups.id',
        'groups.name',
        'groups.type',
        'groups.avatar_url',
        'groups.member_count',
      )
      .orderBy('groups.name', 'asc')
      .limit(10)

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      avatarUrl: row.avatar_url,
      memberCount: Number(row.member_count ?? 0),
    }))
  }

  /** Files shared in a thread, newest first — backs the details rail's "Shared files". */
  async listSharedFiles(context: AuthContext, convId: string, query: SharedFilesQuery) {
    await assertParticipant(context, convId)

    const rows = await db('messages')
      .leftJoin('message_user_states as viewer_state', function joinViewer() {
        this.on('viewer_state.message_id', '=', 'messages.id').andOn(
          'viewer_state.user_id',
          '=',
          db.raw('?', [context.userId]),
        )
      })
      .where('messages.conversation_id', convId)
      .andWhere('messages.is_deleted', false)
      .andWhere('messages.view_once', false)
      .andWhereRaw('jsonb_array_length(messages.attachments) > 0')
      .andWhere((q) => q.whereNull('viewer_state.is_hidden').orWhere('viewer_state.is_hidden', false))
      .orderBy('messages.created_at', 'desc')
      .limit(query.limit)
      .select<{ id: string; sender_id: string; attachments: MessageAttachment[]; created_at: Date }[]>(
        'messages.id',
        'messages.sender_id',
        'messages.attachments',
        'messages.created_at',
      )

    return rows
      .flatMap((row) =>
        (row.attachments ?? []).map((attachment) => ({
          messageId: row.id,
          senderId: row.sender_id,
          sentAt: row.created_at,
          ...attachment,
        })),
      )
      .slice(0, query.limit)
  }

  /** "Remove for me" — hides a message from the viewer's own copy of the thread only. */
  async hideMessage(context: AuthContext, convId: string, msgId: string) {
    await assertParticipant(context, convId)
    const message = await getMessageOwner(convId, msgId)
    if (!message) throw notFound('Message not found', 'MESSAGE_NOT_FOUND')

    await db('message_user_states')
      .insert({
        message_id: msgId,
        user_id: context.userId,
        university_id: context.universityId,
        is_hidden: true,
      })
      .onConflict(['message_id', 'user_id'])
      .merge({ is_hidden: true, updated_at: db.fn.now() })

    return { hidden: true }
  }

  /**
   * Opens a view-once photo for a recipient exactly once. The URL is never part of
   * any list payload; this is the only path that returns it, and the conditional
   * upsert makes a second open (or a racing double-click) fail rather than re-serve it.
   */
  async openViewOnce(context: AuthContext, convId: string, msgId: string) {
    await assertParticipant(context, convId)
    const message = await db('messages')
      .where({ id: msgId, conversation_id: convId })
      .select<{ id: string; sender_id: string; view_once: boolean; is_deleted: boolean; attachments: MessageAttachment[] }[]>(
        'id',
        'sender_id',
        'view_once',
        'is_deleted',
        'attachments',
      )
      .first()
    if (!message || message.is_deleted) throw notFound('Message not found', 'MESSAGE_NOT_FOUND')
    if (!message.view_once) throw badRequest('This photo is not view once', 'NOT_VIEW_ONCE')
    if (message.sender_id === context.userId) {
      throw forbidden('You sent this photo', 'VIEW_ONCE_SENDER')
    }

    const opened = await db('message_user_states')
      .insert({
        message_id: msgId,
        user_id: context.userId,
        university_id: context.universityId,
        once_viewed_at: db.fn.now(),
      })
      .onConflict(['message_id', 'user_id'])
      .merge({ once_viewed_at: db.fn.now(), updated_at: db.fn.now() })
      .where('message_user_states.once_viewed_at', null)
      .returning<{ once_viewed_at: Date }[]>('once_viewed_at')

    if (opened.length === 0) {
      throw new AppError('This photo has already been opened', 410, 'VIEW_ONCE_ALREADY_OPENED')
    }

    getIo()
      .to(`conv:${convId}`)
      .emit(MESSAGE_EVENTS.ONCE_OPENED, { conversationId: convId, messageId: msgId, userId: context.userId })

    const attachment = message.attachments?.[0]
    if (!attachment) throw notFound('Photo not found', 'MESSAGE_NOT_FOUND')
    return attachment
  }

  async markRead(context: AuthContext, convId: string) {
    await assertParticipant(context, convId)
    const readAt = new Date()

    await db('conversation_participants')
      .where({ conversation_id: convId, user_id: context.userId })
      .update({ last_read_at: readAt })

    const payload = { userId: context.userId, convId, readAt }
    const io = getIo()
    io.to(`conv:${convId}`).emit('message:read', payload)
    io.to(`conv:${convId}`).emit('conv:read:ack', { conversationId: convId, userId: context.userId, readAt })
    return payload
  }

  private async createGroupConversation(context: AuthContext, input: CreateConversationInput) {
    if (!input.name) throw badRequest('Group conversations require a name', 'CONVERSATION_NAME_REQUIRED')

    const participantIds = uniqueIds([context.userId, ...(input.participantIds ?? []), input.participantId].filter(isString))
    if (participantIds.length < 2) {
      throw badRequest('Group conversations require at least two participants', 'GROUP_PARTICIPANTS_REQUIRED')
    }

    await assertUsersInUniversity(
      participantIds.filter((userId) => userId !== context.userId),
      context.universityId,
    )

    const conversationId = await db.transaction(async (trx) => {
      const [conversation] = await trx('conversations')
        .insert({
          university_id: context.universityId,
          name: input.name,
          is_group: true,
          type: 'group',
          created_by: context.userId,
        })
        .returning<{ id: string }[]>('id')

      if (!conversation) throw badRequest('Conversation could not be created', 'CONVERSATION_CREATE_FAILED')

      await trx('conversation_participants').insert(
        participantIds.map((userId) => ({
          conversation_id: conversation.id,
          user_id: userId,
        })),
      )

      return conversation.id
    })

    return this.getConversation(context, conversationId)
  }

  /**
   * Thin, internal-use creator for callers (the groups module's class chat) that
   * already know their full, university-verified participant list — the group's
   * member list is the source of truth here, not the requester, so this skips the
   * "creator must be included" / cross-university membership re-checks the public
   * `createConversation` path does for arbitrary user input.
   *
   * Takes an optional `executor` (a `Knex.Transaction`) so the caller can run the
   * conversation insert inside its own transaction — `groups/service.ts` uses this to
   * create the chat and persist `groups.chat_conversation_id` atomically under a row
   * lock, closing a check-then-create race on concurrent first opens.
   */
  async createGroupConversationForGroup(
    context: AuthContext,
    input: { name: string; participantIds: string[] },
    executor: Knex | Knex.Transaction = db,
  ): Promise<string> {
    const participantIds = uniqueIds([context.userId, ...input.participantIds].filter(isString))
    if (participantIds.length < 2) {
      throw badRequest('Group conversations require at least two participants', 'GROUP_PARTICIPANTS_REQUIRED')
    }

    const [conversation] = await executor('conversations')
      .insert({
        university_id: context.universityId,
        name: input.name,
        is_group: true,
        type: 'group',
        created_by: context.userId,
      })
      .returning<{ id: string }[]>('id')

    if (!conversation) throw badRequest('Conversation could not be created', 'CONVERSATION_CREATE_FAILED')

    await executor('conversation_participants').insert(
      participantIds.map((userId) => ({
        conversation_id: conversation.id,
        user_id: userId,
      })),
    )

    return conversation.id
  }

  /**
   * Find-or-create a direct conversation between the caller and `otherUserId`, bypassing
   * the messaging-privacy-tier gate in `createConversation` — used for the ask-teacher
   * flow, where the pairing is established by academic-group membership, not a cold DM.
   */
  async getOrCreateDirect(context: AuthContext, otherUserId: string): Promise<string> {
    const existing = await findDirectConversation(context.userId, otherUserId, context.universityId)
    if (existing) return existing.id

    return db.transaction(async (trx) => {
      const [conversation] = await trx('conversations')
        .insert({
          university_id: context.universityId,
          is_group: false,
          type: 'direct',
          created_by: context.userId,
        })
        .returning<{ id: string }[]>('id')

      if (!conversation) throw badRequest('Conversation could not be created', 'CONVERSATION_CREATE_FAILED')

      await trx('conversation_participants').insert([
        { conversation_id: conversation.id, user_id: context.userId },
        { conversation_id: conversation.id, user_id: otherUserId },
      ])

      return conversation.id
    })
  }

  async upsertMessageReaction(context: AuthContext, convId: string, msgId: string, reactionType: string) {
    await assertParticipant(context, convId)
    const message = await db('messages').where({ id: msgId, conversation_id: convId }).first()
    if (!message) throw notFound('Message not found')

    await db('message_reactions')
      .insert({
        message_id: msgId,
        user_id: context.userId,
        university_id: context.universityId,
        reaction_type: reactionType,
      })
      .onConflict(['message_id', 'user_id'])
      .merge({ reaction_type: reactionType })

    const reactions = await this.getMessageReactions(msgId)
    getIo().to(`conv:${convId}`).emit('message:reaction', { messageId: msgId, reactions })
    return reactions
  }

  async removeMessageReaction(context: AuthContext, convId: string, msgId: string) {
    await assertParticipant(context, convId)
    const message = await db('messages').where({ id: msgId, conversation_id: convId }).first()
    if (!message) throw notFound('Message not found')

    await db('message_reactions').where({ message_id: msgId, user_id: context.userId }).delete()

    const reactions = await this.getMessageReactions(msgId)
    getIo().to(`conv:${convId}`).emit('message:reaction', { messageId: msgId, reactions })
    return reactions
  }

  async getMessageReactions(msgId: string) {
    const rows = await db('message_reactions')
      .join('users', 'users.id', 'message_reactions.user_id')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where('message_reactions.message_id', msgId)
      .select(
        'message_reactions.reaction_type',
        'message_reactions.user_id',
        'profiles.full_name as user_full_name',
      )

    const grouped: Record<string, { userId: string; fullName: string }[]> = {}
    for (const row of rows) {
      if (!grouped[row.reaction_type]) grouped[row.reaction_type] = []
      grouped[row.reaction_type].push({ userId: row.user_id, fullName: row.user_full_name })
    }
    return grouped
  }
}

export const messagesService = new MessagesService()

function conversationListQuery(context: AuthContext) {
  return db('conversations')
    .join('conversation_participants as current_participant', function joinCurrentParticipant() {
      this.on('current_participant.conversation_id', '=', 'conversations.id').andOn(
        'current_participant.user_id',
        '=',
        db.raw('?', [context.userId]),
      )
    })
    .leftJoin(
      db.raw(
        `(
          SELECT DISTINCT ON (conversation_id)
            id,
            conversation_id,
            content,
            type,
            content_type,
            view_once,
            is_deleted,
            sender_id,
            created_at
          FROM messages
          ORDER BY conversation_id, created_at DESC
        ) AS last_message`,
      ),
      'last_message.conversation_id',
      'conversations.id',
    )
    .leftJoin('groups as linked_group', 'linked_group.chat_conversation_id', 'conversations.id')
    .where('conversations.university_id', context.universityId)
    .select<ConversationRow[]>(
      'conversations.id',
      'conversations.university_id',
      'conversations.name',
      'conversations.is_group',
      'conversations.type',
      'conversations.avatar_url',
      'conversations.created_by',
      'conversations.created_at',
      'current_participant.last_read_at',
      'current_participant.is_muted',
      'current_participant.is_pinned',
      'current_participant.pinned_at',
      'current_participant.chat_theme',
      'current_participant.quick_emoji',
      'current_participant.joined_at',
      'linked_group.id as group_id',
      'linked_group.name as group_name',
      'linked_group.type as group_type',
      'linked_group.member_count as group_member_count',
      'last_message.id as last_message_id',
      'last_message.content as last_message_content',
      'last_message.type as last_message_type',
      'last_message.content_type as last_message_content_type',
      'last_message.view_once as last_message_view_once',
      'last_message.is_deleted as last_message_is_deleted',
      'last_message.sender_id as last_message_sender_id',
      'last_message.created_at as last_message_created_at',
      db.raw(
        `(
          SELECT COUNT(*)::int
          FROM messages unread_messages
          WHERE unread_messages.conversation_id = conversations.id
            AND unread_messages.sender_id <> ?
            AND unread_messages.created_at > COALESCE(current_participant.last_read_at, current_participant.joined_at)
        ) AS unread_count`,
        [context.userId],
      ),
      // A message request: a direct thread someone outside the viewer's connections
      // started, which the viewer has not answered yet. Answering (or connecting)
      // moves it into the main list.
      db.raw(
        `(
          conversations.type = 'direct'
          AND conversations.created_by <> ?
          AND NOT EXISTS (
            SELECT 1 FROM messages mine
            WHERE mine.conversation_id = conversations.id AND mine.sender_id = ?
          )
          AND NOT EXISTS (
            SELECT 1
            FROM conversation_participants other_participant
            JOIN connections ON connections.status = 'accepted'
              AND (
                (connections.requester_id = ? AND connections.addressee_id = other_participant.user_id)
                OR (connections.addressee_id = ? AND connections.requester_id = other_participant.user_id)
              )
            WHERE other_participant.conversation_id = conversations.id
              AND other_participant.user_id <> ?
          )
        ) AS is_request`,
        [context.userId, context.userId, context.userId, context.userId, context.userId],
      ),
    )
}

function messageSelectQuery(viewerId: string) {
  return db('messages')
    .join('users', 'users.id', 'messages.sender_id')
    .join('profiles', 'profiles.user_id', 'users.id')
    .leftJoin('message_user_states as viewer_state', function joinViewerState() {
      this.on('viewer_state.message_id', '=', 'messages.id').andOn(
        'viewer_state.user_id',
        '=',
        db.raw('?', [viewerId]),
      )
    })
    .select<MessageRow[]>(
      'messages.id',
      'messages.conversation_id',
      'messages.sender_id',
      'messages.content',
      'messages.media_urls',
      'messages.reply_to_id',
      'messages.type',
      'messages.content_type',
      'messages.sticker_url',
      'messages.attachments',
      'messages.view_once',
      'messages.edited_at',
      'messages.is_deleted',
      'messages.created_at',
      'viewer_state.once_viewed_at as viewer_once_viewed_at',
      db.raw(
        `EXISTS (
          SELECT 1 FROM message_user_states opened
          WHERE opened.message_id = messages.id
            AND opened.user_id <> messages.sender_id
            AND opened.once_viewed_at IS NOT NULL
        ) AS once_opened_by_other`,
      ),
      'users.email as sender_email',
      'users.role as sender_role',
      'profiles.full_name as sender_full_name',
      'profiles.avatar_url as sender_avatar_url',
      'profiles.headline as sender_headline',
    )
}

async function assertParticipant(context: AuthContext, convId: string) {
  const conversation = await db('conversations')
    .join('conversation_participants', 'conversation_participants.conversation_id', 'conversations.id')
    .select<ConversationAccessRow[]>(
      'conversations.id',
      'conversations.university_id',
      'conversations.name',
      'conversations.is_group',
      'conversations.type',
      'conversations.avatar_url',
      'conversations.created_by',
      'conversations.created_at',
      'conversation_participants.last_read_at',
      'conversation_participants.is_muted',
      'conversation_participants.joined_at',
    )
    .where({
      'conversations.id': convId,
      'conversations.university_id': context.universityId,
      'conversation_participants.user_id': context.userId,
    })
    .first()

  if (!conversation) throw notFound('Conversation not found', 'CONVERSATION_NOT_FOUND')
  return conversation
}

async function assertUsersInUniversity(userIds: string[], universityId: string) {
  if (userIds.length === 0) return

  const rows = await db('users').select<UserRow[]>('id', 'university_id').whereIn('id', userIds).andWhere('university_id', universityId)
  if (rows.length !== userIds.length) {
    throw notFound('One or more users were not found', 'USER_NOT_FOUND')
  }
}

async function findDirectConversation(userId: string, participantId: string, universityId: string) {
  return db('conversations')
    .join('conversation_participants as participant_a', 'participant_a.conversation_id', 'conversations.id')
    .join('conversation_participants as participant_b', 'participant_b.conversation_id', 'conversations.id')
    .where({
      'conversations.university_id': universityId,
      'conversations.is_group': false,
      'participant_a.user_id': userId,
      'participant_b.user_id': participantId,
    })
    .whereRaw('(SELECT COUNT(*) FROM conversation_participants cp WHERE cp.conversation_id = conversations.id) = 2')
    .select<{ id: string }[]>('conversations.id')
    .first()
}

async function getParticipantsForConversations(conversationIds: string[]) {
  const participantMap = new Map<string, ReturnType<typeof toParticipant>[]>()
  if (conversationIds.length === 0) return participantMap

  const rows = (await db('conversation_participants')
    .join('users', 'users.id', 'conversation_participants.user_id')
    .join('profiles', 'profiles.user_id', 'users.id')
    .select(
      'conversation_participants.conversation_id',
      'conversation_participants.user_id',
      'conversation_participants.last_read_at',
      'conversation_participants.is_muted',
      'conversation_participants.joined_at',
      'users.email',
      'users.role',
      'profiles.full_name',
      'profiles.avatar_url',
      'profiles.headline',
    )
    .whereIn('conversation_participants.conversation_id', conversationIds)) as Array<ParticipantRow & { conversation_id: string }>

  for (const row of rows) {
    const participants = participantMap.get(row.conversation_id) ?? []
    participants.push(toParticipant(row))
    participantMap.set(row.conversation_id, participants)
  }

  return participantMap
}

async function getMessageById(messageId: string, viewerId: string) {
  return messageSelectQuery(viewerId).where('messages.id', messageId).first<MessageRow>()
}

async function getReactionsForMessages(messageIds: string[]) {
  const map = new Map<string, Record<string, { userId: string; fullName: string }[]>>()
  if (messageIds.length === 0) return map

  const rows = await db('message_reactions')
    .join('profiles', 'profiles.user_id', 'message_reactions.user_id')
    .whereIn('message_reactions.message_id', messageIds)
    .select<{ message_id: string; reaction_type: string; user_id: string; full_name: string | null }[]>(
      'message_reactions.message_id',
      'message_reactions.reaction_type',
      'message_reactions.user_id',
      'profiles.full_name',
    )

  for (const row of rows) {
    const grouped = map.get(row.message_id) ?? {}
    ;(grouped[row.reaction_type] ??= []).push({ userId: row.user_id, fullName: row.full_name ?? 'Unknown User' })
    map.set(row.message_id, grouped)
  }
  return map
}

async function emitToParticipants(convId: string, event: string, payload: unknown, exceptUserId?: string) {
  const rows = await db('conversation_participants')
    .where({ conversation_id: convId })
    .select<{ user_id: string }[]>('user_id')
  const io = getIo()
  for (const { user_id: userId } of rows) {
    if (userId !== exceptUserId) io.to(`user:${userId}`).emit(event, payload)
  }
}

async function getMessageOwner(convId: string, messageId: string) {
  return db('messages')
    .select<MessageOwnerRow[]>('id', 'conversation_id', 'sender_id')
    .where({ id: messageId, conversation_id: convId })
    .first()
}

// Messages never create a bell notification — they surface in the messages popup
// (via the socket events above) plus a Web Push. Push the other participants who
// haven't muted the conversation; the deep link opens the conversation.
async function enqueueMessagePush(
  context: AuthContext,
  convId: string,
  message: ReturnType<typeof toMessage>,
) {
  const rows = await db('conversation_participants')
    .where({ conversation_id: convId, is_muted: false })
    .whereNot({ user_id: context.userId })
    .select<{ user_id: string }[]>('user_id')
  if (rows.length === 0) return

  const body = messagePreview(message)
  for (const { user_id: userId } of rows) {
    enqueuePush(userId, {
      title: message.sender.fullName,
      body,
      url: `/messages/${convId}`,
    })
  }
}

function messagePreview(message: ReturnType<typeof toMessage>): string {
  const text = message.content?.trim()
  if (text) return text.length > 140 ? `${text.slice(0, 140)}…` : text
  if (message.contentType === 'sticker') return 'Sent a sticker'
  if (message.viewOnce) return 'Sent a view-once photo'
  if (message.contentType === 'image') return 'Sent a photo'
  if (message.attachments.length > 0 || message.mediaUrls.length > 0) return 'Sent an attachment'
  return 'Sent you a message'
}

function toConversation(row: ConversationRow, participants: ReturnType<typeof toParticipant>[], currentUserId: string) {
  const otherParticipants = participants.filter((participant) => participant.userId !== currentUserId)
  const otherParticipant = otherParticipants[0]?.user
  return {
    id: row.id,
    universityId: row.university_id,
    name: row.name,
    isGroup: row.is_group,
    type: row.type,
    avatarUrl: row.avatar_url,
    createdBy: row.created_by,
    createdAt: row.created_at,
    currentParticipant: {
      lastReadAt: row.last_read_at,
      isMuted: row.is_muted,
      joinedAt: row.joined_at,
    },
    isPinned: row.is_pinned,
    pinnedAt: row.pinned_at,
    isMuted: row.is_muted,
    chatTheme: row.chat_theme,
    quickEmoji: row.quick_emoji,
    isRequest: Boolean(row.is_request),
    group: row.group_id
      ? {
          id: row.group_id,
          name: row.group_name ?? '',
          type: row.group_type ?? 'other',
          memberCount: Number(row.group_member_count ?? participants.length),
        }
      : null,
    participantCount: participants.length,
    lastMessage: row.last_message_id
      ? {
          id: row.last_message_id,
          content: row.last_message_is_deleted ? null : row.last_message_content,
          body: row.last_message_is_deleted ? '' : (row.last_message_content ?? ''),
          type: row.last_message_type,
          contentType: row.last_message_content_type ?? row.last_message_type,
          viewOnce: Boolean(row.last_message_view_once),
          isDeleted: Boolean(row.last_message_is_deleted),
          senderId: row.last_message_sender_id,
          createdAt: row.last_message_created_at,
          sentAt: row.last_message_created_at,
        }
      : null,
    unreadCount: Number(row.unread_count),
    participants,
    otherParticipants,
    otherParticipant: otherParticipant
      ? {
          id: otherParticipant.id,
          fullName: otherParticipant.fullName ?? 'Unknown User',
          role: otherParticipant.role,
          profile: {
            avatarUrl: otherParticipant.avatarUrl,
            headline: otherParticipant.headline,
          },
        }
      : null,
  }
}

function toParticipant(row: ParticipantRow) {
  return {
    userId: row.user_id,
    lastReadAt: row.last_read_at,
    isMuted: row.is_muted,
    joinedAt: row.joined_at,
    user: {
      id: row.user_id,
      email: row.email,
      role: row.role,
      fullName: row.full_name ?? 'Unknown User',
      avatarUrl: row.avatar_url,
      headline: row.headline,
    },
  }
}

function toMessage(row: MessageRow, viewerId: string) {
  const isSender = row.sender_id === viewerId
  // A view-once photo never carries its URL in a list/socket payload; recipients
  // fetch it through `openViewOnce`, which serves it a single time.
  const attachments = (row.attachments ?? []).map((attachment) =>
    row.view_once ? { ...attachment, url: '' } : attachment,
  )
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    content: row.content,
    body: row.content ?? '',
    mediaUrls: row.view_once ? [] : (row.media_urls ?? []),
    attachments,
    contentType: row.content_type ?? row.type,
    stickerUrl: row.sticker_url,
    viewOnce: row.view_once
      ? { opened: isSender ? Boolean(row.once_opened_by_other) : Boolean(row.viewer_once_viewed_at) }
      : null,
    editedAt: row.edited_at,
    replyToId: row.reply_to_id,
    replyTo: null,
    type: row.type,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
    sentAt: row.created_at,
    sender: {
      id: row.sender_id,
      email: row.sender_email,
      role: row.sender_role,
      fullName: row.sender_full_name ?? 'Unknown User',
      avatarUrl: row.sender_avatar_url,
      headline: row.sender_headline,
      profile: {
        avatarUrl: row.sender_avatar_url,
      },
    },
  }
}

function toLastMessage(row: MessageRow) {
  return {
    id: row.id,
    content: row.content,
    type: row.type,
    senderId: row.sender_id,
    createdAt: row.created_at,
  }
}

function uniqueIds(values: string[]) {
  return [...new Set(values)]
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function pickDefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined))
}
