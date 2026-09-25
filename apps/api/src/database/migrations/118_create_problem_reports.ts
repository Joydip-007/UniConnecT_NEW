import type { Knex } from 'knex'

/**
 * Problem reports filed from the in-app "This page didn't load" card. Each carries
 * the client-generated error id the user saw, so an admin can match it against the
 * browser console log the user shares.
 *
 * One row per (user, error id): pressing Report twice on the same crash is a retry,
 * not a second report, enforced by a unique index.
 */
export async function up(knex: Knex) {
  await knex.schema.createTable('problem_reports', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('error_id', 16).notNullable()
    table.text('error_message').notNullable()
    table.text('description').nullable()
    table.text('page_url').notNullable()
    table.text('user_agent').nullable()
    table.string('status', 20).notNullable().defaultTo('open')
    table.uuid('resolved_by').nullable().references('id').inTable('users').onDelete('SET NULL')
    table.timestamp('resolved_at', { useTz: true }).nullable()
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.index(['university_id', 'created_at'], 'idx_problem_reports_university_created')
    table.index(['university_id', 'status'], 'idx_problem_reports_university_status')
    table.index(['user_id'], 'idx_problem_reports_user')
    table.unique(['user_id', 'error_id'], { indexName: 'uq_problem_reports_user_error' })
  })

  await knex.raw(
    "ALTER TABLE problem_reports ADD CONSTRAINT problem_reports_status_check CHECK (status IN ('open', 'resolved'))",
  )
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('problem_reports')
}
