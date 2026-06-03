import { Paperclip } from 'lucide-react'
import type { ContentAttachment } from '@uniconnect/shared'

/** Renders downloadable attachment chips on a news/notice/event detail page. */
export function AttachmentList({ attachments }: { attachments?: ContentAttachment[] }) {
  const ready = (attachments ?? []).filter((a) => a.fileUrl)
  if (ready.length === 0) return null

  return (
    <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>Attachments</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {ready.map((attachment) => (
          <a
            key={attachment.id}
            href={attachment.fileUrl ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              background: 'var(--surface-page)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-pill)',
              color: 'var(--uc-indigo-xl)',
              textDecoration: 'none',
              fontSize: 13,
            }}
          >
            <Paperclip size={13} />
            {attachment.fileName}
            {attachment.sizeBytes ? (
              <span style={{ color: 'var(--text-tertiary)' }}>· {formatSize(attachment.sizeBytes)}</span>
            ) : null}
          </a>
        ))}
      </div>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
