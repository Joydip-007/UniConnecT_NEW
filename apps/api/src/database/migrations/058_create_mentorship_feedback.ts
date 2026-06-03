import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('mentorship_feedback', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('request_id').notNullable().references('id').inTable('mentorship_requests').onDelete('CASCADE')
    table.uuid('author_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('author_role', 10).notNullable()
    table.integer('rating').notNullable()
    table.text('comment').nullable()
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.unique(['request_id', 'author_id'], { useConstraint: true })
  })

  await knex.raw(`
    ALTER TABLE mentorship_feedback
    ADD CONSTRAINT mentorship_feedback_author_role_check
    CHECK (author_role IN ('student', 'alumni'))
  `)

  await knex.raw(`
    ALTER TABLE mentorship_feedback
    ADD CONSTRAINT mentorship_feedback_rating_check
    CHECK (rating BETWEEN 1 AND 5)
  `)

  await knex.schema.alterTable('mentorship_feedback', (table) => {
    table.index(['university_id', 'request_id'], 'idx_feedback_university_request')
    table.index(['request_id', 'author_role'], 'idx_feedback_request_role')
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('mentorship_feedback')
}
