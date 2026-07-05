import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('group_flashcard_decks', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
    table.string('title', 160).notNullable()
    table.text('description')
    table.boolean('is_archived').notNullable().defaultTo(false)
    table.integer('card_count').notNullable().defaultTo(0)
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
    table.index(['group_id', 'is_archived', 'updated_at'])
    table.index(['university_id', 'group_id'])
  })
  await knex.raw(
    'ALTER TABLE group_flashcard_decks ADD CONSTRAINT group_flashcard_decks_card_count_check CHECK (card_count >= 0)',
  )

  await knex.schema.createTable('group_flashcards', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('deck_id').notNullable().references('id').inTable('group_flashcard_decks').onDelete('CASCADE')
    table.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
    table.text('front').notNullable()
    table.text('back').notNullable()
    table.text('hint')
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
    table.index(['deck_id', 'created_at'])
    table.index(['group_id', 'updated_at'])
  })

  await knex.schema.createTable('group_flashcard_reviews', (table) => {
    table.uuid('card_id').notNullable().references('id').inTable('group_flashcards').onDelete('CASCADE')
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.decimal('ease_factor', 4, 2).notNullable().defaultTo(2.5)
    table.integer('interval_days').notNullable().defaultTo(0)
    table.integer('repetition_count').notNullable().defaultTo(0)
    table.timestamp('due_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('last_reviewed_at', { useTz: true })
    table.string('last_rating', 10)
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
    table.primary(['card_id', 'user_id'])
    table.index(['user_id', 'group_id', 'due_at'])
    table.index(['group_id', 'due_at'])
  })
  await knex.raw(
    'ALTER TABLE group_flashcard_reviews ADD CONSTRAINT group_flashcard_reviews_interval_days_check CHECK (interval_days >= 0)',
  )
  await knex.raw(
    'ALTER TABLE group_flashcard_reviews ADD CONSTRAINT group_flashcard_reviews_repetition_count_check CHECK (repetition_count >= 0)',
  )
  await knex.raw(
    "ALTER TABLE group_flashcard_reviews ADD CONSTRAINT group_flashcard_reviews_last_rating_check CHECK (last_rating IN ('again','hard','good','easy'))",
  )

  await knex.schema.createTable('group_shared_notes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
    table.string('title', 160).notNullable()
    table.text('body').notNullable()
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
    table.index(['group_id', 'updated_at'])
    table.index(['university_id', 'group_id'])
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('group_shared_notes')
  await knex.schema.dropTableIfExists('group_flashcard_reviews')
  await knex.schema.dropTableIfExists('group_flashcards')
  await knex.schema.dropTableIfExists('group_flashcard_decks')
}
