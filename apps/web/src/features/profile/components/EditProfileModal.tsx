import { useEffect, useRef, useState, KeyboardEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Camera, X } from 'lucide-react'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { Avatar } from '@/components/Avatar'
import { GhostBtn, PrimaryBtn } from '@/components/Button'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
}

interface PresignResponse {
  uploadUrl: string
  publicUrl: string
}

type UploadSlot = 'avatar' | 'cover'

// ── Shared field styles ────────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
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
  boxSizing: 'border-box',
  transition: 'border-color 150ms',
}

function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = 'var(--uc-indigo-bdr)'
}
function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = 'var(--border-default)'
}

// ── FieldRow ───────────────────────────────────────────────────────────────────

function FieldRow({
  label,
  optional,
  children,
}: {
  label: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
        {label}
        {optional && (
          <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 4 }}>
            (optional)
          </span>
        )}
      </label>
      {children}
    </div>
  )
}

// ── TagInput ───────────────────────────────────────────────────────────────────

function TagInput({
  tags,
  onChange,
}: {
  tags: string[]
  onChange: (next: string[]) => void
}) {
  const [input, setInput] = useState('')

  function commit() {
    const val = input.trim().replace(/,+$/, '').trim()
    if (val && !tags.includes(val)) {
      onChange([...tags, val])
    }
    setInput('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        padding: '7px 10px',
        background: 'var(--surface-raised)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-md)',
        cursor: 'text',
        minHeight: 40,
        transition: 'border-color 150ms',
      }}
      onClick={(e) => {
        const inp = (e.currentTarget as HTMLDivElement).querySelector('input')
        inp?.focus()
      }}
      onFocusCapture={(e) => {
        if (e.target instanceof HTMLInputElement) {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--uc-indigo-bdr)'
        }
      }}
      onBlurCapture={(e) => {
        if (e.target instanceof HTMLInputElement) {
          ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-default)'
          commit()
        }
      }}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 9px',
            background: 'var(--uc-indigo-bg)',
            border: '0.5px solid var(--uc-indigo-bdr)',
            borderRadius: 'var(--r-pill)',
            fontSize: 12,
            fontWeight: 400,
            color: 'var(--uc-indigo-xl)',
          }}
        >
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChange(tags.filter((t) => t !== tag))
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              lineHeight: 0,
              color: 'var(--uc-indigo-xl)',
              opacity: 0.7,
            }}
            aria-label={`Remove ${tag}`}
          >
            <X size={11} strokeWidth={2} />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? 'Type a skill and press Enter' : ''}
        style={{
          flex: 1,
          minWidth: 120,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontSize: 13,
          fontWeight: 400,
          color: 'var(--text-primary)',
          fontFamily: 'inherit',
          padding: '1px 2px',
        }}
      />
    </div>
  )
}

// ── Toggle ─────────────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        position: 'relative',
        width: 40,
        height: 22,
        borderRadius: 'var(--r-pill)',
        border: 'none',
        cursor: 'pointer',
        background: value ? 'var(--uc-indigo)' : 'var(--surface-hover)',
        transition: 'background 200ms',
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: value ? 21 : 3,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 200ms',
        }}
      />
    </button>
  )
}

// ── AVATAR_PALETTE (mirrors PostCard) ──────────────────────────────────────────

const AVATAR_PALETTE = ['var(--uc-indigo)', 'var(--uc-orange)', 'var(--uc-cyan)', 'var(--uc-mint)']

