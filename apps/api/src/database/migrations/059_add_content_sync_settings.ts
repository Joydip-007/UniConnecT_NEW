import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.alterTable('university_settings', (table) => {
    table.text('content_sync_news_url')
    table.text('content_sync_notice_url')
    table.text('content_sync_event_url')
    table.boolean('content_sync_enabled').notNullable().defaultTo(false)
  })
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('university_settings', (table) => {
    table.dropColumn('content_sync_news_url')
    table.dropColumn('content_sync_notice_url')
    table.dropColumn('content_sync_event_url')
    table.dropColumn('content_sync_enabled')
  })
}
