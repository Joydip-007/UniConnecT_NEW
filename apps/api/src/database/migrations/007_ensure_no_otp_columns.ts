import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.raw('ALTER TABLE users DROP COLUMN IF EXISTS otp_code')
  await knex.raw('ALTER TABLE users DROP COLUMN IF EXISTS otp_expires_at')
}

export async function down(knex: Knex) {
  await knex.raw('ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6)')
  await knex.raw('ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ')
}
