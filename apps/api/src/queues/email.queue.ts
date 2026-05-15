import Queue from 'bull'
import { env } from '../config/env'

export interface EmailQueueJob {
  to: string
  subject: string
  html?: string
  text?: string
}

export const emailQueue = new Queue<EmailQueueJob>('email', env.REDIS_URL)
