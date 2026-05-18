import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.alterTable('profiles', (table) => {
    table.boolean('is_open_to_mentorship').notNullable().defaultTo(false)
    table.integer('mentorship_points').notNullable().defaultTo(0)
  })
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('profiles', (table) => {
    table.dropColumn('is_open_to_mentorship')
    table.dropColumn('mentorship_points')
  })
}
