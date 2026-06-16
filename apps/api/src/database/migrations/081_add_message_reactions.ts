import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('message_reactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('message_id').notNullable().references('id').inTable('messages').onDelete('CASCADE')
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.string('reaction_type', 10).notNullable()
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.unique(['message_id', 'user_id'], 'uq_message_reactions_user_message')
  })

  await knex.raw(
    "ALTER TABLE message_reactions ADD CONSTRAINT message_reactions_type_check CHECK (reaction_type IN ('like', 'love', 'care', 'haha', 'wow', 'angry'))",
  )

  await knex.schema.alterTable('message_reactions', (table) => {
    table.index(['message_id'], 'idx_message_reactions_message')
    table.index(['user_id'], 'idx_message_reactions_user')
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('message_reactions')
}
