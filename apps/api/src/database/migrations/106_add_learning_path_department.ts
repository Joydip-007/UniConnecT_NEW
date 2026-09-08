import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('skill_paths', (table) => {
    table.string('department', 100).nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('skill_paths', (table) => {
    table.dropColumn('department')
  })
}
