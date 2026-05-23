import Queue from 'bull'
import { env } from '../config/env'

export type MentorshipJobType = 'request_reminder' | 'request_expire'

export interface MentorshipQueueJob {
  type: MentorshipJobType
  requestId: string
  universityId: string
  alumniId: string
  studentId: string
}

export const mentorshipQueue = new Queue<MentorshipQueueJob>('mentorship', env.REDIS_URL)
