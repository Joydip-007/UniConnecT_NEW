import type { Knex } from 'knex'

/**
 * User-level moderation primitives:
 *
 * - `user_blocks`  — A blocks B. Stored directionally but enforced bidirectionally
 *   for visibility/interaction (neither party can message, connect with, or see the
 *   other). Blocking also tears down any existing connection between the two.
 * - `user_mutes`   — A mutes B. One-directional and silent: A stops seeing B's posts
 *   in the feed, but B is unaware and can still interact.
 *
 * Distinct from `conversation_participants.is_muted`, which mutes a single thread.
 * Reporting reuses the existing generic `reports` table (target_type = 'user' etc.).
 */
export async function up(knex: Knex) {
  await knex.schema.createTable('user_blocks', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('blocker_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('blocked_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.unique(['blocker_id', 'blocked_id'], { indexName: 'uq_user_blocks_pair' })
    table.index(['blocker_id'], 'idx_user_blocks_blocker')
    table.index(['blocked_id'], 'idx_user_blocks_blocked')
  })

  await knex.raw('ALTER TABLE user_blocks ADD CONSTRAINT user_blocks_no_self CHECK (blocker_id <> blocked_id)')

  await knex.schema.createTable('user_mutes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('muter_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('muted_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.unique(['muter_id', 'muted_id'], { indexName: 'uq_user_mutes_pair' })
    table.index(['muter_id'], 'idx_user_mutes_muter')
  })

  await knex.raw('ALTER TABLE user_mutes ADD CONSTRAINT user_mutes_no_self CHECK (muter_id <> muted_id)')
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('user_mutes')
  await knex.schema.dropTableIfExists('user_blocks')
}
