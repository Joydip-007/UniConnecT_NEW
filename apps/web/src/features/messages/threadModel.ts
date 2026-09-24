import { differenceInCalendarDays, format, isToday, isYesterday, parseISO } from 'date-fns'
import type { ChatTheme } from '@uniconnect/shared'
import type { MessageReactionKey } from '@/components/emoji/reactionConfig'
import type { Conversation, ConversationMember, Message, MessageReactions } from './types'
import { initials, seedColor } from './utils'

// Pure view-model helpers for the Messages page (Messages Page.dc.html). No React,
// no fetching — the components and their tests both lean on these.

export function safeDate(iso: string | null | undefined): Date {
  if (!iso) return new Date(0)
  const d = parseISO(String(iso))
  return isNaN(d.getTime()) ? new Date(0) : d
}

// ── Conversation identity ─────────────────────────────────────────────────────

export function isOneToOne(conv: Pick<Conversation, 'type'>): boolean {
  return conv.type === 'direct' || conv.type === 'mentorship'
}

export function conversationTitle(conv: Conversation): string {
  if (isOneToOne(conv)) return conv.otherParticipant?.fullName ?? 'Unknown'
  return conv.name ?? conv.group?.name ?? 'Group conversation'
}

export function conversationAvatar(conv: Conversation) {
  const title = conversationTitle(conv)
  return {
    src: isOneToOne(conv) ? (conv.otherParticipant?.profile.avatarUrl ?? null) : null,
    initials: initials(title),
    color: seedColor(isOneToOne(conv) ? (conv.otherParticipant?.id ?? conv.id) : conv.id),
  }
}

export function memberCount(conv: Conversation): number {
  return conv.group?.memberCount ?? conv.participantCount ?? conv.participants?.length ?? 0
}

const GROUP_KIND_LABEL: Record<string, string> = {
  academic: 'academic group',
  department: 'department group',
  batch: 'batch group',
  club: 'club group',
  research: 'research group',
  interest: 'interest group',
}

/** Secondary line under the name in the details rail ("Mentor · …", "42 members · club group"). */
export function conversationSubtitle(conv: Conversation): string {
  if (isOneToOne(conv)) {
    const headline = conv.otherParticipant?.profile.headline
    const prefix = conv.type === 'mentorship' ? 'Mentor' : null
    return [prefix, headline].filter(Boolean).join(' · ')
  }
  const n = memberCount(conv)
  const kind = conv.group ? (GROUP_KIND_LABEL[conv.group.type] ?? 'group') : 'group chat'
  return `${n} member${n === 1 ? '' : 's'} · ${kind}`
}

/** The small intro above the first message. */
export function conversationIntro(conv: Conversation): string {
  if (conv.type === 'mentorship') {
    const headline = conv.otherParticipant?.profile.headline
    return headline ? `Your mentorship thread. ${headline}.` : 'Your mentorship thread.'
  }
  if (isOneToOne(conv)) {
    return conv.otherParticipant?.profile.headline ?? 'This is the start of your conversation.'
  }
  if (conv.group) return `Group chat for ${conv.group.name}. Only members of the group are here.`
  return 'Group chat. Only the people added to it are here.'
}

// ── Time ──────────────────────────────────────────────────────────────────────

