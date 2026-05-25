import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('connections', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('requester_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('addressee_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.text('status').notNullable().defaultTo('pending')
    table.text('note').nullable()
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.unique(['requester_id', 'addressee_id'], { indexName: 'uq_connections_requester_addressee' })
  })

  await knex.raw(`
    ALTER TABLE connections
    ADD CONSTRAINT connections_status_check
    CHECK (status IN ('pending', 'accepted'))
  `)

  await knex.schema.alterTable('connections', (table) => {
    table.index(['requester_id'], 'idx_connections_requester')
    table.index(['addressee_id'], 'idx_connections_addressee')
    table.index(['university_id', 'status'], 'idx_connections_university_status')
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('connections')
}
