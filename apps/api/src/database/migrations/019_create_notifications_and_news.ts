import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('notifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('type', 50).notNullable()
    table.uuid('actor_id').references('id').inTable('users').onDelete('SET NULL')
    table.uuid('reference_id')
    table.string('reference_type', 50)
    table.text('content').notNullable()
    table.boolean('is_read').defaultTo(false)
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('news', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('author_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('title', 500).notNullable()
    table.string('slug', 500).notNullable()
    table.text('body').notNullable()
    table.text('cover_url')
    table.string('category', 100).notNullable()
    table.boolean('is_published').defaultTo(false)
    table.boolean('is_pinned').defaultTo(false)
    table.integer('view_count').defaultTo(0)
    table.timestamp('published_at', { useTz: true })
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
    table.unique(['university_id', 'slug'], 'uq_news_university_slug')
  })

  await knex.schema.alterTable('notifications', (table) => {
    table.index(['user_id', 'is_read', 'created_at'], 'idx_notifications_user_read_created')
    table.index(['actor_id'], 'idx_notifications_actor')
  })
  await knex.schema.alterTable('news', (table) => {
    table.index(['university_id', 'is_published', 'published_at'], 'idx_news_university_published')
    table.index(['category'], 'idx_news_category')
    table.index(['author_id'], 'idx_news_author')
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('news')
  await knex.schema.dropTableIfExists('notifications')
}
