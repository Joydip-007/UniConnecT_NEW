import type { Knex } from 'knex'

/**
 * Brings a unified draft model to the two content types that lacked one.
 *
 * `news` and `events` already have `is_published`. Adding it to `posts` and `jobs`
 * (default true so every existing row stays live) lets any user save a draft of any
 * content type. Draft = `is_published = false`; drafts are author-only and are excluded
 * from every public list — they surface only in the author's "Drafts" view.
 */
export async function up(knex: Knex) {
  await knex.schema.alterTable('posts', (table) => {
    table.boolean('is_published').notNullable().defaultTo(true)
  })
  await knex.schema.alterTable('jobs', (table) => {
    table.boolean('is_published').notNullable().defaultTo(true)
  })

  // High-volume feeds filter on is_published; index it alongside the tenant + recency keys.
  await knex.raw(
    `CREATE INDEX idx_posts_university_published_created ON posts (university_id, is_published, created_at DESC)`,
  )
  await knex.raw(
    `CREATE INDEX idx_jobs_university_published_created ON jobs (university_id, is_published, created_at DESC)`,
  )
}

export async function down(knex: Knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_jobs_university_published_created')
  await knex.raw('DROP INDEX IF EXISTS idx_posts_university_published_created')
  await knex.schema.alterTable('jobs', (table) => {
    table.dropColumn('is_published')
  })
  await knex.schema.alterTable('posts', (table) => {
    table.dropColumn('is_published')
  })
}
