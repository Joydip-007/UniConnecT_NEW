import type { Knex } from 'knex'

export async function up(knex: Knex) {
  // Drop constraint first to allow the update
  await knex.raw('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check')

  // Update data
  await knex('users').where({ role: 'staff' }).update({ role: 'faculty' })
  await knex('invitations').where({ role: 'staff' }).update({ role: 'faculty' })

  // Add new constraint with faculty instead of staff
  await knex.raw(
    "ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'alumni', 'faculty', 'admin'))",
  )
}

export async function down(knex: Knex) {
  // Drop the constraint before rewriting the data, mirroring up(). The live CHECK at
  // this point is ('student','alumni','faculty','admin') — it does not permit 'staff' —
  // so updating first made every rollback fail with users_role_check.
  await knex.raw('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check')

  await knex('invitations').where({ role: 'faculty' }).update({ role: 'staff' })
  await knex('users').where({ role: 'faculty' }).update({ role: 'staff' })

  await knex.raw(
    "ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'alumni', 'staff', 'admin'))",
  )
}
