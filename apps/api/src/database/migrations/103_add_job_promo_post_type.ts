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
  // Drop, fold, re-add — in that order, mirroring up(). The fold happens to be legal
  // under the live constraint here because 'post' is in both lists, but doing it before
  // the drop is the ordering that fails the moment a fold target is not, and this file
  // is the one people copy. 025 shipped broken for exactly that reason.
  await knex.raw('ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_type_check')

  // Rows using the type being removed would violate the narrowed constraint. Folded to
  // a plain post rather than deleted: a job_promo post carries reactions, comments and
  // hashtags that a delete would cascade away, and only the type flag is being removed.
  await knex('posts').where({ type: 'job_promo' }).update({ type: 'post' })

  await knex.raw(
    `ALTER TABLE posts ADD CONSTRAINT posts_type_check CHECK (type IN (${checkClause(TYPES_BEFORE)}))`,
  )
}
