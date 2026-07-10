import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('university_settings', (table) => {
    table.boolean('ai_learning_enabled').notNullable().defaultTo(false)
    table.jsonb('ai_learning_topics').notNullable().defaultTo('[]') // [{ category, difficulty? }]
    table.string('ai_learning_difficulty', 20).notNullable().defaultTo('intermediate')
    table.string('ai_learning_language', 2).notNullable().defaultTo('en')
    table.integer('ai_learning_est_days').notNullable().defaultTo(7)
    table.text('ai_learning_custom_instructions')
    table.integer('ai_learning_gen_hour').notNullable().defaultTo(2) // UTC hour, per-tenant cadence
    table.integer('ai_learning_count_per_run').notNullable().defaultTo(1)
    table.boolean('ai_quiz_require_approval').notNullable().defaultTo(false) // opt-in, default off
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('university_settings', (table) => {
    table.dropColumn('ai_learning_enabled')
    table.dropColumn('ai_learning_topics')
    table.dropColumn('ai_learning_difficulty')
    table.dropColumn('ai_learning_language')
    table.dropColumn('ai_learning_est_days')
    table.dropColumn('ai_learning_custom_instructions')
    table.dropColumn('ai_learning_gen_hour')
    table.dropColumn('ai_learning_count_per_run')
    table.dropColumn('ai_quiz_require_approval')
  })
}
