import { useRef } from 'react'
import { Camera } from 'lucide-react'
import { usePresignedUpload } from '@/hooks/usePresignedUpload'

interface ImageUploadFieldProps {
  value: string | null
  onChange: (url: string) => void
  folder: string
  label?: string
  aspectRatio?: string
}

export function ImageUploadField({
  value,
  onChange,
  folder,
  label,
  aspectRatio = '16 / 5',
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { upload, uploading, error, reset } = usePresignedUpload(folder)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const url = await upload(file)
      onChange(url)
    } catch {
      // error state already set by hook
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
      )}

      <button
        type="button"
        onClick={() => { reset(); inputRef.current?.click() }}
        disabled={uploading}
        style={{
          display: 'block',
          width: '100%',
          aspectRatio,
          position: 'relative',
          background: value ? 'transparent' : 'var(--surface-raised)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-md)',
          cursor: uploading ? 'wait' : 'pointer',
          overflow: 'hidden',
          padding: 0,
        }}
        aria-label={label ? `Upload ${label}` : 'Upload image'}
      >
        {/* Preview or dot-pattern placeholder */}
        {value ? (
          <img
            src={value}
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

        {/* Hover / uploading overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--overlay-media)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            opacity: uploading ? 1 : 0,
            transition: 'opacity 150ms',
          }}
          onMouseEnter={(e) => {
            if (!uploading) (e.currentTarget as HTMLDivElement).style.opacity = '1'
          }}
          onMouseLeave={(e) => {
            if (!uploading) (e.currentTarget as HTMLDivElement).style.opacity = '0'
          }}
        >
          {uploading ? (
            <Spinner />
          ) : (
            <>
              <Camera size={16} strokeWidth={1.5} color="var(--text-primary)" />
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                {error ? 'Upload failed — tap to retry' : value ? 'Change image' : 'Click to upload'}
              </span>
            </>
          )}
        </div>
      </button>

      {error && !uploading && (
        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--uc-red)' }}>
          {error} — click to retry
        </span>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
    </div>
  )
}

function Spinner() {
  return (
    <>
      <style>{`@keyframes uc-img-spin { to { transform: rotate(360deg); } }`}</style>
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          border: '2px solid var(--border-strong)',
          borderTopColor: 'var(--text-primary)',
          animation: 'uc-img-spin 0.7s linear infinite',
        }}
      />
    </>
  )
}
