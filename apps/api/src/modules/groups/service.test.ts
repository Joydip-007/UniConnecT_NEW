import { describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { db } from '../../config/db'
import { groupsService } from './service'
import { courseOutlineService } from '../academic/course-outline.service'
import type { UserRole } from '@uniconnect/shared'

async function createUniversity(): Promise<string> {
  const [row] = await db('universities')
    .insert({
      name: 'Test University',
      domain: `test-${randomUUID()}.example.edu`,
    })
    .returning<{ id: string }[]>('id')
  return row.id
}

async function createUser(opts: { universityId: string; role: UserRole }): Promise<{ id: string }> {
  const [user] = await db('users')
    .insert({
      university_id: opts.universityId,
      username: `test_${randomUUID().slice(0, 8)}`,
      email: `${randomUUID()}@example.edu`,
      role: opts.role,
    })
    .returning<{ id: string }[]>('id')

  await db('profiles').insert({
    user_id: user.id,
    full_name: 'Test User',
  })

  return { id: user.id }
}

async function cleanup(universityId: string): Promise<void> {
  const groupIds = await db('groups').where({ university_id: universityId }).pluck('id')
  await db('group_members').whereIn('group_id', groupIds).del()
  await db('groups').where({ university_id: universityId }).del()
  const userIds = await db('users').where({ university_id: universityId }).pluck('id')
  await db('profiles').whereIn('user_id', userIds).del()
  await db('users').where({ university_id: universityId }).del()
  await db('universities').where({ id: universityId }).del()
}

describe('groupService.createGroup — academic type guard', () => {
  it('rejects academic group creation by a student', async () => {
    const universityId = await createUniversity()
    const student = await createUser({ universityId, role: 'student' })

    await expect(
      groupsService.createGroup(
        { userId: student.id, universityId, role: 'student' },
        { name: 'CS101', description: 'A course group', type: 'academic', is_private: false },
      ),
    ).rejects.toMatchObject({ code: 'ACADEMIC_GROUP_FACULTY_ONLY' })

    await cleanup(universityId)
  })

  it('allows academic group creation by faculty and returns aiSettings', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })

    const group = await groupsService.createGroup(
      { userId: faculty.id, universityId, role: 'faculty' },
      { name: 'CS101', description: 'A course group', type: 'academic', is_private: false },
    )

    expect(group.type).toBe('academic')
    expect(group.aiSettings).toEqual({})

    await cleanup(universityId)
  })
})

describe('groupService.updateAiSettings', () => {
  it('merges partial ai_settings and requires owner/admin role', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const group = await groupsService.createGroup(
      { userId: faculty.id, universityId, role: 'faculty' },
      { name: 'CS101', description: 'A course group', type: 'academic', is_private: false },
    )

    const updated = await groupsService.updateAiSettings(
      { userId: faculty.id, universityId, role: 'faculty' },
      group.id,
      { ai_quiz_enabled: true, subject: 'Data Structures' },
    )

    expect(updated.aiSettings).toMatchObject({ ai_quiz_enabled: true, subject: 'Data Structures' })

    await cleanup(universityId)
  })

  it('rejects updates on non-academic groups', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const group = await groupsService.createGroup(
      { userId: faculty.id, universityId, role: 'faculty' },
      { name: 'Club', description: 'A club group', type: 'club', is_private: false },
    )

    await expect(
      groupsService.updateAiSettings(
        { userId: faculty.id, universityId, role: 'faculty' },
        group.id,
        { ai_quiz_enabled: true },
      ),
    ).rejects.toMatchObject({ code: 'ACADEMIC_GROUP_REQUIRED' })

    await cleanup(universityId)
  })
})

describe('groupService — gradebook auto-population on join', () => {
  it('creates gradebook_entries rows when a student joins an academic group with a course outline', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const student = await createUser({ universityId, role: 'student' })
    const group = await groupsService.createGroup(
      { userId: faculty.id, universityId, role: 'faculty' },
      { name: 'CS101', description: 'A course group', type: 'academic', is_private: false },
    )
    await courseOutlineService.createOutline(
      { userId: faculty.id, universityId, role: 'faculty' },
      group.id,
      {
        courseTitle: 'X',
        gradingScale: 'uiu',
        assessments: [
          { categoryName: 'CT', fullMarks: 20, weightPercent: 100, totalGiven: 2, bestNCounted: 1, displayOrder: 1 },
        ],
        topics: [],
      },
    )

    await groupsService.joinGroup({ userId: student.id, universityId, role: 'student' }, group.id)

    const entries = await db('gradebook_entries').where({ group_id: group.id, student_id: student.id })
    expect(entries).toHaveLength(2) // totalGiven = 2 instances

    await cleanup(universityId)
  })
})

