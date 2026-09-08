import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.alterTable('university_settings', (table) => {
    table.boolean('shuttle_live_gps_enabled').notNullable().defaultTo(true)
    table.boolean('shuttle_rider_eta_enabled').notNullable().defaultTo(true)
    table.boolean('shuttle_auto_assign_enabled').notNullable().defaultTo(false)
    table.boolean('shuttle_service_alerts_enabled').notNullable().defaultTo(true)
  })
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('university_settings', (table) => {
    table.dropColumn('shuttle_live_gps_enabled')
    table.dropColumn('shuttle_rider_eta_enabled')
    table.dropColumn('shuttle_auto_assign_enabled')
    table.dropColumn('shuttle_service_alerts_enabled')
  })
}
