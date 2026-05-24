import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Image as ImageIcon, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import { usePresignedUpload } from '@/hooks/usePresignedUpload'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import {
  MAX_IMAGES,
  MAX_IMG_BYTES,
  blurBorder,
  focusBorder,
  inputStyle,
} from '../constants'
import type { LostFoundType, UploadedImage } from '../types'

interface PostItemModalProps {
  onClose: () => void
}

export function PostItemModal({ onClose }: PostItemModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const [itemType, setItemType] = useState<LostFoundType>('lost')
  const [itemName, setItemName] = useState('')
  const [description, setDescription] = useState('')
  const [locationDetail, setLocationDetail] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [images, setImages] = useState<UploadedImage[]>([])
  const { upload: uploadImage, uploading: uploadingImg } = usePresignedUpload('lost-found')

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

  async function handleImgChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    const toUpload = files.slice(0, MAX_IMAGES - images.length)
    if (!toUpload.length) return

    for (const file of toUpload) {
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
        background: 'var(--overlay-media)',
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
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
            <label htmlFor="lfItemName" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
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
            <label htmlFor="lfDesc" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
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
                    alt={`Upload preview ${i + 1}`}
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
                      background: 'var(--overlay-bg-strong)',
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
            <label htmlFor="lfLocation" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
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
            <label htmlFor="lfContact" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
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
