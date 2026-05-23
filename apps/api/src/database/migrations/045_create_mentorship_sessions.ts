import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('mentorship_sessions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table
      .uuid('university_id')
      .notNullable()
      .references('id')
      .inTable('universities')
      .onDelete('CASCADE')
    table
      .uuid('request_id')
      .notNullable()
      .references('id')
      .inTable('mentorship_requests')
      .onDelete('CASCADE')
    table.uuid('created_by').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.date('session_date').notNullable()
    table.integer('duration_minutes').notNullable()
    table.string('topic', 255).notNullable()
    table.text('notes').nullable()
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
  })

  await knex.schema.alterTable('mentorship_sessions', (table) => {
    table.index(
      ['university_id', 'request_id', 'session_date'],
      'idx_mentorship_sessions_university_request_date',
    )
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('mentorship_sessions')
}
