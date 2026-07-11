import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('university_settings', (table) => {
    table.boolean('ai_quiz_enabled').notNullable().defaultTo(false)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('university_settings', (table) => {
    table.dropColumn('ai_quiz_enabled')
  })
}
