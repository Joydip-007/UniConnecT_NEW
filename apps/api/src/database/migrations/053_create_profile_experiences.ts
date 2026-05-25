import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('profile_experiences', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('university_id').notNullable().references('id').inTable('universities')
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.text('title').notNullable()
    table.text('company').notNullable()
    table.text('location').nullable()
    table.date('start_date').notNullable()
    table.date('end_date').nullable()
    table.text('description').nullable()
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  await knex.schema.alterTable('profile_experiences', (table) => {
    table.index(['user_id'], 'idx_profile_exp_user')
    table.index(['university_id', 'user_id'], 'idx_profile_exp_uni')
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('profile_experiences')
}
