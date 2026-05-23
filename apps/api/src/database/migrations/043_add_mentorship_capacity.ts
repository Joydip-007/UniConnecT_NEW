import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.alterTable('profiles', (table) => {
    table.integer('max_mentees').notNullable().defaultTo(3)
  })
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('profiles', (table) => {
    table.dropColumn('max_mentees')
  })
}
