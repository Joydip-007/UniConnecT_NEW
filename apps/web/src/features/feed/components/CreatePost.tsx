import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/stores/authStore'
import { Avatar } from '@/components/Avatar'
import { PrimaryBtn, GhostBtn } from '@/components/Button'

interface PostAuthor {
  id: string
  fullName: string
  profile: { avatarUrl: string | null; headline: string | null; department: string | null }
}

export interface Post {
  id: string
  type: 'post' | 'announcement' | 'event_promo'
  content: string
  mediaUrls: string[]
  author: PostAuthor
  isPinned: boolean
  viewCount: number
  reactionCounts: { like: number; love: number; insightful: number; celebrate: number }
  myReaction: string | null
  commentCount: number
  isSaved: boolean
  poll: null
  createdAt: string
}

interface FeedPage {
  items: Post[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export const FEED_QUERY_KEY = ['posts', 'feed'] as const

const ACTION_BUTTONS = [
  { label: 'Photo', dot: 'var(--uc-mint)' },
  { label: 'Poll', dot: 'var(--uc-orange)' },
  { label: 'Event', dot: 'var(--uc-cyan)' },
  { label: 'Job', dot: 'var(--uc-indigo)' },
] as const

const AVATAR_PALETTE = [
  'var(--uc-indigo)',
  'var(--uc-orange)',
  'var(--uc-cyan)',
  'var(--uc-mint)',
]

function seedColor(id: string): string {
  const sum = [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length]
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

export function CreatePost() {
  const user = useAuthStore((s) => s.user)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const mutation = useMutation({
    mutationFn: (content: string) =>
      api
        .post<{ data: Post }>('/posts', {
          type: 'post',
          content,
          mediaUrls: [],
          groupId: null,
          poll: null,
        })
        .then((r) => r.data.data),
    onSuccess: (newPost) => {
      queryClient.setQueryData<InfiniteData<FeedPage>>(FEED_QUERY_KEY, (old) => {
        if (!old || old.pages.length === 0) return old
        const [first, ...rest] = old.pages as [FeedPage, ...FeedPage[]]
        return {
          ...old,
          pages: [{ ...first, items: [newPost, ...first.items], total: first.total + 1 }, ...rest],
        }
      })
      setText('')
      setOpen(false)
    },
  })

  function handleTextareaInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  function handleOpen() {
    setOpen(true)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  function handleCancel() {
    setText('')
    setOpen(false)
  }

  function handleSubmit() {
    const trimmed = text.trim()
    if (!trimmed || mutation.isPending) return
    mutation.mutate(trimmed)
  }

  if (!user) return null

  const name = user.profile.fullName ?? ''
  const color = seedColor(user.id)
  const avatarInitials = getInitials(name)
  const firstName = name.split(' ')[0] ?? ''

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
      }}
    >
      {!open ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar initials={avatarInitials} color={color} size={40} />
          <button
            onClick={handleOpen}
            style={{
              flex: 1,
              height: 40,
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-hover)',
              borderRadius: 'var(--r-pill)',
              cursor: 'text',
              display: 'flex',
              alignItems: 'center',
              paddingInline: 16,
              color: 'var(--text-tertiary)',
              fontSize: 14,
              fontWeight: 400,
              textAlign: 'left',
            }}
          >
            What's on your mind, {firstName}?
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar initials={avatarInitials} color={color} size={38} />
            <div>
              <p
                style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}
              >
                {name}
              </p>
              {user.profile.headline && (
                <p
                  style={{
                    margin: 0,
                    marginTop: 2,
                    fontSize: 12,
                    fontWeight: 400,
                    color: 'var(--text-secondary)',
                  }}
                >
                  {user.profile.headline}
                </p>
              )}
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextareaInput}
            placeholder="What's on your mind?"
            rows={3}
            style={{
              width: '100%',
              minHeight: 80,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              color: 'var(--text-primary)',
              fontSize: 15,
              fontWeight: 400,
              fontFamily: 'inherit',
              lineHeight: 1.6,
              overflowY: 'hidden',
              boxSizing: 'border-box',
            }}
          />

          <div
            style={{
              borderTop: '0.5px solid var(--border-default)',
              paddingTop: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ACTION_BUTTONS.map(({ label, dot }) => (
                <ActionChip key={label} label={label} dot={dot} />
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <GhostBtn onClick={handleCancel} disabled={mutation.isPending}>
                Cancel
              </GhostBtn>
              <PrimaryBtn
                onClick={handleSubmit}
                disabled={text.trim().length === 0 || mutation.isPending}
              >
                {mutation.isPending ? 'Posting…' : 'Post'}
              </PrimaryBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface ActionChipProps {
  label: string
  dot: string
}

function ActionChip({ label, dot }: ActionChipProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 12px',
        background: hovered ? 'var(--surface-raised)' : 'transparent',
        border: `0.5px solid ${hovered ? 'var(--border-hover)' : 'var(--border-default)'}`,
        borderRadius: 'var(--r-pill)',
        color: 'var(--text-secondary)',
        fontSize: 12,
        fontWeight: 400,
        cursor: 'pointer',
        transition: 'background 150ms, border-color 150ms',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: dot,
          flexShrink: 0,
        }}
      />
      {label}
    </button>
  )
}
