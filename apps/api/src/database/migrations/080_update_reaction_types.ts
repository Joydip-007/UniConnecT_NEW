import type { Knex } from 'knex'

export async function up(knex: Knex) {
  // Migrate old reaction types before dropping the constraint
  await knex('reactions').where('reaction_type', 'insightful').update({ reaction_type: 'like' })
  await knex('reactions').where('reaction_type', 'celebrate').update({ reaction_type: 'love' })

  await knex.raw('ALTER TABLE reactions DROP CONSTRAINT IF EXISTS reactions_reaction_type_check')
  await knex.raw(
    "ALTER TABLE reactions ADD CONSTRAINT reactions_reaction_type_check CHECK (reaction_type IN ('like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'))",
  )
}

export async function down(knex: Knex) {
  await knex('reactions').whereIn('reaction_type', ['care', 'haha', 'wow', 'sad', 'angry']).update({ reaction_type: 'like' })
  await knex.raw('ALTER TABLE reactions DROP CONSTRAINT IF EXISTS reactions_reaction_type_check')
  await knex.raw(
    "ALTER TABLE reactions ADD CONSTRAINT reactions_reaction_type_check CHECK (reaction_type IN ('like', 'love', 'insightful', 'celebrate'))",
  )
}
