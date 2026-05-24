import Queue from 'bull'
import { bullQueueOptions } from '../config/bull'

export interface EmailQueueJob {
  to: string
  subject: string
  html?: string
  text?: string
}

export const emailQueue = new Queue<EmailQueueJob>('email', bullQueueOptions)
