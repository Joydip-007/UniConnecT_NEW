import { lazy, Suspense, useRef, useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { motion } from 'framer-motion'
import { CornerDownRight, Smile, Sticker, Trash2, X } from 'lucide-react'
import type { AttachmentInput, FeedComment, FeedPost } from '@uniconnect/shared'
import { useAuthStore } from '@/stores/authStore'
import { Avatar } from '@/components/Avatar'
import { AttachmentPicker } from '@/components/AttachmentPicker'
import { avatarColor, getInitials } from '@/utils/avatar'
import { PostReactionTrigger } from '@/components/emoji/ReactionBar'
import { TwemojiIcon } from '@/components/emoji/TwemojiIcon'
import { REACTION_MAP } from '@/components/emoji/reactionConfig'
import type { ReactionKey } from '@/components/emoji/reactionConfig'
import { useEmojiInsert } from '@/hooks/useEmojiInsert'
import { useComments } from '@/features/feed/hooks/useComments'
import { useCreateComment } from '@/features/feed/hooks/useCreateComment'
import { useDeleteComment } from '@/features/feed/hooks/useDeleteComment'
import { useUpsertCommentReaction } from '@/features/feed/hooks/useUpsertCommentReaction'

const EmojiPicker = lazy(() =>
  import('@/components/emoji/EmojiPicker').then((m) => ({ default: m.EmojiPicker })),
)
const StickerDrawer = lazy(() =>
  import('@/components/emoji/StickerDrawer').then((m) => ({ default: m.StickerDrawer })),
)

// ── CommentItem ───────────────────────────────────────────────────────────────

interface CommentItemProps {
  comment: FeedComment
  postId: string
  isReply?: boolean
  onReply: (parentId: string, authorName: string) => void
}

function CommentItem({ comment, postId, isReply = false, onReply }: CommentItemProps) {
  const user = useAuthStore((s) => s.user)
  const deleteComment = useDeleteComment(postId)
  const reactionMutation = useUpsertCommentReaction(postId, comment.id)

  const [myReaction, setMyReaction] = useState<ReactionKey | null>(
    comment.ownReaction as ReactionKey | null,
  )
  const [reactionCounts, setReactionCounts] = useState(comment.reactionCounts)

  const canDelete = user && (user.id === comment.authorId || user.role === 'admin')

  function handleReactionSelect(key: ReactionKey) {
    const prev = myReaction
    const removing = prev === key
    const counts = { ...reactionCounts }
    if (prev) counts[prev] = Math.max(0, (counts[prev] ?? 0) - 1)
    if (!removing) counts[key] = (counts[key] ?? 0) + 1
    setMyReaction(removing ? null : key)
    setReactionCounts(counts)
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

  function handleDelete() {
    if (!window.confirm('Delete this comment?')) return
    deleteComment.mutate(comment.id)
  }

  return (
    <div style={{ display: 'flex', gap: 8, marginLeft: isReply ? 40 : 0 }}>
      <Avatar
        initials={getInitials(comment.author.fullName)}
        color={avatarColor(comment.authorId)}
        size={32}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            background: 'var(--surface-raised)',
            borderRadius: 'var(--r-md)',
            padding: '8px 12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 3,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              {comment.author.fullName}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {formatDistanceToNow(parseISO(comment.createdAt), { addSuffix: true })}
            </span>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--text-primary)',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {comment.content}
          </p>
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', gap: 12, marginTop: 4, paddingLeft: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <PostReactionTrigger onSelect={handleReactionSelect}>
            <ActionBtn
              active={Boolean(myReaction)}
              activeColor="var(--uc-indigo-xl)"
              onClick={() => handleReactionSelect(myReaction ?? 'like')}
            >
              {myReaction ? (
                <TwemojiIcon
                  codepoint={REACTION_MAP.get(myReaction)?.codepoint ?? '1f44d'}
                  size={11}
                  label={REACTION_MAP.get(myReaction)?.label}
                />
              ) : (
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z" />
                  <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                </svg>
              )}
              {myReaction
                ? REACTION_MAP.get(myReaction)?.label
                : Object.values(reactionCounts).some(Boolean)
                ? Object.values(reactionCounts).reduce((a, b) => a + b, 0)
                : 'Like'}
            </ActionBtn>
          </PostReactionTrigger>

          {!isReply && (
            <ActionBtn onClick={() => onReply(comment.id, comment.author.fullName)}>
              <CornerDownRight size={11} strokeWidth={1.5} />
              Reply
            </ActionBtn>
          )}

          {canDelete && (
            <ActionBtn onClick={handleDelete} danger>
              <Trash2 size={11} strokeWidth={1.5} />
              Delete
            </ActionBtn>
          )}
        </div>

        {/* Replies */}
        {!isReply &&
          comment.replies.map((reply) => (
            <div key={reply.id} style={{ marginTop: 10 }}>
              <CommentItem comment={reply} postId={postId} onReply={onReply} isReply />
            </div>
          ))}
      </div>
    </div>
  )
}

interface ActionBtnProps {
  active?: boolean
  activeColor?: string
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}

function ActionBtn({ active, activeColor = 'var(--text-primary)', danger, onClick, children }: ActionBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press-feedback"
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 400,
        color: danger ? 'var(--uc-red)' : active ? activeColor : 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: 0,
      }}
    >
      {children}
    </button>
  )
}