describe('groupsService — pending AI content', () => {
  it('lists a pending deck awaiting approval', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const group = await groupsService.createGroup(
      { userId: faculty.id, universityId, role: 'faculty' },
      { name: 'CS101', description: 'A course group', type: 'academic', is_private: false },
    )

    const [deck] = await db('group_flashcard_decks')
      .insert({ group_id: group.id, university_id: universityId, title: 'AI Deck', created_by: faculty.id, is_archived: true })
      .returning<{ id: string }[]>('id')
    await db('groups').where({ id: group.id }).update({ ai_settings: { pending_deck_id: deck.id } })

    const pending = await groupsService.listPendingAiContent({ userId: faculty.id, universityId, role: 'faculty' }, group.id)
    expect(pending).toHaveLength(1)
    expect(pending[0].id).toBe(deck.id)

    await cleanup(universityId)
  })

  it('approving a pending deck un-archives it and clears pending_deck_id', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const group = await groupsService.createGroup(
      { userId: faculty.id, universityId, role: 'faculty' },
      { name: 'CS101', description: 'A course group', type: 'academic', is_private: false },
    )
    const [deck] = await db('group_flashcard_decks')
      .insert({ group_id: group.id, university_id: universityId, title: 'AI Deck', created_by: faculty.id, is_archived: true })
      .returning<{ id: string }[]>('id')
    await db('groups').where({ id: group.id }).update({ ai_settings: { pending_deck_id: deck.id } })

    await groupsService.approvePendingAiContent({ userId: faculty.id, universityId, role: 'faculty' }, group.id, deck.id)

    const updated = await db('group_flashcard_decks').where({ id: deck.id }).first()
    expect(updated.is_archived).toBe(false)
    const updatedGroup = await db('groups').where({ id: group.id }).first()
    expect(updatedGroup.ai_settings.pending_deck_id).toBeNull()

    await cleanup(universityId)
  })

  it('discarding a pending deck deletes it', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const group = await groupsService.createGroup(
      { userId: faculty.id, universityId, role: 'faculty' },
      { name: 'CS101', description: 'A course group', type: 'academic', is_private: false },
    )
    const [deck] = await db('group_flashcard_decks')
      .insert({ group_id: group.id, university_id: universityId, title: 'AI Deck', created_by: faculty.id, is_archived: true })
      .returning<{ id: string }[]>('id')
    await db('groups').where({ id: group.id }).update({ ai_settings: { pending_deck_id: deck.id } })

    await groupsService.discardPendingAiContent({ userId: faculty.id, universityId, role: 'faculty' }, group.id, deck.id)

    expect(await db('group_flashcard_decks').where({ id: deck.id }).first()).toBeUndefined()

    await cleanup(universityId)
  })
})

describe('groupService — shared note attachments', () => {
  it('persists attachments on create and returns them via toSharedNote', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const group = await groupsService.createGroup(
      { userId: faculty.id, universityId, role: 'faculty' },
      { name: 'CS101', description: 'A course group', type: 'academic', is_private: false },
    )
    const context = { userId: faculty.id, universityId, role: 'faculty' as UserRole }

    const note = await groupsService.createSharedNote(context, group.id, {
      title: 'Lecture 1',
      body: 'notes',
      attachments: [{ name: 'lecture1.pdf', url: 'https://cdn.example.com/lecture1.pdf', contentType: 'application/pdf', size: 1024 }],
    })

    expect(note.attachments).toHaveLength(1)
    expect(note.attachments[0].name).toBe('lecture1.pdf')

    await cleanup(universityId)
  })

  it('rejects a presign request for a disallowed content type', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const group = await groupsService.createGroup(
      { userId: faculty.id, universityId, role: 'faculty' },
      { name: 'CS101', description: 'A course group', type: 'academic', is_private: false },
    )
    const context = { userId: faculty.id, universityId, role: 'faculty' as UserRole }

    await expect(
      groupsService.getSharedNoteUploadUrl(context, group.id, 'malware.exe', 'application/x-msdownload'),
    ).rejects.toMatchObject({ statusCode: 400 })

    await cleanup(universityId)
  })
})
