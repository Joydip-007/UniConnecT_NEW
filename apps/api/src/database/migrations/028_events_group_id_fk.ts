import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.raw(
    `ALTER TABLE events
       ADD CONSTRAINT events_group_id_fkey
       FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL`,
  )
  await knex.raw(
    'CREATE INDEX idx_events_group ON events (group_id) WHERE group_id IS NOT NULL',
  )
}

export async function down(knex: Knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_events_group')
  await knex.raw('ALTER TABLE events DROP CONSTRAINT IF EXISTS events_group_id_fkey')
}