// ── CommentDrawer ─────────────────────────────────────────────────────────────

interface Props {
  post: FeedPost
  onClose: () => void
}

export function CommentDrawer({ post, onClose }: Props) {
  const user = useAuthStore((s) => s.user)
  const [replyTo, setReplyTo] = useState<{ parentId: string; authorName: string } | null>(null)
  const [inputText, setInputText] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [showStickers, setShowStickers] = useState(false)
  const [attachments, setAttachments] = useState<AttachmentInput[]>([])
  const [attachmentsUploading, setAttachmentsUploading] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const insertEmoji = useEmojiInsert(inputRef, inputText, setInputText)

  const commentsQuery = useComments(post.id, true)
  const createComment = useCreateComment(post.id)

  const comments = commentsQuery.data?.pages.flatMap((p) => p.items) ?? []

  function handleReply(parentId: string, authorName: string) {
    setReplyTo({ parentId, authorName })
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleSend() {
    const content = inputText.trim()
    if ((!content && attachments.length === 0) || createComment.isPending || attachmentsUploading) return
    createComment.mutate(
      {
        content: content || ' ',
        parent_id: replyTo?.parentId ?? null,
        attachments: attachments.length > 0 ? attachments : undefined,
      },
      {
        onSuccess: () => {
          setInputText('')
          setReplyTo(null)
          setAttachments([])
        },
      },
    )
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputText(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          background: 'var(--overlay-bg-soft)',
        }}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.26, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] }}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 420,
          maxWidth: '100vw',
          zIndex: 101,
          background: 'var(--surface-card)',
          borderLeft: '0.5px solid var(--border-default)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header — post summary */}
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '0.5px solid var(--border-default)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <Avatar
            initials={getInitials(post.author.fullName)}
            color={avatarColor(post.author.id)}
            size={32}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin: '0 0 3px',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-primary)',
              }}
            >
              {post.author.fullName}
            </p>
            {post.content && (
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontWeight: 400,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {post.content}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="press-feedback row-hover-bg"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Comment list */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {commentsQuery.isLoading && (
            <p
              style={{
                fontSize: 13,
                color: 'var(--text-tertiary)',
                textAlign: 'center',
                margin: '24px 0',
              }}
            >
              Loading comments…
            </p>
          )}

          {!commentsQuery.isLoading && comments.length === 0 && (
            <p
              style={{
                fontSize: 13,
                color: 'var(--text-tertiary)',
                textAlign: 'center',
                margin: '24px 0',
              }}
            >
              No comments yet. Be the first!
            </p>
          )}

          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={post.id}
              onReply={handleReply}
            />
          ))}

          {commentsQuery.hasNextPage && (
            <button
              type="button"
              onClick={() => commentsQuery.fetchNextPage()}
              disabled={commentsQuery.isFetchingNextPage}
              style={{
                alignSelf: 'center',
                background: 'transparent',
                border: '0.5px solid var(--border-default)',
                borderRadius: 'var(--r-pill)',
                padding: '7px 16px',
                fontSize: 12,
                fontWeight: 400,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {commentsQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>

        {/* Comment input */}
        {user && (
          <div
            style={{
              padding: '10px 16px',
              borderTop: '0.5px solid var(--border-default)',
            }}
          >
            {replyTo && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                  padding: '5px 10px',
                  background: 'var(--surface-raised)',
                  borderRadius: 'var(--r-sm)',
                  fontSize: 12,
                  fontWeight: 400,
                  color: 'var(--text-secondary)',
                }}
              >
                <CornerDownRight size={12} strokeWidth={1.5} />
                Replying to {replyTo.authorName}
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="press-feedback"
                  style={{
                    marginLeft: 'auto',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0,
                  }}
                >
                  <X size={12} strokeWidth={1.5} />
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <Avatar
                initials={getInitials(user.profile.fullName)}
                color={avatarColor(user.id)}
                size={32}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Emoji picker popover */}
                {showEmoji && (
                  <div style={{ position: 'relative', marginBottom: 6 }}>
                    <div style={{ position: 'absolute', bottom: '100%', left: 0, zIndex: 60 }}>
                      <Suspense fallback={null}>
                        <EmojiPicker
                          onSelect={(e) => { insertEmoji(e); setShowEmoji(false) }}
                          onClose={() => setShowEmoji(false)}
                        />
                      </Suspense>
                    </div>
                  </div>
                )}
                {/* Sticker drawer popover */}
                {showStickers && (
                  <div style={{ position: 'relative', marginBottom: 6 }}>
                    <div style={{ position: 'absolute', bottom: '100%', left: 0, zIndex: 60 }}>
                      <Suspense fallback={null}>
                        <StickerDrawer
                          onSelect={() => {
                            createComment.mutate(
                              { content: ' ', parent_id: replyTo?.parentId ?? null },
                              { onSuccess: () => { setReplyTo(null); setShowStickers(false) } },
                            )
                          }}
                          onClose={() => setShowStickers(false)}
                        />
                      </Suspense>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    background: 'var(--surface-raised)',
                    border: '0.5px solid var(--border-default)',
                    borderRadius: 'var(--r-md)',
                    padding: '8px 12px',
                  }}
                >
                  <textarea
                    ref={inputRef}
                    value={inputText}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Write a comment…"
                    rows={1}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      resize: 'none',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      fontWeight: 400,
                      fontFamily: `inherit, var(--font-emoji)`,
                      lineHeight: 1.6,
                      minHeight: 20,
                      maxHeight: 120,
                      overflowY: 'auto',
                    }}
                  />
                  {/* Attachment picker */}
                  <AttachmentPicker
                    value={attachments}
                    onChange={setAttachments}
                    onUploadingChange={setAttachmentsUploading}
                  />
                  {/* Toolbar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <button
                      type="button"
                      onClick={() => { setShowEmoji((v) => !v); setShowStickers(false) }}
                      title="Emoji"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-tertiary)', display: 'flex' }}
                    >
                      <Smile size={16} strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowStickers((v) => !v); setShowEmoji(false) }}
                      title="Stickers"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-tertiary)', display: 'flex' }}
                    >
                      <Sticker size={16} strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={(!inputText.trim() && attachments.length === 0) || createComment.isPending || attachmentsUploading}
                      className="press-feedback"
                      style={{
                        marginLeft: 'auto',
                        background: 'var(--uc-indigo)',
                        border: 'none',
                        borderRadius: 'var(--r-pill)',
                        padding: '5px 12px',
                        fontSize: 12,
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        flexShrink: 0,
                        opacity: ((!inputText.trim() && attachments.length === 0) || createComment.isPending || attachmentsUploading) ? 0.4 : 1,
                        transition: 'opacity 150ms',
                      }}
                    >
                      {createComment.isPending ? '…' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </>
  )
}
