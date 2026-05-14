import type { Knex } from 'knex'
import { env } from '../../config/env'

const defaultUniversityId = '00000000-0000-4000-8000-000000000001'

export async function seed(knex: Knex) {
  await knex('universities')
    .insert({
      id: defaultUniversityId,
      name: 'United International University',
      domain: 'uiu.ac.bd',
      country: 'Bangladesh',
      plan: 'starter',
    })
    .onConflict('id')
    .merge({
      name: 'United International University',
      domain: 'uiu.ac.bd',
      country: 'Bangladesh',
      plan: 'starter',
    })

  await knex('invitations')
    .insert({
      university_id: defaultUniversityId,
      email: env.DEV_INVITE_EMAIL.toLowerCase(),
      role: env.DEV_INVITE_ROLE,
      token: env.DEV_INVITE_TOKEN,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    })
    .onConflict('token')
    .merge({
      university_id: defaultUniversityId,
      email: env.DEV_INVITE_EMAIL.toLowerCase(),
      role: env.DEV_INVITE_ROLE,
      is_used: false,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    })
}
