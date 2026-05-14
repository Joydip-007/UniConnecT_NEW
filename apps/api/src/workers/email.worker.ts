import { emailQueue, type EmailQueueJob } from '../queues/email.queue'
import { emailService } from '../services/email.service'
import { logger } from '../utils/logger'

emailQueue.process(async (job) => {
  const input = job.data
  const handled = await handleTemplateEmail(input)
  if (handled) return

  const result = await emailService.sendQueuedEmail(input)
  if (!result.success) {
    throw new Error(result.error ?? 'Queued email failed')
  }
})

emailQueue.on('failed', (job, error) => {
  logger.error('Email queue job failed', { jobId: job?.id, error })
})

async function handleTemplateEmail(input: EmailQueueJob) {
  if (!input.text) return false

  const parsed = parseTemplatePayload(input.text)
  if (!parsed || parsed.template !== 'welcome') return false

  const result = await emailService.sendWelcomeEmail(
    input.to,
    parsed.userName,
    parsed.role,
    parsed.universityName,
  )
  if (!result.success) {
    throw new Error(result.error ?? 'Welcome email failed')
  }

  return true
}

function parseTemplatePayload(value: string) {
  try {
    const parsed = JSON.parse(value) as Partial<{
      template: string
      userName: string
      role: string
      universityName: string
    }>

    if (
      typeof parsed.template !== 'string' ||
      typeof parsed.userName !== 'string' ||
      typeof parsed.role !== 'string' ||
      typeof parsed.universityName !== 'string'
    ) {
      return null
    }

    return {
      template: parsed.template,
      userName: parsed.userName,
      role: parsed.role,
      universityName: parsed.universityName,
    }
  } catch {
    return null
  }
}
