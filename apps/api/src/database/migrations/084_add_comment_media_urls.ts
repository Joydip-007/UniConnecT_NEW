import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.alterTable('comments', (table) => {
    table.specificType('media_urls', 'text[]').defaultTo('{}')
  })
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('comments', (table) => {
    table.dropColumn('media_urls')
  })
}
