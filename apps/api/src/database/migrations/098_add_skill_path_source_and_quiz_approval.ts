import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('skill_paths', (table) => {
    table.string('source', 10).notNullable().defaultTo('manual') // 'manual' | 'ai'
  })
  await knex.schema.alterTable('ai_quiz_pool', (table) => {
    table.boolean('is_approved').nullable() // null=pending, true=approved, false=discarded
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('ai_quiz_pool', (table) => table.dropColumn('is_approved'))
  await knex.schema.alterTable('skill_paths', (table) => table.dropColumn('source'))
}
