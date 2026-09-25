import type { Knex } from 'knex'

/**
 * Events redesign (Events Page.dc.html): a full event takes a waitlist instead of a dead
 * "Full" button. A waitlisted RSVP is an `event_rsvps` row with status `waitlisted`; its
 * `created_at` (re-stamped on every status change) is the queue position, and the oldest
 * one is promoted to `going` whenever a seat frees up.
 */
export async function up(knex: Knex) {
  await knex.raw('ALTER TABLE event_rsvps DROP CONSTRAINT IF EXISTS event_rsvps_status_check')
  await knex.raw(
    "ALTER TABLE event_rsvps ADD CONSTRAINT event_rsvps_status_check CHECK (status IN ('going', 'maybe', 'not_going', 'waitlisted'))",
  )
  await knex.schema.alterTable('event_rsvps', (table) => {
    table.index(['event_id', 'status', 'created_at'], 'idx_event_rsvps_event_status_created')
  })
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('event_rsvps', (table) => {
    table.dropIndex(['event_id', 'status', 'created_at'], 'idx_event_rsvps_event_status_created')
  })
  // Drop the constraint, fold the rows, then re-add it narrowed — in that order.
  await knex.raw('ALTER TABLE event_rsvps DROP CONSTRAINT IF EXISTS event_rsvps_status_check')
  // Nobody on a waitlist got a seat, so `not_going` is the honest fold.
  await knex('event_rsvps').where({ status: 'waitlisted' }).update({ status: 'not_going' })
  await knex.raw(
    "ALTER TABLE event_rsvps ADD CONSTRAINT event_rsvps_status_check CHECK (status IN ('going', 'maybe', 'not_going'))",
  )
}
