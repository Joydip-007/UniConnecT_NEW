import { describe, it, expect, afterEach } from 'vitest'
import { DOMAIN, TEST_UNIVERSITY_ID, CREDENTIALS } from './setup'
import { db } from '../config/db'
import { systemGroupsService } from '../modules/groups/system-groups.service'

// Helpers
async function getUserId(role: keyof typeof CREDENTIALS): Promise<string> {
  const cred = CREDENTIALS[role]
  const row = await db('users')
    .where({ university_id: TEST_UNIVERSITY_ID, email: cred.email })
    .select<{ id: string }[]>('id')
    .first()
  if (!row) throw new Error(`Seed user ${role} not found`)
  return row.id
}

async function findSystemGroup(allowedRole: string, department: string | null) {
  const q = db('groups')
    .where({ university_id: TEST_UNIVERSITY_ID, is_system: true, allowed_role: allowedRole })
    .select<{ id: string; name: string; department: string | null }>(['id', 'name', 'department'])
  if (department === null) q.whereNull('department')
  else q.andWhere({ department })
  return q.first()
}

// Clean up system groups created during these tests
afterEach(async () => {
  await db('groups')
    .where({ university_id: TEST_UNIVERSITY_ID, is_system: true })
    .whereIn('allowed_role', ['alumni', 'student'])
    .delete()
})

describe('SystemGroupsService — group naming', () => {
  it('creates admin group named "Admins of {university name}"', async () => {
    const adminId = await getUserId('admin')
    await systemGroupsService.addUserToSystemGroups(adminId, TEST_UNIVERSITY_ID, 'admin', null)

    const group = await findSystemGroup('admin', null)
    expect(group).toBeDefined()
    expect(group!.name).toBe('Admins of United International University')
  })

  it('creates faculty group named "{dept} Dept"', async () => {
    const facultyId = await getUserId('faculty')
    await systemGroupsService.addUserToSystemGroups(facultyId, TEST_UNIVERSITY_ID, 'faculty', 'CSE')

    const group = await findSystemGroup('faculty', 'CSE')
    expect(group).toBeDefined()
    expect(group!.name).toBe('CSE Dept')
  })

  it('creates alumni group named "{batch} Graduates"', async () => {
    const alumniId = await getUserId('alumni')
    await systemGroupsService.addUserToSystemGroups(alumniId, TEST_UNIVERSITY_ID, 'alumni', 'CSE', 'Fall 2023')

    const group = await findSystemGroup('alumni', 'Fall 2023')
    expect(group).toBeDefined()
    expect(group!.name).toBe('Fall 2023 Graduates')
  })

  it('creates student group named just the batch string', async () => {
    const studentId = await getUserId('student')
    await systemGroupsService.addUserToSystemGroups(studentId, TEST_UNIVERSITY_ID, 'student', 'CSE', 'Spring 2024')

    const group = await findSystemGroup('student', 'Spring 2024')
    expect(group).toBeDefined()
    expect(group!.name).toBe('Spring 2024')
  })
})

describe('SystemGroupsService — membership', () => {
  it('adds alumni to the batch group as a member', async () => {
    const alumniId = await getUserId('alumni')
    await systemGroupsService.addUserToSystemGroups(alumniId, TEST_UNIVERSITY_ID, 'alumni', 'CSE', 'Fall 2023')

    const group = await findSystemGroup('alumni', 'Fall 2023')
    const membership = await db('group_members')
      .where({ group_id: group!.id, user_id: alumniId })
      .first()
    expect(membership).toBeDefined()
  })

  it('adds student to the batch group as a member', async () => {
    const studentId = await getUserId('student')
    await systemGroupsService.addUserToSystemGroups(studentId, TEST_UNIVERSITY_ID, 'student', 'CSE', 'Spring 2024')

    const group = await findSystemGroup('student', 'Spring 2024')
    const membership = await db('group_members')
      .where({ group_id: group!.id, user_id: studentId })
      .first()
    expect(membership).toBeDefined()
  })
})

describe('SystemGroupsService — syncUserMembership', () => {
  it('moves alumni from old batch group to new one when batch year changes', async () => {
    const alumniId = await getUserId('alumni')

    // Put them in Fall 2023
    await systemGroupsService.addUserToSystemGroups(alumniId, TEST_UNIVERSITY_ID, 'alumni', 'CSE', 'Fall 2023')
    const oldGroup = await findSystemGroup('alumni', 'Fall 2023')
    expect(oldGroup).toBeDefined()

    // Sync to Summer 2024
    await systemGroupsService.syncUserMembership(
      alumniId,
      TEST_UNIVERSITY_ID,
      { role: 'alumni', department: 'CSE', batchYear: 'Fall 2023' },
      { role: 'alumni', department: 'CSE', batchYear: 'Summer 2024' },
    )

    // No longer in old group
    const oldMembership = await db('group_members')
      .where({ group_id: oldGroup!.id, user_id: alumniId })
      .first()
    expect(oldMembership).toBeUndefined()

    // Now in new group
    const newGroup = await findSystemGroup('alumni', 'Summer 2024')
    expect(newGroup).toBeDefined()
    const newMembership = await db('group_members')
      .where({ group_id: newGroup!.id, user_id: alumniId })
      .first()
    expect(newMembership).toBeDefined()
  })

  it('does nothing when role, department, and batchYear are unchanged', async () => {
    const studentId = await getUserId('student')
    await systemGroupsService.addUserToSystemGroups(studentId, TEST_UNIVERSITY_ID, 'student', 'EEE', 'Fall 2024')

    const groupBefore = await findSystemGroup('student', 'Fall 2024')
    expect(groupBefore).toBeDefined()

    // Call sync with identical previous/next
    await systemGroupsService.syncUserMembership(
      studentId,
      TEST_UNIVERSITY_ID,
      { role: 'student', department: 'EEE', batchYear: 'Fall 2024' },
      { role: 'student', department: 'EEE', batchYear: 'Fall 2024' },
    )

    const membership = await db('group_members')
      .where({ group_id: groupBefore!.id, user_id: studentId })
      .first()
    expect(membership).toBeDefined()
  })
})
