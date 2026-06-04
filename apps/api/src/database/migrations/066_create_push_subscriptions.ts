import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('push_subscriptions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table
      .uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE')
    table
      .uuid('university_id')
      .notNullable()
      .references('id')
      .inTable('universities')
      .onDelete('CASCADE')
    table.text('endpoint').notNullable().unique()
    table.text('p256dh').notNullable()
    table.text('auth').notNullable()
    table.text('user_agent')
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('last_used_at', { useTz: true }).defaultTo(knex.fn.now())
    table.index('user_id')
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('push_subscriptions')
}
