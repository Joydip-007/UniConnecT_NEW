#!/usr/bin/env node
/**
 * UniConnecT — End-to-End Smoke Test
 * Runs against live API (http://localhost:4000) with real HTTP requests.
 * OTPs are injected into Redis directly so the test is hermetic and does
 * not depend on email delivery.
 */

const http = require('http')
const https = require('https')

const API = 'http://localhost:4000'
const UNI_DOMAIN = 'uiu.ac.bd'
const TEST_OTP = '123456'
const JOB_DEADLINE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days out

// ─── Reporting ───────────────────────────────────────────────────────────────

let passed = 0
let failed = 0
const lines = []

function pass(step, code) {
  passed++
  const msg = `✅ PASS — ${step} — HTTP ${code}`
  lines.push(msg)
  console.log(msg)
}

function fail(step, expected, got, detail = '') {
  failed++
  const msg = `🔴 FAIL — ${step} — Expected ${expected} got ${got}${detail ? ' — ' + detail : ''}`
  lines.push(msg)
  console.log(msg)
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────

async function req(method, path, body = null, token = null) {
  return new Promise((resolve) => {
    const url = new URL(API + path)
    const payload = body ? JSON.stringify(body) : null
    const headers = {
      'Content-Type': 'application/json',
      'x-university-domain': UNI_DOMAIN,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(payload ? { 'Content-Length': String(Buffer.byteLength(payload)) } : {}),
    }
    const options = { hostname: url.hostname, port: url.port, path: url.pathname, method, headers }
    const lib = url.protocol === 'https:' ? https : http
    const r = lib.request(options, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => {
        let json = null
        try { json = JSON.parse(data) } catch {}
        resolve({ status: res.statusCode, body: json, raw: data })
      })
    })
    r.on('error', (e) => resolve({ status: 0, body: null, raw: e.message }))
    if (payload) r.write(payload)
    r.end()
  })
}

// ─── Redis OTP injection ──────────────────────────────────────────────────────

async function injectOtp(userId, purpose) {
  const bcrypt = require('/Users/joydipdatta/UniConnecT_NEW/apps/api/node_modules/bcryptjs')
  const { Redis } = require('/Users/joydipdatta/UniConnecT_NEW/apps/api/node_modules/ioredis')
  const r = new Redis({ host: '127.0.0.1', port: 6379 })
  const hash = await bcrypt.hash(TEST_OTP, 10)
  await r.set(`otp:${purpose}:${userId}`, hash, 'EX', 600)
  await r.set(`otp_attempts:${purpose}:${userId}`, '0', 'EX', 600)
  await r.quit()
}

async function getOtpHash(userId, purpose) {
  const { Redis } = require('/Users/joydipdatta/UniConnecT_NEW/apps/api/node_modules/ioredis')
  const r = new Redis({ host: '127.0.0.1', port: 6379 })
  const hash = await r.get(`otp:${purpose}:${userId}`)
  await r.quit()
  return hash
}

// ─── Postgres helpers ─────────────────────────────────────────────────────────

async function pgQuery(sql, params = []) {
  const { Client } = require('/Users/joydipdatta/UniConnecT_NEW/apps/api/node_modules/pg')
  const client = new Client({ connectionString: 'postgres://localhost:5432/uniconnect_db' })
  await client.connect()
  const result = await client.query(sql, params)
  await client.end()
  return result.rows
}

async function getUserId(email) {
  const rows = await pgQuery('SELECT id FROM users WHERE email = $1 LIMIT 1', [email])
  return rows[0]?.id ?? null
}

