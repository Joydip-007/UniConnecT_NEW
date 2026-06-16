import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import { Link } from 'react-router-dom'
import { preprocessHashtags } from '@/utils/preprocessHashtags'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import {
  Archive,
  Bookmark,
  Flag,
  MessageCircle,
  MoreVertical,
  Share2,
  Trash2,
  Pencil,
} from 'lucide-react'
import type { FeedPost, FeedPoll } from '@uniconnect/shared'
import { useAuthStore } from '@/stores/authStore'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { ReactionBtn } from '@/components/Button'
import { PostReactionTrigger } from '@/components/emoji/ReactionBar'
import { ReactionChip } from '@/components/emoji/ReactionChip'
import { TwemojiIcon } from '@/components/emoji/TwemojiIcon'
import { REACTION_MAP, totalReactions } from '@/components/emoji/reactionConfig'
import type { ReactionKey } from '@/components/emoji/reactionConfig'
import { ShareMenu } from '@/components/ShareMenu'
import { ImageLightbox } from '@/components/ImageLightbox'
import { AttachmentList } from '@/features/content-sync'
import { MediaGrid } from './MediaGrid'
import { ReportModal } from '@/features/moderation'
import { avatarColor, getInitials } from '@/utils/avatar'
import { useUpsertReaction } from '@/features/feed/hooks/useUpsertReaction'
import { useSavePost } from '@/features/feed/hooks/useSavePost'
import { useDeletePost } from '@/features/feed/hooks/useDeletePost'
import { useArchivePost } from '@/features/feed/hooks/useArchivePost'
import { api } from '@/lib/axios'

// ── Helpers ───────────────────────────────────────────────────────────────────

function roleBadgeVariant(role: FeedPost['author']['role']): 'dept' | 'alumni' | 'neutral' {
  if (role === 'student') return 'dept'
  if (role === 'alumni') return 'alumni'
  return 'neutral'
}

