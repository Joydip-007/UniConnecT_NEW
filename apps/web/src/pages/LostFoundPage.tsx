import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { CheckCircle2, Image as ImageIcon, MapPin, Phone, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { GhostBtn, OrangeBtn, PrimaryBtn } from '@/components/Button'
import { Avatar } from '@/components/Avatar'

// ── Types ─────────────────────────────────────────────────────────────────────

type LostFoundType = 'lost' | 'found'
type FilterTab = 'all' | 'lost' | 'found'

interface LFAuthor {
  fullName: string
  avatarUrl: string | null
  department: string | null
  batchYear: string | null
}

interface LostFoundItem {
  id: string
  type: LostFoundType
  itemName: string
  description: string
  imageUrls: string[]
  locationDetail: string
  contactInfo: string
  isResolved: boolean
  authorId: string
  author: LFAuthor
  createdAt: string
}

interface LFPage {
  items: LostFoundItem[]
  total: number
  page: number
  hasMore: boolean
}

interface UploadedImage {
  url: string
  preview: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FILTER_TABS: { label: string; value: FilterTab }[] = [
  { label: 'All', value: 'all' },
  { label: 'Lost', value: 'lost' },
  { label: 'Found', value: 'found' },
]

const AVATAR_PALETTE = ['#5B5BD6', '#F05A28', '#06B6D4', '#10B981', '#8B5CF6']
const MAX_IMAGES = 3
const MAX_IMG_BYTES = 5 * 1024 * 1024

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
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

function focusBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = 'var(--uc-indigo-bdr)'
}
function blurBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = 'var(--border-default)'
}

function seedColor(id: string): string {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true })
  } catch {
    return iso
  }
}

// ── TypeBadge ─────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: LostFoundType }) {
  const lost = type === 'lost'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--r-pill)',
        fontSize: 11,
        fontWeight: 500,
        background: lost ? 'var(--uc-orange-bg)' : 'var(--uc-cyan-bg)',
        border: `0.5px solid ${lost ? 'var(--uc-orange-bdr)' : 'rgba(6, 182, 212, 0.28)'}`,
        color: lost ? 'var(--uc-orange-l)' : 'var(--uc-cyan)',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {lost ? 'Lost' : 'Found'}
    </span>
  )
}

