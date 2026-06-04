import type { Knex } from 'knex'

// Online presence: Redis is the source of truth for "online now"; last_seen_at is
// persisted to Postgres only on the online→offline transition.
export async function up(knex: Knex) {
  await knex.schema.alterTable('users', (table) => {
    table.timestamp('last_seen_at', { useTz: true }).nullable()
    table.index(['university_id', 'last_seen_at'], 'idx_users_university_last_seen')
  })
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropIndex(['university_id', 'last_seen_at'], 'idx_users_university_last_seen')
    table.dropColumn('last_seen_at')
  })
}
