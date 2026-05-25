import type { UserRole } from '@uniconnect/shared'
import { db } from '../../config/db'
import { notificationQueue } from '../../queues/notification.queue'
import { getIo } from '../../socket'
import { badRequest, forbidden, notFound } from '../../utils/errors'
import type {
  CreateConversationInput,
  CreateMessageInput,
  MessageListQuery,
  UpdateConversationInput,
  UpdateMessageInput,
} from './schema'

type MessageType = 'text' | 'image' | 'file' | 'system'

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
  joined_at: Date
  last_message_id: string | null
  last_message_content: string | null
  last_message_type: MessageType | null
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
  is_deleted: boolean
  created_at: Date
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

    // Direct conversations require a connection (unless admin, mentorship, or open_to_msg)
    if (!input.is_group) {
      const isAdmin = context.role === 'admin'
      if (!isAdmin) {
        // Check if target has open_to_msg
        const targetProfile = await db('profiles')
          .where({ user_id: input.participantId })
          .select('is_open_to_msg')
          .first<{ is_open_to_msg: boolean }>()

        if (!targetProfile?.is_open_to_msg) {
          // Check connection
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

    const messageQuery = messageSelectQuery()
      .where('messages.conversation_id', convId)
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

    return rows.map(toMessage)
  }

  async createMessage(context: AuthContext, convId: string, input: CreateMessageInput) {
    const conversation = await assertParticipant(context, convId)

    // Re-check connection for direct conversations (handles post-disconnect edge case)
    if (!conversation.is_group && conversation.type === 'direct') {
      if (context.role !== 'admin') {
        const otherParticipants = (await getParticipantsForConversations([convId]))
          .get(convId)
          ?.filter((p) => p.userId !== context.userId) ?? []

        for (const other of otherParticipants) {
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

    const messageId = await db.transaction(async (trx) => {
      const [message] = await trx('messages')
        .insert({
          conversation_id: convId,
          sender_id: context.userId,
          content: input.content ?? null,
          media_urls: input.media_urls,
          reply_to_id: input.reply_to_id ?? null,
          type: input.type,
        })
        .returning<{ id: string }[]>('id')

      if (!message) throw badRequest('Message could not be created', 'MESSAGE_CREATE_FAILED')
      return message.id
    })

    const message = await getMessageById(messageId)
    if (!message) throw notFound('Message not found', 'MESSAGE_NOT_FOUND')

    const mapped = toMessage(message)
    const lastMessage = toLastMessage(message)
    const io = getIo()
    io.to(`conv:${convId}`).emit('message:new', mapped)
    io.to(`conv:${convId}`).emit('conv:message:new', { conversationId: convId, message: mapped })
    io.to(`conv:${convId}`).emit('conversation:updated', { convId, lastMessage })

    const participantIds = await getConversationParticipantIds(convId)
    await enqueueMessageNotifications(context, convId, participantIds.filter((userId) => userId !== context.userId), mapped)

    return mapped
  }

  async updateMessage(context: AuthContext, convId: string, msgId: string, input: UpdateMessageInput) {
    await assertParticipant(context, convId)
    const message = await getMessageOwner(convId, msgId)
    if (!message) throw notFound('Message not found', 'MESSAGE_NOT_FOUND')
    if (message.sender_id !== context.userId) {
      throw forbidden('Only the sender can edit this message', 'MESSAGE_SENDER_REQUIRED')
    }

    await db('messages').where({ id: msgId, conversation_id: convId }).update({ content: input.content })

    const updated = await getMessageById(msgId)
    if (!updated) throw notFound('Message not found', 'MESSAGE_NOT_FOUND')
    return toMessage(updated)
  }

  async deleteMessage(context: AuthContext, convId: string, msgId: string) {
    const conversation = await assertParticipant(context, convId)
    const message = await getMessageOwner(convId, msgId)
    if (!message) throw notFound('Message not found', 'MESSAGE_NOT_FOUND')
    if (message.sender_id !== context.userId && conversation.created_by !== context.userId) {
      throw forbidden('Only the sender or conversation creator can delete this message', 'MESSAGE_DELETE_FORBIDDEN')
    }

    await db('messages').where({ id: msgId, conversation_id: convId }).update({
      is_deleted: true,
      content: 'This message was deleted',
    })

    const deleted = await getMessageById(msgId)
    if (!deleted) throw notFound('Message not found', 'MESSAGE_NOT_FOUND')
    getIo().to(`conv:${convId}`).emit('conv:message:deleted', { conversationId: convId, messageId: msgId })
    return toMessage(deleted)
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
            sender_id,
            created_at
          FROM messages
          ORDER BY conversation_id, created_at DESC
        ) AS last_message`,
      ),
      'last_message.conversation_id',
      'conversations.id',
    )
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
      'current_participant.joined_at',
      'last_message.id as last_message_id',
      'last_message.content as last_message_content',
      'last_message.type as last_message_type',
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
    )
}

function messageSelectQuery() {
  return db('messages')
    .join('users', 'users.id', 'messages.sender_id')
    .join('profiles', 'profiles.user_id', 'users.id')
    .select<MessageRow[]>(
      'messages.id',
      'messages.conversation_id',
      'messages.sender_id',
      'messages.content',
      'messages.media_urls',
      'messages.reply_to_id',
      'messages.type',
      'messages.is_deleted',
      'messages.created_at',
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

async function getConversationParticipantIds(convId: string) {
  const rows = await db('conversation_participants').select<{ user_id: string }[]>('user_id').where({ conversation_id: convId })
  return rows.map((row) => row.user_id)
}

async function getMessageById(messageId: string) {
  return messageSelectQuery().where('messages.id', messageId).first<MessageRow>()
}

async function getMessageOwner(convId: string, messageId: string) {
  return db('messages')
    .select<MessageOwnerRow[]>('id', 'conversation_id', 'sender_id')
    .where({ id: messageId, conversation_id: convId })
    .first()
}

async function enqueueMessageNotifications(
  context: AuthContext,
  convId: string,
  userIds: string[],
  message: ReturnType<typeof toMessage>,
) {
  await Promise.all(
    userIds.map((userId) =>
      notificationQueue.add({
        universityId: context.universityId,
        userId,
        type: 'message:new',
        payload: {
          convId,
          messageId: message.id,
          senderId: context.userId,
          preview: message.content,
        },
      }),
    ),
  )
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
    lastMessage: row.last_message_id
      ? {
          id: row.last_message_id,
          content: row.last_message_content,
          body: row.last_message_content ?? '',
          type: row.last_message_type,
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

function toMessage(row: MessageRow) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    content: row.content,
    body: row.content ?? '',
    mediaUrls: row.media_urls ?? [],
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
