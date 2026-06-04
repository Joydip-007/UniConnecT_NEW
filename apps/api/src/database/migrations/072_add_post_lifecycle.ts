import type { Knex } from 'knex'

/**
 * Post lifecycle columns: scheduling, expiry, and archival (posts only).
 *
 *  - `publish_at`  — when set & in the future on an unpublished post, the post is
 *    "scheduled": invisible until a lifecycle job flips `is_published = true`.
 *  - `archived_at` — non-null = archived. Archived posts are retained but removed
 *    from every public feed/search; reversible (unarchive clears it).
 *  - `expires_at`  — scheduled auto-archive time; a lifecycle job sets `archived_at`
 *    when it passes.
 *
 * Derived states (no enum kept in sync):
 *   draft     = is_published false AND publish_at null
 *   scheduled = is_published false AND publish_at in future
 *   published = is_published true  AND archived_at null
 *   archived  = archived_at not null
 *
 * Both partial indexes back the reconciliation cron, which scans only the small set
 * of rows that still have a pending publish/expire time.
 */
export async function up(knex: Knex) {
  await knex.schema.alterTable('posts', (table) => {
    table.timestamp('publish_at', { useTz: true }).nullable()
    table.timestamp('archived_at', { useTz: true }).nullable()
    table.timestamp('expires_at', { useTz: true }).nullable()
  })

  await knex.raw(
    `CREATE INDEX idx_posts_publish_at ON posts (university_id, publish_at)
       WHERE publish_at IS NOT NULL`,
  )
  await knex.raw(
    `CREATE INDEX idx_posts_expires_at ON posts (university_id, expires_at)
       WHERE expires_at IS NOT NULL AND archived_at IS NULL`,
  )
}

export async function down(knex: Knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_posts_expires_at')
  await knex.raw('DROP INDEX IF EXISTS idx_posts_publish_at')
  await knex.schema.alterTable('posts', (table) => {
    table.dropColumn('expires_at')
    table.dropColumn('archived_at')
    table.dropColumn('publish_at')
  })
}