function seedColor(id: string) {
  const sum = [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length]
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

// ── EditProfileModal ───────────────────────────────────────────────────────────

export function EditProfileModal({ onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const updateProfile = useAuthStore((s) => s.updateProfile)
  const user = useAuthStore((s) => s.user)

  const p = user?.profile

  // ── Form state ─────────────────────────────────────────────────────────────

  const [fullName, setFullName] = useState(p?.fullName ?? '')
  const [headline, setHeadline] = useState(p?.headline ?? '')
  const [bio, setBio] = useState(p?.bio ?? '')
  const [department, setDepartment] = useState(p?.department ?? '')
  const [batchYear, setBatchYear] = useState(p?.batchYear ?? '')
  const [linkedinUrl, setLinkedinUrl] = useState(p?.linkedinUrl ?? '')
  const [phone, setPhone] = useState(p?.phone ?? '')
  const [skills, setSkills] = useState<string[]>(p?.skills ?? [])
  const [isOpenToWork, setIsOpenToWork] = useState(p?.isOpenToWork ?? false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(p?.avatarUrl ?? null)
  const [coverPreview, setCoverPreview] = useState<string | null>(p?.coverUrl ?? null)

  const [uploading, setUploading] = useState<UploadSlot | null>(null)
  const [uploadError, setUploadError] = useState<UploadSlot | null>(null)

  // ── Keyboard close ─────────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // ── Image upload ───────────────────────────────────────────────────────────

  async function handleImageUpload(
    slot: UploadSlot,
    file: File,
  ) {
    setUploading(slot)
    setUploadError(null)

    const folder = slot === 'avatar' ? 'avatars' : 'covers'
    const fieldKey = slot === 'avatar' ? 'avatarUrl' : 'coverUrl'

    try {
      const { data: presign } = await api.post<{ data: PresignResponse }>('/upload/presign', {
        fileName: file.name,
        fileType: file.type,
        folder,
      })
      const { uploadUrl, publicUrl } = presign.data

      const s3Res = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!s3Res.ok) throw new Error('Upload failed')

      await api.patch('/users/me', { [fieldKey]: publicUrl })
      updateProfile({ [fieldKey]: publicUrl })

      if (slot === 'avatar') setAvatarPreview(publicUrl)
      else setCoverPreview(publicUrl)
    } catch {
      setUploadError(slot)
    } finally {
      setUploading(null)
    }
  }

  function onAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleImageUpload('avatar', file)
    e.target.value = ''
  }

  function onCoverFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleImageUpload('cover', file)
    e.target.value = ''
  }

  // ── Form submit ────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: () =>
      api
        .patch<{ data: typeof p }>('/users/me', {
          fullName: fullName.trim(),
          headline: headline.trim() || null,
          bio: bio.trim() || null,
          department: department.trim() || null,
          batchYear: batchYear.trim() || null,
          linkedinUrl: linkedinUrl.trim() || null,
          phone: phone.trim() || null,
          skills,
          isOpenToWork,
        })
        .then((r) => r.data.data),
    onSuccess: (updated) => {
      if (updated) updateProfile(updated)
      onClose()
    },
  })

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) return
    saveMutation.mutate()
  }

  if (!user) return null

  const avatarColor = seedColor(user.id)
  const initials = getInitials(fullName || user.profile.fullName)

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(6,13,26,0.80)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: '24px 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: 'calc(100vh - 48px)',
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-strong)',
          borderRadius: 'var(--r-xl)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px 14px',
            borderBottom: '0.5px solid var(--border-default)',
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}
          >
            Edit profile
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

        {/* ── Scrollable body ────────────────────────────────────────────── */}
        <form
          id="edit-profile-form"
          onSubmit={handleSubmit}
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            padding: '0 0 4px',
          }}
        >
          {/* Cover + Avatar */}
          <div style={{ position: 'relative', paddingBottom: 36 }}>
            {/* Hidden file inputs */}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={onAvatarFileChange}
              style={{ display: 'none' }}
            />
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={onCoverFileChange}
              style={{ display: 'none' }}
            />

            {/* Cover strip */}
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploading === 'cover'}
              style={{
                display: 'block',
                width: '100%',
                height: 100,
                position: 'relative',
                background: 'var(--uc-indigo-bg)',
                border: 'none',
                cursor: uploading === 'cover' ? 'wait' : 'pointer',
                overflow: 'hidden',
                padding: 0,
              }}
            >
              {coverPreview ? (
                <img
                  src={coverPreview}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage:
                      'radial-gradient(circle, rgba(255,255,255,0.11) 1.5px, transparent 1.5px)',
                    backgroundSize: '18px 18px',
                  }}
                />
              )}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(6,13,26,0.30)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  opacity: uploading === 'cover' ? 1 : 0,
                  transition: 'opacity 150ms',
                }}
                className="cover-overlay"
                onMouseEnter={(e) =>
                  uploading !== 'cover' && ((e.currentTarget as HTMLDivElement).style.opacity = '1')
                }
                onMouseLeave={(e) =>
                  uploading !== 'cover' && ((e.currentTarget as HTMLDivElement).style.opacity = '0')
                }
              >
                {uploading === 'cover' ? (
                  <Spinner />
                ) : (
                  <>
                    <Camera size={16} strokeWidth={1.5} color="#fff" />
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#fff' }}>
                      {uploadError === 'cover' ? 'Upload failed — retry' : 'Change cover'}
                    </span>
                  </>
                )}
              </div>
            </button>

            {/* Avatar */}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploading === 'avatar'}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 20,
                borderRadius: '50%',
                border: '3px solid var(--surface-card)',
                background: 'none',
                padding: 0,
                cursor: uploading === 'avatar' ? 'wait' : 'pointer',
                lineHeight: 0,
              }}
              aria-label="Change avatar"
            >
              <div style={{ position: 'relative', borderRadius: '50%', overflow: 'hidden' }}>
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt=""
                    style={{ width: 64, height: 64, objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <Avatar initials={initials} color={avatarColor} size={64} />
                )}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(6,13,26,0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    opacity: uploading === 'avatar' ? 1 : 0,
                    transition: 'opacity 150ms',
                  }}
                  onMouseEnter={(e) =>
                    uploading !== 'avatar' &&
                    ((e.currentTarget as HTMLDivElement).style.opacity = '1')
                  }
                  onMouseLeave={(e) =>
                    uploading !== 'avatar' &&
                    ((e.currentTarget as HTMLDivElement).style.opacity = '0')
                  }
                >
                  {uploading === 'avatar' ? (
                    <Spinner size={16} />
                  ) : (
                    <Camera size={14} strokeWidth={1.5} color="#fff" />
                  )}
                </div>
              </div>
            </button>
          </div>

          {/* Form fields */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              padding: '0 20px',
            }}
          >
            <FieldRow label="Full name">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                required
                style={inputBase}
                onFocus={onFocus}
                onBlur={onBlur}
              />
            </FieldRow>

            <FieldRow label="Headline" optional>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g. Computer Science student at UIU"
                maxLength={120}
                style={inputBase}
                onFocus={onFocus}
                onBlur={onBlur}
              />
            </FieldRow>

            <FieldRow label="Bio" optional>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell people a bit about yourself…"
                rows={3}
                maxLength={500}
                style={{
                  ...inputBase,
                  resize: 'vertical',
                  lineHeight: 1.6,
                  minHeight: 72,
                }}
                onFocus={onFocus}
                onBlur={onBlur}
              />
            </FieldRow>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              <FieldRow label="Department" optional>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. CSE"
                  style={inputBase}
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
              </FieldRow>

              <FieldRow label="Batch year" optional>
                <input
                  type="text"
                  value={batchYear}
                  onChange={(e) => setBatchYear(e.target.value)}
                  placeholder="e.g. 2025"
                  maxLength={4}
                  style={inputBase}
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
              </FieldRow>
            </div>

            <FieldRow label="LinkedIn URL" optional>
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/yourname"
                style={inputBase}
                onFocus={onFocus}
                onBlur={onBlur}
              />
            </FieldRow>

            <FieldRow label="Phone" optional>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+880 1700 000000"
                style={inputBase}
                onFocus={onFocus}
                onBlur={onBlur}
              />
            </FieldRow>

            <FieldRow label="Skills" optional>
              <TagInput tags={skills} onChange={setSkills} />
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 11,
                  fontWeight: 400,
                  color: 'var(--text-tertiary)',
                }}
              >
                Press Enter or comma to add a skill
              </p>
            </FieldRow>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: 'var(--surface-raised)',
                border: '0.5px solid var(--border-default)',
                borderRadius: 'var(--r-md)',
              }}
            >
              <div>
                <p
                  style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}
                >
                  Open to work
                </p>
                <p
                  style={{
                    margin: '2px 0 0',
                    fontSize: 12,
                    fontWeight: 400,
                    color: 'var(--text-secondary)',
                  }}
                >
                  Let recruiters know you're looking for opportunities
                </p>
              </div>
              <Toggle value={isOpenToWork} onChange={setIsOpenToWork} />
            </div>
          </div>

          {/* Bottom spacer so last field clears the sticky footer */}
          <div style={{ height: 4, flexShrink: 0 }} />
        </form>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '14px 20px',
            borderTop: '0.5px solid var(--border-default)',
            flexShrink: 0,
          }}
        >
          {saveMutation.isError && (
            <span
              style={{
                flex: 1,
                fontSize: 12,
                fontWeight: 400,
                color: 'var(--uc-red)',
              }}
            >
              Failed to save — please try again
            </span>
          )}
          <GhostBtn type="button" onClick={onClose} disabled={saveMutation.isPending}>
            Cancel
          </GhostBtn>
          <PrimaryBtn
            type="submit"
            form="edit-profile-form"
            disabled={!fullName.trim() || saveMutation.isPending || uploading !== null}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save changes'}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  )
}

// ── Spinner ────────────────────────────────────────────────────────────────────

function Spinner({ size = 20 }: { size?: number }) {
  return (
    <>
      <style>{`
        @keyframes uc-spin { to { transform: rotate(360deg); } }
      `}</style>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: `2px solid rgba(255,255,255,0.25)`,
          borderTopColor: '#fff',
          animation: 'uc-spin 0.7s linear infinite',
          flexShrink: 0,
        }}
      />
    </>
  )
}
