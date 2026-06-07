import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Image, Loader2, MapPin, Monitor, X } from 'lucide-react'
import type { AttachmentInput, ContentAttachment } from '@uniconnect/shared'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { usePresignedUpload } from '@/hooks/usePresignedUpload'
import { GhostBtn, OrangeBtn } from '@/components/Button'
import { AttachmentPicker } from '@/components/AttachmentPicker'
import { queryClient } from '@/lib/queryClient'

// ── Types ─────────────────────────────────────────────────────────────────────

type EventTypeOption = 'general' | 'career_fair' | 'seminar' | 'workshop' | 'alumni_meetup' | 'club'

export interface EventEditInitial {
  id: string
  title: string
  type: EventTypeOption
  description: string
  isOnline: boolean
  location: string
  onlineLink: string
  startsAt: string // ISO
  endsAt: string | null // ISO
  capacity: number | null
  coverUrl: string | null
  isPublished: boolean
  attachments?: ContentAttachment[]
}

interface Props {
  onClose: () => void
  /** When provided, the form edits this existing event (PATCH) instead of creating one. */
  initial?: EventEditInitial
}

interface EventForm {
  title: string
  type: EventTypeOption | ''
  description: string
  isOnline: boolean
  location: string
  onlineLink: string
  startsAt: string  // datetime-local: "2026-05-16T10:00"
  endsAt: string
  capacity: string  // numeric string; '' = unlimited
  isPublished: boolean
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const fieldStyle: React.CSSProperties = {
  padding: '9px 12px',
  fontSize: 13,
  fontWeight: 400,
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-md)',
  color: 'var(--text-primary)',
  outline: 'none',
  width: '100%',
  fontFamily: 'inherit',
  transition: 'border-color 150ms',
}

const SELECT_CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(238,242,255,0.28)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")"

function focusBorder(
  e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
) {
  e.currentTarget.style.borderColor = 'var(--uc-indigo-bdr)'
}
function blurBorder(
  e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
) {
  e.currentTarget.style.borderColor = 'var(--border-default)'
}

function Label({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label htmlFor={htmlFor} style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
      {children}
      {!required && (
        <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 4 }}>
          (optional)
        </span>
      )}
    </label>
  )
}

// ── CreateEventForm ───────────────────────────────────────────────────────────

const EMPTY: EventForm = {
  title: '',
  type: '',
  description: '',
  isOnline: false,
  location: '',
  onlineLink: '',
  startsAt: '',
  endsAt: '',
  capacity: '',
  isPublished: true,
}

