import { createQueue } from '../config/bull'

export interface EmailQueueJob {
  to: string
  subject: string
  html?: string
  text?: string
}

export const emailQueue = createQueue<EmailQueueJob>('email')
