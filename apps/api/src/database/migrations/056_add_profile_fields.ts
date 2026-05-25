import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.alterTable('profiles', (table) => {
    table.text('location').nullable()
    table.text('website_url').nullable()
    table.text('github_url').nullable()
    table.text('portfolio_url').nullable()
    table.boolean('is_open_to_msg').notNullable().defaultTo(false)
  })
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('profiles', (table) => {
    table.dropColumn('location')
    table.dropColumn('website_url')
    table.dropColumn('github_url')
    table.dropColumn('portfolio_url')
    table.dropColumn('is_open_to_msg')
  })
}
