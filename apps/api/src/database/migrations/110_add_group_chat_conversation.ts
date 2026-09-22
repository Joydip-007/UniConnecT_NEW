import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('groups', (t) => {
    t.uuid('chat_conversation_id').nullable().references('id').inTable('conversations').onDelete('SET NULL')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('groups', (t) => t.dropColumn('chat_conversation_id'))
}
