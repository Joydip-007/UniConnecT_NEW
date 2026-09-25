import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  BarChart2,
  Bold,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Image,
  Italic,
  Link,
  Paperclip,
  Send,
  Smile,
  Sparkles,
  X,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { MAX_ATTACHMENTS_PER_ENTITY } from '@uniconnect/shared'
import type { AttachmentInput, FeedPost, ProfileProgress } from '@uniconnect/shared'
import { useAuthStore } from '@/stores/authStore'
import { Avatar } from '@/components/Avatar'
import { AttachmentPicker, type AttachmentPickerHandle } from '@/components/AttachmentPicker'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { avatarColor, getInitials } from '@/utils/avatar'
import { api } from '@/lib/axios'
import { usePresignedUpload } from '@/hooks/usePresignedUpload'
import { useEmojiInsert } from '@/hooks/useEmojiInsert'
import { useCreatePost } from '@/features/feed/hooks/useCreatePost'
import { useUpdatePost } from '@/features/feed/hooks/useUpdatePost'

const EmojiPicker = lazy(() =>
  import('@/components/emoji/EmojiPicker').then((m) => ({ default: m.EmojiPicker })),
)

/** emoji-mart's rendered width; used to keep the popover on-screen. */
const EMOJI_PICKER_WIDTH = 352

const FIRST_POST_HINT_KEY = 'uc:onboard:first-post-dismissed'

/** `YYYY-MM-DDTHH:mm` in local time — the value format of `<input type="datetime-local">`. */
function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** The next top of the hour, at least an hour out — the schedule picker's starting value. */
function defaultScheduleSlot() {
  const d = new Date(Date.now() + 3_600_000)
  d.setMinutes(0, 0, 0)
  return toLocalInput(d)
}

