import type { Knex } from 'knex'

// Feed ranking: denormalised engagement counters + a precomputed hot_score that a
// Bull cron refreshes. Lets the "Top" feed sort by an index instead of correlated
// subqueries. Counters are maintained transactionally on reaction/comment writes.
export async function up(knex: Knex) {
  await knex.schema.alterTable('posts', (table) => {
    table.integer('reaction_count').notNullable().defaultTo(0)
    table.integer('comment_count').notNullable().defaultTo(0)
    table.double('hot_score').notNullable().defaultTo(0)
    table.index(['university_id', 'is_published', 'hot_score'], 'idx_posts_hot_score')
  })

  // Backfill counters from the existing reaction/comment tables.
  await knex.raw(`
    UPDATE posts p SET reaction_count = sub.cnt
    FROM (
      SELECT target_id AS post_id, COUNT(*)::int AS cnt
      FROM reactions WHERE target_type = 'post' GROUP BY target_id
    ) sub
    WHERE p.id = sub.post_id
  `)
  await knex.raw(`
    UPDATE posts p SET comment_count = sub.cnt
    FROM (
      SELECT post_id, COUNT(*)::int AS cnt FROM comments GROUP BY post_id
    ) sub
    WHERE p.id = sub.post_id
  `)

  // Initial hot_score (HN-style gravity) for posts in the last 14 days.
  await knex.raw(`
    UPDATE posts
    SET hot_score = (1 + reaction_count + 2 * comment_count)
      / power(EXTRACT(EPOCH FROM (now() - created_at)) / 3600 + 2, 1.5)
    WHERE created_at > now() - interval '14 days'
  `)
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('posts', (table) => {
    table.dropIndex(['university_id', 'is_published', 'hot_score'], 'idx_posts_hot_score')
    table.dropColumn('reaction_count')
    table.dropColumn('comment_count')
    table.dropColumn('hot_score')
  })
}
