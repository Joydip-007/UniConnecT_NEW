import type { Knex } from 'knex'

/** History of content-sync runs — powers the admin "last synced" summary and the 409 concurrency guard. */
export async function up(knex: Knex) {
  await knex.schema.createTable('content_sync_runs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('triggered_by').references('id').inTable('users').onDelete('SET NULL')
    table.string('status', 20).notNullable().defaultTo('running')
    table.integer('items_found').notNullable().defaultTo(0)
    table.integer('items_new').notNullable().defaultTo(0)
    table.text('error')
    table.timestamp('started_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('finished_at', { useTz: true })
  })

  await knex.raw(
    "ALTER TABLE content_sync_runs ADD CONSTRAINT content_sync_runs_status_check CHECK (status IN ('running', 'success', 'failed'))",
  )

  await knex.schema.alterTable('content_sync_runs', (table) => {
    table.index(['university_id', 'started_at'], 'idx_content_sync_runs_university')
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('content_sync_runs')
}