function roleLabel(role: FeedPost['author']['role']): string {
  if (role === 'faculty') return 'Faculty'
  if (role === 'admin') return 'Admin'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

// ── PinnedBar ─────────────────────────────────────────────────────────────────

function PinnedBar() {
  return (
    <div
      className="feed-pinned-bar"
      style={{
        background: 'var(--uc-orange-bg)',
        borderBottom: '0.5px solid var(--uc-orange-bdr)',
        padding: '7px 16px',
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--uc-orange-l)' }}>
        Announcement
      </span>
    </div>
  )
}

// ── PollBlock ─────────────────────────────────────────────────────────────────

function PollBlock({ poll }: { poll: FeedPoll; postId: string }) {
  const [localVote, setLocalVote] = useState<string | null>(poll.myVote)
  const [counts, setCounts] = useState(() => poll.options.map((o) => o.voteCount))
  const [animated, setAnimated] = useState(false)
  const voteMutation = useMutation({
    mutationFn: (optionId: string) =>
      api.post(`/polls/${poll.id}/vote`, { optionId }).then((r) => r.data),
  })
  const voted = localVote !== null
  const totalVotes = counts.reduce((a, b) => a + b, 0)

  function handleVote(optionId: string) {
    if (voted || voteMutation.isPending) return
    const idx = poll.options.findIndex((o) => o.id === optionId)
    const previousVote = localVote
    const previousCounts = counts
    setAnimated(false)
    if (idx !== -1) setCounts((prev) => prev.map((c, i) => (i === idx ? c + 1 : c)))
    setLocalVote(optionId)
    window.setTimeout(() => setAnimated(true), 16)
    voteMutation.mutate(optionId, {
      onError: () => {
        setLocalVote(previousVote)
        setCounts(previousCounts)
        setAnimated(false)
        toast.error('Could not record your vote. Try again.')
      },
    })
  }

  return (
    <div
      style={{
        background: 'var(--surface-raised)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-md)',
        padding: '14px 16px',
        marginTop: 8,
      }}
      aria-busy={voteMutation.isPending}
    >
      <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
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
              onClick={() => handleVote(option.id)}
              style={{
                width: '100%',
                position: 'relative',
                background: 'transparent',
                border: `0.5px solid ${isChosen ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
                borderRadius: 'var(--r-sm)',
                padding: '9px 12px',
                cursor: voted || voteMutation.isPending ? 'default' : 'pointer',
                overflow: 'hidden',
                textAlign: 'left',
              }}
              aria-pressed={isChosen}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0, bottom: 0, left: 0,
                  width: '100%',
                  background: isChosen ? 'var(--uc-indigo-bg)' : 'var(--surface-hover)',
                  transform: `scaleX(${animated ? pct / 100 : 0})`,
                  transformOrigin: 'left center',
                  transition: 'transform 250ms cubic-bezier(0.23, 1, 0.32, 1)',
                }}
              />
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: isChosen ? 500 : 400, color: isChosen ? 'var(--uc-indigo-xl)' : 'var(--text-primary)' }}>
                  {option.text}
                </span>
                {voted && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{pct}%</span>}
              </div>
            </button>
          )
        })}
      </div>
      <p aria-live="polite" style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
        {totalVotes.toLocaleString()} vote{totalVotes !== 1 ? 's' : ''}
        {poll.expiresAt && ` · closes ${formatDistanceToNow(parseISO(poll.expiresAt), { addSuffix: true })}`}
      </p>
    </div>
  )
}

// ── ThreeDotMenu ──────────────────────────────────────────────────────────────

interface ThreeDotMenuProps {
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
  onArchive: () => void
  onReport: () => void
}

function ThreeDotMenu({ canEdit, onEdit, onDelete, onArchive, onReport }: ThreeDotMenuProps) {
  const [open, setOpen] = useState(false)

  function handleDelete() {
    setOpen(false)
    onDelete()
  }

  function handleArchive() {
    setOpen(false)
    onArchive()
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="press-feedback row-hover-bg"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: 'var(--r-sm)',
          color: 'var(--text-tertiary)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <MoreVertical size={16} strokeWidth={1.5} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 49 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ type: 'tween', duration: 0.15, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                zIndex: 50,
                background: 'var(--surface-raised)',
                border: '0.5px solid var(--border-hover)',
                borderRadius: 'var(--r-md)',
                padding: 4,
                minWidth: 140,
                marginTop: 4,
                transformOrigin: 'top right',
              }}
            >
              {canEdit ? (
                <>
                  <MenuBtn icon={<Pencil size={13} strokeWidth={1.5} />} label="Edit post" onClick={() => { setOpen(false); onEdit() }} />
                  <MenuBtn icon={<Archive size={13} strokeWidth={1.5} />} label="Archive" onClick={handleArchive} />
                  <MenuBtn icon={<Trash2 size={13} strokeWidth={1.5} />} label="Delete" onClick={handleDelete} danger />
                </>
              ) : (
                <MenuBtn icon={<Flag size={13} strokeWidth={1.5} />} label="Report" onClick={() => { setOpen(false); onReport() }} danger />
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function MenuBtn({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="nav-menu-item"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '8px 12px',
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--r-sm)',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 400,
        color: danger ? 'var(--uc-red)' : 'var(--text-primary)',
        textAlign: 'left',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

// ── Markdown components with hashtag link support ────────────────────────────

const markdownComponents = {
  // Route internal /explore/tag/... links through React Router Link (no full-page reload)
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
    if (href?.startsWith('/')) {
      return (
        <Link to={href} style={{ color: 'var(--uc-indigo-xl)', textDecoration: 'none' }}>
          {children}
        </Link>
      )
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--uc-indigo-xl)' }}>
        {children}
      </a>
    )
  },
}

// ── PostCard ──────────────────────────────────────────────────────────────────

export interface PostCardProps {
  post: FeedPost
  onCommentClick: (postId: string) => void
  onEditPost: (post: FeedPost) => void
}

export function PostCard({ post, onCommentClick, onEditPost }: PostCardProps) {
  const user = useAuthStore((s) => s.user)
  const [myReaction, setMyReaction] = useState<ReactionKey | null>(post.myReaction as ReactionKey | null)
  const [reactionCounts, setReactionCounts] = useState(post.reactionCounts)
  const [animateKey, setAnimateKey] = useState<string | null>(null)
  const [localSaved, setLocalSaved] = useState(post.isSaved)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [reportOpen, setReportOpen] = useState(false)

  const reactionMutation = useUpsertReaction(post.id)
  const saveMutation = useSavePost(post.id)
  const deleteMutation = useDeletePost()
  const archiveMutation = useArchivePost()

  function handleDeletePost() {
    const tid = window.setTimeout(() => deleteMutation.mutate(post.id), 5000)
    toast('Post deleted', {
      action: { label: 'Undo', onClick: () => window.clearTimeout(tid) },
      duration: 5000,
    })
  }

  function handleReactionSelect(key: ReactionKey) {
    const prev = myReaction
    const removing = prev === key
    const nextCounts = { ...reactionCounts }
    if (prev) nextCounts[prev] = Math.max(0, (nextCounts[prev] ?? 0) - 1)
    if (!removing) nextCounts[key] = (nextCounts[key] ?? 0) + 1
    setMyReaction(removing ? null : key)
    setReactionCounts(nextCounts)
    if (!removing) setAnimateKey(`${key}-${Date.now()}`)
    reactionMutation.mutate(
      { current: prev, next: key },
      {
        onError: () => {
          setMyReaction(prev)
          setReactionCounts(reactionCounts)
        },
      },
    )
  }

  function handleSave() {
    const wasSaved = localSaved
    setLocalSaved(!wasSaved)
    saveMutation.mutate(
      { wasSaved },
      {
        onSuccess: () => {
          if (wasSaved) return
          toast.success('Saved to your bookmarks', {
            action: {
              label: 'Undo',
              onClick: () => {
                setLocalSaved(false)
                saveMutation.mutate({ wasSaved: true })
              },
            },
          })
        },
        onError: () => setLocalSaved(wasSaved),
      },
    )
  }

  const canEdit = user && (user.id === post.author.id || user.role === 'admin')
  const isAnnouncement = post.type === 'announcement' || post.isPinned
  const author = post.author

  return (
    <article
      data-feed-post={post.id}
      className="feed-post-card card-hover-border"
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
        transition: 'border-color 200ms ease',
        outline: 'none',
      }}
    >
      {isAnnouncement && <PinnedBar />}

      <div className="feed-post-inner" style={{ padding: '14px 16px 12px' }}>
        {/* Header */}
        <div className="feed-post-header" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <Avatar src={author.profile.avatarUrl} initials={getInitials(author.fullName)} color={avatarColor(author.id)} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                {author.fullName}
              </span>
              <Badge variant={roleBadgeVariant(author.role)}>{roleLabel(author.role)}</Badge>
              {author.profile.department && (
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  · {author.profile.department}
                  {author.profile.batchYear && ` '${author.profile.batchYear.slice(-2)}`}
                </span>
              )}
            </div>
            {author.profile.headline && (
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                {author.profile.headline}
              </p>
            )}
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
              {formatDistanceToNow(parseISO(post.createdAt), { addSuffix: true })}
            </p>
          </div>
          {user && (
            <ThreeDotMenu
              canEdit={!!canEdit}
              onEdit={() => onEditPost(post)}
              onDelete={handleDeletePost}
              onArchive={() => archiveMutation.mutate(post.id)}
              onReport={() => setReportOpen(true)}
            />
          )}
        </div>

        {/* Body — rendered as markdown */}
        {post.content && (
          <div
            className="feed-post-body"
            style={{
              fontSize: 15,
              fontWeight: 400,
              color: 'var(--text-primary)',
              lineHeight: 1.72,
              marginBottom: 12,
            }}
          >
            <ReactMarkdown rehypePlugins={[rehypeSanitize]} components={markdownComponents}>
              {preprocessHashtags(post.content)}
            </ReactMarkdown>
          </div>
        )}

        {/* Media grid */}
        <MediaGrid urls={post.mediaUrls} onOpen={setLightboxIndex} />

        {/* File attachments (shown on the post-detail view) */}
        <AttachmentList attachments={post.attachments} />

        {/* Poll */}
        {post.poll && <PollBlock poll={post.poll} postId={post.id} />}

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
          <PostReactionTrigger onSelect={handleReactionSelect}>
            <ReactionBtn
              active={Boolean(myReaction)}
              onClick={() => handleReactionSelect(myReaction ?? 'like')}
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            >
              {myReaction ? (
                <TwemojiIcon
                  codepoint={REACTION_MAP.get(myReaction)?.codepoint ?? '1f44d'}
                  size={15}
                  label={REACTION_MAP.get(myReaction)?.label}
                />
              ) : (
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z" />
                  <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                </svg>
              )}
              {myReaction ? REACTION_MAP.get(myReaction)?.label : 'Like'}
              {totalReactions(reactionCounts) > 0 && (
                <ReactionChip
                  counts={reactionCounts}
                  myReaction={myReaction}
                  animateKey={animateKey}
                />
              )}
            </ReactionBtn>
          </PostReactionTrigger>

          <ReactionBtn onClick={() => onCommentClick(post.id)}>
            <MessageCircle size={15} strokeWidth={1.5} />
            Comment
            {post.commentCount > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 2 }}>
                {post.commentCount}
              </span>
            )}
          </ReactionBtn>

          <ShareMenu entityType="post" entityId={post.id} title={`${post.author.fullName} on UniConnecT`}>
            {({ open, toggle }) => (
              <ReactionBtn active={open} onClick={toggle}>
                <Share2 size={15} strokeWidth={1.5} />
                Share
              </ReactionBtn>
            )}
          </ShareMenu>

          <ReactionBtn
            active={localSaved}
            activeTone="orange"
            onClick={handleSave}
            style={{ marginLeft: 'auto' }}
          >
            <Bookmark size={15} strokeWidth={1.5} fill={localSaved ? 'currentColor' : 'none'} />
            Save
          </ReactionBtn>
        </div>
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox
          images={post.mediaUrls}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="post"
        targetId={post.id}
        targetLabel="this post"
      />
    </article>
  )
}
