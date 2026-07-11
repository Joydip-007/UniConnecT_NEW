import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('university_settings', (table) => {
    table.text('ai_last_error')
    table.timestamp('ai_last_error_at')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('university_settings', (table) => {
    table.dropColumn('ai_last_error')
    table.dropColumn('ai_last_error_at')
  })
}
