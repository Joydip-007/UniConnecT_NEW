import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('group_quizzes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
    table.string('title', 160).notNullable()
    table.jsonb('questions').notNullable().defaultTo('[]')
    table.boolean('is_archived').notNullable().defaultTo(false)
    table.integer('question_count').notNullable().defaultTo(0)
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
  })

  await knex.schema.alterTable('group_quizzes', (table) => {
    table.index(['group_id', 'created_at'], 'idx_group_quizzes_group_created')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('group_quizzes')
}
