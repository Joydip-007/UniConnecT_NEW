import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('conversations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.string('name', 255)
    table.boolean('is_group').defaultTo(false)
    table.text('avatar_url')
    table.uuid('created_by').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('conversation_participants', (table) => {
    table.uuid('conversation_id').notNullable().references('id').inTable('conversations').onDelete('CASCADE')
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.timestamp('last_read_at', { useTz: true })
    table.boolean('is_muted').defaultTo(false)
    table.timestamp('joined_at', { useTz: true }).defaultTo(knex.fn.now())
    table.primary(['conversation_id', 'user_id'])
  })

  await knex.schema.createTable('messages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('conversation_id').notNullable().references('id').inTable('conversations').onDelete('CASCADE')
    table.uuid('sender_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.text('content')
    table.specificType('media_urls', 'text[]')
    table.uuid('reply_to_id').references('id').inTable('messages').onDelete('SET NULL')
    table.string('type', 20).notNullable().defaultTo('text')
    table.boolean('is_deleted').defaultTo(false)
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
  })

  await knex.raw(
    "ALTER TABLE messages ADD CONSTRAINT messages_type_check CHECK (type IN ('text', 'image', 'file', 'system'))",
  )

  await knex.schema.alterTable('conversations', (table) => {
    table.index(['university_id'], 'idx_conversations_university')
    table.index(['created_by'], 'idx_conversations_created_by')
  })
  await knex.schema.alterTable('conversation_participants', (table) => {
    table.index(['user_id'], 'idx_conversation_participants_user')
  })
  await knex.raw('CREATE INDEX idx_messages_conv ON messages (conversation_id, created_at DESC)')
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('messages')
  await knex.schema.dropTableIfExists('conversation_participants')
  await knex.schema.dropTableIfExists('conversations')
}
