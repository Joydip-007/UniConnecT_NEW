import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import type { ContentAttachment } from '@uniconnect/shared'
import { Modal } from '@/components/Modal'
import { PrimaryBtn } from '@/components/Button'
import { api } from '@/lib/axios'
import { AttachmentList } from './AttachmentList'

interface PreviewNews {
  id: string
  title: string
  body: string
  coverUrl: string | null
  category: string
  createdAt: string
  attachments?: ContentAttachment[]
}

interface PreviewEvent {
  id: string
  title: string
  description: string
  location: string | null
  isOnline: boolean
  coverUrl: string | null
  startsAt: string
  createdAt: string
  attachments?: ContentAttachment[]
}

export interface ImportPreviewTarget {
  kind: 'news' | 'event'
  id: string
}

interface ImportPreviewModalProps {
  target: ImportPreviewTarget | null
  onClose: () => void
  onPublish: (target: ImportPreviewTarget) => void
  publishing: boolean
}

function useImportPreview(target: ImportPreviewTarget | null) {
  return useQuery<PreviewNews | PreviewEvent>({
    queryKey: ['content-sync', 'preview', target?.kind, target?.id],
    queryFn: () =>
      target!.kind === 'news'
        ? api.get<{ data: PreviewNews }>(`/news/${target!.id}`).then((r) => r.data.data)
        : api.get<{ data: PreviewEvent }>(`/events/${target!.id}`).then((r) => r.data.data),
    enabled: target !== null,
  })
}

const labelStyle: React.CSSProperties = { fontSize: 13, color: 'var(--text-secondary)' }

/** Shows an imported draft rendered as it will actually appear once published, before the admin commits. */
export function ImportPreviewModal({ target, onClose, onPublish, publishing }: ImportPreviewModalProps) {
  const { data, isLoading } = useImportPreview(target)

  if (!target) return null

  return (
    <Modal isOpen={target !== null} onClose={onClose} title={data?.title ?? 'Preview'} maxWidth={560}>
      {isLoading || !data ? (
        <p style={labelStyle}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {data.coverUrl && (
            <img
              src={data.coverUrl}
              alt=""
              style={{ width: '100%', borderRadius: 'var(--r-md)', maxHeight: 260, objectFit: 'cover' }}
            />
          )}

          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
            {target.kind === 'news'
              ? (data as PreviewNews).category
              : (data as PreviewEvent).isOnline
                ? 'Online event'
                : (data as PreviewEvent).location || 'Event'}
            {' · '}
            imported {formatDistanceToNow(new Date(data.createdAt), { addSuffix: true })}
          </p>

          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {target.kind === 'news' ? (data as PreviewNews).body : (data as PreviewEvent).description}
          </p>

          <AttachmentList attachments={data.attachments} />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <PrimaryBtn onClick={() => onPublish(target)} disabled={publishing}>
              {publishing ? 'Publishing…' : 'Publish'}
            </PrimaryBtn>
          </div>
        </div>
      )}
    </Modal>
  )
}