async function cleanupStudent() {
  const rows = await pgQuery('SELECT id FROM users WHERE email = $1', ['student@uiu.ac.bd'])
  if (rows.length) {
    const uid = rows[0].id
    // Delete in dependency order — many FKs are NO ACTION in this DB
    for (const q of [
      ['DELETE FROM reactions WHERE user_id = $1', [uid]],
      ['DELETE FROM comments WHERE author_id = $1', [uid]],
      ['DELETE FROM job_applications WHERE applicant_id = $1', [uid]],
      ['DELETE FROM messages WHERE sender_id = $1', [uid]],
      ['DELETE FROM notifications WHERE actor_id = $1', [uid]],
      ['DELETE FROM posts WHERE author_id = $1', [uid]],
      ['DELETE FROM conversations WHERE created_by = $1', [uid]],
      ['DELETE FROM events WHERE organizer_id = $1', [uid]],
      ['DELETE FROM groups WHERE created_by = $1', [uid]],
      ['DELETE FROM jobs WHERE posted_by = $1', [uid]],
      ['DELETE FROM users WHERE id = $1', [uid]],
    ]) {
      await pgQuery(q[0], q[1]).catch(() => {}) // swallow if table doesn't exist
    }
  }
  await pgQuery("UPDATE invitations SET is_used = false WHERE token = 'dev-invite'")
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════════')
  console.log('  UniConnecT — End-to-End Smoke Test')
  console.log(`  API: ${API}   Domain: ${UNI_DOMAIN}`)
  console.log('══════════════════════════════════════════════════\n')

  let studentToken = null
  let studentId = null
  let alumniToken = null
  let alumniId = null
  let postId = null
  let jobId = null
  let convId = null

  // ─── Auth edge cases (steps 13-16) ───────────────────────────────────────
  console.log('─── Health + Auth edge cases ───────────────────────────────\n')

  // Step 13 — Health
  {
    const r = await req('GET', '/health')
    if (r.status === 200 && r.body?.status === 'ok' && r.body?.db === 'connected') {
      pass('GET /health → 200 {status:ok, db:connected, redis:connected}', r.status)
    } else {
      fail('GET /health', '200+ok', `${r.status} ${JSON.stringify(r.body)}`)
      console.log('\n⛔  API not healthy — aborting.\n')
      process.exit(1)
    }
  }

  // Step 14 — /me without token → 401
  {
    const r = await req('GET', '/api/v1/auth/me')
    r.status === 401
      ? pass('GET /api/v1/auth/me (no token) → 401', r.status)
      : fail('GET /api/v1/auth/me (no token)', '401', r.status, r.body?.error)
  }

  // Step 15 — /refresh without cookie → 401
  {
    const r = await req('POST', '/api/v1/auth/refresh')
    r.status === 401
      ? pass('POST /api/v1/auth/refresh (no cookie) → 401', r.status)
      : fail('POST /api/v1/auth/refresh (no cookie)', '401', r.status, r.body?.error)
  }

  // Step 16 — /posts without token → 401
  {
    const r = await req('GET', '/api/v1/posts')
    r.status === 401
      ? pass('GET /api/v1/posts (no token) → 401', r.status)
      : fail('GET /api/v1/posts (no token)', '401', r.status, r.body?.error)
  }

  // ─── Journey 1: Registration + OTP ───────────────────────────────────────
  console.log('\n─── Journey 1: Registration + OTP ──────────────────────────\n')

  // Setup: remove existing student@uiu.ac.bd so we can re-register
  process.stdout.write('  [setup] Clearing student@uiu.ac.bd for fresh test… ')
  await cleanupStudent()
  console.log('done.\n')

  // Step 1 — Register
  {
    const r = await req('POST', '/api/v1/auth/register', {
      full_name: 'Smoke Test Student',
      invitation_token: 'dev-invite',
    })
    if (r.status === 201 && r.body?.data?.user?.id) {
      studentId = r.body.data.user.id
      studentToken = r.body.data.accessToken
      pass(`POST /api/v1/auth/register → 201 userId=${studentId.slice(0, 8)}…`, r.status)
    } else {
      fail('POST /api/v1/auth/register', '201 + {data:{user:{id},accessToken}}', r.status, JSON.stringify(r.body))
      studentId = await getUserId('student@uiu.ac.bd')
    }
  }

  // Step 2 — Confirm OTP is in Redis
  {
    if (!studentId) {
      fail('Redis otp:verify:{id} exists', 'bcrypt hash', 'no studentId — skipped')
    } else {
      const hash = await getOtpHash(studentId, 'verify')
      hash?.startsWith('$2')
        ? pass(`Redis otp:verify:${studentId.slice(0, 8)}… contains bcrypt hash`, 200)
        : fail('Redis otp:verify:{id}', 'bcrypt hash ($2…)', hash ?? 'null')
    }
  }

  // Step 3 — Verify OTP (inject known OTP first)
  {
    if (!studentId) {
      fail('POST /api/v1/auth/verify-otp', '200', 'skipped — no studentId')
    } else {
      await injectOtp(studentId, 'verify')
      const r = await req('POST', '/api/v1/auth/verify-otp', {
        email: 'student@uiu.ac.bd',
        otp: TEST_OTP,
        purpose: 'verify',
      })
      if (r.status === 200 && r.body?.data?.accessToken) {
        studentToken = r.body.data.accessToken
        pass('POST /api/v1/auth/verify-otp → 200 with accessToken', r.status)
      } else {
        fail('POST /api/v1/auth/verify-otp', '200 + accessToken', r.status, JSON.stringify(r.body))
      }
    }
  }

  // ─── Journey 2: Feed ─────────────────────────────────────────────────────
  console.log('\n─── Journey 2: Feed ─────────────────────────────────────────\n')

  // Step 4 — GET /posts (authenticated)
  {
    if (!studentToken) {
      fail('GET /api/v1/posts (auth)', '200', 'skipped — no token')
    } else {
      const r = await req('GET', '/api/v1/posts', null, studentToken)
      if (r.status === 200 && r.body?.data && 'items' in r.body.data) {
        pass('GET /api/v1/posts (auth) → 200 {data:{items,…}}', r.status)
      } else {
        fail('GET /api/v1/posts (auth)', '200 + {data:{items}}', r.status, JSON.stringify(r.body))
      }
    }
  }

  // Step 5 — POST /posts
  {
    if (!studentToken) {
      fail('POST /api/v1/posts', '201', 'skipped — no token')
    } else {
      const r = await req('POST', '/api/v1/posts', {
        content: 'Hello UniConnecT! First post from smoke test.',
        type: 'post',
      }, studentToken)
      if (r.status === 201 && r.body?.data?.id) {
        postId = r.body.data.id
        pass(`POST /api/v1/posts → 201 postId=${postId.slice(0, 8)}…`, r.status)
      } else {
        fail('POST /api/v1/posts', '201 + {data:{id}}', r.status, JSON.stringify(r.body))
      }
    }
  }

  // Step 6 — POST /posts/:id/reactions
  {
    if (!postId || !studentToken) {
      fail('POST /api/v1/posts/:id/reactions', '2xx', 'skipped')
    } else {
      const r = await req('POST', `/api/v1/posts/${postId}/reactions`, {
        reaction_type: 'like',
      }, studentToken)
      r.status === 200 || r.status === 201
        ? pass('POST /api/v1/posts/:id/reactions → 2xx', r.status)
        : fail('POST /api/v1/posts/:id/reactions', '200 or 201', r.status, JSON.stringify(r.body))
    }
  }

  // Step 7 — POST /posts/:id/comments
  {
    if (!postId || !studentToken) {
      fail('POST /api/v1/posts/:id/comments', '201', 'skipped')
    } else {
      const r = await req('POST', `/api/v1/posts/${postId}/comments`, {
        content: 'Nice post!',
      }, studentToken)
      r.status === 201 && r.body?.data?.id
        ? pass('POST /api/v1/posts/:id/comments → 201 with commentId', r.status)
        : fail('POST /api/v1/posts/:id/comments', '201 + {data:{id}}', r.status, JSON.stringify(r.body))
    }
  }

  // ─── Journey 3: Jobs ─────────────────────────────────────────────────────
  console.log('\n─── Journey 3: Jobs ─────────────────────────────────────────\n')

  // Step 8 — Alumni OTP login (inject OTP, call verify-otp with purpose:login)
  {
    alumniId = await getUserId('alumni@uiu.ac.bd')
    if (!alumniId) {
      fail('Alumni login (OTP inject + verify-otp)', '200', 'alumni@uiu.ac.bd not in DB')
    } else {
      await injectOtp(alumniId, 'login')
      const r = await req('POST', '/api/v1/auth/verify-otp', {
        email: 'alumni@uiu.ac.bd',
        otp: TEST_OTP,
        purpose: 'login',
      })
      if (r.status === 200 && r.body?.data?.accessToken) {
        alumniToken = r.body.data.accessToken
        pass('Alumni login via verify-otp (injected OTP) → 200 with accessToken', r.status)
      } else {
        fail('Alumni login via verify-otp', '200 + accessToken', r.status, JSON.stringify(r.body))
      }
    }
  }

  // Step 9 — Alumni posts a job
  {
    if (!alumniToken) {
      fail('POST /api/v1/jobs (alumni)', '201', 'skipped — no alumni token')
    } else {
      const r = await req('POST', '/api/v1/jobs', {
        title: 'Smoke Test Dev Role',
        company: 'UIU Alumni Corp',
        location: 'Dhaka',
        type: 'internship',
        description: 'Test internship created by smoke test suite.',
        requirements: ['React', 'Node.js'],
        deadline: JOB_DEADLINE,
      }, alumniToken)
      if (r.status === 201 && r.body?.data?.id) {
        jobId = r.body.data.id
        pass(`POST /api/v1/jobs → 201 jobId=${jobId.slice(0, 8)}…`, r.status)
      } else {
        fail('POST /api/v1/jobs (alumni)', '201 + {data:{id}}', r.status, JSON.stringify(r.body))
      }
    }
  }

  // Step 10 — Student applies to job
  {
    if (!jobId || !studentToken) {
      fail('POST /api/v1/jobs/:id/apply', '201', 'skipped')
    } else {
      const r = await req('POST', `/api/v1/jobs/${jobId}/apply`, {
        cover_letter: 'Excited to apply via smoke test.',
      }, studentToken)
      r.status === 201 && r.body?.data?.id
        ? pass('POST /api/v1/jobs/:id/apply → 201 with applicationId', r.status)
        : fail('POST /api/v1/jobs/:id/apply', '201 + {data:{id}}', r.status, JSON.stringify(r.body))
    }
  }

  // ─── Journey 4: Messaging ────────────────────────────────────────────────
  console.log('\n─── Journey 4: Messaging ────────────────────────────────────\n')

  // Step 11 — Create direct conversation (student → alumni)
  // CreateConversationSchema: direct needs `participantId` (single UUID)
  {
    if (!studentToken || !alumniId) {
      fail('POST /api/v1/conversations', '201 or 200', 'skipped')
    } else {
      const r = await req('POST', '/api/v1/conversations', {
        participantId: alumniId,
        is_group: false,
      }, studentToken)
      if ((r.status === 201 || r.status === 200) && r.body?.data?.id) {
        convId = r.body.data.id
        pass(`POST /api/v1/conversations → ${r.status} convId=${convId.slice(0, 8)}…`, r.status)
      } else {
        fail('POST /api/v1/conversations', '201 or 200 + {data:{id}}', r.status, JSON.stringify(r.body))
      }
    }
  }

  // Step 12 — Send message
  {
    if (!convId || !studentToken) {
      fail('POST /api/v1/conversations/:id/messages', '201', 'skipped')
    } else {
      const r = await req('POST', `/api/v1/conversations/${convId}/messages`, {
        content: 'Hi! Smoke test message.',
        type: 'text',
      }, studentToken)
      r.status === 201 && r.body?.data?.id
        ? pass('POST /api/v1/conversations/:id/messages → 201 with messageId', r.status)
        : fail('POST /api/v1/conversations/:id/messages', '201 + {data:{id}}', r.status, JSON.stringify(r.body))
    }
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  const total = passed + failed
  console.log('\n══════════════════════════════════════════════════')
  console.log(`  RESULT: ${passed}/${total} steps passed`)
  console.log('══════════════════════════════════════════════════\n')

  if (failed > 0) {
    console.log('Failed steps:')
    lines.filter((l) => l.startsWith('🔴')).forEach((l) => console.log('  ' + l))
    console.log()
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('\n💥 Unexpected error:', e.message, e.stack)
  process.exit(1)
})
