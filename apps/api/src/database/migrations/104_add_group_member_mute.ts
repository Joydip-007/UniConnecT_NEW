import type { Knex } from 'knex'

/**
 * Per-member notification mute for a group. Lives on `group_members` rather than a
 * separate table because muting only means anything while you are a member — leaving
 * the group drops the row and the preference with it, which is the behaviour we want.
 */
export async function up(knex: Knex) {
  await knex.schema.alterTable('group_members', (table) => {
    table.boolean('is_muted').notNullable().defaultTo(false)
  })
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('group_members', (table) => {
    table.dropColumn('is_muted')
  })
}
