import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.raw(`
    CREATE TABLE group_join_requests (
      id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      group_id      uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      university_id uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
      message       text,
      status        varchar(10) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','declined')),
      reviewed_by   uuid REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at   timestamptz,
      created_at    timestamptz NOT NULL DEFAULT now()
    )
  `)

  await knex.raw(`
    CREATE UNIQUE INDEX uq_join_requests_pending
      ON group_join_requests (group_id, user_id)
      WHERE status = 'pending'
  `)

  await knex.raw(`CREATE INDEX idx_join_requests_group_status ON group_join_requests (group_id, status)`)
  await knex.raw(`CREATE INDEX idx_join_requests_user_group   ON group_join_requests (user_id, group_id)`)
}

export async function down(knex: Knex) {
  await knex.raw(`DROP TABLE IF EXISTS group_join_requests CASCADE`)
}
