# Allowed Email Domains — Full Feature Design

**Date:** 2026-05-25  
**Author:** Joydip (via Claude Code)  
**Status:** Approved

---

## Summary

The `AllowedDomainsPanel` UI and the backend CRUD routes (`GET /admin/university/domains`, `PATCH /admin/university/domains`) already exist and are wired together. What is missing is:

1. A bug in the PostgreSQL array update that silently fails the save.
2. No success feedback after saving.
3. No domain guard when creating invitations (admin can invite a disallowed domain; user hits an error only at registration).
4. A generic error message on `RegisterPage` for domain rejections.
5. No real-time broadcast when domains change.
6. No audit trail for config changes.

---

## Scope

| # | Area | What changes |
|---|---|---|
| 1 | `adminService.updateAllowedEmailDomains` | Fix PG array update; add audit log write; emit Socket.io event |
| 2 | `adminService.createInvitation` | Hard-block if invited domain not in allowed list |
| 3 | `adminService.createBulkInvitations` | Same guard; reject entire batch listing offending emails |
| 4 | New migration `040_create_university_audit_log.ts` | `university_audit_logs` table |
| 5 | `AllowedDomainsPanel` (frontend) | Inline success strip after save; auto-dismiss after 4 s |
| 6 | `InvitationsTab` (frontend) | Surface `EMAIL_DOMAIN_NOT_ALLOWED` error from invite mutations |
| 7 | `RegisterPage` (frontend) | Specific error copy for `EMAIL_DOMAIN_NOT_ALLOWED` code |
| 8 | `packages/shared/src/constants/socket.ts` | Add `UNIVERSITY_EVENTS` constant |

---

## Out of scope

