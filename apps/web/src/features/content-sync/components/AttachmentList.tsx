import { useState } from 'react'
import { Download, File, FileImage, FileText, Film, Music, Archive } from 'lucide-react'
import type { ContentAttachment } from '@uniconnect/shared'
import { MediaGrid } from '@/features/feed/components/MediaGrid'
import { ImageLightbox } from '@/components/ImageLightbox'

/** Renders attachment images inline (like a photo grid) and files as download cards. */
export function AttachmentList({ attachments }: { attachments?: ContentAttachment[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const ready = (attachments ?? []).filter((a) => a.fileUrl)
  if (ready.length === 0) return null

  const media = ready.filter((a) => a.mimeType?.startsWith('image/') || a.mimeType?.startsWith('video/'))
  const files = ready.filter((a) => !a.mimeType?.startsWith('image/') && !a.mimeType?.startsWith('video/'))
  const imageUrls = media.map((a) => a.fileUrl!)

  return (
    <>
      {/* Image/video attachments render inline */}
      {media.length > 0 && (
        <>
          <MediaGrid urls={imageUrls} onOpen={setLightboxIndex} />
          {lightboxIndex !== null && (
            <ImageLightbox
              images={imageUrls}
              startIndex={lightboxIndex}
              onClose={() => setLightboxIndex(null)}
            />
          )}
        </>
      )}

      {/* Non-image files render as download cards */}
      {files.length > 0 && (
        <div
          style={{
            marginTop: 10,
            marginBottom: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {files.map((attachment) => (
            <FileCard key={attachment.id} attachment={attachment} />
          ))}
        </div>
      )}
    </>
  )
}

function FileCard({ attachment }: { attachment: ContentAttachment }) {
  const { icon: Icon, color, bg } = getFileStyle(attachment.mimeType)

  return (
    <a
      href={attachment.fileUrl ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      download
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 12px',
        background: 'var(--surface-raised)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-md)',
        textDecoration: 'none',
        transition: 'background 120ms ease',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLAnchorElement).style.background = 'var(--surface-card)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLAnchorElement).style.background = 'var(--surface-raised)'
      }}
    >
      {/* File type tile */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--r-sm)',
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={17} strokeWidth={1.5} color={color} />
      </div>

      {/* Name + size */}
      <div style={{ flex: 1, minWidth: 0 }}>
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
          {attachment.fileName}
        </p>
        {attachment.sizeBytes != null && (
          <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>
            {formatSize(attachment.sizeBytes)}
          </p>
        )}
      </div>

      {/* Download icon */}
      <div
        style={{
          flexShrink: 0,
          color: 'var(--text-tertiary)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Download size={15} strokeWidth={1.5} />
      </div>
    </a>
  )
}

type FileStyle = { icon: typeof File; color: string; bg: string }

function getFileStyle(mimeType: string | null | undefined): FileStyle {
  const t = mimeType ?? ''
  if (t.startsWith('image/'))
    return { icon: FileImage, color: 'var(--uc-mint)', bg: 'var(--uc-mint-bg)' }
  if (t.startsWith('video/'))
    return { icon: Film, color: 'var(--uc-indigo-xl)', bg: 'var(--uc-indigo-bg)' }
  if (t.startsWith('audio/'))
    return { icon: Music, color: 'var(--uc-orange)', bg: 'var(--uc-orange-bg)' }
  if (t === 'application/pdf' || t.includes('word') || t.startsWith('text/'))
    return { icon: FileText, color: 'var(--uc-orange-l)', bg: 'var(--uc-orange-bg)' }
  if (t.includes('zip') || t.includes('tar') || t.includes('rar') || t.includes('7z') || t.includes('compress'))
    return { icon: Archive, color: 'var(--text-secondary)', bg: 'var(--surface-page)' }
  return { icon: File, color: 'var(--text-secondary)', bg: 'var(--surface-page)' }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
