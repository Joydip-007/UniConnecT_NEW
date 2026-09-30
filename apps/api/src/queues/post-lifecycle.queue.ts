import { createQueue } from '../config/bull'

export type PostLifecycleJobType = 'publish' | 'expire'

export interface PostLifecycleJob {
  type: PostLifecycleJobType
  postId: string
  universityId: string
}

/** The repeatable reconciliation sweep carries no post id. */
export interface PostLifecycleSweepJob {
  type: 'sweep'
}

export type PostLifecycleJobData = PostLifecycleJob | PostLifecycleSweepJob

export const postLifecycleQueue = createQueue<PostLifecycleJobData>('post-lifecycle')

// Deterministic job ids so a reschedule/cancel is a clean remove-then-add.
export function publishJobId(postId: string): string {
  return `publish:${postId}`
}

export function expireJobId(postId: string): string {
  return `expire:${postId}`
}

/**
 * Schedule (or reschedule) a delayed lifecycle job for a post. Removes any existing
 * job with the same deterministic id first — Bull won't replace an existing id, so a
 * reschedule must remove then add. A non-positive delay means the target is already
 * past; we skip the delayed job and let the reconciliation cron pick it up.
 */
export async function schedulePostJob(type: PostLifecycleJobType, postId: string, universityId: string, runAt: Date): Promise<void> {
  const jobId = type === 'publish' ? publishJobId(postId) : expireJobId(postId)
  await cancelPostJob(type, postId)
  const delay = runAt.getTime() - Date.now()
  if (delay <= 0) return
  await postLifecycleQueue.add({ type, postId, universityId }, { delay, jobId })
}

export async function cancelPostJob(type: PostLifecycleJobType, postId: string): Promise<void> {
  const jobId = type === 'publish' ? publishJobId(postId) : expireJobId(postId)
  const job = await postLifecycleQueue.getJob(jobId)
  await job?.remove()
}
