import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('badges', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.string('name', 100).notNullable().unique()
    table.text('description')
    table.string('icon_url', 255)
    table.string('category', 30).notNullable() // path | streak | volume | social
    table.string('trigger_type', 50).notNullable().index()
    table.integer('trigger_count').notNullable().defaultTo(1)
    table.integer('points').notNullable().defaultTo(0)
    table.uuid('skill_path_id').nullable().references('id').inTable('skill_paths').onDelete('CASCADE')
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('user_badges', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE').index()
    table.uuid('badge_id').notNullable().references('id').inTable('badges').onDelete('CASCADE').index()
    table.boolean('is_showcased').notNullable().defaultTo(false)
    table.timestamp('awarded_at', { useTz: true }).defaultTo(knex.fn.now())
    table.unique(['user_id', 'badge_id'])
  })
  await knex.raw(
    `CREATE UNIQUE INDEX user_badges_one_showcase_per_user ON user_badges (user_id) WHERE is_showcased`,
  )

  await knex('badges').insert([
    { name: 'Week one',     description: 'Kept a 7-day learning streak',    icon_url: '🔥', category: 'streak', trigger_type: 'streak_milestone', trigger_count: 7,   points: 10 },
    { name: 'Scholar',      description: 'Kept a 30-day learning streak',   icon_url: '📚', category: 'streak', trigger_type: 'streak_milestone', trigger_count: 30,  points: 30 },
    { name: 'Centurion',    description: 'Kept a 100-day learning streak',  icon_url: '🏛️', category: 'streak', trigger_type: 'streak_milestone', trigger_count: 100, points: 100 },
    { name: 'Curious mind', description: 'Completed 10 learning units',     icon_url: '💡', category: 'volume', trigger_type: 'unit_completed',   trigger_count: 10,  points: 10 },
    { name: 'Deep diver',   description: 'Completed 50 learning units',     icon_url: '🤿', category: 'volume', trigger_type: 'unit_completed',   trigger_count: 50,  points: 50 },
  ])
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('user_badges')
  await knex.schema.dropTableIfExists('badges')
}
