import { describe, expect, it } from 'vitest'
import type { Conversation, ConversationMember, Message } from './types'
import {
  buildThreadRows,
  fileMeta,
  fileTone,
  formatBytes,
  listTime,
  reactionSummary,
  snippet,
} from './threadModel'

const ME = 'me-id'
const THEM = 'them-id'

function msg(id: string, senderId: string, sentAt: string, extra: Partial<Message> = {}): Message {
  return {
    id,
    conversationId: 'c1',
    senderId,
    sender: { id: senderId, fullName: senderId === ME ? 'Me Person' : 'Nusrat Jahan', profile: { avatarUrl: null } },
    body: 'hi',
    sentAt,
    isDeleted: false,
    replyTo: null,
    ...extra,
  }
}

function member(userId: string, lastReadAt: string | null): ConversationMember {
  return {
    userId,
    lastReadAt,
    isMuted: false,
    joinedAt: '2026-01-01T00:00:00Z',
    user: { id: userId, role: 'student', fullName: 'Tahsin Alam', avatarUrl: null, headline: null },
  }
}

describe('listTime', () => {
  const now = new Date('2026-09-25T12:00:00')
  it('uses the design’s compact stamps', () => {
    expect(listTime('2026-09-25T11:59:40', now)).toBe('Just now')
    expect(listTime('2026-09-25T11:52:00', now)).toBe('8m')
    expect(listTime('2026-09-25T09:00:00', now)).toBe('3h')
    expect(listTime('2026-09-24T18:00:00', now)).toBe('Yesterday')
    expect(listTime('2026-09-22T18:00:00', now)).toBe('Tue')
    expect(listTime('2026-08-06T18:00:00', now)).toBe('Aug 6')
  })
})

describe('buildThreadRows', () => {
  const messages = [
    msg('1', THEM, '2026-09-24T10:00:00'),
    msg('2', ME, '2026-09-25T09:00:00'),
    msg('3', ME, '2026-09-25T09:01:00'),
    msg('4', THEM, '2026-09-25T09:05:00'),
    msg('5', THEM, '2026-09-25T09:06:00'),
  ]

  it('inserts a divider per day and groups runs by sender', () => {
    const rows = buildThreadRows(messages, ME, { isGroup: false, others: [] })
    expect(rows.map((r) => (r.kind === 'day' ? 'day' : r.key))).toEqual(['day', '1', 'day', '2', '3', '4', '5'])
    const byKey = Object.fromEntries(rows.filter((r) => r.kind === 'msg').map((r) => [r.key, r]))
    expect(byKey['2']).toMatchObject({ mine: true, lastOfRun: false })
    expect(byKey['3']).toMatchObject({ mine: true, lastOfRun: true })
    expect(byKey['4']).toMatchObject({ showAvatar: false, lastOfRun: false })
    expect(byKey['5']).toMatchObject({ showAvatar: true, lastOfRun: true })
  })

  it('marks my last-of-run bubble read only once another participant read past it', () => {
    const unread = buildThreadRows(messages, ME, { isGroup: false, others: [member(THEM, '2026-09-25T09:00:30')] })
    expect(unread.find((r) => r.key === '3')).toMatchObject({ read: false })
    const read = buildThreadRows(messages, ME, { isGroup: false, others: [member(THEM, '2026-09-25T09:02:00')] })
    expect(read.find((r) => r.key === '3')).toMatchObject({ read: true })
  })

  it('names the sender on the first bubble of a run in groups only', () => {
    const group = buildThreadRows(messages, ME, { isGroup: true, others: [] })
    expect(group.find((r) => r.key === '4')).toMatchObject({ showSender: true })
    expect(group.find((r) => r.key === '5')).toMatchObject({ showSender: false })
    const dm = buildThreadRows(messages, ME, { isGroup: false, others: [] })
    expect(dm.find((r) => r.key === '4')).toMatchObject({ showSender: false })
  })
})

describe('snippet', () => {
  const base: Conversation = {
    id: 'c1',
    type: 'group',
    name: 'CSE 2022 · batch group',
    otherParticipant: null,
    unreadCount: 0,
    participants: [member(THEM, null)],
    lastMessage: { body: 'registration closes Sunday night', sentAt: '2026-09-25T09:00:00Z', senderId: THEM },
  }

  it('prefixes the sender’s first name in groups and "You" for my own', () => {
    expect(snippet(base, ME)).toBe('Tahsin: registration closes Sunday night')
    expect(snippet({ ...base, lastMessage: { ...base.lastMessage!, senderId: ME } }, ME)).toBe(
      'You: registration closes Sunday night',
    )
  })

  it('describes non-text messages', () => {
    const photo = { ...base, type: 'direct' as const, lastMessage: { ...base.lastMessage!, body: '', contentType: 'image' as const } }
    expect(snippet(photo, ME)).toBe('Sent a photo')
    const sticker = { ...photo, lastMessage: { ...photo.lastMessage, contentType: 'sticker' as const } }
    expect(snippet(sticker, ME)).toBe('Sent a sticker')
  })
})

describe('files and reactions', () => {
  it('formats sizes and picks the design’s tile tone', () => {
    expect(formatBytes(317_440)).toBe('310 KB')
    expect(formatBytes(1_153_434)).toBe('1.1 MB')
    expect(fileMeta('CV-draft-v2.pdf', 317_440)).toBe('PDF · 310 KB')
    expect(fileTone('dataset-corrected.csv')).toBe('sheet')
    expect(fileTone('lab-sheet.pdf')).toBe('pdf')
    expect(fileTone('week9-plots.ipynb')).toBe('doc')
  })

  it('summarises reactions most-used first', () => {
    expect(
      reactionSummary({
        love: [{ userId: 'a', fullName: 'A' }],
        like: [
          { userId: 'b', fullName: 'B' },
          { userId: 'c', fullName: 'C' },
        ],
      }),
    ).toEqual({ emojis: '👍❤️', count: 3 })
    expect(reactionSummary({})).toBeNull()
  })
})
