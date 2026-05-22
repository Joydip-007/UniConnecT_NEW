// apps/api/src/database/migrations/038_widen_batch_year.ts
import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.raw(`ALTER TABLE profiles ALTER COLUMN batch_year TYPE varchar(20)`)
}

export async function down(knex: Knex) {
  await knex.raw(`ALTER TABLE profiles ALTER COLUMN batch_year TYPE varchar(10)`)
}
