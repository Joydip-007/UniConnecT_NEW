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
    DROP CONSTRAINT IF EXISTS mentorship_requests_status_check
  `)

  // Fold the status being removed onto a permitted one before narrowing the CHECK.
  // The 7-day auto-expiry job produces these rows in normal operation, so skipping
  // this makes the rollback fail on any environment that has run for a week.
  // 'declined' is the closest surviving state: the request ended without being accepted.
  await knex('mentorship_requests').where({ status: 'expired' }).update({ status: 'declined' })

  await knex.raw(`
    ALTER TABLE mentorship_requests
    ADD CONSTRAINT mentorship_requests_status_check
    CHECK (status IN ('pending', 'accepted', 'declined', 'completed'))
  `)
}
