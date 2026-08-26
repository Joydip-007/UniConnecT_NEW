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
import { RoleBadge } from '@/components/RoleBadge'
import { ReactionBtn } from '@/components/Button'
import { PostReactionTrigger } from '@/components/emoji/ReactionBar'
import { TwemojiIcon } from '@/components/emoji/TwemojiIcon'
import { REACTION_MAP, totalReactions, topReactions } from '@/components/emoji/reactionConfig'
import type { ReactionKey } from '@/components/emoji/reactionConfig'
import { ShareMenu } from '@/components/ShareMenu'
import { ImageLightbox } from '@/components/ImageLightbox'
import { AttachmentList } from '@/features/content-sync'
import { MediaGrid } from './MediaGrid'
import { ReportModal } from '@/features/moderation'
import { avatarColor, getInitials } from '@/utils/avatar'
import { useViewTransitionNavigate } from '@/hooks/useViewTransitionNavigate'
import { useUpsertReaction } from '@/features/feed/hooks/useUpsertReaction'
import { useSavePost } from '@/features/feed/hooks/useSavePost'
import { useDeletePost } from '@/features/feed/hooks/useDeletePost'
import { useArchivePost } from '@/features/feed/hooks/useArchivePost'
import { useUnsharePost } from '@/features/feed/hooks/useSharePost'
import { OriginalPostEmbed } from './OriginalPostEmbed'
import { ReactionsDialog } from './ReactionsDialog'
import { SharePostModal } from './SharePostModal'
import { api } from '@/lib/axios'
import { PATHS } from '@/router/paths'

// ── Static styles (module scope — avoids rebuilding per render/per card) ──────

const pinnedBarStyle: React.CSSProperties = {
  background: 'var(--uc-orange-bg)',
  borderBottom: '0.5px solid var(--uc-orange-bdr)',
  borderTopLeftRadius: 'var(--r-lg)',
  borderTopRightRadius: 'var(--r-lg)',
  padding: '7px 16px',
}
const pinnedBarLabelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--uc-orange-l)' }

const pollContainerStyle: React.CSSProperties = {
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-md)',
  padding: '14px 16px',
  marginTop: 8,
}
const pollQuestionStyle: React.CSSProperties = { margin: '0 0 12px', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }
const pollOptionsListStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 }
const pollOptionInnerRowStyle: React.CSSProperties = { position: 'relative', display: 'flex', justifyContent: 'space-between' }
const pollFooterStyle: React.CSSProperties = { margin: '10px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }

const threeDotWrapStyle: React.CSSProperties = { position: 'relative' }
const threeDotBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '4px',
  borderRadius: 'var(--r-sm)',
  color: 'var(--text-tertiary)',
  display: 'flex',
  alignItems: 'center',
}
const threeDotOverlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 49, background: 'transparent', border: 'none', padding: 0, cursor: 'default' }
const threeDotMenuStyle: React.CSSProperties = {
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
}
const threeDotMenuTransition = { type: 'tween' as const, duration: 0.15, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }

const menuBtnBaseStyle: React.CSSProperties = {
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
  textAlign: 'left',
}
const menuBtnDangerColor = 'var(--uc-red)'
const menuBtnDefaultColor = 'var(--text-primary)'

const markdownLinkInternalStyle: React.CSSProperties = { color: 'var(--uc-indigo-xl)', textDecoration: 'none' }
const markdownLinkExternalStyle: React.CSSProperties = { color: 'var(--uc-indigo-xl)' }

const articleStyle: React.CSSProperties = {
  background: 'var(--surface-card)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-lg)',
  transition: 'border-color 200ms ease',
}
const postInnerStyle: React.CSSProperties = { padding: '14px 16px 12px' }
const postHeaderStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }
const authorAvatarLinkStyle: React.CSSProperties = { flexShrink: 0, lineHeight: 0 }
const authorMetaColStyle: React.CSSProperties = { flex: 1, minWidth: 0 }
const authorNameRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }
const authorNameLinkStyle: React.CSSProperties = { fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none' }
/**
 * Headline, department and timestamp share one line. Stacking them cost three rows
 * of header per card before a single word of the post; folded, the same values read
 * as one sentence and the card starts two rows earlier.
 */
const authorMetaLineStyle: React.CSSProperties = { margin: '2px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }
const timestampBtnStyle: React.CSSProperties = {
  margin: 0,
  padding: 0,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  font: 'inherit',
  color: 'inherit',
  textAlign: 'left',
}
const sharedAttributionStyle: React.CSSProperties = { margin: '-4px 0 10px', fontSize: 12, color: 'var(--text-tertiary)' }
const sharedAttributionLinkStyle: React.CSSProperties = { color: 'var(--text-secondary)', fontWeight: 500, textDecoration: 'none' }
const postBodyStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 400,
  color: 'var(--text-primary)',
  lineHeight: 1.72,
  marginBottom: 12,
  overflowWrap: 'anywhere',
}
const countSummaryBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: 10,
  paddingBottom: 6,
  borderBottom: '0.5px solid var(--border-default)',
}
const reactionsTriggerBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '2px 0',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
}
const reactionClusterStyle: React.CSSProperties = { display: 'flex', alignItems: 'center' }
const reactionTotalCountStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 2 }
const commentShareRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 }
const commentBtnStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', fontSize: 12, color: 'var(--text-tertiary)' }
const shareCountStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-tertiary)' }
const actionRowStyle: React.CSSProperties = { marginTop: 4, paddingTop: 4, display: 'flex', alignItems: 'center', gap: 2 }
const reactionBtnInnerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5 }
const saveBtnStyle: React.CSSProperties = { marginLeft: 'auto' }

