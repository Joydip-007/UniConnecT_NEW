import { db } from '../config/db'
import { logger } from '../utils/logger'
import { emailQueue } from '../queues/email.queue'
import { notificationQueue } from '../queues/notification.queue'
import { mentorshipQueue } from '../queues/mentorship.queue'
import { getIo } from '../socket'

mentorshipQueue.process(async (job) => {
  const { type, requestId, universityId, alumniId, studentId } = job.data

  if (type === 'request_reminder') {
    // ── 48-hour alumni reminder ──────────────────────────────────────────────
    const request = await db('mentorship_requests')
      .where({ id: requestId, is_deleted: false })
      .select<{ status: string }[]>('status')
      .first()

    // Idempotency guard: only act on still-pending requests
    if (!request || request.status !== 'pending') {
      logger.info('Mentorship reminder skipped — request no longer pending', { requestId })
      return
    }

    // Fetch alumni email
    const alumniUser = await db('users')
      .where({ id: alumniId })
      .select<{ email: string }[]>('email')
      .first()

    if (alumniUser) {
      await emailQueue.add({
        to: alumniUser.email,
        subject: 'You have an unanswered mentorship request',
        text: `A student is waiting for your response to their mentorship request. Log in to UniConnecT to review and respond.`,
        html: `<p>A student is waiting for your response to their mentorship request.</p><p>Log in to <strong>UniConnecT</strong> to review and respond.</p>`,
      })
    }

    await notificationQueue.add({
      universityId,
      userId: alumniId,
      type: 'mentorship_request_reminder',
      referenceId: requestId,
      referenceType: 'mentorship_request',
      content: 'A student is still waiting for your mentorship response.',
      payload: { requestId },
    })

    logger.info('Mentorship 48h reminder sent', { requestId, alumniId })
  } else if (type === 'request_expire') {
    // ── 7-day auto-expiry ────────────────────────────────────────────────────
    const request = await db('mentorship_requests')
      .where({ id: requestId, is_deleted: false })
      .select<{ status: string }[]>('status')
      .first()

    if (!request || request.status !== 'pending') {
      logger.info('Mentorship expiry skipped — request no longer pending', { requestId })
      return
    }

    await db('mentorship_requests')
      .where({ id: requestId })
      .update({
        status: 'expired',
        reminder_job_id: null,
        expire_job_id: null,
        updated_at: db.fn.now(),
      })

    await notificationQueue.add({
      universityId,
      userId: studentId,
      type: 'mentorship_request_expired',
      referenceId: requestId,
      referenceType: 'mentorship_request',
      content: 'Your mentorship request expired — the mentor didn\'t respond in time.',
      payload: { requestId },
    })

    try {
      getIo()
        .to(`user:${studentId}`)
        .emit('mentorship:request:expired', { requestId })
    } catch {
      // Socket may not be available in worker process; notification is the fallback
      logger.warn('Could not emit mentorship:request:expired via socket', { requestId })
    }

    logger.info('Mentorship request auto-expired', { requestId, studentId })
  } else {
    logger.warn('Unknown mentorship job type', { type, requestId })
  }
})

mentorshipQueue.on('failed', (job, error) => {
  logger.error('Mentorship queue job failed', { jobId: job?.id, type: job?.data?.type, error })
})
