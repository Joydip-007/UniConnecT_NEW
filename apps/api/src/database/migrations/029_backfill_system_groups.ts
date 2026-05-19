import type { Knex } from 'knex'

interface UniversityRow {
  id: string
}

interface FacultyDeptRow {
  university_id: string
  department: string
}

export async function up(knex: Knex) {
  const universities = await knex<UniversityRow>('universities').select('id')

  for (const uni of universities) {
    await ensureAdminGroup(knex, uni.id)
    await ensureFacultyDeptGroups(knex, uni.id)
    await resyncMemberCounts(knex, uni.id)
  }
}

export async function down(knex: Knex) {
  // Remove all system groups and their members (group_members cascade on groups delete)
  await knex('groups').where({ is_system: true }).delete()
}

async function ensureAdminGroup(knex: Knex, universityId: string) {
  const existing = await knex('groups')
    .where({ university_id: universityId, is_system: true, allowed_role: 'admin' })
    .select<{ id: string }[]>('id')
    .first()

  let groupId = existing?.id
  if (!groupId) {
    const firstAdmin = await knex('users')
      .where({ university_id: universityId, role: 'admin' })
      .select<{ id: string }[]>('id')
      .orderBy('created_at', 'asc')
      .first()

    if (!firstAdmin) return // no admin yet — group will be created lazily on first admin promotion

    const [row] = await knex('groups')
      .insert({
        university_id: universityId,
        created_by: firstAdmin.id,
        name: 'All admins',
        description: 'Official auto-managed group for all administrators.',
        type: 'other',
        is_private: true,
        is_system: true,
        allowed_role: 'admin',
        department: null,
        member_count: 0,
      })
      .returning<{ id: string }[]>('id')

    groupId = row.id
  }

  // Sync membership: every admin in this university should be a member
  const admins = await knex('users')
    .where({ university_id: universityId, role: 'admin' })
    .select<{ id: string }[]>('id')

  for (const admin of admins) {
    await knex('group_members')
      .insert({ group_id: groupId, user_id: admin.id, role: 'member' })
      .onConflict(['group_id', 'user_id'])
      .ignore()
  }
}

async function ensureFacultyDeptGroups(knex: Knex, universityId: string) {
  const depts = (await knex('users')
    .join('profiles', 'profiles.user_id', 'users.id')
    .where({ 'users.university_id': universityId, 'users.role': 'faculty' })
    .whereNotNull('profiles.department')
    .select<FacultyDeptRow[]>('users.university_id', 'profiles.department')
    .groupBy('users.university_id', 'profiles.department')) as FacultyDeptRow[]

  for (const { department } of depts) {
    const trimmed = department.trim()
    if (!trimmed) continue

    let group = await knex('groups')
      .where({
        university_id: universityId,
        is_system: true,
        allowed_role: 'faculty',
        department: trimmed,
      })
      .select<{ id: string }[]>('id')
      .first()

    if (!group) {
      const firstFaculty = await knex('users')
        .join('profiles', 'profiles.user_id', 'users.id')
        .where({ 'users.university_id': universityId, 'users.role': 'faculty', 'profiles.department': trimmed })
        .select<{ id: string }[]>('users.id')
        .orderBy('users.created_at', 'asc')
        .first()

      if (!firstFaculty) continue

      const [row] = await knex('groups')
        .insert({
          university_id: universityId,
          created_by: firstFaculty.id,
          name: trimmed,
          description: `Official auto-managed group for ${trimmed} faculty.`,
          type: 'department',
          is_private: true,
          is_system: true,
          allowed_role: 'faculty',
          department: trimmed,
          member_count: 0,
        })
        .returning<{ id: string }[]>('id')
      group = row
    }

    const faculty = await knex('users')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where({ 'users.university_id': universityId, 'users.role': 'faculty', 'profiles.department': trimmed })
      .select<{ id: string }[]>('users.id')

    for (const user of faculty) {
      await knex('group_members')
        .insert({ group_id: group.id, user_id: user.id, role: 'member' })
        .onConflict(['group_id', 'user_id'])
        .ignore()
    }
  }
}

async function resyncMemberCounts(knex: Knex, universityId: string) {
  await knex.raw(
    `UPDATE groups g
       SET member_count = (
         SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id
       )
     WHERE g.university_id = ? AND g.is_system = true`,
    [universityId],
  )
}
