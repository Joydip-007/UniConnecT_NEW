import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.alterTable('groups', (table) => {
    table.string('allowed_role', 20).nullable()
    table.boolean('is_system').notNullable().defaultTo(false)
    table.string('department', 120).nullable()
  })

  await knex.raw(
    "ALTER TABLE groups ADD CONSTRAINT groups_allowed_role_check CHECK (allowed_role IS NULL OR allowed_role IN ('student','alumni','faculty','admin'))",
  )

  await knex.raw(
    `CREATE UNIQUE INDEX uq_groups_system_admin
       ON groups (university_id)
       WHERE is_system = true AND allowed_role = 'admin'`,
  )

  await knex.raw(
    `CREATE UNIQUE INDEX uq_groups_system_faculty_dept
       ON groups (university_id, department)
       WHERE is_system = true AND allowed_role = 'faculty'`,
  )
}

export async function down(knex: Knex) {
  await knex.raw('DROP INDEX IF EXISTS uq_groups_system_faculty_dept')
  await knex.raw('DROP INDEX IF EXISTS uq_groups_system_admin')
  await knex.raw('ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_allowed_role_check')

  await knex.schema.alterTable('groups', (table) => {
    table.dropColumn('department')
    table.dropColumn('is_system')
    table.dropColumn('allowed_role')
  })
}
