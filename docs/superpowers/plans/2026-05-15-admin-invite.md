# Admin Invite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add single and bulk email invitation sending to the admin panel's Invitations tab, so invited recipients receive a personalised registration link via email.

**Architecture:** Wire the existing email queue (Bull/Redis) into `AdminService.createInvitation`; add a new `createBulkInvitations` method and `POST /admin/invitations/bulk` endpoint; rewrite `InvitationsTab` in AdminPage with a Single/Multiple toggle and success/error feedback.

**Tech Stack:** Node.js/Express/Knex (API), Resend (email), Bull (queue), React 18/TanStack Query (frontend), Vitest/Supertest (tests)

---

## File Map

| File | Change |
|------|--------|
| `apps/api/src/services/email.service.ts` | Add `sendInvitationEmail` + `renderInvitationHtml` |
| `apps/api/src/workers/email.worker.ts` | Add `invitation` template branch; extend `parseTemplatePayload` return type |
| `apps/api/src/__tests__/admin-invite.test.ts` | New — integration tests for single and bulk invite endpoints |
| `apps/api/src/modules/admin/schema.ts` | Add `CreateBulkInvitationsSchema` + export its inferred type |
| `apps/api/src/modules/admin/service.ts` | Import `emailQueue`/`env`; update `createInvitation` signature; add `createBulkInvitations` |
| `apps/api/src/modules/admin/controller.ts` | Update `createInvitation` call; add `createBulkInvitations` handler |
| `apps/api/src/modules/admin/router.ts` | Add `POST /invitations/bulk` route; import new symbols |
| `apps/web/src/pages/AdminPage.tsx` | Rename tab label; rewrite `InvitationsTab` |

---

## Task 1: Add `sendInvitationEmail` to email service

**Files:**
- Modify: `apps/api/src/services/email.service.ts`

