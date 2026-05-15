import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('polls', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('post_id').notNullable().unique().references('id').inTable('posts').onDelete('CASCADE')
    table.string('question', 500).notNullable()
    table.timestamp('expires_at', { useTz: true })
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('poll_options', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('poll_id').notNullable().references('id').inTable('polls').onDelete('CASCADE')
    table.string('option_text', 255).notNullable()
    table.integer('display_order').defaultTo(0)
  })

  await knex.schema.createTable('poll_votes', (table) => {
    table.uuid('poll_option_id').notNullable().references('id').inTable('poll_options').onDelete('CASCADE')
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.timestamp('voted_at', { useTz: true }).defaultTo(knex.fn.now())
    table.primary(['poll_option_id', 'user_id'])
  })

  await knex.schema.alterTable('poll_options', (table) => {
    table.index(['poll_id'], 'idx_poll_options_poll')
  })
  await knex.schema.alterTable('poll_votes', (table) => {
    table.index(['user_id'], 'idx_poll_votes_user')
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('poll_votes')
  await knex.schema.dropTableIfExists('poll_options')
  await knex.schema.dropTableIfExists('polls')
}
