import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('group_session_creator_notes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('session_id').notNullable().unique().references('id').inTable('group_study_sessions').onDelete('CASCADE')
    table.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('created_by').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('title', 255)
    table.text('body')
    table.jsonb('attachments').notNullable().defaultTo('[]')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
  await knex.schema.alterTable('group_session_creator_notes', (table) => {
    table.index(['session_id'], 'session_creator_notes_session_idx')
  })

  await knex.schema.createTable('group_session_member_notes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('session_id').notNullable().references('id').inTable('group_study_sessions').onDelete('CASCADE')
    table.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.text('body')
    table.jsonb('attachments').notNullable().defaultTo('[]')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.unique(['session_id', 'user_id'])
  })
  await knex.schema.alterTable('group_session_member_notes', (table) => {
    table.index(['session_id', 'user_id'], 'session_member_notes_user_idx')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('group_session_member_notes')
  await knex.schema.dropTableIfExists('group_session_creator_notes')
}
