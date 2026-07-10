import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_type_check')
  await knex.raw(
    "ALTER TABLE groups ADD CONSTRAINT groups_type_check CHECK (type IN ('department','club','batch','research','interest','other','academic'))",
  )

  await knex.schema.alterTable('groups', (table) => {
    table.jsonb('ai_settings').notNullable().defaultTo('{}')
  })

  // Irreversible: hard-delete flashcard data from all non-academic groups.
  // Pre-launch (Assumption A1) — no real user data at risk.
  await knex('group_flashcard_reviews')
    .whereIn('group_id', knex('groups').select('id').where('type', '!=', 'academic'))
    .del()
  await knex('group_flashcards')
    .whereIn('group_id', knex('groups').select('id').where('type', '!=', 'academic'))
    .del()
  await knex('group_flashcard_decks')
    .whereIn('group_id', knex('groups').select('id').where('type', '!=', 'academic'))
    .del()
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_type_check')
  await knex.raw(
    "ALTER TABLE groups ADD CONSTRAINT groups_type_check CHECK (type IN ('department','club','batch','research','interest','other'))",
  )
  await knex.schema.alterTable('groups', (table) => {
    table.dropColumn('ai_settings')
  })
  // Flashcard delete is intentionally not reversible.
}
