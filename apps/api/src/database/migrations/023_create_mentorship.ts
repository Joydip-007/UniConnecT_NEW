import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('mentorship_requests', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('student_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('alumni_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.text('message').notNullable()
    table.string('status', 20).notNullable().defaultTo('pending')
    table.text('session_notes').nullable()
    table.boolean('is_deleted').defaultTo(false)
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
    table.unique(['student_id', 'alumni_id'], 'uq_mentorship_student_alumni')
  })

  await knex.raw(`
    ALTER TABLE mentorship_requests
    ADD CONSTRAINT mentorship_requests_status_check
    CHECK (status IN ('pending', 'accepted', 'declined', 'completed'))
  `)

  await knex.schema.alterTable('mentorship_requests', (table) => {
    table.index(['university_id', 'student_id'], 'idx_mentorship_university_student')
    table.index(['university_id', 'alumni_id', 'status'], 'idx_mentorship_university_alumni_status')
    table.index(['university_id', 'created_at'], 'idx_mentorship_university_created')
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('mentorship_requests')
}
