import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('university_audit_logs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    t.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    t.uuid('actor_id').nullable().references('id').inTable('users').onDelete('SET NULL')
    t.text('action').notNullable()           // e.g. 'domains.updated'
    t.jsonb('payload').notNullable().defaultTo('{}')
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.index(['university_id', 'created_at'])
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('university_audit_logs')
}
