import { db } from '../../config/db'
import { CREDENTIALS, TEST_UNIVERSITY_ID } from '../setup'

/**
 * Creates a group directly via `db('groups').insert(...)`, bypassing the
 * service's faculty-only creation guard for test convenience, and adds the
 * creator as an `owner` group member so membership-gated routes (e.g.
 * flashcard decks, which call `assertMemberAccess`) work against the fixture.
 */
export async function createGroupFixture(overrides: {
  type: 'department' | 'club' | 'batch' | 'research' | 'interest' | 'other' | 'academic'
  universityId?: string
  creatorId?: string
  name?: string
  description?: string
}) {
  const universityId = overrides.universityId ?? TEST_UNIVERSITY_ID
  const creatorId =
    overrides.creatorId ?? (await db('users').where({ email: CREDENTIALS.faculty.email }).first('id')).id

  const [row] = await db('groups')
    .insert({
      university_id: universityId,
      created_by: creatorId,
      name: overrides.name ?? `Test group ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      description: overrides.description ?? 'Fixture group for tests',
      type: overrides.type,
    })
    .returning('*')

  await db('group_members').insert({
    group_id: row.id,
    user_id: creatorId,
    role: 'owner',
  })

  return row as { id: string; university_id: string; created_by: string; name: string; type: string }
}

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
