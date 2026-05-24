import Queue from 'bull'
import { bullQueueOptions } from '../config/bull'

export type MentorshipJobType = 'request_reminder' | 'request_expire'

export interface MentorshipQueueJob {
  type: MentorshipJobType
  requestId: string
  universityId: string
  alumniId: string
  studentId: string
}

export const mentorshipQueue = new Queue<MentorshipQueueJob>('mentorship', bullQueueOptions)
