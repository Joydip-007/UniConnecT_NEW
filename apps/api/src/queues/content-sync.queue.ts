import Queue from 'bull'
import { bullQueueOptions } from '../config/bull'

export interface SyncRunJob {
  kind: 'sync-run'
  universityId: string
  runId: string
  triggeredBy: string
  /** Optional per-source fetch window override for this run (e.g. a backfill). Falls back
   *  to the tenant's configured `entriesPerSource` when absent. */
  entriesPerSource?: number
}

export interface AttachmentDownloadJob {
  kind: 'attachment-download'
  attachmentId: string
  universityId: string
}

export interface AttachmentBackfillJob {
  kind: 'attachment-backfill'
  universityId: string
}

export type ContentSyncJob = SyncRunJob | AttachmentDownloadJob | AttachmentBackfillJob

export const contentSyncQueue = new Queue<ContentSyncJob>('content-sync', bullQueueOptions)
