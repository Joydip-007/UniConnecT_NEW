import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE group_resources DROP CONSTRAINT IF EXISTS group_resources_category_check')

  // Fold the categories being removed onto their nearest surviving category before
  // narrowing the CHECK, or any existing row makes the new constraint unsatisfiable.
  await knex('group_resources').where({ category: 'syllabus' }).update({ category: 'notes' })
  await knex('group_resources').where({ category: 'past_papers' }).update({ category: 'other' })

  await knex.raw(
    "ALTER TABLE group_resources ADD CONSTRAINT group_resources_category_check CHECK (category IN ('researches','projects','assignments','notes','other'))",
  )
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE group_resources DROP CONSTRAINT IF EXISTS group_resources_category_check')

  // Fold the categories being removed back onto a permitted old value before
  // re-adding the narrower constraint.
  await knex('group_resources').where({ category: 'researches' }).update({ category: 'notes' })
  await knex('group_resources').where({ category: 'projects' }).update({ category: 'other' })

  await knex.raw(
    "ALTER TABLE group_resources ADD CONSTRAINT group_resources_category_check CHECK (category IN ('notes','syllabus','past_papers','assignments','other'))",
  )
}
