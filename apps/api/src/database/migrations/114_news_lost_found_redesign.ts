import type { Knex } from 'knex'

/**
 * News and lost & found redesign (News and Lost Found.dc.html):
 *  - news: a list `summary`, `tags` ("Filed under" + the rail's "trending now") and an
 *    optional `key_date` (the rail's "key dates")
 *  - lost_and_found: admin `is_pinned`, `resolved_at` (the rail's "reunited this month"
 *    and average time to resolve), and per-user saves
 *  - university_settings: the physical lost & found desk shown in the rail
 */
export async function up(knex: Knex) {
  await knex.schema.alterTable('news', (table) => {
    table.text('summary').nullable()
    table.specificType('tags', 'text[]').notNullable().defaultTo(knex.raw("'{}'::text[]"))
    table.date('key_date').nullable()
  })
  await knex.schema.alterTable('news', (table) => {
    table.index(['university_id', 'key_date'], 'idx_news_university_key_date')
  })

  await knex.schema.alterTable('lost_and_found', (table) => {
    table.boolean('is_pinned').notNullable().defaultTo(false)
    table.timestamp('resolved_at', { useTz: true }).nullable()
  })
  // Rows resolved before this column existed were last touched when they resolved.
  await knex.raw('UPDATE lost_and_found SET resolved_at = updated_at WHERE is_resolved = true AND resolved_at IS NULL')
  await knex.schema.alterTable('lost_and_found', (table) => {
    table.index(['university_id', 'is_resolved', 'created_at'], 'idx_lost_found_university_resolved_created')
  })

  await knex.schema.createTable('lost_found_saves', (table) => {
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('item_id').notNullable().references('id').inTable('lost_and_found').onDelete('CASCADE')
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.primary(['user_id', 'item_id'])
    table.index(['item_id'], 'idx_lost_found_saves_item')
  })

  await knex.schema.alterTable('university_settings', (table) => {
    table.jsonb('lost_found_desk').nullable()
  })
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('university_settings', (table) => {
    table.dropColumn('lost_found_desk')
  })

  await knex.schema.dropTableIfExists('lost_found_saves')

  await knex.schema.alterTable('lost_and_found', (table) => {
    table.dropIndex(['university_id', 'is_resolved', 'created_at'], 'idx_lost_found_university_resolved_created')
    table.dropColumn('resolved_at')
    table.dropColumn('is_pinned')
  })

  await knex.schema.alterTable('news', (table) => {
    table.dropIndex(['university_id', 'key_date'], 'idx_news_university_key_date')
    table.dropColumn('key_date')
    table.dropColumn('tags')
    table.dropColumn('summary')
  })
}
