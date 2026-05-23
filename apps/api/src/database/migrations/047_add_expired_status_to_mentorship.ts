import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.raw(`
    ALTER TABLE mentorship_requests
    DROP CONSTRAINT mentorship_requests_status_check
  `)

  await knex.raw(`
    ALTER TABLE mentorship_requests
    ADD CONSTRAINT mentorship_requests_status_check
    CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'expired'))
  `)
}

export async function down(knex: Knex) {
  await knex.raw(`
    ALTER TABLE mentorship_requests
    DROP CONSTRAINT mentorship_requests_status_check
  `)

  await knex.raw(`
    ALTER TABLE mentorship_requests
    ADD CONSTRAINT mentorship_requests_status_check
    CHECK (status IN ('pending', 'accepted', 'declined', 'completed'))
  `)
}
