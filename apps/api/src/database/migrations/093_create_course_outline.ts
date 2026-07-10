import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('academic_course_outlines', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('group_id').notNullable().unique().references('id').inTable('groups').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL')
    table.string('course_code', 50)
    table.string('course_title', 255).notNullable()
    table.decimal('credit_hours', 3, 1)
    table.string('trimester', 100)
    table.text('description')
    table.string('grading_scale', 50).notNullable().defaultTo('uiu')
    table.jsonb('custom_scale_json')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('course_outline_assessments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('outline_id').notNullable().references('id').inTable('academic_course_outlines').onDelete('CASCADE')
    table.string('category_name', 100).notNullable()
    table.integer('full_marks').notNullable()
    table.decimal('weight_percent', 5, 2).notNullable()
    table.integer('total_given').notNullable().defaultTo(1)
    table.integer('best_n_counted').notNullable().defaultTo(1)
    table.integer('display_order').notNullable().defaultTo(1)
    table.check('best_n_counted <= total_given AND best_n_counted >= 1', [], 'best_n_valid')
  })
  await knex.schema.alterTable('course_outline_assessments', (table) => {
    table.index(['outline_id', 'display_order'], 'co_assessments_outline_idx')
  })

  await knex.schema.createTable('course_outline_topics', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('outline_id').notNullable().references('id').inTable('academic_course_outlines').onDelete('CASCADE')
    table.integer('week_number').notNullable()
    table.string('title', 255).notNullable()
    table.text('description')
    table.unique(['outline_id', 'week_number'])
  })
  await knex.schema.alterTable('course_outline_topics', (table) => {
    table.index(['outline_id', 'week_number'], 'co_topics_outline_idx')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('course_outline_topics')
  await knex.schema.dropTableIfExists('course_outline_assessments')
  await knex.schema.dropTableIfExists('academic_course_outlines')
}
