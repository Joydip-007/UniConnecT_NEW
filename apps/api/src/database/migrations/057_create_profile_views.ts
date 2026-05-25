import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('profile_views', (table) => {
    table.uuid('viewer_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('viewed_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('university_id').notNullable()
    table.timestamp('viewed_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.primary(['viewer_id', 'viewed_id'])
  })

  await knex.schema.alterTable('profile_views', (table) => {
    table.index(['viewed_id', 'viewed_at'], 'idx_profile_views_viewed')
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('profile_views')
}
