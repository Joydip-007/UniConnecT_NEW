import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('user_settings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table
      .uuid('user_id')
      .notNullable()
      .unique()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE')
    table
      .uuid('university_id')
      .notNullable()
      .references('id')
      .inTable('universities')
      .onDelete('CASCADE')
    table.jsonb('notification_preferences').notNullable().defaultTo('{}')
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
    table.index('university_id')
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('user_settings')
}
