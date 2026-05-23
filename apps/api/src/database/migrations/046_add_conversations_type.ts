import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.alterTable('conversations', (table) => {
    table.string('type', 20).notNullable().defaultTo('direct')
  })

  await knex.raw(`
    ALTER TABLE conversations
    ADD CONSTRAINT conversations_type_check
    CHECK (type IN ('direct', 'group', 'mentorship'))
  `)
}

export async function down(knex: Knex) {
  await knex.raw(`
    ALTER TABLE conversations
    DROP CONSTRAINT IF EXISTS conversations_type_check
  `)
  await knex.schema.alterTable('conversations', (table) => {
    table.dropColumn('type')
  })
}
