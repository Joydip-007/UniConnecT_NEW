import Queue from 'bull'
import { bullQueueOptions } from '../config/bull'

export interface SyncRunJob {
  kind: 'sync-run'
  universityId: string
  runId: string
  triggeredBy: string
}

export interface AttachmentDownloadJob {
  kind: 'attachment-download'
  attachmentId: string
  universityId: string
}

export type ContentSyncJob = SyncRunJob | AttachmentDownloadJob

export const contentSyncQueue = new Queue<ContentSyncJob>('content-sync', bullQueueOptions)
