import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.alterTable('university_settings', (table) => {
    // Newest entries fetched per source (news/notice/event) on each content-sync run.
    table.integer('content_sync_entries_per_source').notNullable().defaultTo(5)
  })
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('university_settings', (table) => {
    table.dropColumn('content_sync_entries_per_source')
  })
}
