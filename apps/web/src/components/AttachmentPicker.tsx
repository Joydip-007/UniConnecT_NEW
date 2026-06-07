import { useRef, useState } from 'react'
import { Paperclip, X } from 'lucide-react'
import {
  isAllowedAttachment,
  MAX_ATTACHMENTS_PER_ENTITY,
  MAX_ATTACHMENT_SIZE_BYTES,
  type AttachmentInput,
  type ContentAttachment,
} from '@uniconnect/shared'
import { usePresignedUpload } from '@/hooks/usePresignedUpload'

const ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,image/*'

interface Props {
  /** Staged, freshly-uploaded attachments to be submitted with the form. */
  value: AttachmentInput[]
  onChange: (next: AttachmentInput[]) => void
  /** Already-saved attachments (edit mode). Removing one adds its id to `removedIds`. */
  existing?: ContentAttachment[]
  removedIds?: string[]
  onRemovedIdsChange?: (ids: string[]) => void
  /** Bubbles uploading state so the parent can disable submit while files are in flight. */
  onUploadingChange?: (uploading: boolean) => void
  disabled?: boolean
}

/** File attachment picker: validates type/size, uploads via the presign flow, and stages
 *  files as `AttachmentInput[]`. Reused by the news/event/job/post composers. */
export function AttachmentPicker({
  value,
  onChange,
  existing = [],
  removedIds = [],
  onRemovedIdsChange,
  onUploadingChange,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { upload } = usePresignedUpload('attachments')
  const [busy, setBusy] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const keptExisting = existing.filter((a) => !removedIds.includes(a.id))
  const total = keptExisting.length + value.length

  function setBusyDelta(delta: number) {
    setBusy((prev) => {
      const next = prev + delta
      onUploadingChange?.(next > 0)
      return next
    })
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (inputRef.current) inputRef.current.value = ''
    if (files.length === 0) return
    setError(null)

    let remaining = MAX_ATTACHMENTS_PER_ENTITY - total
    for (const file of files) {
      if (remaining <= 0) {
        setError(`You can attach up to ${MAX_ATTACHMENTS_PER_ENTITY} files`)
        break
      }
      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        setError(`"${file.name}" is too large (max 25 MB)`)
        continue
      }
      if (!isAllowedAttachment(file.name, file.type)) {
        setError(`"${file.name}" is not an allowed file type`)
        continue
      }
      remaining -= 1
      setBusyDelta(1)
      try {
        const fileUrl = await upload(file)
        onChange([
          ...value,
          { fileUrl, fileName: file.name, mimeType: file.type || undefined, sizeBytes: file.size },
        ])
      } catch {
        setError(`Failed to upload "${file.name}"`)
      } finally {
        setBusyDelta(-1)
      }
    }
  }

  function removeStaged(fileUrl: string) {
    onChange(value.filter((a) => a.fileUrl !== fileUrl))
  }

  function removeExisting(id: string) {
    onRemovedIdsChange?.([...removedIds, id])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {(keptExisting.length > 0 || value.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {keptExisting.map((a) => (
            <Chip key={a.id} label={a.fileName} onRemove={disabled ? undefined : () => removeExisting(a.id)} />
          ))}
          {value.map((a) => (
            <Chip key={a.fileUrl} label={a.fileName} onRemove={disabled ? undefined : () => removeStaged(a.fileUrl)} />
          ))}
        </div>
      )}

      <input ref={inputRef} type="file" accept={ACCEPT} multiple style={{ display: 'none' }} onChange={handleFiles} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || busy > 0 || total >= MAX_ATTACHMENTS_PER_ENTITY}
        className="interactive-surface"
        style={{
          alignSelf: 'flex-start',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 12px',
          background: 'var(--surface-raised)',
          border: '0.5px dashed var(--border-hover)',
          borderRadius: 'var(--r-pill)',
          color: 'var(--text-secondary)',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        <Paperclip size={13} strokeWidth={1.5} />
        {busy > 0 ? 'Uploading…' : total === 0 ? 'Add attachments' : `Add more (${MAX_ATTACHMENTS_PER_ENTITY - total} left)`}
      </button>

      {error && <p style={{ margin: 0, fontSize: 12, color: 'var(--uc-red-l, var(--text-tertiary))' }}>{error}</p>}
    </div>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        background: 'var(--surface-page)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-pill)',
        color: 'var(--text-secondary)',
        fontSize: 13,
        maxWidth: 240,
      }}
    >
      <Paperclip size={12} strokeWidth={1.5} style={{ flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="press-feedback"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, lineHeight: 0 }}
        >
          <X size={13} strokeWidth={1.5} />
        </button>
      )}
    </span>
  )
}
