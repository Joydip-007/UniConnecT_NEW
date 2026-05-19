import { useRef, useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { motion } from 'framer-motion'
import { CornerDownRight, ThumbsUp, Trash2, X } from 'lucide-react'
import type { FeedComment, FeedPost } from '@uniconnect/shared'
import { useAuthStore } from '@/stores/authStore'
import { Avatar } from '@/components/Avatar'
import { avatarColor, getInitials } from '@/utils/avatar'
import { useComments } from '@/features/feed/hooks/useComments'
import { useCreateComment } from '@/features/feed/hooks/useCreateComment'
import { useDeleteComment } from '@/features/feed/hooks/useDeleteComment'
import { useUpsertCommentReaction } from '@/features/feed/hooks/useUpsertCommentReaction'

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

  const [localLiked, setLocalLiked] = useState(comment.ownReaction === 'like')
  const [likeCount, setLikeCount] = useState(comment.reactionCounts.like)

  const canDelete = user && (user.id === comment.authorId || user.role === 'admin')

  function handleLike() {
    const wasLiked = localLiked
    setLocalLiked(!wasLiked)
    setLikeCount((c) => (wasLiked ? c - 1 : c + 1))
    reactionMutation.mutate(
      { wasLiked },
      {
        onError: () => {
          setLocalLiked(wasLiked)
          setLikeCount((c) => (wasLiked ? c + 1 : c - 1))
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
        <div style={{ display: 'flex', gap: 12, marginTop: 4, paddingLeft: 4, flexWrap: 'wrap' }}>
          <ActionBtn
            active={localLiked}
            activeColor="var(--uc-indigo-xl)"
            onClick={handleLike}
          >
            <ThumbsUp size={11} strokeWidth={1.5} />
            {likeCount > 0 ? likeCount : 'Like'}
          </ActionBtn>

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
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const commentsQuery = useComments(post.id, true)
  const createComment = useCreateComment(post.id)

  const comments = commentsQuery.data?.pages.flatMap((p) => p.items) ?? []

  function handleReply(parentId: string, authorName: string) {
    setReplyTo({ parentId, authorName })
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleSend() {
    const content = inputText.trim()
    if (!content || createComment.isPending) return
    createComment.mutate(
      { content, parent_id: replyTo?.parentId ?? null },
      {
        onSuccess: () => {
          setInputText('')
          setReplyTo(null)
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
              <div
                style={{
                  flex: 1,
                  background: 'var(--surface-raised)',
                  border: '0.5px solid var(--border-default)',
                  borderRadius: 'var(--r-md)',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 8,
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
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    fontWeight: 400,
                    fontFamily: 'inherit',
                    lineHeight: 1.6,
                    minHeight: 20,
                    maxHeight: 120,
                    overflowY: 'auto',
                  }}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!inputText.trim() || createComment.isPending}
                  className="press-feedback"
                  style={{
                    background: 'var(--uc-indigo)',
                    border: 'none',
                    borderRadius: 'var(--r-pill)',
                    padding: '5px 12px',
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    flexShrink: 0,
                    opacity: !inputText.trim() || createComment.isPending ? 0.4 : 1,
                    transition: 'opacity 150ms',
                  }}
                >
                  {createComment.isPending ? '…' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </>
  )
}
