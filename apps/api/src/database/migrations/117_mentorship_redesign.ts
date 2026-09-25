import type { Knex } from 'knex'

/**
 * Mentorship redesign (Mentorship Page.dc.html):
 * - Mentor settings — an alumnus lists the topics they mentor on and free-text weekly
 *   availability slots ("Tue, 6:00 to 8:00 pm"), separate from their profile skills.
 * - Request lifecycle detail — `responded_at` powers "replies in about N days";
 *   `decline_reason` is shown to the student; `ended_*` records who ended an accepted
 *   mentorship and why (either party can end it; the row moves to `completed`).
 * - Session requests — a student proposes a time (or none) and an alumnus schedules
 *   one; the open row is closed (`done`) once a session is logged.
 * - Waitlist — "Notify me" on a full mentor; rows are consumed when a place opens.
 * - Per-session points — `points_awarded` records what logging a session paid the
 *   alumnus, so deleting it reverses exactly that (legacy rows carry 0).
 */
export async function up(knex: Knex) {
  await knex.schema.alterTable('profiles', (table) => {
    table.specificType('mentorship_topics', 'text[]').notNullable().defaultTo('{}')
    table.specificType('mentorship_availability', 'text[]').notNullable().defaultTo('{}')
  })

  await knex.schema.alterTable('mentorship_requests', (table) => {
    table.timestamp('responded_at', { useTz: true })
    table.text('decline_reason')
    table.timestamp('ended_at', { useTz: true })
    table.uuid('ended_by').references('id').inTable('users').onDelete('SET NULL')
    table.string('end_reason', 100)
    table.text('end_note')
  })
  await knex('mentorship_requests')
    .whereIn('status', ['accepted', 'declined', 'completed'])
    .update({ responded_at: knex.ref('updated_at') })

  await knex.schema.alterTable('mentorship_sessions', (table) => {
    table.integer('points_awarded').notNullable().defaultTo(0)
  })

  await knex.schema.createTable('mentorship_session_requests', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('request_id').notNullable().references('id').inTable('mentorship_requests').onDelete('CASCADE')
    table.uuid('requested_by').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('slot_label', 100)
    table.string('topic', 255)
    table.string('status', 20).notNullable().defaultTo('requested')
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
    table.index(['university_id', 'request_id', 'status'], 'idx_mentorship_session_requests_request_status')
  })
  await knex.raw(
    "ALTER TABLE mentorship_session_requests ADD CONSTRAINT mentorship_session_requests_status_check CHECK (status IN ('requested', 'scheduled', 'withdrawn', 'done'))",
  )

  await knex.schema.createTable('mentorship_waitlist', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('student_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('alumni_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.unique(['student_id', 'alumni_id'], 'uq_mentorship_waitlist_student_alumni')
    table.index(['university_id', 'alumni_id'], 'idx_mentorship_waitlist_university_alumni')
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('mentorship_waitlist')
  await knex.schema.dropTableIfExists('mentorship_session_requests')
  await knex.schema.alterTable('mentorship_sessions', (table) => {
    table.dropColumn('points_awarded')
  })
  await knex.schema.alterTable('mentorship_requests', (table) => {
    table.dropColumn('end_note')
    table.dropColumn('end_reason')
    table.dropColumn('ended_by')
    table.dropColumn('ended_at')
    table.dropColumn('decline_reason')
    table.dropColumn('responded_at')
  })
  await knex.schema.alterTable('profiles', (table) => {
    table.dropColumn('mentorship_availability')
    table.dropColumn('mentorship_topics')
  })
}
