import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('profile_views', (table) => {
    table.uuid('viewer_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('viewed_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.timestamp('viewed_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.primary(['viewer_id', 'viewed_id'])
  })

  // Raw SQL used because Knex .index() does not support per-column sort direction
  await knex.raw(
    'CREATE INDEX idx_profile_views_viewed ON profile_views (viewed_id, viewed_at DESC)'
  )
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('profile_views')
}
