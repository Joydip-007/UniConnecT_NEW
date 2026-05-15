import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.string('email', 255).notNullable().unique()
    table.text('password_hash')
    table.string('role', 20).notNullable()
    table.boolean('is_verified').defaultTo(false)
    table.string('otp_code', 6)
    table.timestamp('otp_expires_at', { useTz: true })
    table.boolean('is_active').defaultTo(true)
    table.timestamp('last_active_at', { useTz: true })
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
  })

  await knex.raw(
    "ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'alumni', 'staff', 'admin'))",
  )
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('users')
}
