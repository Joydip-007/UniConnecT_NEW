import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('university_settings', (table) => {
    table.string('ai_quiz_difficulty', 20).notNullable().defaultTo('intermediate')
    table.string('ai_quiz_language', 2).notNullable().defaultTo('en')
    table.integer('ai_quiz_count').notNullable().defaultTo(5)
    table.text('ai_quiz_custom_instructions')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('university_settings', (table) => {
    table.dropColumn('ai_quiz_difficulty')
    table.dropColumn('ai_quiz_language')
    table.dropColumn('ai_quiz_count')
    table.dropColumn('ai_quiz_custom_instructions')
  })
}
