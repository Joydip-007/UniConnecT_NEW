import type { ChatTheme, MessageAttachment, UserRole } from '@uniconnect/shared'

export interface Participant {
  id: string
  fullName: string
  role: 'student' | 'alumni' | 'faculty' | 'admin'
  profile: {
    avatarUrl: string | null
    headline: string | null
  }
}

/** One member of a thread, as `GET /conversations` returns it (read state included). */
export interface ConversationMember {
  userId: string
  lastReadAt: string | null
  isMuted: boolean
  joinedAt: string
  user: {
    id: string
    role: UserRole
    fullName: string
    avatarUrl: string | null
    headline: string | null
  }
}

export interface LastMessage {
  body: string
  sentAt: string
  senderId: string
  contentType?: MessageContentType | null
  viewOnce?: boolean
  isDeleted?: boolean
}

/** The study/club group a group chat belongs to (`groups.chat_conversation_id`). */
export interface LinkedGroup {
  id: string
  name: string
  type: string
  memberCount: number
}

export interface Conversation {
  id: string
  type: 'direct' | 'group' | 'mentorship'
  name: string | null
  avatarUrl?: string | null
  otherParticipant: Participant | null
  lastMessage: LastMessage | null
  unreadCount: number
  createdAt?: string
  participants?: ConversationMember[]
  participantCount?: number
  isPinned?: boolean
  isMuted?: boolean
  chatTheme?: ChatTheme
  quickEmoji?: string
  isRequest?: boolean
  group?: LinkedGroup | null
}

export type MessageContentType = 'text' | 'image' | 'file' | 'system' | 'sticker'

export interface MessageSender {
  id: string
  fullName: string
  /** Absent on optimistic (pending) messages, which are always the viewer's own. */
  role?: UserRole
  profile: { avatarUrl: string | null }
}

export interface ReplyContext {
  id: string
  body: string
  senderName: string
}

export type MessageReactions = Record<string, { userId: string; fullName: string }[]>

export interface Message {
  id: string
  conversationId: string
  senderId: string
  sender: MessageSender
  body: string
  sentAt: string
  isDeleted: boolean
  replyTo: ReplyContext | null
  contentType?: MessageContentType
  stickerUrl?: string | null
  attachments?: MessageAttachment[]
  mediaUrls?: string[]
  /** Present only on view-once photos; `opened` is from the viewer's side. */
  viewOnce?: { opened: boolean } | null
  editedAt?: string | null
  reactions?: MessageReactions
}

export interface MessagesPage {
  items: Message[]
  nextCursor: string | null
}

export interface CommonGroup {
  id: string
  name: string
  type: string
  avatarUrl: string | null
  memberCount: number
}

export interface SharedFile extends MessageAttachment {
  messageId: string
  senderId: string
  sentAt: string
}
