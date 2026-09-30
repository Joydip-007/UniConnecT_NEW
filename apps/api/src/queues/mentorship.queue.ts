import { createQueue } from '../config/bull'

export type MentorshipJobType = 'request_reminder' | 'request_expire'

export interface MentorshipQueueJob {
  type: MentorshipJobType
  requestId: string
  universityId: string
  alumniId: string
  studentId: string
}

export const mentorshipQueue = createQueue<MentorshipQueueJob>('mentorship')
