import type { Knex } from 'knex'

// Reversible self-deactivation. `is_active = false` + `deactivated_at` set marks a
// self-deactivated account (reactivated on next successful login). `is_active = false`
// with a null `deactivated_at` remains an admin-disabled account (cannot self-reactivate).
export async function up(knex: Knex) {
  await knex.schema.alterTable('users', (table) => {
    table.timestamp('deactivated_at', { useTz: true }).nullable()
  })
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('deactivated_at')
  })
}
