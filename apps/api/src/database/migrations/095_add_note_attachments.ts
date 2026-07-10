import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('group_shared_notes', (table) => {
    table.jsonb('attachments').notNullable().defaultTo('[]')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('group_shared_notes', (table) => {
    table.dropColumn('attachments')
  })
}
