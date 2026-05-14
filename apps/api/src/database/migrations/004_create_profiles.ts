import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('profiles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('user_id').notNullable().unique().references('id').inTable('users').onDelete('CASCADE')
    table.string('full_name', 255).notNullable()
    table.text('avatar_url')
    table.text('cover_url')
    table.text('bio')
    table.string('department', 100)
    table.string('batch_year', 10)
    table.string('headline', 255)
    table.text('linkedin_url')
    table.string('phone', 30)
    table.specificType('skills', 'text[]')
    table.boolean('is_open_to_work').defaultTo(false)
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('profiles')
}