- [ ] **Step 1: Add `sendInvitationEmail` method and `renderInvitationHtml` helper**

  Insert the method after `sendWelcomeEmail` (line ~66) and the render function after `renderSimpleHtml`. The method goes inside the `ResendEmailService` class; the render function is a module-level function.

  Inside `ResendEmailService` class, after `sendWelcomeEmail`:
  ```ts
  async sendInvitationEmail(
    to: string,
    registerUrl: string,
    role: string,
    universityName: string,
  ): Promise<EmailResult> {
    return this.sendEmail({
      to,
      subject: "You're invited to join UniConnecT",
      html: renderInvitationHtml({ registerUrl, role, universityName }),
      text: `You've been invited to join ${universityName} on UniConnecT as a ${role}. Create your account here: ${registerUrl}`,
      tags: [
        { name: 'category', value: 'invitation' },
        { name: 'app', value: 'uniconnect' },
      ],
    })
  }
  ```

  After `renderSimpleHtml`, add:
  ```ts
  function renderInvitationHtml(input: {
    registerUrl: string
    role: string
    universityName: string
  }) {
    const registerUrl = escapeHtml(input.registerUrl)
    const role = escapeHtml(input.role)
    const universityName = escapeHtml(input.universityName)

    return `
      <div style="margin:0;padding:0;background:#060D1A;color:#EEF2FF;font-family:Arial,Helvetica,sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#060D1A;margin:0;padding:0;">
          <tr>
            <td align="center" style="padding:32px 16px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:560px;background:#0A1628;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="padding:28px 24px 8px;">
                    <div style="font-size:18px;line-height:1.3;font-weight:500;color:#F05A28;">UniConnecT</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 24px 28px;">
                    <h1 style="margin:0 0 14px;font-size:24px;line-height:1.3;font-weight:500;color:#EEF2FF;">You've been invited</h1>
                    <p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#B8C4E6;">You've been invited to join <strong style="color:#DDE6FF;">${universityName}</strong> on UniConnecT as a <strong style="color:#DDE6FF;">${role}</strong>.</p>
                    <p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:#B8C4E6;">Click below to create your account. This link is personal — please don't share it.</p>
                    <a href="${registerUrl}" style="display:inline-block;background:#5B5BD6;color:#FFFFFF;text-decoration:none;border-radius:999px;padding:12px 18px;font-size:14px;">Create account</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 24px 24px;border-top:1px solid rgba(255,255,255,0.08);">
                    <p style="margin:0;font-size:12px;line-height:1.5;color:#7180A3;">UniConnecT — Your campus. One place.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add apps/api/src/services/email.service.ts
  git commit -m "feat(email): add sendInvitationEmail method"
  ```

---

## Task 2: Add `invitation` branch to email worker

**Files:**
- Modify: `apps/api/src/workers/email.worker.ts`

- [ ] **Step 1: Extend `parseTemplatePayload` return type and add `invitation` branch**

  Replace the current content of `apps/api/src/workers/email.worker.ts` with:

  ```ts
  import { emailQueue, type EmailQueueJob } from '../queues/email.queue'
  import { emailService } from '../services/email.service'
  import { logger } from '../utils/logger'

  emailQueue.process(async (job) => {
    const input = job.data
    const handled = await handleTemplateEmail(input)
    if (handled) return

    const result = await emailService.sendQueuedEmail(input)
    if (!result.success) {
      throw new Error(result.error ?? 'Queued email failed')
    }
  })

  emailQueue.on('failed', (job, error) => {
    logger.error('Email queue job failed', { jobId: job?.id, error })
  })

  async function handleTemplateEmail(input: EmailQueueJob) {
    if (!input.text) return false

    const parsed = parseTemplatePayload(input.text)
    if (!parsed) return false

    if (parsed.template === 'welcome') {
      const result = await emailService.sendWelcomeEmail(
        input.to,
        parsed.userName!,
        parsed.role!,
        parsed.universityName!,
      )
      if (!result.success) {
        throw new Error(result.error ?? 'Welcome email failed')
      }
      return true
    }

    if (parsed.template === 'otp') {
      const result = await emailService.sendOtpEmail(
        input.to,
        parsed.otp!,
        parsed.purpose as any,
        parsed.userName!,
      )
      if (!result.success) {
        throw new Error(result.error ?? 'OTP email failed')
      }
      return true
    }

    if (parsed.template === 'invitation') {
      const result = await emailService.sendInvitationEmail(
        input.to,
        parsed.registerUrl!,
        parsed.role!,
        parsed.universityName!,
      )
      if (!result.success) {
        throw new Error(result.error ?? 'Invitation email failed')
      }
      return true
    }

    return false
  }

  function parseTemplatePayload(value: string) {
    try {
      const parsed = JSON.parse(value) as Partial<{
        template: string
        userName: string
        role: string
        universityName: string
        otp: string
        purpose: string
        registerUrl: string
      }>

      if (
        typeof parsed.template !== 'string' ||
        typeof parsed.userName !== 'string'
      ) {
        return null
      }

      return parsed
    } catch {
      return null
    }
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add apps/api/src/workers/email.worker.ts
  git commit -m "feat(email): add invitation template branch to email worker"
  ```

---

## Task 3: Write failing integration tests

**Files:**
- Create: `apps/api/src/__tests__/admin-invite.test.ts`

- [ ] **Step 1: Create the test file**

  ```ts
  import { describe, it, expect, beforeAll, afterAll } from 'vitest'
  import supertest from 'supertest'
  import { app, loginAs, DOMAIN, TEST_UNIVERSITY_ID, CREDENTIALS } from './setup'
  import { db } from '../config/db'

  const api = supertest(app)
  const UNI = { 'x-university-domain': DOMAIN }

  let adminToken: string
  let staffToken: string

  beforeAll(async () => {
    const [admin, staff] = await Promise.all([
      loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password),
      loginAs(CREDENTIALS.staff.email, CREDENTIALS.staff.password),
    ])
    adminToken = admin.accessToken
    staffToken = staff.accessToken
  })

  afterAll(async () => {
    await db.raw(
      `DELETE FROM invitations WHERE university_id = ? AND (email LIKE 'inv.test%' OR email LIKE 'bulk.test%')`,
      [TEST_UNIVERSITY_ID],
    )
  })

  describe('POST /api/v1/admin/invitations', () => {
    it('returns 201 with invitation data including token', async () => {
      const email = `inv.test.${Date.now()}@uiu.ac.bd`
      const res = await api
        .post('/api/v1/admin/invitations')
        .set(UNI)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email, role: 'student', expires_in_days: 7 })

      expect(res.status).toBe(201)
      expect(res.body.data).toMatchObject({ email, role: 'student' })
      expect(res.body.data).toHaveProperty('id')
      expect(res.body.data).toHaveProperty('token')
    })

    it('returns 401 without auth token', async () => {
      const res = await api
        .post('/api/v1/admin/invitations')
        .set(UNI)
        .send({ email: 'noauth@uiu.ac.bd', role: 'student', expires_in_days: 7 })

      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/v1/admin/invitations/bulk', () => {
    it('returns 201 with created count and emails list', async () => {
      const ts = Date.now()
      const emails = [`bulk.test.a.${ts}@uiu.ac.bd`, `bulk.test.b.${ts}@uiu.ac.bd`]
      const res = await api
        .post('/api/v1/admin/invitations/bulk')
        .set(UNI)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emails, role: 'alumni', expires_in_days: 7 })

      expect(res.status).toBe(201)
      expect(res.body.data.created).toBe(2)
      expect(res.body.data.emails).toEqual(expect.arrayContaining(emails))
    })

    it('deduplicates emails and counts only unique', async () => {
      const ts = Date.now()
      const email = `bulk.test.dup.${ts}@uiu.ac.bd`
      const res = await api
        .post('/api/v1/admin/invitations/bulk')
        .set(UNI)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emails: [email, email, email], role: 'student', expires_in_days: 7 })

      expect(res.status).toBe(201)
      expect(res.body.data.created).toBe(1)
    })

    it('returns 422 when emails array is empty', async () => {
      const res = await api
        .post('/api/v1/admin/invitations/bulk')
        .set(UNI)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emails: [], role: 'student', expires_in_days: 7 })

      expect(res.status).toBe(422)
    })

    it('returns 422 when emails array exceeds 50', async () => {
      const emails = Array.from({ length: 51 }, (_, i) => `bulk.test.over${i}@uiu.ac.bd`)
      const res = await api
        .post('/api/v1/admin/invitations/bulk')
        .set(UNI)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emails, role: 'student', expires_in_days: 7 })

      expect(res.status).toBe(422)
    })

    it('returns 403 for staff role (admin-only endpoint)', async () => {
      const res = await api
        .post('/api/v1/admin/invitations/bulk')
        .set(UNI)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ emails: [`bulk.test.staff.${Date.now()}@uiu.ac.bd`], role: 'student', expires_in_days: 7 })

      expect(res.status).toBe(403)
    })
  })
  ```

- [ ] **Step 2: Run tests to confirm they fail (bulk endpoint not yet implemented)**

  ```bash
  cd apps/api && npx pnpm test src/__tests__/admin-invite.test.ts 2>&1 | tail -30
  ```

  Expected: `POST /api/v1/admin/invitations/bulk` tests fail with 404.  
  `POST /api/v1/admin/invitations` tests should already pass (endpoint exists).

- [ ] **Step 3: Commit**

  ```bash
  git add apps/api/src/__tests__/admin-invite.test.ts
  git commit -m "test(admin): add failing integration tests for invite endpoints"
  ```

---

## Task 4: Wire email into `createInvitation`

**Files:**
- Modify: `apps/api/src/modules/admin/service.ts`
- Modify: `apps/api/src/modules/admin/controller.ts`

- [ ] **Step 1: Add imports to `service.ts`**

  At the top of `apps/api/src/modules/admin/service.ts`, after the existing imports, add:

  ```ts
  import { emailQueue } from '../../queues/email.queue'
  import { env } from '../../config/env'
  ```

- [ ] **Step 2: Update `createInvitation` signature and body**

  Change the `createInvitation` method signature from:
  ```ts
  async createInvitation(
    universityId: string,
    invitedById: string,
    input: CreateInvitationInput,
  )
  ```
  to:
  ```ts
  async createInvitation(
    universityId: string,
    invitedById: string,
    input: CreateInvitationInput,
    universityName: string,
  )
  ```

  At the end of the method body, after `return toInvitation(row)`, add the email enqueue **before** the return statement:

  ```ts
  const registerUrl = `${env.WEB_URL}/register/${token}`
  void emailQueue.add({
    to: input.email,
    subject: "You're invited to join UniConnecT",
    text: JSON.stringify({
      template: 'invitation',
      userName: '',
      registerUrl,
      role: input.role,
      universityName,
    }),
  })

  return toInvitation(row)
  ```

- [ ] **Step 3: Update `createInvitation` controller call**

  In `apps/api/src/modules/admin/controller.ts`, update the `createInvitation` handler to pass `req.university!.name`:

  ```ts
  export const createInvitation = asyncHandler(async (req: Request, res: Response) => {
    const { universityId, userId } = getAdminContext(req)
    sendSuccess(
      res,
      await adminService.createInvitation(
        universityId,
        userId,
        req.body as CreateInvitationInput,
        req.university!.name,
      ),
      201,
    )
  })
  ```

- [ ] **Step 4: Run existing single-invite tests to confirm they still pass**

  ```bash
  cd apps/api && npx pnpm test src/__tests__/admin-invite.test.ts 2>&1 | grep -E "PASS|FAIL|✓|✗|admin/invitations"
  ```

  Expected: the two `POST /api/v1/admin/invitations` tests pass. Bulk tests still fail with 404.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/api/src/modules/admin/service.ts apps/api/src/modules/admin/controller.ts
  git commit -m "feat(admin): enqueue invitation email on single invite creation"
  ```

---

## Task 5: Implement bulk invite endpoint

**Files:**
- Modify: `apps/api/src/modules/admin/schema.ts`
- Modify: `apps/api/src/modules/admin/service.ts`
- Modify: `apps/api/src/modules/admin/controller.ts`
- Modify: `apps/api/src/modules/admin/router.ts`

- [ ] **Step 1: Add `CreateBulkInvitationsSchema` to schema.ts**

  Append to `apps/api/src/modules/admin/schema.ts`:

  ```ts
  export const CreateBulkInvitationsSchema = z.object({
    emails: z.array(z.string().email()).min(1).max(50),
    role: z.enum(['student', 'alumni', 'staff', 'admin']).default('student'),
    expires_in_days: z.number().int().min(1).max(30).default(7),
  })

  export type CreateBulkInvitationsInput = z.infer<typeof CreateBulkInvitationsSchema>
  ```

- [ ] **Step 2: Add `createBulkInvitations` to service.ts**

  Add this method to `AdminService` after `createInvitation`:

  ```ts
  async createBulkInvitations(
    universityId: string,
    invitedById: string,
    input: CreateBulkInvitationsInput,
    universityName: string,
  ) {
    const unique = [...new Set(input.emails.map((e) => e.toLowerCase().trim()))]
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + input.expires_in_days)

    const rows = unique.map((email) => ({
      university_id: universityId,
      invited_by: invitedById,
      email,
      role: input.role,
      token: crypto.randomBytes(32).toString('hex'),
      expires_at: expiresAt,
    }))

    await db.transaction(async (trx) => {
      await db('invitations').insert(rows).transacting(trx)
    })

    for (const row of rows) {
      const registerUrl = `${env.WEB_URL}/register/${row.token}`
      void emailQueue.add({
        to: row.email,
        subject: "You're invited to join UniConnecT",
        text: JSON.stringify({
          template: 'invitation',
          userName: '',
          registerUrl,
          role: input.role,
          universityName,
        }),
      })
    }

    return { created: rows.length, emails: rows.map((r) => r.email) }
  }
  ```

  Also add `CreateBulkInvitationsInput` to the import from `'./schema'` at the top of the file.

- [ ] **Step 3: Add `createBulkInvitations` controller handler**

  In `apps/api/src/modules/admin/controller.ts`, add after the `createInvitation` handler:

  ```ts
  export const createBulkInvitations = asyncHandler(async (req: Request, res: Response) => {
    const { universityId, userId } = getAdminContext(req)
    sendSuccess(
      res,
      await adminService.createBulkInvitations(
        universityId,
        userId,
        req.body as CreateBulkInvitationsInput,
        req.university!.name,
      ),
      201,
    )
  })
  ```

  Also add `CreateBulkInvitationsInput` to the import from `'./schema'`.

- [ ] **Step 4: Add bulk route to router.ts**

  In `apps/api/src/modules/admin/router.ts`, add the new route **before** the existing `POST /invitations` line:

  ```ts
  adminRouter.post('/invitations/bulk', requireRole('admin'), validate(CreateBulkInvitationsSchema), createBulkInvitations)
  ```

  Add `createBulkInvitations` to the controller import and `CreateBulkInvitationsSchema` to the schema import.

- [ ] **Step 5: Run all admin-invite tests to confirm they all pass**

  ```bash
  cd apps/api && npx pnpm test src/__tests__/admin-invite.test.ts 2>&1 | tail -30
  ```

  Expected output: all 7 tests pass.

- [ ] **Step 6: Run full test suite to check for regressions**

  ```bash
  cd /Users/joydipdatta/UniConnecT_NEW && npx pnpm --filter api test 2>&1 | tail -20
  ```

  Expected: all tests pass, no regressions.

- [ ] **Step 7: Commit**

  ```bash
  git add apps/api/src/modules/admin/schema.ts apps/api/src/modules/admin/service.ts apps/api/src/modules/admin/controller.ts apps/api/src/modules/admin/router.ts
  git commit -m "feat(admin): add bulk invite endpoint POST /admin/invitations/bulk"
  ```

---

## Task 6: Frontend — rename tab + rewrite InvitationsTab

**Files:**
- Modify: `apps/web/src/pages/AdminPage.tsx`

- [ ] **Step 1: Rename the "Invitations" tab label to "Invite"**

  In `apps/web/src/pages/AdminPage.tsx`, find the `TABS` array (around line 104) and change the label:

  ```ts
  { label: 'Invite', value: 'invitations', icon: <Mail size={14} /> },
  ```

- [ ] **Step 2: Replace the entire `InvitationsTab` function**

  Delete the existing `InvitationsTab` function (lines 424–573) and replace it with:

  ```tsx
  function InvitationsTab() {
    const qc = useQueryClient()
    const [page, setPage] = useState(1)
    const [mode, setMode] = useState<'single' | 'multiple'>('single')
    const [formEmail, setFormEmail] = useState('')
    const [formRole, setFormRole] = useState<UserRole>('student')
    const [formDays, setFormDays] = useState(7)
    const [bulkText, setBulkText] = useState('')
    const [bulkRole, setBulkRole] = useState<UserRole>('student')
    const [bulkDays, setBulkDays] = useState(7)
    const [successMsg, setSuccessMsg] = useState<string | null>(null)
    const limit = 20

    const { data, isLoading } = useQuery<Paginated<Invitation>>({
      queryKey: ['admin', 'invitations', page],
      queryFn: () =>
        api.get<{ data: Paginated<Invitation> }>(`/admin/invitations?page=${page}&limit=${limit}`)
          .then((r) => r.data.data),
    })

    const singleMutation = useMutation({
      mutationFn: () =>
        api.post('/admin/invitations', { email: formEmail, role: formRole, expires_in_days: formDays }),
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ['admin', 'invitations'] })
        const sent = formEmail
        setFormEmail('')
        setFormRole('student')
        setFormDays(7)
        flash(`Invitation sent to ${sent}`)
      },
    })

    const bulkMutation = useMutation({
      mutationFn: (emails: string[]) =>
        api.post('/admin/invitations/bulk', { emails, role: bulkRole, expires_in_days: bulkDays }),
      onSuccess: (_data, emails) => {
        void qc.invalidateQueries({ queryKey: ['admin', 'invitations'] })
        setBulkText('')
        flash(`${emails.length} invitation${emails.length === 1 ? '' : 's'} sent`)
      },
    })

    const deleteMutation = useMutation({
      mutationFn: (id: string) => api.delete(`/admin/invitations/${id}`),
      onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin', 'invitations'] }) },
    })

    function flash(msg: string) {
      setSuccessMsg(msg)
      setTimeout(() => setSuccessMsg(null), 5000)
    }

    function parseEmails(text: string): string[] {
      return [
        ...new Set(
          text
            .split(/[,\n]/)
            .map((e) => e.trim().toLowerCase())
            .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
        ),
      ]
    }

    const parsedEmails = parseEmails(bulkText)

    function handleToggle(next: 'single' | 'multiple') {
      setMode(next)
      setSuccessMsg(null)
      singleMutation.reset()
      bulkMutation.reset()
    }

    const totalPages = Math.ceil((data?.total ?? 0) / limit)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <style>{`
          .invite-textarea-wrap { overflow: hidden; transition: max-height 220ms ease; }
        `}</style>

        {/* ── Send panel ── */}
        <div style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
              Send invite
            </span>
            <div style={{
              display: 'flex',
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-pill)',
              padding: '3px',
            }}>
              {(['single', 'multiple'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleToggle(m)}
                  style={{
                    padding: '4px 14px',
                    fontSize: 12,
                    borderRadius: 'var(--r-pill)',
                    border: 'none',
                    cursor: 'pointer',
                    background: mode === m ? 'var(--uc-indigo-bg)' : 'transparent',
                    color: mode === m ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                    fontWeight: mode === m ? 500 : 400,
                    transition: 'background 150ms, color 150ms',
                  }}
                >
                  {m === 'single' ? 'Single' : 'Multiple'}
                </button>
              ))}
            </div>
          </div>

          {mode === 'single' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input
                  type="email"
                  placeholder="Email address"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') singleMutation.mutate() }}
                  style={{ ...inputStyle, flex: '2 1 200px' }}
                />
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as UserRole)}
                  style={{ ...selectStyle, flex: '1 1 120px' }}
                >
                  {(['student', 'alumni', 'staff', 'admin'] as UserRole[]).map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <select
                  value={formDays}
                  onChange={(e) => setFormDays(Number(e.target.value))}
                  style={{ ...selectStyle, flex: '1 1 120px' }}
                >
                  {[1, 3, 7, 14, 30].map((d) => (
                    <option key={d} value={d}>Expires in {d}d</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <PrimaryBtn
                  disabled={!formEmail.trim() || singleMutation.isPending}
                  onClick={() => singleMutation.mutate()}
                >
                  {singleMutation.isPending ? 'Sending…' : 'Send invite'}
                </PrimaryBtn>
                {singleMutation.isError && (
                  <span style={{ fontSize: 13, color: 'var(--uc-orange-l)' }}>
                    Failed to send. Try again.
                  </span>
                )}
              </div>
            </div>
          )}

          {mode === 'multiple' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <select
                  value={bulkRole}
                  onChange={(e) => setBulkRole(e.target.value as UserRole)}
                  style={{ ...selectStyle, flex: '1 1 120px' }}
                >
                  {(['student', 'alumni', 'staff', 'admin'] as UserRole[]).map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <select
                  value={bulkDays}
                  onChange={(e) => setBulkDays(Number(e.target.value))}
                  style={{ ...selectStyle, flex: '1 1 120px' }}
                >
                  {[1, 3, 7, 14, 30].map((d) => (
                    <option key={d} value={d}>Expires in {d}d</option>
                  ))}
                </select>
              </div>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="Enter emails separated by commas or new lines, e.g.&#10;alice@uiu.ac.bd, bob@uiu.ac.bd, carol@uiu.ac.bd"
                rows={5}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  minHeight: 110,
                  lineHeight: 1.6,
                }}
              />
              {parsedEmails.length > 50 && (
                <span style={{ fontSize: 12, color: 'var(--uc-orange-l)' }}>
                  Maximum 50 emails per send — {parsedEmails.length} detected. Remove some before sending.
                </span>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <PrimaryBtn
                  disabled={parsedEmails.length === 0 || parsedEmails.length > 50 || bulkMutation.isPending}
                  onClick={() => bulkMutation.mutate(parsedEmails)}
                >
                  {bulkMutation.isPending
                    ? 'Sending…'
                    : parsedEmails.length === 0
                      ? 'Send invites'
                      : `Send ${parsedEmails.length} invite${parsedEmails.length === 1 ? '' : 's'}`}
                </PrimaryBtn>
                {bulkMutation.isError && (
                  <span style={{ fontSize: 13, color: 'var(--uc-orange-l)' }}>
                    Failed to send. Try again.
                  </span>
                )}
              </div>
            </div>
          )}

          {successMsg !== null && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--uc-mint-bg)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-md)',
              padding: '10px 14px',
            }}>
              <span style={{ fontSize: 13, color: 'var(--uc-mint)' }}>{successMsg}</span>
              <button
                type="button"
                onClick={() => setSuccessMsg(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--uc-mint)' }}
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* ── Past invitations ── */}
        {isLoading || !data ? (
          <Spinner />
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>
              {data.total.toLocaleString()} invitation{data.total === 1 ? '' : 's'} sent
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {data.items.map((inv) => (
                <div key={inv.id} style={{
                  background: 'var(--surface-card)',
                  border: '0.5px solid var(--border-default)',
                  borderRadius: 'var(--r-md)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{inv.email}</span>
                      <Badge variant="neutral">{inv.role}</Badge>
                      {inv.isUsed
                        ? <Badge variant="alumni">used</Badge>
                        : new Date(inv.expiresAt) < new Date()
                          ? <Badge variant="neutral">expired</Badge>
                          : <Badge variant="dept">active</Badge>}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      Expires {fmtDate(inv.expiresAt)}
                    </span>
                  </div>
                  {!inv.isUsed && (
                    <button
                      type="button"
                      title="Delete invitation"
                      onClick={() => deleteMutation.mutate(inv.id)}
                      disabled={deleteMutation.isPending}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: 'var(--text-tertiary)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4 }}>
                <GhostBtn disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</GhostBtn>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', alignSelf: 'center' }}>
                  {page} / {totalPages}
                </span>
                <GhostBtn disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</GhostBtn>
              </div>
            )}
          </>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 3: Run typecheck + lint**

  ```bash
  cd /Users/joydipdatta/UniConnecT_NEW && npx pnpm typecheck 2>&1 | tail -20 && npx pnpm lint 2>&1 | tail -20
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/src/pages/AdminPage.tsx
  git commit -m "feat(admin): rename Invitations tab to Invite, add single/bulk toggle with email sending"
  ```

---

## Task 7: Final verification

- [ ] **Step 1: Run all API tests**

  ```bash
  cd /Users/joydipdatta/UniConnecT_NEW && npx pnpm --filter api test 2>&1 | tail -30
  ```

  Expected: all tests pass.

- [ ] **Step 2: Run typecheck and lint across the monorepo**

  ```bash
  cd /Users/joydipdatta/UniConnecT_NEW && npx pnpm typecheck && npx pnpm lint
  ```

  Expected: no errors or warnings.

- [ ] **Step 3: Final commit if anything was adjusted**

  ```bash
  git add -p  # stage only relevant changes
  git commit -m "chore(admin): final typecheck and lint fixes for invite feature"
  ```
