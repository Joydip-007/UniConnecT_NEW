import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('daily_quiz_slots', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE').index()
    table.string('department', 100).notNullable()
    table.date('date').notNullable()
    table.jsonb('questions').notNullable().defaultTo('[]')
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.unique(['university_id', 'department', 'date'])
    table.index(['university_id', 'date'])
  })

  await knex.schema.createTable('daily_quiz_attempts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('slot_id').notNullable().references('id').inTable('daily_quiz_slots').onDelete('CASCADE').index()
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE').index()
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE').index()
    table.jsonb('answers').notNullable().defaultTo('[]')
    table.integer('score').notNullable().defaultTo(0)
    table.integer('correct_count').notNullable().defaultTo(0)
    table.integer('total_questions').notNullable().defaultTo(0)
    table.timestamp('completed_at', { useTz: true }).defaultTo(knex.fn.now())
    table.unique(['slot_id', 'user_id'])
    table.index(['university_id', 'completed_at'])
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('daily_quiz_attempts')
  await knex.schema.dropTableIfExists('daily_quiz_slots')
}
