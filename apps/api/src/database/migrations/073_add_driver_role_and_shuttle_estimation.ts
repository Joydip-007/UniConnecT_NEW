import type { Knex } from 'knex'

// Adds the least-privilege `driver` role (transport staff who broadcast GPS) and
// the client-side estimation params on shuttle_routes. Drivers are walled off
// from the social app; their only write is POST /shuttle/locations.
export async function up(knex: Knex) {
  // Widen the users role constraint to allow 'driver'.
  // Current constraint (after 025_rename_staff_to_faculty): ('student','alumni','faculty','admin').
  await knex.raw('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check')
  await knex.raw(
    "ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'alumni', 'faculty', 'admin', 'driver'))",
  )

  // Estimation params consumed by the browser to interpolate a bus along the route.
  // est_duration_min → one-way trip length for fixed-trip routes (null ⇒ derive from schedule).
  // cycle_minutes    → round-trip cycle for continuous routes with no timetable (e.g. Kuril BRTC).
  await knex.schema.alterTable('shuttle_routes', (table) => {
    table.integer('est_duration_min').nullable()
    table.integer('cycle_minutes').nullable()
  })
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('shuttle_routes', (table) => {
    table.dropColumn('cycle_minutes')
    table.dropColumn('est_duration_min')
  })

  // Drop any drivers before narrowing the constraint, or the CHECK would fail.
  await knex('users').where({ role: 'driver' }).del()
  await knex.raw('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check')
  await knex.raw(
    "ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'alumni', 'faculty', 'admin'))",
  )
}
