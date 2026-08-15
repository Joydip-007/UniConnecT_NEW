import type { Knex } from 'knex'

/**
 * Adds the `job_promo` post type, mirroring how `event_promo` already works: a member
 * who may post jobs can share an opportunity into the feed, while the structured job
 * board in the `jobs` table stays the source of truth for applications.
 *
 * The type list lives in a CHECK constraint created by 008_create_posts, so extending
 * it means dropping and recreating that constraint.
 */
const TYPES_BEFORE = ['post', 'announcement', 'lost_found', 'news', 'event_promo']
const TYPES_AFTER = [...TYPES_BEFORE, 'job_promo']

function checkClause(types: string[]): string {
  return types.map((t) => `'${t}'`).join(', ')
}

export async function up(knex: Knex) {
  await knex.raw('ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_type_check')
  await knex.raw(
    `ALTER TABLE posts ADD CONSTRAINT posts_type_check CHECK (type IN (${checkClause(TYPES_AFTER)}))`,
  )
}

export async function down(knex: Knex) {
  // Rows using the type being removed would violate the narrowed constraint, so fold
  // them back to a plain post rather than failing the rollback.
  await knex('posts').where({ type: 'job_promo' }).update({ type: 'post' })
  await knex.raw('ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_type_check')
  await knex.raw(
    `ALTER TABLE posts ADD CONSTRAINT posts_type_check CHECK (type IN (${checkClause(TYPES_BEFORE)}))`,
  )
}
