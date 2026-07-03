import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import { Link } from 'react-router-dom'
import { CornerDownRight, Paperclip, Smile, Sticker, Trash2, X } from 'lucide-react'
import type { AttachmentInput, FeedComment, FeedPost } from '@uniconnect/shared'
import { useAuthStore } from '@/stores/authStore'
import { Avatar } from '@/components/Avatar'
import { RoleBadge } from '@/components/RoleBadge'
import { AttachmentPicker, type AttachmentPickerHandle } from '@/components/AttachmentPicker'
import { PATHS } from '@/router/paths'
import { avatarColor, getInitials } from '@/utils/avatar'
import { preprocessHashtags } from '@/utils/preprocessHashtags'
import { PostReactionTrigger } from '@/components/emoji/ReactionBar'
import { TwemojiIcon } from '@/components/emoji/TwemojiIcon'
import { REACTION_MAP } from '@/components/emoji/reactionConfig'
import type { ReactionKey } from '@/components/emoji/reactionConfig'
import { useEmojiInsert } from '@/hooks/useEmojiInsert'
import { useSearchPeople } from '@/features/search'
import type { UserSearchResult } from '@/features/search/types'
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
import { StickerMessage } from '@/components/emoji/StickerDrawer'

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
    if (href?.startsWith('/')) {
      return (
        <Link to={href} style={{ color: 'var(--uc-indigo-xl)', textDecoration: 'none', fontWeight: 500 }}>
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

function detectMention(value: string, caret: number) {
  const beforeCaret = value.slice(0, caret)
  const match = beforeCaret.match(/(^|\s)@([^@\n]{0,40})$/)
  if (!match) return null
  const query = match[2] ?? ''
  return { query, start: caret - query.length - 1, end: caret }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ── CommentItem ───────────────────────────────────────────────────────────────

interface CommentItemProps {
  comment: FeedComment
  postId: string
  isReply?: boolean
  onReply: (parentId: string, authorName: string, authorId: string) => void
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
  const authorProfileUrl = PATHS.PROFILE.replace(':id', comment.authorId)

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
      <Link to={authorProfileUrl} style={{ flexShrink: 0, lineHeight: 0 }} aria-label={`View ${comment.author.fullName}'s profile`}>
        <Avatar
          src={comment.author.avatarUrl}
          initials={getInitials(comment.author.fullName)}
          color={avatarColor(comment.authorId)}
          size={32}
        />
      </Link>
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
            <RoleBadge role={comment.author.role} size={13} />
            <Link
              to={authorProfileUrl}
              style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none' }}
            >
              {comment.author.fullName}
            </Link>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {formatDistanceToNow(parseISO(comment.createdAt), { addSuffix: true })}
            </span>
          </div>
          <div
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
            <ReactMarkdown rehypePlugins={[rehypeSanitize]} components={markdownComponents}>
              {preprocessHashtags(comment.content)}
            </ReactMarkdown>
          </div>
          {comment.mediaUrls && comment.mediaUrls.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {comment.mediaUrls.map((url) => (
                <StickerMessage key={url} url={url} />
              ))}
            </div>
          )}
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
            <ActionBtn onClick={() => onReply(comment.id, comment.author.fullName, comment.authorId)}>
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
  const [replyTo, setReplyTo] = useState<{ parentId: string; authorName: string; authorId: string } | null>(null)
  const [inputText, setInputText] = useState('')
  const [mentionCandidate, setMentionCandidate] = useState<{ query: string; start: number; end: number } | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [selectedMentions, setSelectedMentions] = useState<Array<{ id: string; fullName: string }>>([])
  const [showEmoji, setShowEmoji] = useState(false)
  const [showStickers, setShowStickers] = useState(false)
  const [attachments, setAttachments] = useState<AttachmentInput[]>([])
  const [attachmentsUploading, setAttachmentsUploading] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const attachPickerRef = useRef<AttachmentPickerHandle>(null)
  const insertEmoji = useEmojiInsert(inputRef, inputText, setInputText)

  const commentsQuery = useComments(post.id, true)
  const createComment = useCreateComment(post.id)
  const mentionQuery = useSearchPeople(mentionCandidate?.query ?? '', 6, {
    enabled: Boolean(mentionCandidate),
  })

  const comments = commentsQuery.data?.pages.flatMap((p) => p.items) ?? []
  const mentionOptions = mentionQuery.data?.pages.flatMap((p) => p.items) ?? []
  const postAuthorProfileUrl = PATHS.PROFILE.replace(':id', post.author.id)

  useEffect(() => {
    setMentionIndex(0)
  }, [mentionCandidate?.query])

  function handleReply(parentId: string, authorName: string, authorId: string) {
    setReplyTo({ parentId, authorName, authorId })
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function linkSelectedMentions(content: string) {
    return [...selectedMentions]
      .sort((a, b) => b.fullName.length - a.fullName.length)
      .reduce((result, mention) => {
        const pattern = new RegExp(`(^|\\s)@${escapeRegExp(mention.fullName)}(?=$|\\s|[.,!?])`, 'g')
        return result.replace(pattern, `$1[@${mention.fullName}](${PATHS.PROFILE.replace(':id', mention.id)})`)
      }, content)
  }

  function handleSend() {
    const content = inputText.trim()
    if ((!content && attachments.length === 0) || createComment.isPending || attachmentsUploading) return
    createComment.mutate(
      {
        content: content ? linkSelectedMentions(content) : ' ',
        parent_id: replyTo?.parentId ?? null,
        attachments: attachments.length > 0 ? attachments : undefined,
      },
      {
        onSuccess: () => {
          setInputText('')
          setReplyTo(null)
          setMentionCandidate(null)
          setSelectedMentions([])
          setAttachments([])
        },
      },
    )
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionCandidate && mentionOptions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex((i) => (i + 1) % mentionOptions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex((i) => (i - 1 + mentionOptions.length) % mentionOptions.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(mentionOptions[mentionIndex] ?? mentionOptions[0])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionCandidate(null)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputText(e.target.value)
    setMentionCandidate(detectMention(e.target.value, e.target.selectionStart))
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  function handleInputSelect() {
    const el = inputRef.current
    if (!el) return
    setMentionCandidate(detectMention(inputText, el.selectionStart))
  }

  function insertMention(person: UserSearchResult | undefined) {
    if (!person || !mentionCandidate) return
    const mentionText = `@${person.fullName} `
    const nextText = `${inputText.slice(0, mentionCandidate.start)}${mentionText}${inputText.slice(mentionCandidate.end)}`
    const nextCaret = mentionCandidate.start + mentionText.length
    setInputText(nextText)
    setSelectedMentions((prev) => (
      prev.some((m) => m.id === person.id)
        ? prev
        : [...prev, { id: person.id, fullName: person.fullName }]
    ))
    setMentionCandidate(null)
    setMentionIndex(0)
    setTimeout(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(nextCaret, nextCaret)
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`
    }, 0)
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
          <Link to={postAuthorProfileUrl} style={{ flexShrink: 0, lineHeight: 0 }} aria-label={`View ${post.author.fullName}'s profile`}>
            <Avatar
              src={post.author.profile.avatarUrl}
              initials={getInitials(post.author.fullName)}
              color={avatarColor(post.author.id)}
              size={32}
            />
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Link
              to={postAuthorProfileUrl}
              style={{
                margin: '0 0 3px',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-primary)',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              {post.author.fullName}
            </Link>
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
                Replying to{' '}
                <Link
                  to={PATHS.PROFILE.replace(':id', replyTo.authorId)}
                  style={{ color: 'var(--text-secondary)', fontWeight: 500, textDecoration: 'none' }}
                >
                  {replyTo.authorName}
                </Link>
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
                src={user.profile.avatarUrl}
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
                          onSelect={(url) => {
                            createComment.mutate(
                              { content: '', media_urls: [url], parent_id: replyTo?.parentId ?? null },
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
                    position: 'relative',
                    background: 'var(--surface-raised)',
                    border: '0.5px solid var(--border-default)',
                    borderRadius: 'var(--r-md)',
                    padding: '8px 12px',
                  }}
                >
                  {mentionCandidate && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 'calc(100% + 6px)',
                        zIndex: 70,
                        background: 'var(--surface-card)',
                        border: '0.5px solid var(--border-hover)',
                        borderRadius: 'var(--r-md)',
                        overflow: 'hidden',
                        maxHeight: 240,
                        overflowY: 'auto',
                      }}
                    >
                      {mentionQuery.isFetching && mentionOptions.length === 0 ? (
                        <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                          Searching…
                        </div>
                      ) : mentionOptions.length === 0 ? (
                        <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                          No people found
                        </div>
                      ) : (
                        mentionOptions.map((person, index) => (
                          <button
                            key={person.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              insertMention(person)
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 9,
                              width: '100%',
                              padding: '8px 10px',
                              background: index === mentionIndex ? 'var(--surface-hover)' : 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <Avatar
                              src={person.avatarUrl}
                              initials={getInitials(person.fullName)}
                              color={avatarColor(person.id)}
                              size={30}
                            />
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span
                                style={{
                                  display: 'block',
                                  fontSize: 13,
                                  fontWeight: 500,
                                  color: 'var(--text-primary)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {person.fullName}
                              </span>
                              {(person.headline || person.department) && (
                                <span
                                  style={{
                                    display: 'block',
                                    fontSize: 11,
                                    color: 'var(--text-tertiary)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {person.headline ?? person.department}
                                </span>
                              )}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  <textarea
                    ref={inputRef}
                    value={inputText}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onClick={handleInputSelect}
                    onKeyUp={handleInputSelect}
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
                  {/* Attachment chips + hidden input (button rendered in toolbar) */}
                  <AttachmentPicker
                    ref={attachPickerRef}
                    hideButton
                    value={attachments}
                    onChange={setAttachments}
                    onUploadingChange={setAttachmentsUploading}
                  />
                  {/* Toolbar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <button
                      type="button"
                      title="Emoji"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => { setShowEmoji((v) => !v); setShowStickers(false) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: showEmoji ? 'var(--uc-indigo)' : 'var(--text-tertiary)', display: 'flex', transition: 'color 150ms' }}
                    >
                      <Smile size={16} strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      title="Stickers"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => { setShowStickers((v) => !v); setShowEmoji(false) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: showStickers ? 'var(--uc-indigo)' : 'var(--text-tertiary)', display: 'flex', transition: 'color 150ms' }}
                    >
                      <Sticker size={16} strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      title="Attach file"
                      onClick={() => attachPickerRef.current?.open()}
                      disabled={attachmentsUploading}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: attachments.length > 0 ? 'var(--uc-indigo)' : 'var(--text-tertiary)', display: 'flex', transition: 'color 150ms' }}
                    >
                      <Paperclip size={16} strokeWidth={1.5} />
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
