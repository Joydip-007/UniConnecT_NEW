import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.alterTable('users', (table) => {
    table.text('theme_preference').notNullable().defaultTo('system')
  })

  await knex.raw(
    "ALTER TABLE users ADD CONSTRAINT users_theme_preference_check CHECK (theme_preference IN ('light', 'dark', 'system'))",
  )
}

export async function down(knex: Knex) {
  await knex.raw('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_theme_preference_check')
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('theme_preference')
  })
}
