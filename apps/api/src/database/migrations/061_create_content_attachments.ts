import type { Knex } from 'knex'

/**
 * Polymorphic attachments captured by the content-sync automation.
 * Files are downloaded server-side and re-hosted on R2/S3 (file_url), so they
 * survive UIU removing the original and cost zero Skyvern credits.
 */
export async function up(knex: Knex) {
  await knex.schema.createTable('content_attachments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.string('entity_type', 20).notNullable()
    table.uuid('entity_id').notNullable()
    table.text('source_url').notNullable()
    table.text('file_url')
    table.text('file_name').notNullable()
    table.string('mime_type', 255)
    table.integer('size_bytes')
    table.string('download_status', 20).notNullable().defaultTo('pending')
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
  })

  await knex.raw(
    "ALTER TABLE content_attachments ADD CONSTRAINT content_attachments_entity_type_check CHECK (entity_type IN ('news', 'event'))",
  )
  await knex.raw(
    "ALTER TABLE content_attachments ADD CONSTRAINT content_attachments_download_status_check CHECK (download_status IN ('pending', 'done', 'failed'))",
  )

  await knex.schema.alterTable('content_attachments', (table) => {
    table.index(['entity_type', 'entity_id'], 'idx_content_attachments_entity')
    table.index(['download_status'], 'idx_content_attachments_status')
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('content_attachments')
}
