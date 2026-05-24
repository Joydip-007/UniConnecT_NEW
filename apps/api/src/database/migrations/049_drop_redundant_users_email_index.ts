import type { Knex } from 'knex'

// idx_users_email is a plain btree index on users(email).
// users_email_unique is a UNIQUE btree index on the same column and is a
// strict superset — it serves all lookup queries and additionally enforces
// uniqueness. Postgres never picks the plain index over the unique one, so
// idx_users_email wastes 16 kB and adds unnecessary write overhead.
export async function up(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS idx_users_email')
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)')
}
