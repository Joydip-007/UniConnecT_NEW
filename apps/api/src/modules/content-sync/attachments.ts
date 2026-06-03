import type { ContentAttachment } from '@uniconnect/shared'
import { db } from '../../config/db'

interface AttachmentRow {
  id: string
  entity_type: 'news' | 'event'
  entity_id: string
  file_url: string | null
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  download_status: 'pending' | 'done' | 'failed'
}

/** Returns successfully-downloaded attachments for a news/event item, for detail views. */
export async function getAttachmentsFor(
  entityType: 'news' | 'event',
  entityId: string,
): Promise<ContentAttachment[]> {
  const rows = (await db('content_attachments')
    .where({ entity_type: entityType, entity_id: entityId, download_status: 'done' })
    .orderBy('created_at', 'asc')
    .select(
      'id',
      'entity_type',
      'entity_id',
      'file_url',
      'file_name',
      'mime_type',
      'size_bytes',
      'download_status',
    )) as AttachmentRow[]

  return rows.map((row) => ({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    fileUrl: row.file_url,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    downloadStatus: row.download_status,
  }))
}
