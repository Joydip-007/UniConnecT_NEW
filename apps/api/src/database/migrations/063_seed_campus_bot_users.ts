import type { Knex } from 'knex'

/**
 * Creates one "Campus Feed" bot user (+ profile) per existing university.
 * All content-sync imports are authored by this user so they're visually
 * distinct from human posts and never misattributed. The bot has no usable
 * password (password_hash NULL) and cannot log in.
 *
 * New universities get their bot created at university-creation time
 * (see ensureCampusBotUser in the content-sync service).
 */
export async function up(knex: Knex) {
  const universities = await knex<{ id: string; domain: string }>('universities').select('id', 'domain')

  for (const university of universities) {
    const email = `campus-bot@${university.domain}`

    const existing = await knex('users').where({ email }).first<{ id: string }>('id')
    if (existing) continue

    const [user] = await knex('users')
      .insert({
        university_id: university.id,
        email,
        password_hash: null,
        role: 'faculty',
        is_verified: true,
        is_active: true,
      })
      .returning<{ id: string }[]>('id')

    if (!user) continue

    await knex('profiles').insert({
      user_id: user.id,
      full_name: 'Campus Feed',
      headline: 'Automated campus news & notices',
    })
  }
}

export async function down(knex: Knex) {
  const bots = await knex('users')
    .whereLike('email', 'campus-bot@%')
    .select<{ id: string }[]>('id')

  const ids = bots.map((b) => b.id)
  if (ids.length === 0) return

  // profiles + authored content cascade via FK onDelete where defined;
  // delete the bot users explicitly.
  await knex('users').whereIn('id', ids).delete()
}