/** Conversation-list stamp: "Just now", "8m", "3h", "Yesterday", "Mon", "Aug 6". */
export function listTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return ''
  const d = safeDate(iso)
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60_000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m`
  if (differenceInCalendarDays(now, d) === 0) return `${Math.floor(diffMin / 60)}h`
  if (differenceInCalendarDays(now, d) === 1) return 'Yesterday'
  if (differenceInCalendarDays(now, d) < 7) return format(d, 'EEE')
  return format(d, now.getFullYear() === d.getFullYear() ? 'MMM d' : 'MMM d, yyyy')
}

/** In-bubble stamp: "3:10 pm". */
export function bubbleTime(iso: string | null | undefined): string {
  return format(safeDate(iso), 'h:mm a').toLowerCase()
}

/** Day divider: "Today", "Yesterday", "Aug 6". */
export function dayLabel(iso: string | null | undefined, now: Date = new Date()): string {
  const d = safeDate(iso)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, now.getFullYear() === d.getFullYear() ? 'MMM d' : 'MMM d, yyyy')
}

// ── List snippet ──────────────────────────────────────────────────────────────

export function snippet(conv: Conversation, myUserId: string | undefined): string {
  const last = conv.lastMessage
  if (!last) return 'No messages yet'

  let text: string
  if (last.isDeleted) text = 'Message removed'
  else if (last.contentType === 'sticker') text = 'Sent a sticker'
  else if (last.viewOnce) text = 'Sent a photo'
  else if (last.contentType === 'image' && !last.body) text = 'Sent a photo'
  else if (last.contentType === 'file' && !last.body) text = 'Sent a file'
  else text = last.body || 'Sent a message'

  if (last.senderId === myUserId) return `You: ${text}`
  if (!isOneToOne(conv)) {
    const sender = conv.participants?.find((p) => p.userId === last.senderId)
    const first = sender?.user.fullName.split(' ')[0]
    if (first) return `${first}: ${text}`
  }
  return text
}

// ── Thread rows ───────────────────────────────────────────────────────────────

export type ThreadRow =
  | { kind: 'day'; key: string; label: string }
  | {
      kind: 'msg'
      key: string
      message: Message
      mine: boolean
      /** Theirs only: the avatar sits on the last bubble of a run. */
      showAvatar: boolean
      /** Group threads: the sender's name heads the first bubble of a run. */
      showSender: boolean
      /** Last bubble of a run — gets the small tail corner and a wider gap after it. */
      lastOfRun: boolean
      /** Mine, last of a run, and some other participant has read up to it. */
      read: boolean
    }

function dayKey(iso: string): string {
  return format(safeDate(iso), 'yyyy-MM-dd')
}

export function buildThreadRows(
  messages: Message[],
  myUserId: string | undefined,
  options: { isGroup: boolean; others: ConversationMember[] },
): ThreadRow[] {
  const rows: ThreadRow[] = []
  const readMarks = options.others
    .map((o) => (o.lastReadAt ? safeDate(o.lastReadAt).getTime() : 0))
    .filter((t) => t > 0)

  messages.forEach((m, i) => {
    const prev = messages[i - 1]
    const next = messages[i + 1]
    const day = dayKey(m.sentAt)
    if (!prev || dayKey(prev.sentAt) !== day) {
      rows.push({ kind: 'day', key: `day-${day}`, label: dayLabel(m.sentAt) })
    }
    const samePrev = !!prev && prev.senderId === m.senderId && dayKey(prev.sentAt) === day
    const sameNext = !!next && next.senderId === m.senderId && dayKey(next.sentAt) === day
    const mine = m.senderId === myUserId
    const sentAt = safeDate(m.sentAt).getTime()
    rows.push({
      kind: 'msg',
      key: m.id,
      message: m,
      mine,
      showAvatar: !mine && !sameNext,
      showSender: !mine && options.isGroup && !samePrev,
      lastOfRun: !sameNext,
      read: mine && !sameNext && !m.isDeleted && readMarks.some((t) => t >= sentAt),
    })
  })
  return rows
}

// ── Chat theme ────────────────────────────────────────────────────────────────

export const CHAT_THEMES: { key: ChatTheme; label: string; color: string }[] = [
  { key: 'indigo', label: 'Indigo', color: 'var(--uc-indigo)' },
  { key: 'mint', label: 'Mint', color: 'var(--uc-mint)' },
  { key: 'amber', label: 'Amber', color: 'var(--uc-amber)' },
  { key: 'cyan', label: 'Cyan', color: 'var(--uc-cyan)' },
  { key: 'rose', label: 'Rose', color: 'var(--uc-orange)' },
]

export function chatTheme(key: ChatTheme | undefined) {
  return CHAT_THEMES.find((t) => t.key === key) ?? CHAT_THEMES[0]!
}

// ── Reactions ─────────────────────────────────────────────────────────────────

/** The six message reactions the API accepts, as the quick bar shows them. */
export const QUICK_REACTIONS: { key: MessageReactionKey; emoji: string; label: string }[] = [
  { key: 'like', emoji: '👍', label: 'Like' },
  { key: 'love', emoji: '❤️', label: 'Love' },
  { key: 'haha', emoji: '😂', label: 'Haha' },
  { key: 'care', emoji: '🤗', label: 'Care' },
  { key: 'wow', emoji: '😮', label: 'Wow' },
  { key: 'angry', emoji: '😡', label: 'Angry' },
]

const EMOJI_BY_KEY = new Map(QUICK_REACTIONS.map((r) => [r.key as string, r.emoji]))

/** One chip under a bubble: up to three emojis, most-used first, plus the total. */
export function reactionSummary(reactions: MessageReactions | undefined): { emojis: string; count: number } | null {
  if (!reactions) return null
  const entries = Object.entries(reactions).filter(([, users]) => users.length > 0)
  if (entries.length === 0) return null
  entries.sort((a, b) => b[1].length - a[1].length)
  return {
    emojis: entries
      .slice(0, 3)
      .map(([key]) => EMOJI_BY_KEY.get(key) ?? '')
      .join(''),
    count: entries.reduce((sum, [, users]) => sum + users.length, 0),
  }
}

export function myReaction(reactions: MessageReactions | undefined, myUserId: string | undefined): MessageReactionKey | null {
  if (!reactions || !myUserId) return null
  const hit = Object.entries(reactions).find(([, users]) => users.some((u) => u.userId === myUserId))
  return (hit?.[0] as MessageReactionKey | undefined) ?? null
}

// ── Files ─────────────────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function extension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export type FileTone = 'doc' | 'pdf' | 'sheet'

/** Which of the design's three file tiles a file gets (indigo doc, mint PDF, amber sheet). */
export function fileTone(name: string, mimeType?: string): FileTone {
  const ext = extension(name)
  if (ext === 'pdf' || mimeType === 'application/pdf') return 'pdf'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet'
  return 'doc'
}

const KIND_LABEL: Record<string, string> = {
  pdf: 'PDF',
  doc: 'Document',
  docx: 'Document',
  ppt: 'Slides',
  pptx: 'Slides',
  xls: 'Sheet',
  xlsx: 'Sheet',
  csv: 'Sheet',
  txt: 'Text',
  ipynb: 'Notebook',
  png: 'Image',
  jpg: 'Image',
  jpeg: 'Image',
  gif: 'Image',
  webp: 'Image',
}

/** "PDF · 310 KB". */
export function fileMeta(name: string, size: number): string {
  const ext = extension(name)
  return `${KIND_LABEL[ext] ?? (ext ? ext.toUpperCase() : 'File')} · ${formatBytes(size)}`
}
