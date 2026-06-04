import type { Knex } from 'knex'

// Reuse the user_settings table (created in 065) for privacy. One JSONB column,
// missing keys fall back to DEFAULT_PRIVACY_PREFERENCES via deep-merge in the service.
export async function up(knex: Knex) {
  await knex.schema.alterTable('user_settings', (table) => {
    table.jsonb('privacy_preferences').notNullable().defaultTo('{}')
  })
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('user_settings', (table) => {
    table.dropColumn('privacy_preferences')
  })
}