/** ISO timestamp → "YYYY-MM-DDTHH:mm" in local time for a datetime-local input. */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function CreateEventForm({ onClose, initial }: Props) {
  const isEdit = Boolean(initial)
  const role = useAuthStore((s) => s.user?.role)
  const overlayRef   = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm]                 = useState<EventForm>(() =>
    initial
      ? {
          title: initial.title,
          type: initial.type,
          description: initial.description,
          isOnline: initial.isOnline,
          location: initial.location,
          onlineLink: initial.onlineLink,
          startsAt: toLocalInput(initial.startsAt),
          endsAt: initial.endsAt ? toLocalInput(initial.endsAt) : '',
          capacity: initial.capacity != null ? String(initial.capacity) : '',
          isPublished: initial.isPublished,
        }
      : EMPTY,
  )
  const [coverPreview, setCoverPreview] = useState<string | null>(initial?.coverUrl ?? null)
  const [coverUrl, setCoverUrl]         = useState<string | null>(initial?.coverUrl ?? null)
  const [dateErr, setDateErr]           = useState<string | null>(null)
  const [attachments, setAttachments]   = useState<AttachmentInput[]>([])
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([])
  const [attachmentsUploading, setAttachmentsUploading] = useState(false)
  const { upload: uploadCover, uploading: coverUploading, error: uploadErr, reset: resetUploadErr } = usePresignedUpload('events')

  function set<K extends keyof EventForm>(field: K, value: EventForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (field === 'startsAt' || field === 'endsAt') setDateErr(null)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverPreview(URL.createObjectURL(file))
    resetUploadErr()
    try {
      setCoverUrl(await uploadCover(file))
    } catch {
      setCoverPreview(null)
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function removeCover() {
    setCoverPreview(null)
    setCoverUrl(null)
    resetUploadErr()
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const content = {
        title: form.title.trim(),
        type: form.type || undefined,
        description: form.description.trim(),
        isOnline: form.isOnline,
        ...(form.isOnline
          ? { onlineLink: form.onlineLink.trim() || undefined }
          : { location: form.location.trim() }),
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        capacity: form.capacity ? parseInt(form.capacity, 10) : null,
        coverUrl: coverUrl ?? null,
        attachments: attachments.length > 0 ? attachments : undefined,
      }
      // Events publish via a dedicated PATCH /events/:id/publish route, so the update
      // payload intentionally omits isPublished (UpdateEventSchema rejects it).
      return initial
        ? api.patch(`/events/${initial.id}`, {
            ...content,
            removedAttachmentIds: removedAttachmentIds.length > 0 ? removedAttachmentIds : undefined,
          })
        : api.post('/events', { ...content, isPublished: form.isPublished })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      if (initial) queryClient.invalidateQueries({ queryKey: ['events', 'detail', initial.id] })
      queryClient.invalidateQueries({ queryKey: ['content-sync', 'pending'] })
      onClose()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) {
      setDateErr('End time must be after start time.')
      return
    }
    saveMutation.mutate()
  }

  const locationValid = form.isOnline ? !!form.onlineLink.trim() : !!form.location.trim()
  const isValid =
    !!form.title.trim() &&
    !!form.type &&
    !!form.description.trim() &&
    locationValid &&
    !!form.startsAt &&
    !!form.endsAt

  // Role guard — must be after all hooks
  if (role !== 'faculty' && role !== 'admin') {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--overlay-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-strong)',
            borderRadius: 'var(--r-xl)',
            padding: '32px 24px',
            textAlign: 'center',
            maxWidth: 320,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            Permission required
          </p>
          <p style={{ margin: '0 0 20px', fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
            Only faculty and admins can create events.
          </p>
          <GhostBtn onClick={onClose}>Close</GhostBtn>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay-bg)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        zIndex: 200,
        padding: '32px 16px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-strong)',
          borderRadius: 'var(--r-xl)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>
            {isEdit ? 'Edit event' : 'Create event'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: 'var(--text-tertiary)',
              lineHeight: 0,
            }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="cef-title" required>Event title</Label>
            <input
              id="cef-title"
              type="text"
              required
              placeholder="Career Fair 2026"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              style={fieldStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>

          {/* Type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="cef-type" required>Event type</Label>
            <select
              id="cef-type"
              required
              value={form.type}
              onChange={(e) => set('type', e.target.value as EventTypeOption | '')}
              style={{
                ...fieldStyle,
                appearance: 'none',
                backgroundImage: SELECT_CHEVRON,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                paddingRight: 32,
                colorScheme: 'dark',
              }}
              onFocus={focusBorder}
              onBlur={blurBorder}
            >
              <option value="" disabled>Select type…</option>
              <option value="general">General</option>
              <option value="career_fair">Career fair</option>
              <option value="seminar">Seminar</option>
              <option value="workshop">Workshop</option>
              <option value="alumni_meetup">Alumni meetup</option>
              <option value="club">Club</option>
            </select>
          </div>

          {/* Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="cef-desc" required>Description</Label>
            <textarea
              id="cef-desc"
              required
              rows={4}
              placeholder="Describe the event, what attendees can expect…"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.6 }}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>

          {/* Location / online toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Label htmlFor={form.isOnline ? 'cef-link' : 'cef-loc'} required>
              {form.isOnline ? 'Online link' : 'Location'}
            </Label>

            {/* Toggle */}
            <div
              style={{
                display: 'inline-flex',
                alignSelf: 'flex-start',
                border: '0.5px solid var(--border-default)',
                borderRadius: 'var(--r-md)',
                overflow: 'hidden',
              }}
            >
              {([false, true] as const).map((online) => (
                <button
                  key={String(online)}
                  type="button"
                  onClick={() => set('isOnline', online)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: form.isOnline === online ? 500 : 400,
                    background: form.isOnline === online ? 'var(--uc-indigo-bg)' : 'transparent',
                    color: form.isOnline === online ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 150ms, color 150ms',
                  }}
                >
                  {online
                    ? <Monitor size={12} strokeWidth={1.5} />
                    : <MapPin size={12} strokeWidth={1.5} />}
                  {online ? 'Online' : 'In-person'}
                </button>
              ))}
            </div>

            {/* Conditional input */}
            {form.isOnline ? (
              <input
                id="cef-link"
                type="url"
                required
                placeholder="https://zoom.us/j/... or meet.google.com/..."
                value={form.onlineLink}
                onChange={(e) => set('onlineLink', e.target.value)}
                style={fieldStyle}
                onFocus={focusBorder}
                onBlur={blurBorder}
              />
            ) : (
              <input
                id="cef-loc"
                type="text"
                required
                placeholder="UIU Campus, Madani Ave, Dhaka"
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                style={fieldStyle}
                onFocus={focusBorder}
                onBlur={blurBorder}
              />
            )}
          </div>

          {/* Cover image */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="cef-cover">Cover image</Label>
            <input
              ref={fileInputRef}
              id="cef-cover"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {coverPreview ? (
              <div
                style={{
                  position: 'relative',
                  height: 120,
                  borderRadius: 'var(--r-md)',
                  overflow: 'hidden',
                  border: '0.5px solid var(--border-default)',
                }}
              >
                <img
                  src={coverPreview}
                  alt="Cover preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                {coverUploading ? (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'var(--overlay-media)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Loader2
                      size={22}
                      strokeWidth={1.5}
                      color="var(--uc-indigo-l)"
                      className="animate-spin"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={removeCover}
                    aria-label="Remove cover"
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'var(--overlay-bg)',
                      border: '0.5px solid var(--border-default)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <X size={14} strokeWidth={2} />
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  height: 80,
                  background: 'var(--surface-raised)',
                  border: '0.5px dashed var(--border-hover)',
                  borderRadius: 'var(--r-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                  transition: 'border-color 150ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--uc-indigo-bdr)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-hover)'
                }}
              >
                <Image size={20} strokeWidth={1.5} />
                <span style={{ fontSize: 12, fontWeight: 400 }}>Click to upload cover image</span>
              </button>
            )}

            {uploadErr && (
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--uc-red)' }}>
                {uploadErr}
              </span>
            )}
          </div>

          {/* Attachments */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="cef-attach">Attachments</Label>
            <AttachmentPicker
              value={attachments}
              onChange={setAttachments}
              existing={initial?.attachments}
              removedIds={removedAttachmentIds}
              onRemovedIdsChange={setRemovedAttachmentIds}
              onUploadingChange={setAttachmentsUploading}
              disabled={saveMutation.isPending}
            />
          </div>

          {/* Starts at + Ends at */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label htmlFor="cef-starts" required>Starts at</Label>
              <input
                id="cef-starts"
                type="datetime-local"
                required
                value={form.startsAt}
                onChange={(e) => set('startsAt', e.target.value)}
                style={{ ...fieldStyle, colorScheme: 'dark' }}
                onFocus={focusBorder}
                onBlur={blurBorder}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label htmlFor="cef-ends" required>Ends at</Label>
              <input
                id="cef-ends"
                type="datetime-local"
                required
                min={form.startsAt || undefined}
                value={form.endsAt}
                onChange={(e) => set('endsAt', e.target.value)}
                style={{
                  ...fieldStyle,
                  colorScheme: 'dark',
                  ...(dateErr ? { borderColor: 'var(--uc-red)' } : {}),
                }}
                onFocus={focusBorder}
                onBlur={blurBorder}
              />
              {dateErr && (
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--uc-red)', marginTop: -2 }}>
                  {dateErr}
                </span>
              )}
            </div>
          </div>

          {/* Capacity */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="cef-cap">Capacity</Label>
            <input
              id="cef-cap"
              type="number"
              min={1}
              step={1}
              placeholder="500"
              value={form.capacity}
              onChange={(e) => set('capacity', e.target.value)}
              style={fieldStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)', marginTop: -2 }}>
              Leave empty for unlimited attendance
            </span>
          </div>

          {/* Publish toggle — create only; editing publishes via the detail page's Publish button */}
          {!isEdit && (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                padding: '10px 12px',
                background: 'var(--surface-raised)',
                border: '0.5px solid var(--border-default)',
                borderRadius: 'var(--r-md)',
              }}
            >
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => set('isPublished', e.target.checked)}
                style={{ width: 14, height: 14, accentColor: 'var(--uc-indigo)', cursor: 'pointer' }}
              />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 400, color: 'var(--text-primary)' }}>
                Publish immediately
              </span>
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                {form.isPublished ? 'Visible to all members' : 'Save as draft'}
              </span>
            </label>
          )}

          {/* Server error */}
          {saveMutation.isError && (
            <p style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--uc-red)' }}>
              Something went wrong. Please try again.
            </p>
          )}

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
              paddingTop: 4,
              borderTop: '0.5px solid var(--border-default)',
            }}
          >
            <GhostBtn type="button" onClick={onClose}>
              Cancel
            </GhostBtn>
            <OrangeBtn
              type="submit"
              disabled={!isValid || coverUploading || attachmentsUploading || saveMutation.isPending}
            >
              {saveMutation.isPending
                ? 'Saving…'
                : isEdit
                  ? 'Save changes'
                  : form.isPublished
                    ? 'Create & publish'
                    : 'Save draft'}
            </OrangeBtn>
          </div>
        </form>
      </div>
    </div>
  )
}
