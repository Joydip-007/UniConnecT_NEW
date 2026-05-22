import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.raw(`
    ALTER TABLE groups
      ADD COLUMN pinned_text  text,
      ADD COLUMN pinned_at    timestamptz,
      ADD COLUMN pinned_by    uuid REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN rules_md     text
  `)

  await knex.raw(`
    ALTER TABLE groups
      ADD CONSTRAINT groups_pinned_text_len CHECK (char_length(pinned_text) <= 1000),
      ADD CONSTRAINT groups_rules_md_len    CHECK (char_length(rules_md)    <= 5000)
  `)
}

export async function down(knex: Knex) {
  await knex.raw(`
    ALTER TABLE groups
      DROP CONSTRAINT IF EXISTS groups_pinned_text_len,
      DROP CONSTRAINT IF EXISTS groups_rules_md_len
  `)

  await knex.raw(`
    ALTER TABLE groups
      DROP COLUMN IF EXISTS pinned_text,
      DROP COLUMN IF EXISTS pinned_at,
      DROP COLUMN IF EXISTS pinned_by,
      DROP COLUMN IF EXISTS rules_md
  `)
}
