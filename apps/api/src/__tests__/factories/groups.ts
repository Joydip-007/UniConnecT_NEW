import { db } from '../../config/db'

export async function makeJoinRequest(overrides: {
  groupId: string
  userId: string
  universityId: string
  message?: string
  status?: 'pending' | 'approved' | 'declined'
}) {
  const [row] = await db('group_join_requests')
    .insert({
      group_id: overrides.groupId,
      user_id: overrides.userId,
      university_id: overrides.universityId,
      message: overrides.message ?? null,
      status: overrides.status ?? 'pending',
    })
    .returning('*')
  return row as { id: string; group_id: string; user_id: string; status: string }
}

export async function makeResource(overrides: {
  groupId: string
  universityId: string
  uploadedBy: string
  title?: string
  url?: string
  category?: 'notes' | 'syllabus' | 'past_papers' | 'assignments' | 'other'
}) {
  const [row] = await db('group_resources')
    .insert({
      group_id: overrides.groupId,
      university_id: overrides.universityId,
      uploaded_by: overrides.uploadedBy,
      title: overrides.title ?? 'Test Resource',
      url: overrides.url ?? 'https://example.com/resource',
      category: overrides.category ?? 'notes',
    })
    .returning('*')
  return row as { id: string; group_id: string; click_count: number }
}

export async function makeStudySession(overrides: {
  groupId: string
  universityId: string
  createdBy: string
  title?: string
  startsAt?: Date
}) {
  const [row] = await db('group_study_sessions')
    .insert({
      group_id: overrides.groupId,
      university_id: overrides.universityId,
      created_by: overrides.createdBy,
      title: overrides.title ?? 'Test Study Session',
      is_online: false,
      starts_at: overrides.startsAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
    .returning('*')
  return row as { id: string; group_id: string; rsvp_count: number }
}
