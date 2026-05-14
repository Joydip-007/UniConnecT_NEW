import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.alterTable('users', (table) => {
    table.index(['university_id'], 'idx_users_university')
    table.index(['role'], 'idx_users_role')
    table.index(['email'], 'idx_users_email')
  })
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropIndex(['email'], 'idx_users_email')
    table.dropIndex(['role'], 'idx_users_role')
    table.dropIndex(['university_id'], 'idx_users_university')
  })
}
