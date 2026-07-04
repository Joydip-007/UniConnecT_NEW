import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.alterTable('universities', (table) => {
    table.string('timezone', 64).notNullable().defaultTo('Asia/Dhaka')
  })

  await knex.schema.createTable('skill_paths', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    // null = platform-wide path visible to all tenants
    table.uuid('university_id').nullable().references('id').inTable('universities').onDelete('CASCADE').index()
    table.string('title', 255).notNullable()
    table.text('description')
    table.string('category', 100).notNullable()
    table.string('difficulty', 20).notNullable().defaultTo('beginner')
    table.integer('estimated_days').notNullable().defaultTo(7)
    table.string('badge_name', 100)
    table.string('badge_icon', 100)
    table.boolean('is_published').notNullable().defaultTo(true)
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('skill_path_units', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('path_id').notNullable().references('id').inTable('skill_paths').onDelete('CASCADE').index()
    table.integer('display_order').notNullable()
    table.string('title', 255).notNullable()
    table.string('type', 20).notNullable() // read | video | exercise | quiz
    table.jsonb('content').notNullable().defaultTo('{}')
    table.jsonb('completion_rule').notNullable().defaultTo('{}')
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
    table.unique(['path_id', 'display_order'])
  })

  await knex.schema.createTable('skill_path_enrollments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE').index()
    table.uuid('path_id').notNullable().references('id').inTable('skill_paths').onDelete('CASCADE').index()
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE').index()
    table.string('status', 20).notNullable().defaultTo('active') // active | completed | abandoned
    table.timestamp('started_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('completed_at', { useTz: true }).nullable()
    table.unique(['user_id', 'path_id'])
  })

  await knex.schema.createTable('unit_completions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE').index()
    table.uuid('unit_id').notNullable().references('id').inTable('skill_path_units').onDelete('CASCADE').index()
    table.uuid('path_id').notNullable().references('id').inTable('skill_paths').onDelete('CASCADE').index()
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE').index()
    table.integer('score').nullable()
    table.timestamp('completed_at', { useTz: true }).defaultTo(knex.fn.now())
    table.unique(['user_id', 'unit_id']) // idempotent completion writes
  })

  await knex.raw(
    'CREATE INDEX idx_unit_completions_uni_completed_at ON unit_completions (university_id, completed_at DESC)',
  )

  await knex.schema.createTable('learning_stats', (table) => {
    table.uuid('user_id').primary().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE').index()
    table.integer('current_streak').notNullable().defaultTo(0)
    table.integer('longest_streak').notNullable().defaultTo(0)
    table.date('last_activity_date').nullable()
    table.string('freezes_used_month', 7).nullable() // 'YYYY-MM'
    table.integer('freezes_used_count').notNullable().defaultTo(0)
    table.date('last_reminder_date').nullable()
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('learning_stats')
  await knex.schema.dropTableIfExists('unit_completions')
  await knex.schema.dropTableIfExists('skill_path_enrollments')
  await knex.schema.dropTableIfExists('skill_path_units')
  await knex.schema.dropTableIfExists('skill_paths')
  await knex.schema.alterTable('universities', (table) => {
    table.dropColumn('timezone')
  })
}
