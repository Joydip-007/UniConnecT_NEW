"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messagesService = exports.MessagesService = void 0;
const db_1 = require("../../config/db");
const notification_queue_1 = require("../../queues/notification.queue");
const socket_1 = require("../../socket");
const errors_1 = require("../../utils/errors");
class MessagesService {
    async listConversations(context) {
        const rows = (await conversationListQuery(context)
            .orderByRaw('COALESCE(last_message.created_at, conversations.created_at) DESC'));
        const participants = await getParticipantsForConversations(rows.map((row) => row.id));
        return rows.map((row) => toConversation(row, participants.get(row.id) ?? [], context.userId));
    }
    async createConversation(context, input) {
        if (input.is_group) {
            return { data: await this.createGroupConversation(context, input), created: true };
        }
        if (!input.participantId) {
            throw (0, errors_1.badRequest)('participantId is required for direct conversations', 'PARTICIPANT_REQUIRED');
        }
        if (input.participantId === context.userId) {
            throw (0, errors_1.badRequest)('You cannot create a conversation with yourself', 'SELF_CONVERSATION_NOT_ALLOWED');
        }
        await assertUsersInUniversity([input.participantId], context.universityId);
        const existing = await findDirectConversation(context.userId, input.participantId, context.universityId);
        if (existing)
            return { data: await this.getConversation(context, existing.id), created: false };
        const conversationId = await db_1.db.transaction(async (trx) => {
            const [conversation] = await trx('conversations')
                .insert({
                university_id: context.universityId,
                is_group: false,
                created_by: context.userId,
            })
                .returning('id');
            if (!conversation)
                throw (0, errors_1.badRequest)('Conversation could not be created', 'CONVERSATION_CREATE_FAILED');
            await trx('conversation_participants').insert([
                { conversation_id: conversation.id, user_id: context.userId },
                { conversation_id: conversation.id, user_id: input.participantId },
            ]);
            return conversation.id;
        });
        return { data: await this.getConversation(context, conversationId), created: true };
    }
    async getConversation(context, convId) {
        const row = await conversationListQuery(context).where('conversations.id', convId).first();
        if (!row)
            throw (0, errors_1.notFound)('Conversation not found', 'CONVERSATION_NOT_FOUND');
        const participants = await getParticipantsForConversations([row.id]);
        return toConversation(row, participants.get(row.id) ?? [], context.userId);
    }
    async updateConversation(context, convId, input) {
        const conversation = await assertParticipant(context, convId);
        if (!conversation.is_group) {
            throw (0, errors_1.badRequest)('Only group conversations can be updated', 'DIRECT_CONVERSATION_UPDATE_FORBIDDEN');
        }
        await (0, db_1.db)('conversations')
            .where({ id: convId, university_id: context.universityId })
            .update({
            ...pickDefined({
                name: input.name,
                avatar_url: input.avatar_url,
            }),
        });
        return this.getConversation(context, convId);
    }
    async leaveConversation(context, convId) {
        await assertParticipant(context, convId);
        await (0, db_1.db)('conversation_participants').where({ conversation_id: convId, user_id: context.userId }).delete();
        return { left: true };
    }
    async listMessages(context, convId, query) {
        await assertParticipant(context, convId);
        const messageQuery = messageSelectQuery()
            .where('messages.conversation_id', convId)
            .orderBy('messages.created_at', 'desc')
            .limit(query.limit);
        if (query.before) {
            const before = await (0, db_1.db)('messages')
                .select('created_at')
                .where({ id: query.before, conversation_id: convId })
                .first();
            if (!before)
                throw (0, errors_1.notFound)('Message cursor not found', 'MESSAGE_CURSOR_NOT_FOUND');
            messageQuery.andWhere('messages.created_at', '<', before.created_at);
        }
        const rows = (await messageQuery).reverse();
        await (0, db_1.db)('conversation_participants')
            .where({ conversation_id: convId, user_id: context.userId })
            .update({ last_read_at: db_1.db.fn.now() });
        return rows.map(toMessage);
    }
    async createMessage(context, convId, input) {
        await assertParticipant(context, convId);
        if (input.reply_to_id) {
            const reply = await (0, db_1.db)('messages').where({ id: input.reply_to_id, conversation_id: convId }).first();
            if (!reply)
                throw (0, errors_1.notFound)('Reply message not found', 'REPLY_MESSAGE_NOT_FOUND');
        }
        const messageId = await db_1.db.transaction(async (trx) => {
            const [message] = await trx('messages')
                .insert({
                conversation_id: convId,
                sender_id: context.userId,
                content: input.content ?? null,
                media_urls: input.media_urls,
                reply_to_id: input.reply_to_id ?? null,
                type: input.type,
            })
                .returning('id');
            if (!message)
                throw (0, errors_1.badRequest)('Message could not be created', 'MESSAGE_CREATE_FAILED');
            return message.id;
        });
        const message = await getMessageById(messageId);
        if (!message)
            throw (0, errors_1.notFound)('Message not found', 'MESSAGE_NOT_FOUND');
        const mapped = toMessage(message);
        const lastMessage = toLastMessage(message);
        const io = (0, socket_1.getIo)();
        io.to(`conv:${convId}`).emit('message:new', mapped);
        io.to(`conv:${convId}`).emit('conv:message:new', { conversationId: convId, message: mapped });
        io.to(`conv:${convId}`).emit('conversation:updated', { convId, lastMessage });
        const participantIds = await getConversationParticipantIds(convId);
        await enqueueMessageNotifications(context, convId, participantIds.filter((userId) => userId !== context.userId), mapped);
        return mapped;
    }
    async updateMessage(context, convId, msgId, input) {
        await assertParticipant(context, convId);
        const message = await getMessageOwner(convId, msgId);
        if (!message)
            throw (0, errors_1.notFound)('Message not found', 'MESSAGE_NOT_FOUND');
        if (message.sender_id !== context.userId) {
            throw (0, errors_1.forbidden)('Only the sender can edit this message', 'MESSAGE_SENDER_REQUIRED');
        }
        await (0, db_1.db)('messages').where({ id: msgId, conversation_id: convId }).update({ content: input.content });
        const updated = await getMessageById(msgId);
        if (!updated)
            throw (0, errors_1.notFound)('Message not found', 'MESSAGE_NOT_FOUND');
        return toMessage(updated);
    }
    async deleteMessage(context, convId, msgId) {
        const conversation = await assertParticipant(context, convId);
        const message = await getMessageOwner(convId, msgId);
        if (!message)
            throw (0, errors_1.notFound)('Message not found', 'MESSAGE_NOT_FOUND');
        if (message.sender_id !== context.userId && conversation.created_by !== context.userId) {
            throw (0, errors_1.forbidden)('Only the sender or conversation creator can delete this message', 'MESSAGE_DELETE_FORBIDDEN');
        }
        await (0, db_1.db)('messages').where({ id: msgId, conversation_id: convId }).update({
            is_deleted: true,
            content: 'This message was deleted',
        });
        const deleted = await getMessageById(msgId);
        if (!deleted)
            throw (0, errors_1.notFound)('Message not found', 'MESSAGE_NOT_FOUND');
        (0, socket_1.getIo)().to(`conv:${convId}`).emit('conv:message:deleted', { conversationId: convId, messageId: msgId });
        return toMessage(deleted);
    }
    async markRead(context, convId) {
        await assertParticipant(context, convId);
        const readAt = new Date();
        await (0, db_1.db)('conversation_participants')
            .where({ conversation_id: convId, user_id: context.userId })
            .update({ last_read_at: readAt });
        const payload = { userId: context.userId, convId, readAt };
        const io = (0, socket_1.getIo)();
        io.to(`conv:${convId}`).emit('message:read', payload);
        io.to(`conv:${convId}`).emit('conv:read:ack', { conversationId: convId, userId: context.userId, readAt });
        return payload;
    }
    async createGroupConversation(context, input) {
        if (!input.name)
            throw (0, errors_1.badRequest)('Group conversations require a name', 'CONVERSATION_NAME_REQUIRED');
        const participantIds = uniqueIds([context.userId, ...(input.participantIds ?? []), input.participantId].filter(isString));
        if (participantIds.length < 2) {
            throw (0, errors_1.badRequest)('Group conversations require at least two participants', 'GROUP_PARTICIPANTS_REQUIRED');
        }
        await assertUsersInUniversity(participantIds.filter((userId) => userId !== context.userId), context.universityId);
        const conversationId = await db_1.db.transaction(async (trx) => {
            const [conversation] = await trx('conversations')
                .insert({
                university_id: context.universityId,
                name: input.name,
                is_group: true,
                created_by: context.userId,
            })
                .returning('id');
            if (!conversation)
                throw (0, errors_1.badRequest)('Conversation could not be created', 'CONVERSATION_CREATE_FAILED');
            await trx('conversation_participants').insert(participantIds.map((userId) => ({
                conversation_id: conversation.id,
                user_id: userId,
            })));
            return conversation.id;
        });
        return this.getConversation(context, conversationId);
    }
}
exports.MessagesService = MessagesService;
exports.messagesService = new MessagesService();
function conversationListQuery(context) {
    return (0, db_1.db)('conversations')
        .join('conversation_participants as current_participant', function joinCurrentParticipant() {
        this.on('current_participant.conversation_id', '=', 'conversations.id').andOn('current_participant.user_id', '=', db_1.db.raw('?', [context.userId]));
    })
        .leftJoin(db_1.db.raw(`(
          SELECT DISTINCT ON (conversation_id)
            id,
            conversation_id,
            content,
            type,
            sender_id,
            created_at
          FROM messages
          ORDER BY conversation_id, created_at DESC
        ) AS last_message`), 'last_message.conversation_id', 'conversations.id')
        .where('conversations.university_id', context.universityId)
        .select('conversations.id', 'conversations.university_id', 'conversations.name', 'conversations.is_group', 'conversations.avatar_url', 'conversations.created_by', 'conversations.created_at', 'current_participant.last_read_at', 'current_participant.is_muted', 'current_participant.joined_at', 'last_message.id as last_message_id', 'last_message.content as last_message_content', 'last_message.type as last_message_type', 'last_message.sender_id as last_message_sender_id', 'last_message.created_at as last_message_created_at', db_1.db.raw(`(
          SELECT COUNT(*)::int
          FROM messages unread_messages
          WHERE unread_messages.conversation_id = conversations.id
            AND unread_messages.sender_id <> ?
            AND unread_messages.created_at > COALESCE(current_participant.last_read_at, current_participant.joined_at)
        ) AS unread_count`, [context.userId]));
}
function messageSelectQuery() {
    return (0, db_1.db)('messages')
        .join('users', 'users.id', 'messages.sender_id')
        .join('profiles', 'profiles.user_id', 'users.id')
        .select('messages.id', 'messages.conversation_id', 'messages.sender_id', 'messages.content', 'messages.media_urls', 'messages.reply_to_id', 'messages.type', 'messages.is_deleted', 'messages.created_at', 'users.email as sender_email', 'users.role as sender_role', 'profiles.full_name as sender_full_name', 'profiles.avatar_url as sender_avatar_url', 'profiles.headline as sender_headline');
}
async function assertParticipant(context, convId) {
    const conversation = await (0, db_1.db)('conversations')
        .join('conversation_participants', 'conversation_participants.conversation_id', 'conversations.id')
        .select('conversations.id', 'conversations.university_id', 'conversations.name', 'conversations.is_group', 'conversations.avatar_url', 'conversations.created_by', 'conversations.created_at', 'conversation_participants.last_read_at', 'conversation_participants.is_muted', 'conversation_participants.joined_at')
        .where({
        'conversations.id': convId,
        'conversations.university_id': context.universityId,
        'conversation_participants.user_id': context.userId,
    })
        .first();
    if (!conversation)
        throw (0, errors_1.notFound)('Conversation not found', 'CONVERSATION_NOT_FOUND');
    return conversation;
}
async function assertUsersInUniversity(userIds, universityId) {
    if (userIds.length === 0)
        return;
    const rows = await (0, db_1.db)('users').select('id', 'university_id').whereIn('id', userIds).andWhere('university_id', universityId);
    if (rows.length !== userIds.length) {
        throw (0, errors_1.notFound)('One or more users were not found', 'USER_NOT_FOUND');
    }
}
async function findDirectConversation(userId, participantId, universityId) {
    return (0, db_1.db)('conversations')
        .join('conversation_participants as participant_a', 'participant_a.conversation_id', 'conversations.id')
        .join('conversation_participants as participant_b', 'participant_b.conversation_id', 'conversations.id')
        .where({
        'conversations.university_id': universityId,
        'conversations.is_group': false,
        'participant_a.user_id': userId,
        'participant_b.user_id': participantId,
    })
        .whereRaw('(SELECT COUNT(*) FROM conversation_participants cp WHERE cp.conversation_id = conversations.id) = 2')
        .select('conversations.id')
        .first();
}
async function getParticipantsForConversations(conversationIds) {
    const participantMap = new Map();
    if (conversationIds.length === 0)
        return participantMap;
    const rows = (await (0, db_1.db)('conversation_participants')
        .join('users', 'users.id', 'conversation_participants.user_id')
        .join('profiles', 'profiles.user_id', 'users.id')
        .select('conversation_participants.conversation_id', 'conversation_participants.user_id', 'conversation_participants.last_read_at', 'conversation_participants.is_muted', 'conversation_participants.joined_at', 'users.email', 'users.role', 'profiles.full_name', 'profiles.avatar_url', 'profiles.headline')
        .whereIn('conversation_participants.conversation_id', conversationIds));
    for (const row of rows) {
        const participants = participantMap.get(row.conversation_id) ?? [];
        participants.push(toParticipant(row));
        participantMap.set(row.conversation_id, participants);
    }
    return participantMap;
}
async function getConversationParticipantIds(convId) {
    const rows = await (0, db_1.db)('conversation_participants').select('user_id').where({ conversation_id: convId });
    return rows.map((row) => row.user_id);
}
async function getMessageById(messageId) {
    return messageSelectQuery().where('messages.id', messageId).first();
}
async function getMessageOwner(convId, messageId) {
    return (0, db_1.db)('messages')
        .select('id', 'conversation_id', 'sender_id')
        .where({ id: messageId, conversation_id: convId })
        .first();
}
async function enqueueMessageNotifications(context, convId, userIds, message) {
    await Promise.all(userIds.map((userId) => notification_queue_1.notificationQueue.add({
        universityId: context.universityId,
        userId,
        type: 'message:new',
        payload: {
            convId,
            messageId: message.id,
            senderId: context.userId,
            preview: message.content,
        },
    })));
}
function toConversation(row, participants, currentUserId) {
    const otherParticipants = participants.filter((participant) => participant.userId !== currentUserId);
    const otherParticipant = otherParticipants[0]?.user;
    return {
        id: row.id,
        universityId: row.university_id,
        name: row.name,
        isGroup: row.is_group,
        type: row.is_group ? 'group' : 'dm',
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
                fullName: otherParticipant.fullName,
                role: otherParticipant.role,
                profile: {
                    avatarUrl: otherParticipant.avatarUrl,
                    headline: otherParticipant.headline,
                },
            }
            : null,
    };
}
function toParticipant(row) {
    return {
        userId: row.user_id,
        lastReadAt: row.last_read_at,
        isMuted: row.is_muted,
        joinedAt: row.joined_at,
        user: {
            id: row.user_id,
            email: row.email,
            role: row.role,
            fullName: row.full_name,
            avatarUrl: row.avatar_url,
            headline: row.headline,
        },
    };
}
function toMessage(row) {
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
            fullName: row.sender_full_name,
            avatarUrl: row.sender_avatar_url,
            headline: row.sender_headline,
            profile: {
                avatarUrl: row.sender_avatar_url,
            },
        },
    };
}
function toLastMessage(row) {
    return {
        id: row.id,
        content: row.content,
        type: row.type,
        senderId: row.sender_id,
        createdAt: row.created_at,
    };
}
function uniqueIds(values) {
    return [...new Set(values)];
}
function isString(value) {
    return typeof value === 'string';
}
function pickDefined(value) {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
