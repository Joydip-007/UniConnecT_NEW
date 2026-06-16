import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.alterTable('messages', (table) => {
    table.string('content_type', 10).notNullable().defaultTo('text')
    table.text('sticker_url').nullable()
  })

  await knex.raw(
    "ALTER TABLE messages ADD CONSTRAINT messages_content_type_check CHECK (content_type IN ('text', 'image', 'file', 'system', 'sticker'))",
  )
}

export async function down(knex: Knex) {
  await knex.raw('ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_content_type_check')
  await knex.schema.alterTable('messages', (table) => {
    table.dropColumn('content_type')
    table.dropColumn('sticker_url')
  })
}
