import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.alterTable('mentorship_requests', (table) => {
    table
      .uuid('conversation_id')
      .nullable()
      .references('id')
      .inTable('conversations')
      .onDelete('SET NULL')
    table.text('reminder_job_id').nullable()
    table.text('expire_job_id').nullable()
  })
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('mentorship_requests', (table) => {
    table.dropColumn('conversation_id')
    table.dropColumn('reminder_job_id')
    table.dropColumn('expire_job_id')
  })
}
