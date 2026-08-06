import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('academic_group_modules', (table) => {
    table.jsonb('file_urls').notNullable().defaultTo('[]')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('academic_group_modules', (table) => {
    table.dropColumn('file_urls')
  })
}
