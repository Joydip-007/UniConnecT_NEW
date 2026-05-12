import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import {
  Bookmark,
  Briefcase,
  Calendar,
  ExternalLink,
  MapPin,
  MessageCircle,
  Phone,
  ThumbsUp,
} from 'lucide-react'
import { api } from '@/lib/axios'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { GhostBtn, PrimaryBtn, ReactionBtn } from '@/components/Button'

// ── Types ─────────────────────────────────────────────────────────────────────

export type PostType =
  | 'post'
  | 'announcement'
  | 'event_promo'
  | 'poll'
  | 'job_promo'
  | 'lost_found'

export interface PostAuthor {
  id: string
  fullName: string
  role: 'student' | 'alumni' | 'staff' | 'admin'
  profile: {
    avatarUrl: string | null
    headline: string | null
    department: string | null
    batchYear: string | null
  }
}

export interface PollOption {
  id: string
  text: string
  voteCount: number
}

export interface FeedPoll {
  id: string
  question: string
  options: PollOption[]
  totalVotes: number
  myVote: string | null
  expiresAt: string | null
}

export interface JobEmbed {
  id: string
  title: string
  company: string
  location: string
  type: string
  logoUrl: string | null
}

export interface EventEmbed {
  id: string
  title: string
  coverUrl: string | null
  startsAt: string
  location: string
  isOnline: boolean
  myRsvp: 'going' | 'maybe' | 'not_going' | null
}

export interface LostFoundEmbed {
  id: string
  type: 'lost' | 'found'
  itemName: string
  description: string
  locationDetail: string
  contactInfo: string
  images: string[]
}

export interface FeedPost {
  id: string
  type: PostType
  content: string
  mediaUrls: string[]
  author: PostAuthor
  isPinned: boolean
  viewCount: number
  reactionCounts: { like: number; love: number; insightful: number; celebrate: number }
  myReaction: 'like' | 'love' | 'insightful' | 'celebrate' | null
  commentCount: number
  isSaved: boolean
  poll: FeedPoll | null
  jobEmbed: JobEmbed | null
  eventEmbed: EventEmbed | null
  lostFoundEmbed: LostFoundEmbed | null
  createdAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function roleBadgeVariant(role: PostAuthor['role']): 'dept' | 'alumni' | 'neutral' {
  if (role === 'student') return 'dept'
  if (role === 'alumni') return 'alumni'
  return 'neutral'
}

function roleLabel(role: PostAuthor['role']): string {
  if (role === 'staff') return 'Staff'
  if (role === 'admin') return 'Admin'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

// ── PinnedBar ─────────────────────────────────────────────────────────────────

function PinnedBar() {
  return (
    <div
      style={{
        background: 'var(--uc-orange-bg)',
        borderBottom: '0.5px solid var(--uc-orange-bdr)',
        padding: '7px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--uc-orange-l)', letterSpacing: '0.01em' }}>
        Announcement
      </span>
    </div>
  )
}

// ── PollBlock ─────────────────────────────────────────────────────────────────

function PollBlock({ poll }: { poll: FeedPoll }) {
  const [localVote, setLocalVote] = useState<string | null>(poll.myVote)
  const [counts, setCounts] = useState(() => poll.options.map((o) => o.voteCount))
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    if (localVote === null) return
    const t = setTimeout(() => setAnimated(true), 16)
    return () => clearTimeout(t)
  }, [localVote])

  const voted = localVote !== null
  const totalVotes = counts.reduce((a, b) => a + b, 0)

  const voteMutation = useMutation({
    mutationFn: (optionId: string) =>
      api.post(`/polls/${poll.id}/vote`, { optionId }).then((r) => r.data),
    onSuccess: (_data, optionId) => {
      const idx = poll.options.findIndex((o) => o.id === optionId)
      if (idx !== -1) {
        setCounts((prev) => prev.map((c, i) => (i === idx ? c + 1 : c)))
      }
      setLocalVote(optionId)
    },
  })

