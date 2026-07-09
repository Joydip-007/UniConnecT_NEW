import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('ai_quiz_pool', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.string('department', 255).notNullable()
    table.jsonb('questions').notNullable()
    table.timestamp('generated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('consumed_at', { useTz: true })
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  await knex.schema.alterTable('ai_quiz_pool', (table) => {
    table.index(['university_id', 'department', 'consumed_at'], 'ai_quiz_pool_available_idx')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('ai_quiz_pool')
}
