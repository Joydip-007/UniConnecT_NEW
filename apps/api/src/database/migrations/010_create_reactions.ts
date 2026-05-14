import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('reactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('target_id').notNullable()
    table.string('target_type', 20).notNullable()
    table.string('reaction_type', 20).notNullable()
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.unique(['user_id', 'target_id', 'target_type'], 'uq_reactions_user_target')
  })

  await knex.raw(
    "ALTER TABLE reactions ADD CONSTRAINT reactions_target_type_check CHECK (target_type IN ('post', 'comment'))",
  )
  await knex.raw(
    "ALTER TABLE reactions ADD CONSTRAINT reactions_reaction_type_check CHECK (reaction_type IN ('like', 'love', 'insightful', 'celebrate'))",
  )

  await knex.schema.alterTable('reactions', (table) => {
    table.index(['target_id', 'target_type'], 'idx_reactions_target')
    table.index(['user_id'], 'idx_reactions_user')
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('reactions')
}
