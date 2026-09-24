import type { Knex } from 'knex'

/**
 * Messages redesign (Messages Page.dc.html):
 *  - per-participant thread preferences: pin, chat theme, default quick emoji
 *    (`is_muted` already exists on `conversation_participants`)
 *  - structured attachment metadata (name/size/mime) beside the legacy `media_urls`
 *  - "view once" photos and message edit timestamps
 *  - per-viewer message state: "remove for me" and view-once opens
 */
export async function up(knex: Knex) {
  await knex.schema.alterTable('conversation_participants', (table) => {
    table.boolean('is_pinned').notNullable().defaultTo(false)
    table.timestamp('pinned_at', { useTz: true }).nullable()
    table.string('chat_theme', 16).notNullable().defaultTo('indigo')
    table.string('quick_emoji', 16).notNullable().defaultTo('👍')
  })

  await knex.raw(
    "ALTER TABLE conversation_participants ADD CONSTRAINT conversation_participants_chat_theme_check CHECK (chat_theme IN ('indigo', 'mint', 'amber', 'cyan', 'rose'))",
  )

  await knex.schema.alterTable('messages', (table) => {
    table.jsonb('attachments').notNullable().defaultTo(knex.raw("'[]'::jsonb"))
    table.boolean('view_once').notNullable().defaultTo(false)
    table.timestamp('edited_at', { useTz: true }).nullable()
  })

  await knex.schema.createTable('message_user_states', (table) => {
    table.uuid('message_id').notNullable().references('id').inTable('messages').onDelete('CASCADE')
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.boolean('is_hidden').notNullable().defaultTo(false)
    table.timestamp('once_viewed_at', { useTz: true }).nullable()
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.primary(['message_id', 'user_id'])
    table.index(['user_id'], 'idx_message_user_states_user')
    table.index(['university_id'], 'idx_message_user_states_university')
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('message_user_states')

  await knex.schema.alterTable('messages', (table) => {
    table.dropColumn('attachments')
    table.dropColumn('view_once')
    table.dropColumn('edited_at')
  })

  await knex.raw(
    'ALTER TABLE conversation_participants DROP CONSTRAINT IF EXISTS conversation_participants_chat_theme_check',
  )
  await knex.schema.alterTable('conversation_participants', (table) => {
    table.dropColumn('is_pinned')
    table.dropColumn('pinned_at')
    table.dropColumn('chat_theme')
    table.dropColumn('quick_emoji')
  })
}
