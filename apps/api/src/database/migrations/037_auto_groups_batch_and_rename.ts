// apps/api/src/database/migrations/037_auto_groups_batch_and_rename.ts
import type { Knex } from 'knex'

interface BatchRow { university_id: string; batch_year: string }

export async function up(knex: Knex) {
  // Pass 1 — rename admin groups: "All admins" → "Admins of {university name}"
  await knex.raw(`
    UPDATE groups g
    SET name = 'Admins of ' || u.name
    FROM universities u
    WHERE g.university_id = u.id
      AND g.is_system = true
      AND g.allowed_role = 'admin'
  `)

  // Pass 2 — rename faculty dept groups: "{dept}" → "{dept} Dept"
  await knex.raw(`
    UPDATE groups
    SET name = department || ' Dept'
    WHERE is_system = true
      AND allowed_role = 'faculty'
      AND department IS NOT NULL
  `)

  // Pass 3 — backfill alumni batch groups
  const alumniBatches = await knex('profiles')
    .join('users', 'users.id', 'profiles.user_id')
    .where({ 'users.role': 'alumni', 'users.is_deleted': false })
    .whereNotNull('profiles.batch_year')
    .select<BatchRow[]>('users.university_id', 'profiles.batch_year as batch_year')
    .groupBy('users.university_id', 'profiles.batch_year')

  for (const { university_id, batch_year } of alumniBatches) {
    let group = await knex('groups')
      .where({ university_id, is_system: true, allowed_role: 'alumni', department: batch_year })
      .select<{ id: string }[]>('id')
      .first()

    if (!group) {
      const firstAlumnus = await knex('users')
        .join('profiles', 'profiles.user_id', 'users.id')
        .where({ 'users.university_id': university_id, 'users.role': 'alumni', 'users.is_deleted': false, 'profiles.batch_year': batch_year })
        .select<{ id: string }[]>('users.id')
        .orderBy('users.created_at', 'asc')
        .first()
      if (!firstAlumnus) continue

      const [row] = await knex('groups')
        .insert({
          university_id,
          created_by: firstAlumnus.id,
          name: `${batch_year} Graduates`,
          description: `Official auto-managed group for ${batch_year} graduates.`,
          type: 'batch',
          is_private: true,
          is_system: true,
          allowed_role: 'alumni',
          department: batch_year,
          member_count: 0,
        })
        .returning<{ id: string }[]>('id')
      group = row
    }

    const members = await knex('users')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where({ 'users.university_id': university_id, 'users.role': 'alumni', 'users.is_deleted': false, 'profiles.batch_year': batch_year })
      .select<{ id: string }[]>('users.id')

    for (const member of members) {
      await knex('group_members')
        .insert({ group_id: group.id, user_id: member.id, role: 'member' })
        .onConflict(['group_id', 'user_id'])
        .ignore()
    }
  }

  // Pass 4 — backfill student batch groups
  const studentBatches = await knex('profiles')
    .join('users', 'users.id', 'profiles.user_id')
    .where({ 'users.role': 'student', 'users.is_deleted': false })
    .whereNotNull('profiles.batch_year')
    .select<BatchRow[]>('users.university_id', 'profiles.batch_year as batch_year')
    .groupBy('users.university_id', 'profiles.batch_year')

  for (const { university_id, batch_year } of studentBatches) {
    let group = await knex('groups')
      .where({ university_id, is_system: true, allowed_role: 'student', department: batch_year })
      .select<{ id: string }[]>('id')
      .first()

    if (!group) {
      const firstStudent = await knex('users')
        .join('profiles', 'profiles.user_id', 'users.id')
        .where({ 'users.university_id': university_id, 'users.role': 'student', 'users.is_deleted': false, 'profiles.batch_year': batch_year })
        .select<{ id: string }[]>('users.id')
        .orderBy('users.created_at', 'asc')
        .first()
      if (!firstStudent) continue

      const [row] = await knex('groups')
        .insert({
          university_id,
          created_by: firstStudent.id,
          name: batch_year,
          description: `Official auto-managed group for ${batch_year} students.`,
          type: 'batch',
          is_private: true,
          is_system: true,
          allowed_role: 'student',
          department: batch_year,
          member_count: 0,
        })
        .returning<{ id: string }[]>('id')
      group = row
    }

    const members = await knex('users')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where({ 'users.university_id': university_id, 'users.role': 'student', 'users.is_deleted': false, 'profiles.batch_year': batch_year })
      .select<{ id: string }[]>('users.id')

    for (const member of members) {
      await knex('group_members')
        .insert({ group_id: group.id, user_id: member.id, role: 'member' })
        .onConflict(['group_id', 'user_id'])
        .ignore()
    }
  }

  // Pass 5 — resync member counts on all system groups
  await knex.raw(`
    UPDATE groups g
    SET member_count = (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id)
    WHERE g.is_system = true
  `)
}

export async function down(knex: Knex) {
  // Revert admin group names
  await knex.raw(`
    UPDATE groups
    SET name = 'All admins'
    WHERE is_system = true AND allowed_role = 'admin'
  `)

  // Revert faculty group names: remove ' Dept' suffix
  await knex.raw(`
    UPDATE groups
    SET name = department
    WHERE is_system = true AND allowed_role = 'faculty' AND department IS NOT NULL
  `)

  // Delete alumni and student batch groups (cascade removes group_members)
  await knex('groups')
    .where({ is_system: true })
    .whereIn('allowed_role', ['alumni', 'student'])
    .delete()
}
