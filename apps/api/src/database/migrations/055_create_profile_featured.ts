import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('profile_featured', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.text('type').notNullable()
    table.uuid('post_id').nullable().references('id').inTable('posts').onDelete('CASCADE')
    table.text('link_url').nullable()
    table.text('link_title').nullable()
    table.text('link_description').nullable()
    table.integer('display_order').notNullable().defaultTo(0)
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
  })

  await knex.raw(`
    ALTER TABLE profile_featured
    ADD CONSTRAINT profile_featured_type_check
    CHECK (type IN ('post', 'link'))
  `)

  await knex.schema.alterTable('profile_featured', (table) => {
    table.index(['user_id'], 'idx_profile_featured_user')
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('profile_featured')
}