// ── SkeletonCard ──────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--surface-raised)',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            style={{ height: 13, width: '40%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }}
          />
          <div
            style={{ height: 11, width: '25%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }}
          />
        </div>
        <div
          style={{ width: 48, height: 20, borderRadius: 'var(--r-pill)', background: 'var(--surface-raised)' }}
        />
      </div>
      <div style={{ height: 15, width: '60%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
      <div style={{ height: 12, width: '45%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
      <div style={{ display: 'flex', gap: 6 }}>
        {[80, 64, 96].map((w, i) => (
          <div
            key={i}
            style={{ height: 26, width: w, borderRadius: 'var(--r-pill)', background: 'var(--surface-raised)' }}
          />
        ))}
      </div>
    </div>
  )
}

// ── LostFoundCard ─────────────────────────────────────────────────────────────

interface LostFoundCardProps {
  item: LostFoundItem
  currentUserId: string | undefined
}

function LostFoundCard({ item, currentUserId }: LostFoundCardProps) {
  const queryClient = useQueryClient()
  const [showContact, setShowContact] = useState(false)
  const isOwn = currentUserId === item.authorId

  const resolveMutation = useMutation({
    mutationFn: () => api.patch(`/lost-found/${item.id}/resolve`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lost-found', 'list'] })
      toast.success('Item marked as resolved')
    },
    onError: () => {
      toast.error('Failed to update item')
    },
  })

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: `0.5px solid ${item.isResolved ? 'rgba(16,185,129,0.18)' : 'var(--border-default)'}`,
        borderRadius: 'var(--r-lg)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        opacity: item.isResolved ? 0.75 : 1,
        transition: 'opacity 150ms',
      }}
    >
      {/* Header: avatar + author + type badge */}
      <div
        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {item.author.avatarUrl ? (
            <img
              src={item.author.avatarUrl}
              alt={item.author.fullName}
              style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <Avatar
              initials={getInitials(item.author.fullName)}
              color={seedColor(item.authorId)}
              size={36}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.author.fullName}
            </p>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>
              {relativeTime(item.createdAt)}
            </p>
          </div>
        </div>
        <TypeBadge type={item.type} />
      </div>

      {/* Item name + description */}
      <div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
          {item.itemName}
        </p>
        {item.description && (
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--text-secondary)',
              lineHeight: 1.55,
            }}
          >
            {item.description}
          </p>
        )}
      </div>

      {/* Location */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <MapPin size={12} strokeWidth={1.5} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
          {item.locationDetail}
        </span>
      </div>

      {/* Image thumbnails */}
      {item.imageUrls.length > 0 && (
        <div style={{ display: 'flex', gap: 6 }}>
          {item.imageUrls.slice(0, 3).map((url, i) => (
            <div
              key={i}
              style={{
                position: 'relative',
                width: 72,
                height: 72,
                borderRadius: 'var(--r-sm)',
                overflow: 'hidden',
                border: '0.5px solid var(--border-default)',
                flexShrink: 0,
              }}
            >
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {i === 2 && item.imageUrls.length > 3 && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(6,13,26,0.72)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                  }}
                >
                  +{item.imageUrls.length - 3}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Resolved banner */}
      {item.isResolved && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            background: 'var(--uc-mint-bg)',
            border: '0.5px solid rgba(16,185,129,0.28)',
            borderRadius: 'var(--r-md)',
          }}
        >
          <CheckCircle2 size={13} strokeWidth={1.5} color="var(--uc-mint)" />
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--uc-mint)' }}>Resolved</span>
        </div>
      )}

      {/* Actions row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setShowContact((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 400,
            background: showContact ? 'var(--uc-indigo-bg)' : 'var(--surface-raised)',
            border: `0.5px solid ${showContact ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
            borderRadius: 'var(--r-pill)',
            color: showContact ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'background 150ms, color 150ms, border-color 150ms',
          }}
        >
          <Phone size={12} strokeWidth={1.5} />
          Contact
        </button>

        {isOwn && !item.isResolved && (
          <button
            type="button"
            onClick={() => resolveMutation.mutate()}
            disabled={resolveMutation.isPending}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 400,
              background: 'var(--uc-mint-bg)',
              border: '0.5px solid rgba(16,185,129,0.28)',
              borderRadius: 'var(--r-pill)',
              color: 'var(--uc-mint)',
              cursor: resolveMutation.isPending ? 'default' : 'pointer',
              opacity: resolveMutation.isPending ? 0.6 : 1,
              transition: 'opacity 150ms',
            }}
          >
            <CheckCircle2 size={12} strokeWidth={1.5} />
            {resolveMutation.isPending ? 'Resolving…' : 'Mark as resolved'}
          </button>
        )}
      </div>

      {/* Contact info reveal */}
      {showContact && (
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--surface-raised)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-md)',
            fontSize: 13,
            fontWeight: 400,
            color: 'var(--text-primary)',
            lineHeight: 1.55,
          }}
        >
          {item.contactInfo}
        </div>
      )}
    </div>
  )
}

// ── PostItemModal ─────────────────────────────────────────────────────────────

interface PostItemModalProps {
  onClose: () => void
}

