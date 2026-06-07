import type { Knex } from 'knex'

/**
 * Generalizes `content_attachments` from a content-sync-only table into the shared
 * attachment store for user-uploaded files too.
 *
 * - `source_url` becomes nullable (user uploads have no external source).
 * - `entity_type` widens to include 'job' and 'post' (was 'news' | 'event').
 * - `uploaded_by` records the uploading user (NULL = content-sync import).
 *
 * User-upload rows are inserted with `download_status = 'done'` and `source_url = NULL`;
 * content-sync rows keep the existing pending → done/failed download lifecycle.
 */
export async function up(knex: Knex) {
  await knex.schema.alterTable('content_attachments', (table) => {
    table.text('source_url').nullable().alter()
    table
      .uuid('uploaded_by')
      .nullable()
      .references('id')
      .inTable('users')
      .onDelete('SET NULL')
  })

  await knex.raw('ALTER TABLE content_attachments DROP CONSTRAINT IF EXISTS content_attachments_entity_type_check')
  await knex.raw(
    "ALTER TABLE content_attachments ADD CONSTRAINT content_attachments_entity_type_check CHECK (entity_type IN ('news', 'event', 'job', 'post'))",
  )
}

export async function down(knex: Knex) {
  // Drop rows that the widened constraint allowed but the original did not, so the
  // restored CHECK can be applied without violation.
  await knex('content_attachments').whereIn('entity_type', ['job', 'post']).delete()

  await knex.raw('ALTER TABLE content_attachments DROP CONSTRAINT IF EXISTS content_attachments_entity_type_check')
  await knex.raw(
    "ALTER TABLE content_attachments ADD CONSTRAINT content_attachments_entity_type_check CHECK (entity_type IN ('news', 'event'))",
  )

  await knex.schema.alterTable('content_attachments', (table) => {
    table.dropColumn('uploaded_by')
  })

  // Note: source_url is left nullable on rollback — re-tightening to NOT NULL could fail
  // on user-upload rows that legitimately have a null source. Harmless to leave relaxed.
}
