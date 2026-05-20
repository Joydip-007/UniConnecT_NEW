import bcrypt from 'bcryptjs'
import type { Knex } from 'knex'

const UNIVERSITY_ID = '00000000-0000-4000-8000-000000000001'
const JOYDIP_ID = '00000000-0000-4000-8000-000000000011'
const ADMIN_ID = '00000000-0000-4000-8000-000000000010'

const DEFAULT_PASSWORD = 'password123'

const bootstrapUsers = [
  {
    id: ADMIN_ID,
    email: 'admin@uiu.ac.bd',
    role: 'admin',
    fullName: 'Dev Admin',
    headline: 'Platform administrator',
    department: 'Administration',
  },
  {
    id: JOYDIP_ID,
    email: 'joydip.datta15@gmail.com',
    role: 'admin',
    fullName: 'Joydip Datta',
    headline: 'Software engineer | UniConnecT co-founder',
    department: 'Computer Science & Engineering',
  },
] as const

export async function up(knex: Knex) {
  const passwordHash = await bcrypt.hash(process.env.BOOTSTRAP_ADMIN_PASSWORD ?? DEFAULT_PASSWORD, 10)
  const allowedDomains = knex.raw(
    "ARRAY['uiu.ac.bd','bscse.uiu.ac.bd','mscse.uiu.ac.bd','bsds.uiu.ac.bd','gmail.com']::text[]",
  )

  await knex('universities')
    .insert({
      id: UNIVERSITY_ID,
      name: 'United International University',
      domain: 'uiu.ac.bd',
      country: 'Bangladesh',
      plan: 'starter',
      is_active: true,
      allowed_email_domains: allowedDomains,
    })
    .onConflict('domain')
    .merge({
      name: 'United International University',
      country: 'Bangladesh',
      plan: 'starter',
      is_active: true,
      allowed_email_domains: allowedDomains,
    })

  const university = await knex('universities').select<{ id: string }>('id').where({ domain: 'uiu.ac.bd' }).first()
  const universityId = university?.id ?? UNIVERSITY_ID

  for (const user of bootstrapUsers) {
    await knex('users')
      .insert({
        id: user.id,
        university_id: universityId,
        email: user.email,
        password_hash: passwordHash,
        role: user.role,
        is_verified: true,
        is_active: true,
        is_deleted: false,
        theme_preference: 'system',
      })
      .onConflict('email')
      .merge({
        university_id: universityId,
        password_hash: passwordHash,
        role: user.role,
        is_verified: true,
        is_active: true,
        is_deleted: false,
      })

    const storedUser = await knex('users').select<{ id: string }>('id').where({ email: user.email }).first()
    if (!storedUser) continue

    await knex('profiles')
      .insert({
        user_id: storedUser.id,
        full_name: user.fullName,
        headline: user.headline,
        department: user.department,
        is_open_to_work: false,
        is_open_to_mentorship: false,
        mentorship_points: 0,
      })
      .onConflict('user_id')
      .merge({
        full_name: user.fullName,
        headline: user.headline,
        department: user.department,
      })
  }
}

export async function down(knex: Knex) {
  await knex('profiles').whereIn('user_id', [ADMIN_ID, JOYDIP_ID]).delete()
  await knex('users').whereIn('id', [ADMIN_ID, JOYDIP_ID]).delete()
}
