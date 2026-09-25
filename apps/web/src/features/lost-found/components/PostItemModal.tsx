import { useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ImagePlus, MapPin, Phone, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import { usePresignedUpload } from '@/hooks/usePresignedUpload'
import { Avatar } from '@/components/Avatar'
import { Modal } from '@/components/Modal'
import { useAuthStore } from '@/stores/authStore'
import { MAX_IMAGES, MAX_IMG_BYTES, blurBorder, focusBorder, getInitials } from '../constants'
import type { LostFoundType, UploadedImage } from '../types'

interface PostItemModalProps {
  onClose: () => void
}

const fieldBase: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-md)',
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color 150ms',
}

/** An input with a leading icon — the "where" and "how to reach you" rows. */
function IconField({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', lineHeight: 0, color: 'var(--text-tertiary)', pointerEvents: 'none' }}>
        {icon}
      </span>
      {children}
    </div>
  )
}

/**
 * "Report a lost or found item". Posting keeps the sheet open on a confirmation so the
 * poster sees exactly what went up; Done closes it.
 */
export function PostItemModal({ onClose }: PostItemModalProps) {
  const imgInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const me = useAuthStore((s) => s.user)

  const [itemType, setItemType] = useState<LostFoundType>('lost')
  const [itemName, setItemName] = useState('')
  const [description, setDescription] = useState('')
  const [locationDetail, setLocationDetail] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [images, setImages] = useState<UploadedImage[]>([])
  const [posted, setPosted] = useState(false)
  const { upload: uploadImage, uploading: uploadingImg } = usePresignedUpload('lost-found')

  async function handleImgChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_IMAGES - images.length)
    for (const file of files) {
      if (file.size > MAX_IMG_BYTES) {
        toast.error(`${file.name} exceeds 5 MB`)
        continue
      }
      const preview = URL.createObjectURL(file)
      try {
        const publicUrl = await uploadImage(file)
        setImages((prev) => [...prev, { url: publicUrl, preview }])
      } catch {
        URL.revokeObjectURL(preview)
        toast.error(`Failed to upload ${file.name}`)
      }
    }
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

  const submit = useMutation({
    mutationFn: () =>
      api.post('/lost-found', {
        type: itemType,
        itemName: itemName.trim(),
        ...(description.trim() && { description: description.trim() }),
        imageUrls: images.map((img) => img.url),
        locationDetail: locationDetail.trim(),
        contactInfo: contactInfo.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lost-found'] })
      setPosted(true)
    },
    onError: () => toast.error('Failed to post item'),
  })

  const canSubmit =
    !posted &&
    itemName.trim().length > 0 &&
    locationDetail.trim().length > 0 &&
    contactInfo.trim().length > 0 &&
    !uploadingImg &&
    !submit.isPending

  const fullName = me?.profile?.fullName ?? 'You'
  const dept = me?.profile?.department

  return (
    <Modal isOpen onClose={onClose} title="Report a lost or found item" maxWidth={520} frame="panel" sheet>
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 'min(92vh, 760px)' }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '0.5px solid var(--border-default)' }}>
          <h3 style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
            {posted ? 'Report posted' : 'Report a lost or found item'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '0.5px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <X size={15} strokeWidth={1.5} />
          </button>
        </div>

        <form
          id="lf-report-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (canSubmit) submit.mutate()
          }}
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <Avatar src={me?.profile?.avatarUrl ?? null} initials={getInitials(fullName)} color="var(--uc-indigo)" size={36} />
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullName}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>{dept ? `${dept} · posting now` : 'Posting now'}</p>
              </div>
            </div>
            <div role="radiogroup" aria-label="Lost or found" style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {(['lost', 'found'] as LostFoundType[]).map((type) => {
                const active = itemType === type
                return (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={posted}
                    onClick={() => setItemType(type)}
                    style={{
                      padding: '5px 14px',
                      borderRadius: 'var(--r-pill)',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: posted ? 'default' : 'pointer',
                      fontFamily: 'inherit',
                      background: active ? 'var(--uc-orange-bg)' : 'var(--surface-raised)',
                      border: `0.5px solid ${active ? 'var(--uc-orange-bdr)' : 'var(--border-default)'}`,
                      color: active ? 'var(--uc-orange-l)' : 'var(--text-secondary)',
                    }}
                  >
                    {type === 'lost' ? 'Lost' : 'Found'}
                  </button>
                )
              })}
            </div>
          </div>

          {posted && (
            <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--uc-mint-bg)', border: '0.5px solid var(--uc-mint-bdr)', borderRadius: 'var(--r-md)' }}>
              <CheckCircle2 size={15} strokeWidth={1.5} color="var(--uc-mint)" />
              <span style={{ fontSize: 13, color: 'var(--uc-mint)' }}>Posted to the lost &amp; found board.</span>
            </div>
          )}

          <input
            aria-label="Item name"
            value={itemName}
            readOnly={posted}
            maxLength={255}
            onChange={(e) => setItemName(e.target.value)}
            onFocus={focusBorder}
            onBlur={blurBorder}
            placeholder={itemType === 'found' ? 'What did you find?' : 'What did you lose?'}
            style={{ ...fieldBase, minHeight: 44, padding: '11px 12px', fontSize: 15, fontWeight: 500 }}
          />

          <textarea
            aria-label="Description"
            value={description}
            readOnly={posted}
            onChange={(e) => setDescription(e.target.value)}
            onFocus={focusBorder}
            onBlur={blurBorder}
            placeholder="Describe it: colour, marks, anything only the owner would know."
            style={{ ...fieldBase, minHeight: 104, padding: '11px 12px', fontSize: 13, lineHeight: 1.6, resize: 'vertical' }}
          />

          <IconField icon={<MapPin size={14} strokeWidth={1.5} />}>
            <input
              aria-label={`Where it was ${itemType}`}
              value={locationDetail}
              readOnly={posted}
              maxLength={255}
              onChange={(e) => setLocationDetail(e.target.value)}
              onFocus={focusBorder}
              onBlur={blurBorder}
              placeholder={`Where it was ${itemType}`}
              style={{ ...fieldBase, padding: '10px 12px 10px 34px', fontSize: 13 }}
            />
          </IconField>

          <IconField icon={<Phone size={14} strokeWidth={1.5} />}>
            <input
              aria-label="How people should reach you"
              value={contactInfo}
              readOnly={posted}
              maxLength={255}
              onChange={(e) => setContactInfo(e.target.value)}
              onFocus={focusBorder}
              onBlur={blurBorder}
              placeholder="How people should reach you"
              style={{ ...fieldBase, padding: '10px 12px 10px 34px', fontSize: 13 }}
            />
          </IconField>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {images.map((img, index) => (
              <div key={img.url} style={{ position: 'relative', width: 72, height: 72, flexShrink: 0, borderRadius: 'var(--r-sm)', overflow: 'hidden', border: '0.5px solid var(--border-default)' }}>
                <img src={img.preview} alt={`Photo ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {!posted && (
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    aria-label={`Remove photo ${index + 1}`}
                    style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'var(--overlay-bg-strong)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}
                  >
                    <X size={11} strokeWidth={2} />
                  </button>
                )}
              </div>
            ))}
            {!posted && images.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => imgInputRef.current?.click()}
                disabled={uploadingImg}
                style={{ width: 72, height: 72, flexShrink: 0, borderRadius: 'var(--r-sm)', border: '0.5px dashed var(--border-hover)', background: 'var(--surface-raised)', cursor: uploadingImg ? 'wait' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--text-tertiary)', fontFamily: 'inherit' }}
              >
                {uploadingImg ? (
                  <span style={{ fontSize: 11 }}>Uploading…</span>
                ) : (
                  <>
                    <ImagePlus size={16} strokeWidth={1.5} />
                    <span style={{ fontSize: 11 }}>Photo</span>
                  </>
                )}
              </button>
            )}
            <input ref={imgInputRef} type="file" accept="image/*" multiple onChange={handleImgChange} style={{ display: 'none' }} aria-label="Upload photos" />
          </div>
        </form>

        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderTop: '0.5px solid var(--border-default)' }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>Visible to everyone on campus</span>
          <button
            type="button"
            onClick={onClose}
            style={{ minHeight: 40, padding: '0 16px', borderRadius: 'var(--r-pill)', border: '0.5px solid var(--border-hover)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {posted ? 'Done' : 'Cancel'}
          </button>
          {!posted && (
            <button
              type="submit"
              form="lf-report-form"
              disabled={!canSubmit}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 20px', borderRadius: 'var(--r-pill)', border: 'none', background: 'var(--uc-orange)', color: 'var(--on-accent)', fontSize: 13, fontWeight: 500, cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.5, fontFamily: 'inherit' }}
            >
              <Send size={14} strokeWidth={1.5} />
              {submit.isPending ? 'Posting…' : 'Post'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
