import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.alterTable('news', (table) => {
    // Original publish date from the imported source (WordPress article date).
    // Used to pick the single featured announcement = the latest notice.
    table.timestamp('source_published_at', { useTz: true }).nullable()
  })
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('news', (table) => {
    table.dropColumn('source_published_at')
  })
}
