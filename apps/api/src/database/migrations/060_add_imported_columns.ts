import type { Knex } from 'knex'

/**
 * Adds the columns the content-sync automation needs to track imported items.
 * - source_url: the original UIU detail-page URL — the incremental dedup key.
 * - is_imported: distinguishes scraped items from human-authored ones.
 * - is_announcement (news only): the single featured notice on the News page.
 *
 * Two partial unique indexes give DB-level guarantees the worker relies on:
 *  - (university_id, source_url) → re-running a sync can never duplicate an item.
 *  - (university_id) where is_announcement → exactly one announcement per tenant.
 */
export async function up(knex: Knex) {
  await knex.schema.alterTable('news', (table) => {
    table.text('source_url')
    table.boolean('is_imported').notNullable().defaultTo(false)
    table.boolean('is_announcement').notNullable().defaultTo(false)
  })

  await knex.schema.alterTable('events', (table) => {
    table.text('source_url')
    table.boolean('is_imported').notNullable().defaultTo(false)
  })

  await knex.raw(
    `CREATE UNIQUE INDEX uq_news_university_source_url ON news (university_id, source_url) WHERE source_url IS NOT NULL`,
  )
  await knex.raw(
    `CREATE UNIQUE INDEX uq_events_university_source_url ON events (university_id, source_url) WHERE source_url IS NOT NULL`,
  )
  await knex.raw(
    `CREATE UNIQUE INDEX uq_news_university_announcement ON news (university_id) WHERE is_announcement`,
  )
}

export async function down(knex: Knex) {
  await knex.raw('DROP INDEX IF EXISTS uq_news_university_announcement')
  await knex.raw('DROP INDEX IF EXISTS uq_events_university_source_url')
  await knex.raw('DROP INDEX IF EXISTS uq_news_university_source_url')

  await knex.schema.alterTable('events', (table) => {
    table.dropColumn('source_url')
    table.dropColumn('is_imported')
  })

  await knex.schema.alterTable('news', (table) => {
    table.dropColumn('source_url')
    table.dropColumn('is_imported')
    table.dropColumn('is_announcement')
  })
}
