import type { Knex } from 'knex'

/**
 * Admin content moderation removes a post rather than deleting it, so the
 * "Recently removed" tray can restore it. `removed_at` marks the removal and
 * `removed_by` records which admin did it; the post is also archived
 * (`archived_at`) so every existing public query hides it without a new filter.
 * The author cannot unarchive a post while `removed_at` is set.
 */
export async function up(knex: Knex) {
  await knex.schema.alterTable('posts', (table) => {
    table.timestamp('removed_at', { useTz: true }).nullable()
    table.uuid('removed_by').nullable().references('id').inTable('users').onDelete('SET NULL')
  })
  await knex.raw(
    'CREATE INDEX idx_posts_removed ON posts (university_id, removed_at DESC) WHERE removed_at IS NOT NULL',
  )
}

export async function down(knex: Knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_posts_removed')
  await knex.schema.alterTable('posts', (table) => {
    table.dropColumn('removed_by')
    table.dropColumn('removed_at')
  })
}
