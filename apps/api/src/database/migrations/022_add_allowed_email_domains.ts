import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.alterTable('universities', (table) => {
    table.specificType('allowed_email_domains', 'text[]').defaultTo(null)
  })
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('universities', (table) => {
    table.dropColumn('allowed_email_domains')
  })
}
