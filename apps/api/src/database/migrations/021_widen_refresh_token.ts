import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.alterTable('user_sessions', (table) => {
    table.text('refresh_token').alter()
  })
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('user_sessions', (table) => {
    table.string('refresh_token', 256).alter()
  })
}
