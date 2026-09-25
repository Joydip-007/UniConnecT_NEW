import type { Knex } from 'knex'

/**
 * Backs the shuttle redesign (`Shuttle Tracker.dc.html`):
 *  - `shuttle_shifts`     one row per broadcast session. Start/Stop broadcast opens and
 *                         closes it, so a driver's assigned route, time on duty, trips
 *                         and riders carried are all read from real sessions.
 *  - `shuttle_rider_prefs` a rider's own stop and "alert me 5 min before" toggle.
 *  - `shuttle_notices`    admin-managed diversions and timetable changes for the rider rail.
 */
export async function up(knex: Knex) {
  await knex.schema.createTable('shuttle_shifts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('driver_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('route_id').notNullable().references('id').inTable('shuttle_routes').onDelete('CASCADE')
    table.timestamp('started_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('ended_at', { useTz: true })
    table.integer('riders_count').notNullable().defaultTo(0)
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
    table.index(['university_id', 'driver_id', 'started_at'], 'idx_shuttle_shifts_driver_started')
    table.index(['route_id'], 'idx_shuttle_shifts_route')
  })
  await knex.raw('ALTER TABLE shuttle_shifts ADD CONSTRAINT shuttle_shifts_riders_check CHECK (riders_count >= 0)')
  // A driver has at most one open shift.
  await knex.raw(
    'CREATE UNIQUE INDEX uq_shuttle_shifts_open_driver ON shuttle_shifts (driver_id) WHERE ended_at IS NULL',
  )

  await knex.schema.createTable('shuttle_rider_prefs', (table) => {
    table.uuid('user_id').primary().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('route_id').references('id').inTable('shuttle_routes').onDelete('SET NULL')
    // Stops live in the route's `stops` jsonb, so this is that stop's own string id.
    table.string('stop_id', 100)
    table.boolean('alert_enabled').notNullable().defaultTo(true)
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
    table.index(['university_id'], 'idx_shuttle_rider_prefs_university')
  })

  await knex.schema.createTable('shuttle_notices', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('route_id').references('id').inTable('shuttle_routes').onDelete('SET NULL')
    table.string('tone', 20).notNullable().defaultTo('info')
    table.string('title', 160).notNullable()
    table.string('detail', 240)
    table.timestamp('expires_at', { useTz: true })
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL')
    table.boolean('is_deleted').notNullable().defaultTo(false)
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
    table.index(['university_id', 'created_at'], 'idx_shuttle_notices_university_created')
  })
  await knex.raw("ALTER TABLE shuttle_notices ADD CONSTRAINT shuttle_notices_tone_check CHECK (tone IN ('disruption', 'info'))")
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('shuttle_notices')
  await knex.schema.dropTableIfExists('shuttle_rider_prefs')
  await knex.schema.dropTableIfExists('shuttle_shifts')
}
