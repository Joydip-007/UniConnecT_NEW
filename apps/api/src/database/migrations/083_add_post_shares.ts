import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('posts', (table) => {
    table.uuid('original_post_id').nullable().references('id').inTable('posts').onDelete('SET NULL')
    table.integer('share_count').notNullable().defaultTo(0)
    table.boolean('hide_reaction_counts').notNullable().defaultTo(false)
    table.boolean('comments_disabled').notNullable().defaultTo(false)
    table.boolean('shares_disabled').notNullable().defaultTo(false)
  })

  await knex.raw(`
    CREATE INDEX idx_posts_original_post_id
    ON posts(original_post_id)
    WHERE original_post_id IS NOT NULL
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS idx_posts_original_post_id')
  await knex.schema.alterTable('posts', (table) => {
    table.dropColumn('original_post_id')
    table.dropColumn('share_count')
    table.dropColumn('hide_reaction_counts')
    table.dropColumn('comments_disabled')
    table.dropColumn('shares_disabled')
  })
}