  return (
    <div
      style={{
        background: 'var(--surface-raised)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-md)',
        padding: '14px 16px',
        marginTop: 8,
      }}
    >
      <p
        style={{
          margin: '0 0 12px',
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--text-primary)',
          lineHeight: 1.4,
        }}
      >
        {poll.question}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {poll.options.map((option, idx) => {
          const count = counts[idx] ?? 0
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
          const isChosen = localVote === option.id

          return (
            <button
              key={option.id}
              type="button"
              disabled={voted || voteMutation.isPending}
              onClick={() => {
                if (!voted) voteMutation.mutate(option.id)
              }}
              style={{
                width: '100%',
                position: 'relative',
                background: 'transparent',
                border: `0.5px solid ${isChosen ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
                borderRadius: 'var(--r-sm)',
                padding: '9px 12px',
                cursor: voted ? 'default' : 'pointer',
                overflow: 'hidden',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: animated ? `${pct}%` : '0%',
                  background: isChosen ? 'var(--uc-indigo-bg)' : 'rgba(255,255,255,0.04)',
                  transition: 'width 600ms cubic-bezier(0.4,0,0.2,1)',
                }}
              />
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: isChosen ? 500 : 400,
                    color: isChosen ? 'var(--uc-indigo-xl)' : 'var(--text-primary)',
                  }}
                >
                  {option.text}
                </span>
                {voted && (
                  <span
                    style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 8 }}
                  >
                    {pct}%
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <p
        style={{ margin: '10px 0 0', fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}
      >
        {totalVotes.toLocaleString()} vote{totalVotes !== 1 ? 's' : ''}
        {poll.expiresAt &&
          ` · closes ${formatDistanceToNow(parseISO(poll.expiresAt), { addSuffix: true })}`}
      </p>
    </div>
  )
}

// ── EventSnippet ──────────────────────────────────────────────────────────────

type RsvpStatus = 'going' | 'maybe' | 'not_going'

const RSVP_BUTTONS: { status: RsvpStatus; label: string }[] = [
  { status: 'going', label: 'Going' },
  { status: 'maybe', label: 'Maybe' },
  { status: 'not_going', label: 'Not going' },
]

function EventSnippet({ event }: { event: EventEmbed }) {
  const [localRsvp, setLocalRsvp] = useState<RsvpStatus | null>(event.myRsvp)

  const rsvpMutation = useMutation({
    mutationFn: (status: RsvpStatus) =>
      api.post(`/events/${event.id}/rsvp`, { status }).then((r) => r.data),
    onSuccess: (_data, status) => setLocalRsvp(status),
  })

  return (
    <div
      style={{
        background: 'var(--surface-raised)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-md)',
        overflow: 'hidden',
        marginTop: 8,
      }}
    >
      {/* Cover */}
      <div
        style={{
          height: 88,
          position: 'relative',
          background: event.coverUrl ? undefined : 'var(--uc-indigo-bg)',
          overflow: 'hidden',
        }}
      >
        {event.coverUrl ? (
          <img
            src={event.coverUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'radial-gradient(circle, rgba(255,255,255,0.11) 1.5px, transparent 1.5px)',
              backgroundSize: '14px 14px',
            }}
          />
        )}
        {event.isOnline && (
          <span
            style={{
              position: 'absolute',
              top: 8,
              left: 10,
              background: 'var(--uc-cyan-bg)',
              border: '0.5px solid var(--uc-cyan)',
              borderRadius: 'var(--r-pill)',
              padding: '2px 9px',
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--uc-cyan)',
            }}
          >
            Online
          </span>
        )}
      </div>

      {/* Details */}
      <div style={{ padding: '12px 14px' }}>
        <p
          style={{
            margin: '0 0 7px',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text-primary)',
            lineHeight: 1.4,
          }}
        >
          {event.title}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={12} strokeWidth={1.5} color="var(--text-secondary)" />
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
              {format(parseISO(event.startsAt), "EEE, MMM d · h:mm a")}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={12} strokeWidth={1.5} color="var(--text-secondary)" />
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
              {event.location}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {RSVP_BUTTONS.map(({ status, label }) => {
            const active = localRsvp === status
            return (
              <button
                key={status}
                type="button"
                disabled={rsvpMutation.isPending}
                onClick={() => rsvpMutation.mutate(status)}
                style={{
                  flex: 1,
                  padding: '7px 0',
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: 'var(--r-pill)',
                  cursor: 'pointer',
                  border: `0.5px solid ${active ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
                  background: active ? 'var(--uc-indigo-bg)' : 'transparent',
                  color: active ? 'var(--uc-indigo-l)' : 'var(--text-secondary)',
                  transition: 'background 150ms, border-color 150ms, color 150ms',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── JobSnippet ────────────────────────────────────────────────────────────────

function JobSnippet({ job }: { job: JobEmbed }) {
  const companyInitial = job.company.charAt(0).toUpperCase()

  return (
    <div
      style={{
        background: 'var(--surface-raised)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-md)',
        padding: '14px 16px',
        marginTop: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--r-sm)',
            background: 'var(--uc-indigo-bg)',
            border: '0.5px solid var(--uc-indigo-bdr)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {job.logoUrl ? (
            <img
              src={job.logoUrl}
              alt={job.company}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--uc-indigo-l)' }}>
              {companyInitial}
            </span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--text-primary)',
              lineHeight: 1.4,
            }}
          >
            {job.title}
          </p>
          <p
            style={{
              margin: '2px 0 0',
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--text-secondary)',
            }}
          >
            {job.company}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                fontWeight: 400,
                color: 'var(--text-secondary)',
              }}
            >
              <MapPin size={11} strokeWidth={1.5} />
              {job.location}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: '1px 8px',
                borderRadius: 'var(--r-pill)',
                background: 'var(--uc-mint-bg)',
                color: 'var(--uc-mint)',
              }}
            >
              {job.type.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <PrimaryBtn>
          <Briefcase size={13} strokeWidth={1.5} />
          Apply now
        </PrimaryBtn>
        <GhostBtn>
          <ExternalLink size={13} strokeWidth={1.5} />
          View details
        </GhostBtn>
      </div>
    </div>
  )
}

// ── LostFoundCard ─────────────────────────────────────────────────────────────

function LostFoundCard({ item }: { item: LostFoundEmbed }) {
  const isLost = item.type === 'lost'

  return (
    <div
      style={{
        background: 'var(--uc-orange-bg)',
        border: '0.5px solid var(--uc-orange-bdr)',
        borderRadius: 'var(--r-md)',
        padding: '14px 16px',
        marginTop: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 8,
          gap: 8,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text-primary)',
            lineHeight: 1.4,
          }}
        >
          {item.itemName}
        </p>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            padding: '2px 9px',
            borderRadius: 'var(--r-pill)',
            background: isLost ? 'rgba(240,90,40,0.15)' : 'var(--uc-mint-bg)',
            color: isLost ? 'var(--uc-orange-l)' : 'var(--uc-mint)',
            border: `0.5px solid ${isLost ? 'var(--uc-orange-bdr)' : 'rgba(16,185,129,0.28)'}`,
            flexShrink: 0,
          }}
        >
          {isLost ? 'Lost' : 'Found'}
        </span>
      </div>

      {item.description && (
        <p
          style={{
            margin: '0 0 10px',
            fontSize: 13,
            fontWeight: 400,
            color: 'var(--uc-orange-l)',
            lineHeight: 1.5,
          }}
        >
          {item.description}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
        {item.locationDetail && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={12} strokeWidth={1.5} color="var(--uc-orange-l)" />
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--uc-orange-l)' }}>
              {item.locationDetail}
            </span>
          </div>
        )}
        {item.contactInfo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Phone size={12} strokeWidth={1.5} color="var(--uc-orange-l)" />
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--uc-orange-l)' }}>
              {item.contactInfo}
            </span>
          </div>
        )}
      </div>

      {item.images.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto' }}>
          {item.images.slice(0, 3).map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              style={{
                width: 72,
                height: 72,
                borderRadius: 'var(--r-sm)',
                objectFit: 'cover',
                flexShrink: 0,
                border: '0.5px solid var(--uc-orange-bdr)',
              }}
            />
          ))}
        </div>
      )}

      <GhostBtn
        style={{
          fontSize: 12,
          borderColor: 'var(--uc-orange-bdr)',
          color: 'var(--uc-orange-l)',
        }}
      >
        Send a message
      </GhostBtn>
    </div>
  )
}

