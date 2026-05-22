import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.raw(`
    CREATE TABLE group_resources (
      id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      group_id      uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      university_id uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
      uploaded_by   uuid REFERENCES users(id) ON DELETE SET NULL,
      title         varchar(255) NOT NULL,
      url           text NOT NULL,
      category      varchar(20) NOT NULL
                      CHECK (category IN ('notes','syllabus','past_papers','assignments','other')),
      description   text,
      click_count   integer NOT NULL DEFAULT 0 CHECK (click_count >= 0),
      created_at    timestamptz NOT NULL DEFAULT now()
    )
  `)

  await knex.raw(`CREATE INDEX idx_resources_group_cat  ON group_resources (group_id, category, created_at DESC)`)
  await knex.raw(`CREATE INDEX idx_resources_group_date ON group_resources (group_id, created_at DESC)`)
}

export async function down(knex: Knex) {
  await knex.raw(`DROP TABLE IF EXISTS group_resources CASCADE`)
}