/** "25 Sep, 4:00 pm" */
function formatSchedule(value: string) {
  const d = new Date(value)
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${d
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    .toLowerCase()}`
}

type TabMode = 'photo' | 'poll' | null
type PostType = 'post' | 'announcement'

interface PollOption {
  id: string
  text: string
}

interface PhotoItem {
  file: File
  previewUrl: string
  s3Url?: string
  /** The presign or S3 PUT failed — the tile says so and submit is blocked until it's removed. */
  failed?: boolean
}

interface Props {
  editPost?: FeedPost | null
  onDismissEdit?: () => void
  /** When posting from inside a group's feed tab, ties the new post to that group. */
  groupId?: string
}

// ── CreatePost ────────────────────────────────────────────────────────────────

export function CreatePost({ editPost, onDismissEdit, groupId }: Props) {
  const user = useAuthStore((s) => s.user)
  const [open, setOpen] = useState(false)
  const [instantOpen, setInstantOpen] = useState(false)
  const [text, setText] = useState('')
  const [postType, setPostType] = useState<PostType>('post')
  const [activeTab, setActiveTab] = useState<TabMode>(null)

  // Photo state
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [uploading, setUploading] = useState(false)
  const { upload: uploadPhoto } = usePresignedUpload('posts')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // File attachments (documents/images shown as download chips, separate from the gallery)
  const [attachments, setAttachments] = useState<AttachmentInput[]>([])
  const [existingAttachments, setExistingAttachments] = useState<FeedPost['attachments']>([])
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([])
  const [attachmentsUploading, setAttachmentsUploading] = useState(false)
  const attachmentPickerRef = useRef<AttachmentPickerHandle>(null)

  // Poll state
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState<PollOption[]>([
    { id: '1', text: '' },
    { id: '2', text: '' },
  ])
  const [pollExpiresAt, setPollExpiresAt] = useState('')

  // Scheduling: a future local datetime publishes the post later (posts only).
  const [scheduleAt, setScheduleAt] = useState('')
  // Split-button menu next to Post: "Post now" / "Schedule for later" (with an inline picker).
  const [postMenuOpen, setPostMenuOpen] = useState(false)
  const [schedPickerOpen, setSchedPickerOpen] = useState(false)
  const [schedDraft, setSchedDraft] = useState('')
  const postMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!postMenuOpen) return
    function onDown(e: MouseEvent) {
      if (!postMenuRef.current?.contains(e.target as Node)) setPostMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setPostMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [postMenuOpen])

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const insertEmoji = useEmojiInsert(textareaRef, text, setText)

  // Emoji picker — portalled to <body> because the panel's `overflow: hidden` would clip
  // a 435px popover; anchored above the toolbar button from its viewport rect.
  const emojiBtnRef = useRef<HTMLSpanElement>(null)
  const [emojiAnchor, setEmojiAnchor] = useState<{ left: number; bottom: number } | null>(null)

  function toggleEmoji() {
    if (emojiAnchor) return setEmojiAnchor(null)
    const rect = emojiBtnRef.current?.getBoundingClientRect()
    if (!rect) return
    setEmojiAnchor({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - EMOJI_PICKER_WIDTH - 8)),
      bottom: window.innerHeight - rect.top + 8,
    })
  }

  useEffect(() => {
    if (!emojiAnchor) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setEmojiAnchor(null)
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [emojiAnchor])
  const createPost = useCreatePost()
  const updatePost = useUpdatePost()

  const isEditMode = !!editPost
  const isSubmitting = createPost.isPending || updatePost.isPending
  const canAnnounce = user?.role === 'faculty' || user?.role === 'admin'

  // First-post hint — dedupes the React Query call shared with RightSidebar
  const { data: progress } = useQuery({
    queryKey: ['users', 'me', 'progress'],
    queryFn: () =>
      api
        .get<{ data: ProfileProgress }>('/users/me/progress')
        .then((r) => r.data.data),
    staleTime: 30_000,
  })
  const [firstHintDismissed, setFirstHintDismissed] = useState(() => {
    try {
      return localStorage.getItem(FIRST_POST_HINT_KEY) === '1'
    } catch {
      return false
    }
  })
  // Only surface this once the rest of the profile is filled in — otherwise it
  // competes with the onboarding checklist's own "share your first post" step.
  const showFirstPostHint =
    !isEditMode &&
    progress != null &&
    !progress.hasMadePost &&
    progress.hasAvatar &&
    progress.hasHeadline &&
    progress.hasBio &&
    !firstHintDismissed
  function dismissFirstPostHint() {
    setFirstHintDismissed(true)
    try {
      localStorage.setItem(FIRST_POST_HINT_KEY, '1')
    } catch {
      /* localStorage may be blocked; the in-memory flag still hides the hint for this session */
    }
  }

  // Pre-fill when entering edit mode
  useEffect(() => {
    if (!editPost) return
    setInstantOpen(false)
    setOpen(true)
    setText(editPost.content)
    setPostType(editPost.type === 'announcement' ? 'announcement' : 'post')
    if (editPost.mediaUrls.length > 0) {
      setActiveTab('photo')
      setPhotos(
        editPost.mediaUrls.map((url, i) => ({
          file: new File([], `img-${i}`),
          previewUrl: url,
          s3Url: url,
        })),
      )
    } else {
      setActiveTab(null)
      setPhotos([])
    }
    setExistingAttachments(editPost.attachments ?? [])
    setAttachments([])
    setRemovedAttachmentIds([])
  }, [editPost])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => textareaRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [open])

  // Warn before page unload if composer has unsaved content
  useEffect(() => {
    if (!open) return
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (text.trim().length > 0 || photos.length > 0 || pollQuestion.trim().length > 0) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [open, text, photos, pollQuestion])

  // Open when the `c` keyboard shortcut fires
  useEffect(() => {
    function handleOpenEvent(event: Event) {
      const customEvent = event as CustomEvent<{ instant?: boolean }>
      setInstantOpen(customEvent.detail?.instant === true)
      setOpen(true)
    }
    window.addEventListener('uc:open-create-post', handleOpenEvent)
    return () => window.removeEventListener('uc:open-create-post', handleOpenEvent)
  }, [])

  if (!user) return null

  const name = user.profile.fullName ?? ''
  const firstName = name.split(' ')[0] ?? ''

  function handleClose(force = false) {
    const isDirty = text.trim().length > 0 || photos.length > 0 || pollQuestion.trim().length > 0
    if (!force && isDirty && !window.confirm('Discard this post?')) return
    setOpen(false)
    setInstantOpen(false)
    resetForm()
    onDismissEdit?.()
  }

  function resetForm() {
    setEmojiAnchor(null)
    setText('')
    setPostType('post')
    setActiveTab(null)
    setPhotos([])
    setPollQuestion('')
    setPollOptions([
      { id: '1', text: '' },
      { id: '2', text: '' },
    ])
    setPollExpiresAt('')
    setScheduleAt('')
    setPostMenuOpen(false)
    setSchedPickerOpen(false)
    setSchedDraft('')
    setAttachments([])
    setExistingAttachments([])
    setRemovedAttachmentIds([])
  }

  function toggleTab(tab: TabMode) {
    setActiveTab((prev) => (prev === tab ? null : tab))
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 4 - photos.length)
    if (!files.length) return

    const newItems: PhotoItem[] = files.map((f) => ({
      file: f,
      previewUrl: URL.createObjectURL(f),
    }))
    setPhotos((prev) => [...prev, ...newItems].slice(0, 4))
    if (fileInputRef.current) fileInputRef.current.value = ''

    setUploading(true)
    const results = await Promise.allSettled(newItems.map((item) => uploadPhoto(item.file)))
    setUploading(false)

    setPhotos((prev) =>
      prev.map((p) => {
        const i = newItems.findIndex((item) => item.previewUrl === p.previewUrl)
        if (i === -1) return p
        const result = results[i]!
        return result.status === 'fulfilled' ? { ...p, s3Url: result.value } : { ...p, failed: true }
      }),
    )
  }

  function removePhoto(previewUrl: string) {
    setPhotos((prev) => prev.filter((p) => p.previewUrl !== previewUrl))
  }

  function addPollOption() {
    if (pollOptions.length >= 10) return
    setPollOptions((prev) => [...prev, { id: Date.now().toString(), text: '' }])
  }

  function removePollOption(id: string) {
    if (pollOptions.length <= 2) return
    setPollOptions((prev) => prev.filter((o) => o.id !== id))
  }

  function updatePollOption(id: string, text: string) {
    setPollOptions((prev) => prev.map((o) => (o.id === id ? { ...o, text } : o)))
  }

  function insertMarkdown(before: string, after: string = before) {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = text.slice(start, end)
    const newText = text.slice(0, start) + before + selected + after + text.slice(end)
    setText(newText)
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(start + before.length, start + before.length + selected.length)
    }, 0)
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 400)}px`
  }

  function canSubmit() {
    if (uploading || attachmentsUploading || isSubmitting) return false
    // Never publish with a photo silently missing — a failed upload must be removed first.
    if (photos.some((p) => !p.s3Url)) return false
    if (activeTab === 'poll') {
      if (!pollQuestion.trim()) return false
      if (pollOptions.filter((o) => o.text.trim()).length < 2) return false
      return true
    }
    return text.trim().length > 0
  }

  /** `ignoreSchedule` backs the menu's "Post now", which publishes even if a time is set. */
  async function handleSubmit(asDraft = false, ignoreSchedule = false) {
    if (!canSubmit()) return
    const mediaUrls = photos.filter((p) => p.s3Url).map((p) => p.s3Url!)
    const pollData =
      activeTab === 'poll' && !isEditMode
        ? {
            question: pollQuestion.trim(),
            options: pollOptions.map((o) => o.text.trim()).filter(Boolean),
            expires_at: pollExpiresAt || null,
          }
        : undefined

    if (isEditMode && editPost) {
      await updatePost.mutateAsync({
        postId: editPost.id,
        input: {
          content: text.trim(),
          type: postType,
          media_urls: mediaUrls,
          attachments: attachments.length > 0 ? attachments : undefined,
          removedAttachmentIds: removedAttachmentIds.length > 0 ? removedAttachmentIds : undefined,
        },
      })
    } else {
      // A future schedule time keeps the post unpublished until it fires.
      const publishAt = scheduleAt && !ignoreSchedule ? new Date(scheduleAt) : null
      const isScheduled = publishAt !== null && publishAt.getTime() > Date.now()
      await createPost.mutateAsync({
        type: postType,
        content: text.trim(),
        media_urls: mediaUrls,
        attachments: attachments.length > 0 ? attachments : undefined,
        poll: pollData,
        group_id: groupId ?? null,
        is_published: isScheduled ? false : !asDraft,
        publish_at: isScheduled ? publishAt.toISOString() : undefined,
      })
    }
    handleClose(true)
  }

  const attachmentCount =
    (existingAttachments ?? []).filter((a) => !removedAttachmentIds.includes(a.id)).length +
    attachments.length
  const attachmentsFull = attachmentCount >= MAX_ATTACHMENTS_PER_ENTITY
  const schedDraftPast = !!schedDraft && new Date(schedDraft).getTime() <= Date.now()
  const hasSchedule = !!scheduleAt && !isEditMode

  function togglePostMenu() {
    setPostMenuOpen((o) => !o)
    setSchedPickerOpen(false)
    setSchedDraft(scheduleAt)
  }

  return (
    <>
      {/* Collapsed trigger */}
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: 16,
        }}
      >
        {showFirstPostHint && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              background: 'var(--uc-orange-bg)',
              border: '0.5px solid var(--uc-orange-bdr)',
              borderRadius: 'var(--r-md)',
              padding: '10px 12px',
              marginBottom: 12,
            }}
          >
            <Sparkles size={14} style={{ color: 'var(--uc-orange-l)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--uc-orange-l)' }}>
                Say hi to your campus
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Your first post helps people find you. Share a question, intro, or something happening this week.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissFirstPostHint}
              aria-label="Dismiss"
              className="press-feedback"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
                padding: 2,
                lineHeight: 0,
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar
            src={user.profile.avatarUrl}
            initials={getInitials(name)}
            color={avatarColor(user.id)}
            size={40}
          />
          <button
            className="interactive-surface"
            onClick={() => {
              setInstantOpen(false)
              setOpen(true)
            }}
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
      </div>

      {/* Modal */}
      {open && (
        <div
          className="create-post-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close composer"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--overlay-bg-strong)',
              border: 'none',
              padding: 0,
              margin: 0,
              cursor: 'default',
            }}
            onClick={() => handleClose()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                handleClose()
              }
            }}
          />

          {/* Modal panel — full-screen composer on mobile (see .create-post-panel in index.css) */}
          <div
            className={`create-post-panel${instantOpen ? '' : ' modal-panel-enter'}`}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 560,
              maxHeight: '90vh',
              background: 'var(--surface-card)',
              border: '0.5px solid var(--border-hover)',
              borderRadius: 'var(--r-lg)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'visible',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '14px 16px',
                borderBottom: '0.5px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Avatar
                src={user.profile.avatarUrl}
                initials={getInitials(name)}
                color={avatarColor(user.id)}
                size={40}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}
                >
                  {name}
                </p>
                {user.profile.headline && (
                  <p
                    style={{
                      margin: '2px 0 0',
                      fontSize: 12,
                      fontWeight: 400,
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {user.profile.headline}
                  </p>
                )}
              </div>

              {/* Announcement toggle */}
              {canAnnounce && (
                <div
                  style={{
                    display: 'flex',
                    background: 'var(--surface-raised)',
                    border: '0.5px solid var(--border-default)',
                    borderRadius: 'var(--r-pill)',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  {(['post', 'announcement'] as PostType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPostType(t)}
                      style={{
                        padding: '5px 12px',
                        fontSize: 12,
                        fontWeight: postType === t ? 500 : 400,
                        background: postType === t ? 'var(--uc-indigo-bg)' : 'transparent',
                        color:
                          postType === t ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background 150ms ease, color 150ms ease',
                      }}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => handleClose()}
                aria-label="Close composer"
                className="press-feedback row-hover-bg"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 'var(--r-sm)',
                  color: 'var(--text-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {/* Markdown toolbar */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {[
                  { icon: <Bold size={13} strokeWidth={1.5} />, title: 'Bold', action: () => insertMarkdown('**') },
                  { icon: <Italic size={13} strokeWidth={1.5} />, title: 'Italic', action: () => insertMarkdown('_') },
                  { icon: <Link size={13} strokeWidth={1.5} />, title: 'Link', action: () => insertMarkdown('[', '](url)') },
                ].map(({ icon, title, action }) => (
                  <button
                    key={title}
                    type="button"
                    title={title}
                    onClick={action}
                    className="interactive-surface"
                    style={{
                      background: 'transparent',
                      border: '0.5px solid var(--border-default)',
                      borderRadius: 'var(--r-sm)',
                      padding: '4px 7px',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextareaChange}
                placeholder="What's on your mind?"
                style={{
                  width: '100%',
                  minHeight: 120,
                  background: 'transparent',
                  border: 'none',
                  resize: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 15,
                  fontWeight: 400,
                  fontFamily: 'inherit',
                  lineHeight: 1.6,
                  boxSizing: 'border-box',
                  display: 'block',
                  outline: 'none',
                }}
              />

              {/* Photo thumbnails */}
              {activeTab === 'photo' && (
                <div style={{ marginTop: 8 }}>
                  {photos.length > 0 && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: photos.length === 1 ? '1fr' : '1fr 1fr',
                        gap: 4,
                        marginBottom: 10,
                        borderRadius: 'var(--r-md)',
                        overflow: 'hidden',
                      }}
                    >
                      {photos.map((p) => (
                        <div key={p.previewUrl} style={{ position: 'relative' }}>
                          <img
                            src={p.previewUrl}
                            alt=""
                            style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
                          />
                          <button
                            type="button"
                            onClick={() => removePhoto(p.previewUrl)}
                            aria-label="Remove photo"
                            className="press-feedback"
                            style={{
                              position: 'absolute',
                              top: 6,
                              right: 6,
                              background: 'var(--overlay-media)',
                              border: 'none',
                              borderRadius: '50%',
                              width: 24,
                              height: 24,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: 'var(--text-primary)',
                            }}
                          >
                            <X size={12} strokeWidth={2} />
                          </button>
                          {!p.s3Url && (
                            <div
                              style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'var(--overlay-media)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                pointerEvents: 'none',
                              }}
                            >
                              <span style={{ color: 'var(--text-primary)', fontSize: 12 }}>
                                {p.failed ? 'Upload failed — remove and try again' : 'Uploading…'}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {photos.length < 4 && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="interactive-surface"
                        style={{
                          width: '100%',
                          padding: '10px',
                          background: 'var(--surface-raised)',
                          border: '0.5px dashed var(--border-hover)',
                          borderRadius: 'var(--r-md)',
                          color: 'var(--text-secondary)',
                          fontSize: 13,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          boxSizing: 'border-box',
                        }}
                      >
                        <Image size={14} strokeWidth={1.5} />
                        {photos.length === 0
                          ? 'Add photos (max 4)'
                          : `Add more (${4 - photos.length} remaining)`}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* File attachments — opened from the paperclip in the footer; chips only once staged */}
              <div style={{ marginTop: attachmentCount > 0 ? 12 : 0 }}>
                <AttachmentPicker
                  ref={attachmentPickerRef}
                  hideButton
                  value={attachments}
                  onChange={setAttachments}
                  existing={existingAttachments}
                  removedIds={removedAttachmentIds}
                  onRemovedIdsChange={setRemovedAttachmentIds}
                  onUploadingChange={setAttachmentsUploading}
                  disabled={isSubmitting}
                />
              </div>

              {/* Poll UI */}
              {activeTab === 'poll' && !isEditMode && (
                <div
                  style={{
                    marginTop: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    background: 'var(--surface-raised)',
                    border: '0.5px solid var(--border-default)',
                    borderRadius: 'var(--r-md)',
                    padding: 14,
                  }}
                >
                  <input
                    type="text"
                    aria-label="Poll question"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder="Ask a question…"
                    maxLength={500}
                    style={pollInputStyle}
                  />
                  {pollOptions.map((opt, idx) => (
                    <div key={opt.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="text"
                        aria-label={`Poll option ${idx + 1}`}
                        value={opt.text}
                        onChange={(e) => updatePollOption(opt.id, e.target.value)}
                        placeholder={`Option ${idx + 1}`}
                        style={{ ...pollInputStyle, flex: 1 }}
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removePollOption(opt.id)}
                          aria-label="Remove poll option"
                          className="press-feedback"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 4,
                            color: 'var(--text-tertiary)',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <X size={14} strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 10 && (
                    <button
                      type="button"
                      onClick={addPollOption}
                      className="press-feedback"
                      style={{
                        fontSize: 12,
                        color: 'var(--uc-indigo-xl)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        padding: '2px 0',
                      }}
                    >
                      + Add option
                    </button>
                  )}
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Closes at (optional)
                    <input
                      type="datetime-local"
                      value={pollExpiresAt}
                      onChange={(e) => setPollExpiresAt(e.target.value)}
                      style={{ ...pollInputStyle, display: 'block', marginTop: 4, width: '100%', boxSizing: 'border-box' }}
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Schedule chip (posts only, not while editing) */}
            {hasSchedule && (
              <div style={{ padding: '0 16px 10px', display: 'flex' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 6px 5px 10px',
                    background: 'var(--uc-indigo-bg)',
                    border: '0.5px solid var(--uc-indigo-bdr)',
                    borderRadius: 'var(--r-pill)',
                    color: 'var(--uc-indigo-xl)',
                    fontSize: 12,
                  }}
                >
                  <Clock size={12} strokeWidth={1.5} />
                  Scheduled for {formatSchedule(scheduleAt)}
                  <button
                    type="button"
                    aria-label="Clear schedule"
                    onClick={() => setScheduleAt('')}
                    className="press-feedback"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--uc-indigo-xl)',
                      padding: 2,
                      lineHeight: 0,
                      borderRadius: '50%',
                    }}
                  >
                    <X size={12} strokeWidth={1.5} />
                  </button>
                </span>
              </div>
            )}

            {/* Footer */}
            <div
              className="composer-footer"
              style={{
                padding: '10px 16px',
                borderTop: '0.5px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', gap: 6 }}>
                <TabBtn
                  active={activeTab === 'photo'}
                  disabled={false}
                  title="Photo"
                  activeColor="var(--uc-mint)"
                  activeBg="var(--uc-mint-bg)"
                  onClick={() => toggleTab('photo')}
                >
                  <Image size={15} strokeWidth={1.5} />
                </TabBtn>
                <TabBtn
                  active={attachmentCount > 0}
                  disabled={attachmentsFull || attachmentsUploading || isSubmitting}
                  title={
                    attachmentCount === 0
                      ? 'Add attachments'
                      : `Add more (${MAX_ATTACHMENTS_PER_ENTITY - attachmentCount} left)`
                  }
                  activeColor="var(--uc-cyan)"
                  activeBg="var(--uc-cyan-bg)"
                  onClick={() => attachmentPickerRef.current?.open()}
                >
                  <Paperclip size={15} strokeWidth={1.5} />
                </TabBtn>
                <TabBtn
                  active={activeTab === 'poll'}
                  disabled={isEditMode}
                  title="Poll"
                  activeColor="var(--uc-orange)"
                  activeBg="var(--uc-orange-bg)"
                  onClick={() => toggleTab('poll')}
                >
                  <BarChart2 size={15} strokeWidth={1.5} />
                </TabBtn>
                {/* Stop mousedown so the picker's outside-click handler doesn't close it
                    just before this click toggles it back open. */}
                <span ref={emojiBtnRef} onMouseDown={(e) => e.stopPropagation()}>
                  <TabBtn
                    active={emojiAnchor !== null}
                    disabled={false}
                    title="Emoji"
                    activeColor="var(--uc-indigo-l)"
                    activeBg="var(--uc-indigo-bg)"
                    onClick={toggleEmoji}
                  >
                    <Smile size={15} strokeWidth={1.5} />
                  </TabBtn>
                </span>
              </div>

              <div className="composer-footer-actions" style={{ display: 'flex', gap: 8 }}>
                {!isEditMode && (
                  <GhostBtn onClick={() => handleSubmit(true)} disabled={!canSubmit()}>
                    Save as draft
                  </GhostBtn>
                )}
                <GhostBtn onClick={() => handleClose()} disabled={isSubmitting}>
                  Cancel
                </GhostBtn>
                <div ref={postMenuRef} style={{ position: 'relative', display: 'flex' }}>
                  <PrimaryBtn
                    onClick={() => handleSubmit(false)}
                    disabled={!canSubmit()}
                    style={
                      isEditMode
                        ? undefined
                        : { borderRadius: 'var(--r-pill) 0 0 var(--r-pill)', paddingRight: 16 }
                    }
                  >
                    {isSubmitting
                      ? isEditMode
                        ? 'Saving…'
                        : scheduleAt
                          ? 'Scheduling…'
                          : 'Posting…'
                      : isEditMode
                        ? 'Save'
                        : scheduleAt
                          ? 'Schedule'
                          : 'Post'}
                  </PrimaryBtn>
                  {!isEditMode && (
                    <button
                      type="button"
                      aria-label="More post options"
                      aria-haspopup="menu"
                      aria-expanded={postMenuOpen}
                      onClick={togglePostMenu}
                      disabled={isSubmitting}
                      className="press-feedback"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 12px 0 10px',
                        background: 'var(--uc-indigo)',
                        border: 'none',
                        borderLeft: '0.5px solid var(--border-strong)',
                        borderRadius: '0 var(--r-pill) var(--r-pill) 0',
                        color: 'var(--on-accent)',
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        opacity: isSubmitting ? 0.4 : 1,
                      }}
                    >
                      <ChevronDown size={14} strokeWidth={1.5} />
                    </button>
                  )}
                  {postMenuOpen && !isEditMode && (
                    <div
                      role="menu"
                      className="modal-panel-enter"
                      style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 6px)',
                        right: 0,
                        zIndex: 220,
                        width: 260,
                        background: 'var(--surface-card)',
                        border: '0.5px solid var(--border-hover)',
                        borderRadius: 'var(--r-md)',
                        padding: 4,
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        disabled={!canSubmit()}
                        onClick={() => {
                          setPostMenuOpen(false)
                          setScheduleAt('')
                          void handleSubmit(false, true)
                        }}
                        className="row-hover-bg"
                        style={{
                          ...menuItemStyle,
                          cursor: canSubmit() ? 'pointer' : 'not-allowed',
                          opacity: canSubmit() ? 1 : 0.4,
                        }}
                      >
                        <Send size={15} strokeWidth={1.5} />
                        <span style={{ flex: 1 }}>Post now</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        aria-expanded={schedPickerOpen}
                        onClick={() => {
                          setSchedPickerOpen((o) => !o)
                          setSchedDraft((d) => d || defaultScheduleSlot())
                        }}
                        className="row-hover-bg"
                        style={{
                          ...menuItemStyle,
                          background: schedPickerOpen ? 'var(--surface-raised)' : 'transparent',
                        }}
                      >
                        <Clock size={15} strokeWidth={1.5} />
                        <span style={{ flex: 1 }}>Schedule for later</span>
                        {schedPickerOpen ? (
                          <ChevronUp size={14} strokeWidth={1.5} />
                        ) : (
                          <ChevronRight size={14} strokeWidth={1.5} />
                        )}
                      </button>
                      {schedPickerOpen && (
                        <div
                          style={{
                            padding: '8px 10px 10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            borderTop: '0.5px solid var(--border-default)',
                            marginTop: 4,
                          }}
                        >
                          <label
                            style={{
                              fontSize: 12,
                              color: 'var(--text-secondary)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                            }}
                          >
                            Date and time
                            <input
                              type="datetime-local"
                              value={schedDraft}
                              min={toLocalInput(new Date())}
                              onChange={(e) => setSchedDraft(e.target.value)}
                              style={{
                                background: 'var(--surface-raised)',
                                border: '0.5px solid var(--border-default)',
                                borderRadius: 'var(--r-sm)',
                                padding: '7px 10px',
                                fontSize: 13,
                                fontFamily: 'inherit',
                                color: 'var(--text-primary)',
                                width: '100%',
                                boxSizing: 'border-box',
                              }}
                            />
                          </label>
                          {schedDraftPast && (
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--uc-red)' }}>
                              Pick a time in the future.
                            </p>
                          )}
                          <PrimaryBtn
                            onClick={() => {
                              setScheduleAt(schedDraft)
                              setPostMenuOpen(false)
                              setSchedPickerOpen(false)
                            }}
                            disabled={!schedDraft || schedDraftPast}
                            style={{ alignSelf: 'flex-end', padding: '7px 16px' }}
                          >
                            Set schedule
                          </PrimaryBtn>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {open && emojiAnchor &&
        createPortal(
          <div style={{ position: 'fixed', left: emojiAnchor.left, bottom: emojiAnchor.bottom, zIndex: 210 }}>
            <Suspense fallback={null}>
              <EmojiPicker onSelect={insertEmoji} onClose={() => setEmojiAnchor(null)} />
            </Suspense>
          </div>,
          document.body,
        )}
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface TabBtnProps {
  active: boolean
  disabled: boolean
  title: string
  activeColor: string
  activeBg: string
  onClick: () => void
  children: React.ReactNode
}

function TabBtn({ active, disabled, title, activeColor, activeBg, onClick, children }: TabBtnProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="press-feedback"
      style={{
        padding: '6px 10px',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-pill)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        transition: 'background 150ms ease, color 150ms ease',
        color: active ? activeColor : 'var(--text-secondary)',
        background: active ? activeBg : 'transparent',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  )
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '9px 10px',
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--r-sm)',
  color: 'var(--text-primary)',
  fontSize: 13,
  fontFamily: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
}

const pollInputStyle: React.CSSProperties = {
  background: 'var(--surface-page)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-sm)',
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 400,
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
}