function PostItemModal({ onClose }: PostItemModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const [itemType, setItemType] = useState<LostFoundType>('lost')
  const [itemName, setItemName] = useState('')
  const [description, setDescription] = useState('')
  const [locationDetail, setLocationDetail] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [images, setImages] = useState<UploadedImage[]>([])
  const [uploadingImg, setUploadingImg] = useState(false)

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

  async function handleImgChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    const toUpload = files.slice(0, MAX_IMAGES - images.length)
    if (!toUpload.length) return

    setUploadingImg(true)

    for (const file of toUpload) {
      if (file.size > MAX_IMG_BYTES) {
        toast.error(`${file.name} exceeds 5 MB`)
        continue
      }
      const preview = URL.createObjectURL(file)
      try {
        const presignRes = await api.post<{
          data: { uploadUrl: string; publicUrl: string }
        }>('/upload/presign', {
          fileName: file.name,
          fileType: file.type,
          folder: 'lost-found',
        })
        const { uploadUrl, publicUrl } = presignRes.data.data
        const s3Res = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        })
        if (!s3Res.ok) throw new Error('S3 upload failed')
        setImages((prev) => [...prev, { url: publicUrl, preview }])
      } catch {
        URL.revokeObjectURL(preview)
        toast.error(`Failed to upload ${file.name}`)
      }
    }

    setUploadingImg(false)
    if (imgInputRef.current) imgInputRef.current.value = ''
  }

  function removeImage(index: number) {
    setImages((prev) => {
      const next = [...prev]
      URL.revokeObjectURL(next[index].preview)
      next.splice(index, 1)
      return next
    })
  }

  const submitMutation = useMutation({
    mutationFn: () =>
      api
        .post('/lost-found', {
          type: itemType,
          itemName: itemName.trim(),
          ...(description.trim() && { description: description.trim() }),
          imageUrls: images.map((img) => img.url),
          locationDetail: locationDetail.trim(),
          contactInfo: contactInfo.trim(),
        })
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lost-found', 'list'] })
      toast.success('Item posted')
      onClose()
    },
    onError: () => {
      toast.error('Failed to post item')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    submitMutation.mutate()
  }

  const canSubmit =
    itemName.trim().length > 0 &&
    locationDetail.trim().length > 0 &&
    contactInfo.trim().length > 0 &&
    !uploadingImg &&
    !submitMutation.isPending

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(6,13,26,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-strong)',
          borderRadius: 'var(--r-xl)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          margin: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
        >
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>
            Report item
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Type toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              Type
            </label>
            <div
              style={{
                display: 'flex',
                gap: 4,
                padding: 4,
                background: 'var(--surface-raised)',
                borderRadius: 'var(--r-pill)',
              }}
            >
              {(['lost', 'found'] as LostFoundType[]).map((t) => {
                const active = itemType === t
                const isLost = t === 'lost'
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setItemType(t)}
                    style={{
                      flex: 1,
                      padding: '7px 0',
                      fontSize: 13,
                      fontWeight: active ? 500 : 400,
                      borderRadius: 'var(--r-pill)',
                      border: 'none',
                      cursor: 'pointer',
                      background: active
                        ? isLost
                          ? 'var(--uc-orange-bg)'
                          : 'var(--uc-cyan-bg)'
                        : 'transparent',
                      color: active
                        ? isLost
                          ? 'var(--uc-orange-l)'
                          : 'var(--uc-cyan)'
                        : 'var(--text-secondary)',
                      transition: 'background 150ms, color 150ms',
                    }}
                  >
                    {t === 'lost' ? 'Lost' : 'Found'}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Item name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              htmlFor="lfItemName"
              style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}
            >
              Item name
            </label>
            <input
              id="lfItemName"
              type="text"
              placeholder="e.g. Blue wallet, iPhone 14, student ID"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              style={inputStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>

          {/* Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              htmlFor="lfDesc"
              style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}
            >
              Description{' '}
              <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(optional)</span>
            </label>
            <textarea
              id="lfDesc"
              rows={3}
              placeholder="Identifying details, when and where it was lost or found…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>

          {/* Photos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              Photos{' '}
              <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(up to 3)</span>
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {images.map((img, i) => (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    width: 80,
                    height: 80,
                    flexShrink: 0,
                    borderRadius: 'var(--r-sm)',
                    overflow: 'hidden',
                    border: '0.5px solid var(--border-default)',
                  }}
                >
                  <img
                    src={img.preview}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    aria-label="Remove photo"
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: 'rgba(6,13,26,0.80)',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 0,
                      color: 'var(--text-primary)',
                    }}
                  >
                    <X size={11} strokeWidth={2} />
                  </button>
                </div>
              ))}

              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => imgInputRef.current?.click()}
                  disabled={uploadingImg}
                  style={{
                    width: 80,
                    height: 80,
                    flexShrink: 0,
                    borderRadius: 'var(--r-sm)',
                    border: '0.5px dashed var(--border-hover)',
                    background: 'var(--surface-raised)',
                    cursor: uploadingImg ? 'default' : 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    color: 'var(--text-tertiary)',
                    opacity: uploadingImg ? 0.6 : 1,
                    transition: 'background 150ms, opacity 150ms',
                  }}
                  onMouseEnter={(e) => {
                    if (!uploadingImg) e.currentTarget.style.background = 'var(--surface-hover)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--surface-raised)'
                  }}
                >
                  {uploadingImg ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 400,
                        color: 'var(--text-tertiary)',
                        textAlign: 'center',
                        padding: '0 4px',
                      }}
                    >
                      Uploading…
                    </span>
                  ) : (
                    <>
                      <ImageIcon size={18} strokeWidth={1.5} />
                      <span style={{ fontSize: 10, fontWeight: 400 }}>Add photo</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <input
              ref={imgInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImgChange}
              style={{ display: 'none' }}
              aria-label="Upload photos"
            />
          </div>

          {/* Location */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              htmlFor="lfLocation"
              style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}
            >
              Location
            </label>
            <input
              id="lfLocation"
              type="text"
              placeholder="e.g. Library 2nd floor, main cafeteria, gate 1"
              value={locationDetail}
              onChange={(e) => setLocationDetail(e.target.value)}
              style={inputStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>

          {/* Contact info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              htmlFor="lfContact"
              style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}
            >
              Contact info
            </label>
            <input
              id="lfContact"
              type="text"
              placeholder="Phone number or email"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              style={inputStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <GhostBtn type="button" onClick={onClose}>
              Cancel
            </GhostBtn>
            <PrimaryBtn type="submit" disabled={!canSubmit}>
              {submitMutation.isPending ? 'Posting…' : 'Post item'}
            </PrimaryBtn>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── LostFoundPage ─────────────────────────────────────────────────────────────

export default function LostFoundPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('type') as FilterTab | null
  const activeTab: FilterTab =
    rawTab !== null && FILTER_TABS.some((t) => t.value === rawTab) ? rawTab : 'all'
  const showResolved = searchParams.get('resolved') === 'true'

  const [modalOpen, setModalOpen] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const currentUserId = useAuthStore((s) => s.user?.id)

  const queryKey = ['lost-found', 'list', { type: activeTab, resolved: showResolved }]

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery<LFPage>({
      queryKey,
      queryFn: ({ pageParam }) =>
        api
          .get<{ data: LFPage }>('/lost-found', {
            params: {
              page: pageParam,
              ...(activeTab !== 'all' && { type: activeTab }),
              isResolved: showResolved,
            },
          })
          .then((r) => r.data.data),
      initialPageParam: 1,
      getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    })

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const items = data?.pages.flatMap((p) => p.items) ?? []
  const allCaughtUp = !isLoading && !hasNextPage && items.length > 0

  function setTab(value: FilterTab) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === 'all') next.delete('type')
        else next.set('type', value)
        return next
      },
      { replace: true },
    )
  }

  function toggleResolved() {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (showResolved) next.delete('resolved')
        else next.set('resolved', 'true')
        return next
      },
      { replace: true },
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <nav
          style={{
            flex: 1,
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            padding: '4px 6px',
            display: 'flex',
            gap: 2,
            minWidth: 0,
          }}
        >
          {FILTER_TABS.map(({ label, value }) => {
            const active = activeTab === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                style={{
                  flex: '1 0 auto',
                  padding: '7px 12px',
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  borderRadius: 'var(--r-pill)',
                  border: 'none',
                  cursor: 'pointer',
                  background: active ? 'var(--uc-indigo-bg)' : 'transparent',
                  color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                  transition: 'background 150ms, color 150ms',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            )
          })}
        </nav>

        <button
          type="button"
          onClick={toggleResolved}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '7px 12px',
            fontSize: 13,
            fontWeight: 400,
            background: showResolved ? 'var(--uc-mint-bg)' : 'var(--surface-card)',
            border: `0.5px solid ${showResolved ? 'rgba(16,185,129,0.28)' : 'var(--border-default)'}`,
            borderRadius: 'var(--r-pill)',
            color: showResolved ? 'var(--uc-mint)' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'background 150ms, color 150ms, border-color 150ms',
            whiteSpace: 'nowrap',
          }}
        >
          <CheckCircle2 size={13} strokeWidth={1.5} />
          Resolved
        </button>
      </div>

      {/* Skeleton */}
      {isLoading && (
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      )}

      {/* Items list */}
      {items.map((item) => (
        <LostFoundCard key={item.id} item={item} currentUserId={currentUserId} />
      ))}

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <div
          style={{
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <p
            style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}
          >
            Nothing here yet
          </p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
            {activeTab !== 'all'
              ? `No ${activeTab} items found. Try switching the filter.`
              : showResolved
                ? 'No resolved items found.'
                : 'Be the first to report a lost or found item.'}
          </p>
        </div>
      )}

      {/* Loading next page */}
      {isFetchingNextPage && (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      )}

      {/* Sentinel */}
      <div ref={sentinelRef} style={{ height: 1 }} />

      {/* All caught up */}
      {allCaughtUp && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0 16px' }}>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border-default)' }} />
          <span
            style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', flexShrink: 0 }}
          >
            {items.length} {items.length === 1 ? 'item' : 'items'} shown
          </span>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border-default)' }} />
        </div>
      )}

      {/* Floating report button */}
      <OrangeBtn
        onClick={() => setModalOpen(true)}
        style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
          boxShadow: '0 4px 16px rgba(240,90,40,0.30)',
          zIndex: 50,
        }}
      >
        <Plus size={15} strokeWidth={2} />
        Report item
      </OrangeBtn>

      {modalOpen && <PostItemModal onClose={() => setModalOpen(false)} />}
    </div>
  )
}
