import { createServer } from 'node:http'
import bcrypt from 'bcryptjs'
import supertest from 'supertest'
import { beforeAll, afterAll } from 'vitest'
import { createApp } from '../app'
import { db } from '../config/db'
import { redis } from '../config/redis'
import { setupSocket } from '../socket'

export const DOMAIN = 'uiu.ac.bd'
export const TEST_UNIVERSITY_ID = '00000000-0000-4000-8000-000000000001'

export const CREDENTIALS = {
  admin:   { email: 'admin@uiu.ac.bd',   password: 'Admin@1234',   role: 'admin'   },
  staff:   { email: 'staff@uiu.ac.bd',   password: 'Staff@1234',   role: 'staff'   },
  alumni:  { email: 'alumni@uiu.ac.bd',  password: 'Alumni@1234',  role: 'alumni'  },
  student: { email: 'student@uiu.ac.bd', password: 'Student@1234', role: 'student' },
}

const app = createApp()
export { app }

beforeAll(async () => {
  // Run pending migrations (idempotent)
  await db.migrate.latest()

  // Initialize socket so services can call getIo() without throwing
  const server = createServer(app)
  setupSocket(server, redis)

  // Ensure university exists
  await db('universities')
    .insert({
      id: TEST_UNIVERSITY_ID,
      name: 'United International University',
      domain: DOMAIN,
      country: 'Bangladesh',
      plan: 'starter',
    })
    .onConflict('id')
    .merge({ domain: DOMAIN, plan: 'starter', is_active: true })

  // Clear existing sessions so parallel test processes don't collide on the unique refresh_token constraint
  const testEmails = Object.values(CREDENTIALS).map((c) => c.email)
  await db('user_sessions')
    .whereIn('user_id', db('users').select('id').whereIn('email', testEmails))
    .delete()

  // Upsert the 4 seed test users
  const entries = Object.entries(CREDENTIALS) as [string, { email: string; password: string; role: string }][]
  for (const [key, cred] of entries) {
    const hash = await bcrypt.hash(cred.password, 10)
    const [row] = await db('users')
      .insert({
        university_id: TEST_UNIVERSITY_ID,
        email: cred.email,
        password_hash: hash,
        role: cred.role,
        is_verified: true,
        is_active: true,
      })
      .onConflict('email')
      .merge({ password_hash: hash, role: cred.role, is_verified: true, is_active: true })
      .returning<{ id: string }[]>('id')

    await db('profiles')
      .insert({ user_id: row.id, full_name: `${key[0]!.toUpperCase()}${key.slice(1)} User` })
      .onConflict('user_id')
      .ignore()
  }
})

afterAll(async () => {
  await db.destroy()
  await redis.quit()
})

// ── helper ─────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string
  cookie: string
}

export async function loginAs(email: string, password: string): Promise<AuthTokens> {
  const res = await supertest(app)
    .post('/api/v1/auth/login')
    .set('x-university-domain', DOMAIN)
    .send({ email, password })

  if (res.status !== 200) {
    throw new Error(`loginAs(${email}) → HTTP ${res.status}: ${JSON.stringify(res.body)}`)
  }

  const accessToken = (res.body as { data: { accessToken: string } }).data.accessToken
  const raw = res.headers['set-cookie'] as string[] | string | undefined
  const cookie = Array.isArray(raw) ? raw.join('; ') : (raw ?? '')

  return { accessToken, cookie }
}
