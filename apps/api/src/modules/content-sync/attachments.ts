import type { Knex } from 'knex'
import {
  isAllowedAttachment,
  MAX_ATTACHMENTS_PER_ENTITY,
  type AttachmentEntityType,
  type AttachmentInput,
  type ContentAttachment,
} from '@uniconnect/shared'
import { db } from '../../config/db'
import { badRequest } from '../../utils/errors'

interface AttachmentRow {
  id: string
  entity_type: AttachmentEntityType
  entity_id: string
  file_url: string | null
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  download_status: 'pending' | 'done' | 'failed'
}

/** Batch-fetches attachments for multiple entities of the same type. Returns a map of entityId → attachments. */
export async function getAttachmentsForMany(
  entityType: AttachmentEntityType,
  entityIds: string[],
): Promise<Map<string, ContentAttachment[]>> {
  if (entityIds.length === 0) return new Map()
  const rows = (await db('content_attachments')
    .where({ entity_type: entityType, download_status: 'done' })
    .whereIn('entity_id', entityIds)
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

  const map = new Map<string, ContentAttachment[]>()
  for (const row of rows) {
    const list = map.get(row.entity_id) ?? []
    list.push(toContentAttachment(row))
    map.set(row.entity_id, list)
  }
  return map
}

/** Returns successfully-downloaded attachments for an entity, for detail views. */
export async function getAttachmentsFor(
  entityType: AttachmentEntityType,
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

  return rows.map(toContentAttachment)
}

function toContentAttachment(row: AttachmentRow): ContentAttachment {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    fileUrl: row.file_url,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    downloadStatus: row.download_status,
  }
}

interface AddAttachmentsParams {
  universityId: string
  entityType: AttachmentEntityType
  entityId: string
  uploadedBy: string
  attachments: AttachmentInput[]
}

/**
 * Inserts user-uploaded attachments for an entity. Files are already on R2 (presign flow),
 * so rows land as `download_status = 'done'` with no `source_url`. Validates the allowlist
 * and the per-entity cap. Pass the entity's transaction so inserts roll back with it.
 */
export async function addUserAttachments(trx: Knex, params: AddAttachmentsParams): Promise<void> {
  const { universityId, entityType, entityId, uploadedBy, attachments } = params
  if (attachments.length === 0) return

  for (const attachment of attachments) {
    if (!isAllowedAttachment(attachment.fileName, attachment.mimeType)) {
      throw badRequest(`File type not allowed: ${attachment.fileName}`, 'ATTACHMENT_TYPE_NOT_ALLOWED')
    }
  }

  const [{ count }] = await trx('content_attachments')
    .where({ entity_type: entityType, entity_id: entityId })
    .count<{ count: string | number }[]>({ count: '*' })
  const existing = Number(count)
  if (existing + attachments.length > MAX_ATTACHMENTS_PER_ENTITY) {
    throw badRequest(
      `Too many attachments (max ${MAX_ATTACHMENTS_PER_ENTITY} per item)`,
      'ATTACHMENT_LIMIT_EXCEEDED',
    )
  }

  await trx('content_attachments').insert(
    attachments.map((attachment) => ({
      university_id: universityId,
      entity_type: entityType,
      entity_id: entityId,
      source_url: null,
      file_url: attachment.fileUrl,
      file_name: attachment.fileName,
      mime_type: attachment.mimeType ?? null,
      size_bytes: attachment.sizeBytes ?? null,
      download_status: 'done',
      uploaded_by: uploadedBy,
    })),
  )
}

interface RemoveAttachmentsParams {
  universityId: string
  entityType: AttachmentEntityType
  entityId: string
  ids: string[]
}

/** Deletes the given attachment ids, scoped to the entity + university (cross-entity ids are
 *  silently ignored). Pass the entity's transaction so deletes roll back with it. */
export async function removeAttachments(trx: Knex, params: RemoveAttachmentsParams): Promise<void> {
  const { universityId, entityType, entityId, ids } = params
  if (ids.length === 0) return

  await trx('content_attachments')
    .where({ university_id: universityId, entity_type: entityType, entity_id: entityId })
    .whereIn('id', ids)
    .delete()
}
