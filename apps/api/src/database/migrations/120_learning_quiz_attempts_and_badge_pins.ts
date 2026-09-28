import type { Knex } from 'knex'

/**
 * Backs the Learn redesign (`Learn Page.dc.html`):
 *  - `unit_quiz_attempts`       every submission of a path checkpoint quiz, with the picks,
 *                               so "Past results" can replay each attempt question by question
 *                               and the Quizzes tab can show best / latest scores.
 *                               `unit_completions.score` only ever held the passing attempt.
 *  - `user_badges.showcased_at` a learner pins up to three badges to their profile; the
 *                               timestamp orders them and decides which pin a fourth replaces.
 */
export async function up(knex: Knex) {
  await knex.schema.createTable('unit_quiz_attempts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('unit_id').notNullable().references('id').inTable('skill_path_units').onDelete('CASCADE')
    table.uuid('path_id').notNullable().references('id').inTable('skill_paths').onDelete('CASCADE')
    table.jsonb('answers').notNullable().defaultTo('[]')
    table.integer('correct_count').notNullable().defaultTo(0)
    table.integer('total_questions').notNullable().defaultTo(0)
    table.integer('score').notNullable().defaultTo(0)
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.index(['user_id', 'unit_id', 'created_at'], 'idx_unit_quiz_attempts_user_unit')
    table.index(['university_id', 'created_at'], 'idx_unit_quiz_attempts_uni_created')
    table.index(['path_id'], 'idx_unit_quiz_attempts_path')
  })
  await knex.raw(
    'ALTER TABLE unit_quiz_attempts ADD CONSTRAINT unit_quiz_attempts_score_check CHECK (score BETWEEN 0 AND 100)',
  )

  // 086 allowed one showcase per user; pins replace it with up to three (capped in the service).
  await knex.raw('DROP INDEX IF EXISTS user_badges_one_showcase_per_user')
  await knex.schema.alterTable('user_badges', (table) => {
    table.timestamp('showcased_at', { useTz: true }).nullable()
  })
  // Existing single showcases keep their place as the first pin.
  await knex('user_badges').where('is_showcased', true).update({ showcased_at: knex.raw('awarded_at') })
}

export async function down(knex: Knex) {
  // The old showcase is a single badge: keep each user's most recent pin, clear the rest.
  await knex.raw(`
    UPDATE user_badges ub SET is_showcased = false
    WHERE ub.is_showcased = true
      AND ub.id <> (
        SELECT id FROM user_badges x
        WHERE x.user_id = ub.user_id AND x.is_showcased = true
        ORDER BY x.showcased_at DESC NULLS LAST, x.awarded_at DESC
        LIMIT 1
      )
  `)
  await knex.raw(
    'CREATE UNIQUE INDEX IF NOT EXISTS user_badges_one_showcase_per_user ON user_badges (user_id) WHERE is_showcased',
  )
  await knex.schema.alterTable('user_badges', (table) => {
    table.dropColumn('showcased_at')
  })
  await knex.schema.dropTableIfExists('unit_quiz_attempts')
}