- Showing the allowed domain list to users on `RegisterPage` (invitation-gated site; users don't need to see this).
- Retroactively banning or notifying existing users whose email domain is removed from the list.
- Public API endpoint for allowed domains.
- Client-side live-update reaction to `university:domains_updated` socket event (emitted for future use).

---

## Section 1 — Backend

### 1a. Fix `updateAllowedEmailDomains`

**File:** `apps/api/src/modules/admin/service.ts`

Current (buggy):
```ts
await db('universities')
  .where({ id: universityId })
  .update({ allowed_email_domains: db.raw('?::text[]', [unique.length ? `{${unique.join(',')}}` : '{}']) })
```

Fixed — the pg driver serialises a JS `string[]` to `text[]` natively:
```ts
await db('universities')
  .where({ id: universityId })
  .update({ allowed_email_domains: unique })
```

Method signature extended:
```ts
async updateAllowedEmailDomains(universityId: string, actorId: string, domains: string[])
```

After the DB update:
1. Fetch the previous value before updating (needed for audit payload).
2. Insert into `university_audit_logs`: `{ university_id, actor_id, action: 'domains.updated', payload: { before, after } }`.
3. Emit `university:domains_updated` to Socket.io room `uni:{universityId}` with `{ allowedEmailDomains: unique }`.

### 1b. Invite guard in `createInvitation`

**File:** `apps/api/src/modules/admin/service.ts`

After resolving the invited email, before inserting the invitation row:
```ts
const { allowedEmailDomains } = await this.getAllowedEmailDomains(universityId)
if (allowedEmailDomains.length > 0) {
  const domain = email.split('@')[1]?.toLowerCase() ?? ''
  if (!allowedEmailDomains.includes(domain)) {
    throw badRequest(
      `Invitations are only allowed for: ${allowedEmailDomains.join(', ')}`,
      'EMAIL_DOMAIN_NOT_ALLOWED',
    )
  }
}
```

### 1c. Invite guard in `createBulkInvitations`

Same pattern; collect all offending emails first, then throw a single error listing them:
```ts
const blocked = unique.filter(e => {
  const d = e.split('@')[1]?.toLowerCase() ?? ''
  return !allowedEmailDomains.includes(d)
})
if (blocked.length > 0) {
  throw badRequest(
    `These emails have disallowed domains: ${blocked.join(', ')}. Allowed: ${allowedEmailDomains.join(', ')}`,
    'EMAIL_DOMAIN_NOT_ALLOWED',
  )
}
```

### 1d. Update controller — pass `actorId`

**File:** `apps/api/src/modules/admin/controller.ts`

```ts
export const updateAllowedDomains = asyncHandler(async (req: Request, res: Response) => {
  const { universityId, userId } = getAdminContext(req)
  const { allowed_email_domains } = req.body as UpdateAllowedDomainsInput
  sendSuccess(res, await adminService.updateAllowedEmailDomains(universityId, userId, allowed_email_domains))
})
```

### 1e. New migration `040_create_university_audit_log.ts`

**File:** `apps/api/src/database/migrations/040_create_university_audit_log.ts`

```ts
export async function up(knex: Knex) {
  await knex.schema.createTable('university_audit_logs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    t.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    t.uuid('actor_id').nullable().references('id').inTable('users').onDelete('SET NULL')
    t.text('action').notNullable()           // e.g. 'domains.updated'
    t.jsonb('payload').notNullable().defaultTo('{}')
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.index(['university_id', 'created_at'])
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('university_audit_logs')
}
```

---

## Section 2 — Frontend

### 2a. `AllowedDomainsPanel` — success strip

**File:** `apps/web/src/pages/AdminPage.tsx`

Add `successMsg: string | null` state (same pattern as `InvitationsTab`).  
In `saveMutation.onSuccess`:
```ts
onSuccess: () => {
  void qc.invalidateQueries({ queryKey: ['admin', 'university', 'domains'] })
  setEditing(false)
  setSuccessMsg('Allowed domains saved.')
  setTimeout(() => setSuccessMsg(null), 4000)
},
```

Render below the domain chips (view mode only):
```tsx
{successMsg && (
  <div style={{ /* green mint strip — same pattern as InvitationsTab */ }}>
    <span style={{ fontSize: 13, color: 'var(--uc-mint)' }}>{successMsg}</span>
    <button onClick={() => setSuccessMsg(null)}>×</button>
  </div>
)}
```

### 2b. `InvitationsTab` — domain error in mutations

**File:** `apps/web/src/pages/AdminPage.tsx`

Both `singleMutation` and `bulkMutation` already show `isError` with "Failed to send. Try again."  
Extend to extract the API error message for `EMAIL_DOMAIN_NOT_ALLOWED`:

```tsx
{singleMutation.isError && (
  <span style={{ fontSize: 13, color: 'var(--uc-orange-l)' }}>
    {getDomainError(singleMutation.error) ?? 'Failed to send. Try again.'}
  </span>
)}
```

Helper:
```ts
function getDomainError(err: unknown): string | null {
  if (!isAxiosError(err)) return null
  const code: string = err.response?.data?.code ?? ''
  if (code === 'EMAIL_DOMAIN_NOT_ALLOWED') return err.response?.data?.error ?? 'Email domain not allowed.'
  return null
}
```

### 2c. `RegisterPage` — domain error copy

**File:** `apps/web/src/pages/RegisterPage.tsx`

In the `catch` block, before the generic 422 branch:
```ts
} else if (status === 422 && code === 'EMAIL_DOMAIN_NOT_ALLOWED') {
  setServerError('Your email domain is not permitted to register at this university.')
} else if (status === 422) {
  setServerError('Please check your details and try again.')
}
```

---

## Section 3 — Shared constants

**File:** `packages/shared/src/constants/socket.ts`

Add:
```ts
export const UNIVERSITY_EVENTS = {
  DOMAINS_UPDATED: 'university:domains_updated',
} as const
```

---

## Data flow after save

```
Admin clicks Save
  → PATCH /admin/university/domains  { allowed_email_domains: [...] }
  → adminService.updateAllowedEmailDomains(universityId, actorId, domains)
      1. SELECT current domains (for audit before-value)
      2. UPDATE universities SET allowed_email_domains = [...]
      3. INSERT university_audit_logs { action: 'domains.updated', payload: { before, after } }
      4. getIo().to(`uni:${universityId}`).emit('university:domains_updated', { allowedEmailDomains })
  → 200 { data: { allowedEmailDomains: [...] } }
  → frontend: invalidateQueries(['admin', 'university', 'domains'])
  → frontend: setEditing(false) + show success strip 4 s
```

---

## Error flow — invite with blocked domain

```
Admin types blocked@blocked.com → Send invite
  → POST /admin/invitations { email, role, expires_in_days }
  → adminService.createInvitation(...)
      1. getAllowedEmailDomains(universityId)  → ['uiu.ac.bd', ...]
      2. domain = 'blocked.com' — not in list
      3. throw badRequest('Invitations are only allowed for: ...', 'EMAIL_DOMAIN_NOT_ALLOWED')
  → 400 { error: 'Invitations are only allowed for: ...', code: 'EMAIL_DOMAIN_NOT_ALLOWED' }
  → frontend InvitationsTab: shows API error message in orange under the Send button
```

---

## Testing notes

- After running `db:migrate`, `university_audit_logs` table must exist.
- `updateAllowedEmailDomains` should be tested with an empty array (clears all domains) and a multi-domain array.
- Invite guard must pass when `allowedEmailDomains` is empty (any domain permitted).
- `EMAIL_DOMAIN_NOT_ALLOWED` path in `RegisterPage` requires a test that mocks the 422 response with that code.
