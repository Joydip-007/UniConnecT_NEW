import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.alterTable('invitations', (table) => {
    table.uuid('batch_id').nullable()
    table.string('batch_label', 120).nullable()
  })
  await knex.schema.alterTable('invitations', (table) => {
    table.index('batch_id')
  })
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('invitations', (table) => {
    table.dropIndex('batch_id')
    table.dropColumn('batch_label')
    table.dropColumn('batch_id')
  })
}
