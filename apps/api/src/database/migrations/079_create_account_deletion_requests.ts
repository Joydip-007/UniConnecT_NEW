import type { Knex } from 'knex'

/**
 * Account deletion requests. UniConnecT is invite-based, so a member cannot
 * self-delete; instead they file a request with a reason that admins review.
 * Reversible self-deactivation (users.deactivated_at) remains separate.
 *
 * A user may have at most one open ('pending') request at a time, enforced by a
 * partial unique index.
 */
export async function up(knex: Knex) {
  await knex.schema.createTable('account_deletion_requests', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.text('reason').notNullable()
    table.string('status', 20).notNullable().defaultTo('pending')
    table.text('admin_note').nullable()
    table.uuid('reviewed_by').nullable().references('id').inTable('users').onDelete('SET NULL')
    table.timestamp('reviewed_at', { useTz: true }).nullable()
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.index(['university_id', 'status'], 'idx_adr_university_status')
    table.index(['user_id'], 'idx_adr_user')
  })

  await knex.raw(
    "ALTER TABLE account_deletion_requests ADD CONSTRAINT adr_status_check CHECK (status IN ('pending', 'approved', 'declined', 'cancelled'))",
  )

  // At most one open request per user.
  await knex.raw(
    'CREATE UNIQUE INDEX uq_adr_one_pending_per_user ON account_deletion_requests (user_id) WHERE status = \'pending\'',
  )
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('account_deletion_requests')
}