// ── PostCard ──────────────────────────────────────────────────────────────────

export function PostCard({ post }: { post: FeedPost }) {
  const [localLike, setLocalLike] = useState(post.myReaction === 'like')
  const [localLikeCount, setLocalLikeCount] = useState(post.reactionCounts.like)
  const [localSaved, setLocalSaved] = useState(post.isSaved)

  const likeMutation = useMutation({
    mutationFn: (wasLiked: boolean) =>
      wasLiked
        ? api.delete(`/posts/${post.id}/reactions`)
        : api.post(`/posts/${post.id}/reactions`, { reactionType: 'like' }),
    onError: (_err, wasLiked) => {
      setLocalLike(wasLiked)
      setLocalLikeCount((c) => (wasLiked ? c + 1 : c - 1))
    },
  })

  const saveMutation = useMutation({
    mutationFn: (wasSaved: boolean) =>
      wasSaved
        ? api.delete(`/posts/${post.id}/save`)
        : api.post(`/posts/${post.id}/save`),
    onError: (_err, wasSaved) => setLocalSaved(wasSaved),
  })

  function handleLike() {
    const wasLiked = localLike
    setLocalLike(!wasLiked)
    setLocalLikeCount((c) => (wasLiked ? c - 1 : c + 1))
    likeMutation.mutate(wasLiked)
  }

  function handleSave() {
    const wasSaved = localSaved
    setLocalSaved(!wasSaved)
    saveMutation.mutate(wasSaved)
  }

  const isAnnouncement = post.type === 'announcement' || post.isPinned
  const author = post.author
  const avatarColor = seedColor(author.id)

  return (
    <article
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
        transition: 'border-color 200ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-hover)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-default)'
      }}
    >
      {isAnnouncement && <PinnedBar />}

      <div style={{ padding: '14px 16px 12px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <Avatar initials={getInitials(author.fullName)} color={avatarColor} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                {author.fullName}
              </span>
              <Badge variant={roleBadgeVariant(author.role)}>{roleLabel(author.role)}</Badge>
              {author.profile.department && (
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                  · {author.profile.department}
                  {author.profile.batchYear && ` '${author.profile.batchYear.slice(-2)}`}
                </span>
              )}
            </div>
            {author.profile.headline && (
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: 12,
                  fontWeight: 400,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.4,
                }}
              >
                {author.profile.headline}
              </p>
            )}
            <p
              style={{
                margin: '2px 0 0',
                fontSize: 12,
                fontWeight: 400,
                color: 'var(--text-tertiary)',
              }}
            >
              {formatDistanceToNow(parseISO(post.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>

        {/* Body text */}
        {post.content && (
          <p
            style={{
              margin: '0 0 12px',
              fontSize: 15,
              fontWeight: 400,
              color: 'var(--text-primary)',
              lineHeight: 1.72,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {post.content}
          </p>
        )}

        {/* Media grid */}
        {post.mediaUrls.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: post.mediaUrls.length === 1 ? '1fr' : '1fr 1fr',
              gap: 3,
              marginBottom: 12,
              borderRadius: 'var(--r-md)',
              overflow: 'hidden',
            }}
          >
            {post.mediaUrls.slice(0, 4).map((url, i) => (
              <img
                key={i}
                src={url}
                alt=""
                style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }}
              />
            ))}
          </div>
        )}

        {/* Type-specific blocks */}
        {post.poll && <PollBlock poll={post.poll} />}
        {post.eventEmbed && <EventSnippet event={post.eventEmbed} />}
        {post.jobEmbed && <JobSnippet job={post.jobEmbed} />}
        {post.lostFoundEmbed && <LostFoundCard item={post.lostFoundEmbed} />}

        {/* Reactions bar */}
        <div
          style={{
            borderTop: '0.5px solid var(--border-default)',
            marginTop: 12,
            paddingTop: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <ReactionBtn active={localLike} onClick={handleLike}>
            <ThumbsUp size={15} strokeWidth={1.5} />
            Like
            {localLikeCount > 0 && (
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 2 }}>
                {localLikeCount}
              </span>
            )}
          </ReactionBtn>

          <ReactionBtn>
            <MessageCircle size={15} strokeWidth={1.5} />
            Comment
            {post.commentCount > 0 && (
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 2 }}>
                {post.commentCount}
              </span>
            )}
          </ReactionBtn>

          <ReactionBtn active={localSaved} onClick={handleSave} style={{ marginLeft: 'auto' }}>
            <Bookmark
              size={15}
              strokeWidth={1.5}
              fill={localSaved ? 'currentColor' : 'none'}
            />
            Save
          </ReactionBtn>
        </div>
      </div>
    </article>
  )
}