// ── PinnedBar ─────────────────────────────────────────────────────────────────

function PinnedBar() {
  return (
    <div className="feed-pinned-bar" style={pinnedBarStyle}>
      <span style={pinnedBarLabelStyle}>
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
    <div style={pollContainerStyle} aria-busy={voteMutation.isPending}>
      <p style={pollQuestionStyle}>
        {poll.question}
      </p>
      <div style={pollOptionsListStyle}>
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
              <div style={pollOptionInnerRowStyle}>
                <span style={{ fontSize: 13, fontWeight: isChosen ? 500 : 400, color: isChosen ? 'var(--uc-indigo-xl)' : 'var(--text-primary)' }}>
                  {option.text}
                </span>
                {voted && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{pct}%</span>}
              </div>
            </button>
          )
        })}
      </div>
      <p aria-live="polite" style={pollFooterStyle}>
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
    <div style={threeDotWrapStyle}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Post options"
        className="press-feedback row-hover-bg"
        style={threeDotBtnStyle}
      >
        <MoreVertical size={16} strokeWidth={1.5} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              style={threeDotOverlayStyle}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={threeDotMenuTransition}
              style={threeDotMenuStyle}
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
      style={{ ...menuBtnBaseStyle, color: danger ? menuBtnDangerColor : menuBtnDefaultColor }}
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
        <Link to={href} style={markdownLinkInternalStyle}>
          {children}
        </Link>
      )
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={markdownLinkExternalStyle}>
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
  const viewTransitionNavigate = useViewTransitionNavigate()
  const [myReaction, setMyReaction] = useState<ReactionKey | null>(post.myReaction as ReactionKey | null)
  const [reactionCounts, setReactionCounts] = useState(post.reactionCounts)
  const [localSaved, setLocalSaved] = useState(post.isSaved)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [showReactionsDialog, setShowReactionsDialog] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [localShareCount, setLocalShareCount] = useState(post.shareCount)
  const [myShareId, setMyShareId] = useState<string | null>(post.myShare)

  // Root post ID — for a share card, the root is the original; for originals, it's self
  const rootPostId = post.originalPost?.id ?? post.id

  const reactionMutation = useUpsertReaction(post.id)
  const saveMutation = useSavePost(post.id)
  const deleteMutation = useDeletePost()
  const archiveMutation = useArchivePost()
  const unshareMutation = useUnsharePost(myShareId ?? '', rootPostId)

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
  const authorProfileUrl = PATHS.PROFILE.replace(':id', author.id)
  // Everything that used to own its own line, in reading order; the timestamp is
  // appended separately because it stays an interactive link to the post detail.
  const authorMeta = [
    author.profile.headline,
    author.profile.department &&
      `${author.profile.department}${author.profile.batchYear ? ` '${author.profile.batchYear.slice(-2)}` : ''}`,
  ].filter((part): part is string => Boolean(part))

  return (
    <article
      data-feed-post={post.id}
      className="feed-post-card card-hover-border"
      style={articleStyle}
    >
      {isAnnouncement && <PinnedBar />}

      <div className="feed-post-inner" style={postInnerStyle}>
        {/* Header */}
        <div className="feed-post-header" style={postHeaderStyle}>
          <Link to={authorProfileUrl} style={authorAvatarLinkStyle} aria-label={`View ${author.fullName}'s profile`}>
            <Avatar src={author.profile.avatarUrl} initials={getInitials(author.fullName)} color={avatarColor(author.id)} size={40} />
          </Link>
          <div style={authorMetaColStyle}>
            <div style={authorNameRowStyle}>
              {/* Below-the-badge tooltip: the card is paint-contained, so an
                  upward tip from a badge this close to the top edge gets clipped. */}
              <RoleBadge role={author.role} size={15} tipPlacement="below" />
              <Link
                to={authorProfileUrl}
                style={authorNameLinkStyle}
              >
                {author.fullName}
              </Link>
            </div>
            <p style={authorMetaLineStyle}>
              {authorMeta.map((part) => (
                <span key={part}>{part} · </span>
              ))}
              <button
                type="button"
                onClick={() => viewTransitionNavigate(PATHS.POST_DETAIL.replace(':id', post.id))}
                className="post-timestamp-link"
                aria-label="View post"
                style={timestampBtnStyle}
              >
                {formatDistanceToNow(parseISO(post.createdAt), { addSuffix: true })}
              </button>
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

        {/* "X shared Y's post" attribution line for share cards */}
        {post.originalPost && (
          <p style={sharedAttributionStyle}>
            shared{' '}
            <Link
              to={PATHS.PROFILE.replace(':id', post.originalPost.author.id)}
              style={sharedAttributionLinkStyle}
            >
              {post.originalPost.author.fullName}
            </Link>
            's post
          </p>
        )}

        {/* Body — rendered as markdown */}
        {post.content && (
          <div
            className="feed-post-body"
            style={postBodyStyle}
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

        {/* Embedded original post for share cards */}
        {post.originalPost && (
          <OriginalPostEmbed post={post.originalPost} />
        )}

        {/* Count summary bar — Facebook-style */}
        {((!post.reactionCountsHidden && totalReactions(reactionCounts) > 0) || post.commentCount > 0 || localShareCount > 0) && (
          <div
            style={countSummaryBarStyle}
          >
            {/* Left: reaction emoji cluster + total count */}
            {!post.reactionCountsHidden && totalReactions(reactionCounts) > 0 ? (
              <button
                type="button"
                onClick={() => setShowReactionsDialog(true)}
                style={reactionsTriggerBtnStyle}
              >
                <span style={reactionClusterStyle}>
                  {topReactions(reactionCounts, 3).map((r, i) => (
                    <span
                      key={r.key}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 18,
                        height: 18,
                        background: 'var(--surface-raised)',
                        borderRadius: '50%',
                        border: '1px solid var(--surface-card)',
                        marginLeft: i > 0 ? -4 : 0,
                        zIndex: 3 - i,
                        position: 'relative',
                      }}
                    >
                      <TwemojiIcon codepoint={r.codepoint} size={12} label={r.label} />
                    </span>
                  ))}
                </span>
                <span style={reactionTotalCountStyle}>
                  {totalReactions(reactionCounts).toLocaleString()}
                </span>
              </button>
            ) : (
              <span />
            )}

            {/* Right: comment count · share count */}
            <div style={commentShareRowStyle}>
              {post.commentCount > 0 && (
                <button
                  type="button"
                  onClick={() => onCommentClick(post.id)}
                  style={commentBtnStyle}
                >
                  {post.commentCount.toLocaleString()} comment{post.commentCount !== 1 ? 's' : ''}
                </button>
              )}
              {localShareCount > 0 && (
                <span style={shareCountStyle}>
                  {localShareCount.toLocaleString()} share{localShareCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action row */}
        <div
          style={actionRowStyle}
        >
          <PostReactionTrigger onSelect={handleReactionSelect}>
            <ReactionBtn
              active={Boolean(myReaction)}
              onClick={() => handleReactionSelect(myReaction ?? 'like')}
              style={reactionBtnInnerStyle}
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
            </ReactionBtn>
          </PostReactionTrigger>

          {!post.commentsDisabled && (
            <ReactionBtn onClick={() => onCommentClick(post.id)}>
              <MessageCircle size={15} strokeWidth={1.5} />
              Comment
            </ReactionBtn>
          )}

          <ShareMenu
            entityType="post"
            entityId={post.id}
            title={`${post.author.fullName} on UniConnecT`}
            onShareToProfile={post.sharesDisabled ? undefined : () => setShowShareModal(true)}
            isSharedByMe={!!myShareId}
            onUnshare={myShareId ? () => {
              const prevShareId = myShareId
              const prevCount = localShareCount
              setMyShareId(null)
              setLocalShareCount(Math.max(0, localShareCount - 1))
              unshareMutation.mutate(undefined, {
                onError: () => {
                  setMyShareId(prevShareId)
                  setLocalShareCount(prevCount)
                },
              })
            } : undefined}
          >
            {({ open, toggle }) => (
              <ReactionBtn active={open || !!myShareId} onClick={toggle}>
                <Share2 size={15} strokeWidth={1.5} />
                Share
              </ReactionBtn>
            )}
          </ShareMenu>

          <ReactionBtn
            active={localSaved}
            activeTone="orange"
            onClick={handleSave}
            style={saveBtnStyle}
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

      {showReactionsDialog && (
        <ReactionsDialog
          postId={post.id}
          counts={reactionCounts}
          onClose={() => setShowReactionsDialog(false)}
        />
      )}

      {showShareModal && (
        <SharePostModal
          post={post}
          onClose={() => setShowShareModal(false)}
          onShared={(shareId) => {
            setMyShareId(shareId)
            setLocalShareCount((c) => c + 1)
          }}
        />
      )}
    </article>
  )
}
