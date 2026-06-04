import { useEffect, useRef, useState } from 'react'
import { BarChart2, Bold, Image, Italic, Link, Sparkles, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { FeedPost } from '@uniconnect/shared'
import { useAuthStore } from '@/stores/authStore'
import { Avatar } from '@/components/Avatar'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { avatarColor, getInitials } from '@/utils/avatar'
import { api } from '@/lib/axios'
import { useCreatePost } from '@/features/feed/hooks/useCreatePost'
import { useUpdatePost } from '@/features/feed/hooks/useUpdatePost'

const FIRST_POST_HINT_KEY = 'uc:onboard:first-post-dismissed'

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
}

interface Props {
  editPost?: FeedPost | null
  onDismissEdit?: () => void
}

// ── CreatePost ────────────────────────────────────────────────────────────────

export function CreatePost({ editPost, onDismissEdit }: Props) {
  const user = useAuthStore((s) => s.user)
  const [open, setOpen] = useState(false)
  const [instantOpen, setInstantOpen] = useState(false)
  const [text, setText] = useState('')
  const [postType, setPostType] = useState<PostType>('post')
  const [activeTab, setActiveTab] = useState<TabMode>(null)

  // Photo state
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Poll state
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState<PollOption[]>([
    { id: '1', text: '' },
    { id: '2', text: '' },
  ])
  const [pollExpiresAt, setPollExpiresAt] = useState('')

  // Scheduling: a future local datetime publishes the post later (posts only).
  const [scheduleAt, setScheduleAt] = useState('')

  const textareaRef = useRef<HTMLTextAreaElement>(null)
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
        .get<{ data: { profileScore: number; hasMadePost: boolean; followerCount: number; isVerified: boolean } }>(
          '/users/me/progress',
        )
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
  const showFirstPostHint = !isEditMode && progress != null && !progress.hasMadePost && !firstHintDismissed
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
  }, [editPost])

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 50)
  }, [open])

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

  function handleClose() {
    setOpen(false)
    setInstantOpen(false)
    resetForm()
    onDismissEdit?.()
  }

  function resetForm() {
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
    const results = await Promise.allSettled(
      newItems.map(async (item) => {
        const { data } = await api.post<{ data: { uploadUrl: string; fileUrl: string } }>(
          '/upload/presign',
          { filename: item.file.name, contentType: item.file.type },
        )
        await fetch(data.data.uploadUrl, {
          method: 'PUT',
          body: item.file,
          headers: { 'Content-Type': item.file.type },
        })
        return { previewUrl: item.previewUrl, s3Url: data.data.fileUrl }
      }),
    )
    setUploading(false)

    setPhotos((prev) =>
      prev.map((p) => {
        const match = results.find(
          (r) => r.status === 'fulfilled' && r.value.previewUrl === p.previewUrl,
        )
        return match?.status === 'fulfilled' ? { ...p, s3Url: match.value.s3Url } : p
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
    if (uploading || isSubmitting) return false
    if (activeTab === 'poll') {
      if (!pollQuestion.trim()) return false
      if (pollOptions.filter((o) => o.text.trim()).length < 2) return false
      return true
    }
    return text.trim().length > 0
  }

  async function handleSubmit(asDraft = false) {
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
        },
      })
    } else {
      // A future schedule time keeps the post unpublished until it fires.
      const publishAt = scheduleAt ? new Date(scheduleAt) : null
      const isScheduled = publishAt !== null && publishAt.getTime() > Date.now()
      await createPost.mutateAsync({
        type: postType,
        content: text.trim(),
        media_urls: mediaUrls,
        poll: pollData,
        is_published: isScheduled ? false : !asDraft,
        publish_at: isScheduled ? publishAt.toISOString() : undefined,
      })
    }
    handleClose()
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
          <Avatar initials={getInitials(name)} color={avatarColor(user.id)} size={40} />
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
          <div
            style={{ position: 'absolute', inset: 0, background: 'var(--overlay-bg-strong)' }}
            onClick={handleClose}
          />

          {/* Modal panel */}
          <div
            className={instantOpen ? undefined : 'modal-panel-enter'}
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
              overflow: 'hidden',
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
              <Avatar initials={getInitials(name)} color={avatarColor(user.id)} size={40} />
              <div style={{ flex: 1 }}>
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
                onClick={handleClose}
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
                  outline: 'none',
                  resize: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 15,
                  fontWeight: 400,
                  fontFamily: 'inherit',
                  lineHeight: 1.6,
                  boxSizing: 'border-box',
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
                                background: 'var(--overlay-bg-soft)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <span style={{ color: 'var(--text-primary)', fontSize: 12 }}>Uploading…</span>
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
                        value={opt.text}
                        onChange={(e) => updatePollOption(opt.id, e.target.value)}
                        placeholder={`Option ${idx + 1}`}
                        style={{ ...pollInputStyle, flex: 1 }}
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removePollOption(opt.id)}
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

            {/* Schedule (posts only, not while editing) */}
            {!isEditMode && (
              <div style={{ padding: '0 16px 10px' }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  Schedule for later (optional)
                  <input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                    style={{
                      background: 'var(--surface-raised)',
                      border: '0.5px solid var(--border-default)',
                      borderRadius: 'var(--r-sm)',
                      padding: '6px 10px',
                      fontSize: 13,
                      color: 'var(--text-primary)',
                    }}
                  />
                  {scheduleAt && (
                    <button
                      type="button"
                      onClick={() => setScheduleAt('')}
                      className="row-hover-bg"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-tertiary)', padding: '2px 6px', borderRadius: 'var(--r-sm)' }}
                    >
                      Clear
                    </button>
                  )}
                </label>
              </div>
            )}

            {/* Footer */}
            <div
              style={{
                padding: '10px 16px',
                borderTop: '0.5px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
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
                  active={activeTab === 'poll'}
                  disabled={isEditMode}
                  title="Poll"
                  activeColor="var(--uc-orange)"
                  activeBg="var(--uc-orange-bg)"
                  onClick={() => toggleTab('poll')}
                >
                  <BarChart2 size={15} strokeWidth={1.5} />
                </TabBtn>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {!isEditMode && (
                  <GhostBtn onClick={() => handleSubmit(true)} disabled={!canSubmit()}>
                    Save as draft
                  </GhostBtn>
                )}
                <GhostBtn onClick={handleClose} disabled={isSubmitting}>
                  Cancel
                </GhostBtn>
                <PrimaryBtn onClick={() => handleSubmit(false)} disabled={!canSubmit()}>
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
              </div>
            </div>
          </div>
        </div>
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
