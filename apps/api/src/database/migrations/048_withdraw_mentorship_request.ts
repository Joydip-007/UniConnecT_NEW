import type { Knex } from 'knex'

export async function up(knex: Knex) {
  // Drop the full unique constraint that prevented re-requesting after any terminal state
  await knex.raw(`
    ALTER TABLE mentorship_requests
    DROP CONSTRAINT uq_mentorship_student_alumni
  `)

  // Replace with a partial unique index: only one active request per student–alumni pair
  await knex.raw(`
    CREATE UNIQUE INDEX uq_mentorship_active_per_alumni
      ON mentorship_requests (student_id, alumni_id)
      WHERE (is_deleted = false AND status IN ('pending', 'accepted'))
  `)
}

export async function down(knex: Knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS uq_mentorship_active_per_alumni
  `)

  await knex.raw(`
    ALTER TABLE mentorship_requests
      ADD CONSTRAINT uq_mentorship_student_alumni UNIQUE (student_id, alumni_id)
  `)
}
