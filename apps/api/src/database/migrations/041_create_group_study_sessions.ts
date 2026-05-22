import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.raw(`
    CREATE TABLE group_study_sessions (
      id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      group_id      uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      university_id uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
      created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
      title         varchar(255) NOT NULL,
      description   text,
      location      varchar(255),
      is_online     boolean NOT NULL DEFAULT false,
      online_link   text,
      starts_at     timestamptz NOT NULL,
      ends_at       timestamptz,
      capacity      integer CHECK (capacity > 0),
      rsvp_count    integer NOT NULL DEFAULT 0 CHECK (rsvp_count >= 0),
      created_at    timestamptz NOT NULL DEFAULT now()
    )
  `)

  await knex.raw(`CREATE INDEX idx_study_sessions_group ON group_study_sessions (group_id, starts_at DESC)`)
  await knex.raw(`CREATE INDEX idx_study_sessions_univ  ON group_study_sessions (university_id, starts_at)`)

  await knex.raw(`
    CREATE TABLE group_study_session_rsvps (
      session_id  uuid NOT NULL REFERENCES group_study_sessions(id) ON DELETE CASCADE,
      user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status      varchar(12) NOT NULL CHECK (status IN ('going','not_going')),
      updated_at  timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (session_id, user_id)
    )
  `)
}

export async function down(knex: Knex) {
  await knex.raw(`DROP TABLE IF EXISTS group_study_session_rsvps CASCADE`)
  await knex.raw(`DROP TABLE IF EXISTS group_study_sessions CASCADE`)
}
