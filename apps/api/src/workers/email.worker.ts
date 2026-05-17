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
  if (!parsed) return false

  if (parsed.template === 'welcome') {
    const result = await emailService.sendWelcomeEmail(
      input.to,
      parsed.userName!,
      parsed.role!,
      parsed.universityName!,
    )
    if (!result.success) {
      throw new Error(result.error ?? 'Welcome email failed')
    }
    return true
  }

  if (parsed.template === 'otp') {
    const result = await emailService.sendOtpEmail(
      input.to,
      parsed.otp!,
      parsed.purpose as any,
      parsed.userName!,
    )
    if (!result.success) {
      throw new Error(result.error ?? 'OTP email failed')
    }
    return true
  }

  if (parsed.template === 'invitation') {
    const result = await emailService.sendInvitationEmail(
      input.to,
      parsed.registerUrl!,
      parsed.role!,
      parsed.universityName!,
      parsed.token!,
    )
    if (!result.success) {
      throw new Error(result.error ?? 'Invitation email failed')
    }
    return true
  }

  return false
}

function parseTemplatePayload(value: string) {
  try {
    const parsed = JSON.parse(value) as Partial<{
      template: string
      userName: string
      role: string
      universityName: string
      otp: string
      purpose: string
      registerUrl: string
      token: string
    }>

    if (
      typeof parsed.template !== 'string' ||
      typeof parsed.userName !== 'string'
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}
