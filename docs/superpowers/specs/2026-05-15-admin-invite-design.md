# Admin Invite — Design Spec
**Date:** 2026-05-15  
**Project:** UniConnecT  
**Status:** Approved

---

## Goal

Enhance the admin panel's "Invitations" tab (renamed to "Invite") so admins can send single or bulk email invitations. Each invited email receives a message containing their personal registration link (`/register/:token`) so they can self-onboard with the correct role.

Currently, `createInvitation` only inserts a DB row — no email is sent. This feature wires up email delivery for both single and bulk flows.

---

## Architecture

### Backend

#### 1. Email template — `sendInvitationEmail`
Add method to `apps/api/src/services/email.service.ts`:

```ts
sendInvitationEmail(to: string, registerUrl: string, role: string, universityName: string): Promise<EmailResult>
```

- Subject: `"You're invited to join UniConnecT"`
- Body: role the person is being invited as, CTA button → `registerUrl`
- `registerUrl` = `${env.WEB_URL}/register/${token}`
- Tagged `category: invitation`

#### 2. Email worker — new `invitation` template branch
`apps/api/src/workers/email.worker.ts` — add an `if (parsed.template === 'invitation')` branch in `handleTemplateEmail`. Payload fields: `registerUrl`, `role`, `universityName`.

The email queue job `text` field carries a JSON string:
```json
{ "template": "invitation", "userName": "", "registerUrl": "...", "role": "student", "universityName": "UIU" }
```

`userName` is intentionally empty string — the invitation email uses a generic greeting ("You've been invited to join UniConnecT") since the recipient has not yet created an account. The existing `parseTemplatePayload` check (`typeof parsed.userName !== 'string'`) passes because `""` is a valid string.

#### 3. Wire email into single invite
`apps/api/src/modules/admin/service.ts` — `createInvitation`:  
After the DB insert, enqueue one `emailQueue` job with the invitation template payload. Non-blocking; HTTP response returns immediately.

#### 4. Bulk schema
`apps/api/src/modules/admin/schema.ts`:

```ts
CreateBulkInvitationsSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(50),
  role: z.enum(['student', 'alumni', 'staff', 'admin']).default('student'),
  expires_in_days: z.number().int().min(1).max(30).default(7),
})
```

#### 5. `createBulkInvitations` service method
`apps/api/src/modules/admin/service.ts`:

- Wraps in a single Knex transaction
- Generates one `crypto.randomBytes(32).toString('hex')` token per email
- Bulk-inserts all invitation rows in one `db('invitations').insert([...]).transacting(trx)`
- After transaction commits: enqueues one email job per address (outside the transaction — fire-and-forget)
- Returns `{ created: number, emails: string[] }`

Max 50 emails per request to prevent abuse.

#### 6. New route
`apps/api/src/modules/admin/router.ts`:

```
POST /admin/invitations/bulk   requireRole('admin')   validate(CreateBulkInvitationsSchema)
```

New controller handler `createBulkInvitations` in `controller.ts`.

---

### Frontend

#### Tab rename
`apps/web/src/pages/AdminPage.tsx` — `TABS` array: change label `'Invitations'` → `'Invite'`. The `value` key stays `'invitations'` (no other references to change).

#### `InvitationsTab` — send panel
A persistent card at the top of the tab (always visible, replaces the "New invitation" button + collapsible form pattern).

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Send invite            [Single ●───○ Multiple]      │
│                                                      │
│  [Single mode]                                       │
│  Email ________________  Role ______  Expiry ____    │
│  [ Send invite ]                                     │
│                                                      │
│  [Multiple mode]                                     │
│  Role ______  Expiry ____                            │
│  ┌──────────────────────────────────────────────┐   │
│  │ Enter emails separated by commas,            │   │
│  │ e.g. alice@uiu.ac.bd, bob@uiu.ac.bd, …       │   │
│  └──────────────────────────────────────────────┘   │
│  [ Send 3 invites ]  ← count updates live            │
└─────────────────────────────────────────────────────┘
```

**Toggle** — pill-style `Single | Multiple` switch, styled with `var(--uc-indigo-bg)` active state. Toggling to Multiple animates the textarea in (CSS `max-height` transition). Toggling back resets textarea content and errors.

**Live count** — in multiple mode, the button label reads "Send N invites" where N = count of valid unique emails parsed from the textarea (split on `,` and `\n`, trim whitespace, filter valid email format). Invalid entries are silently excluded from the count.

**Mutations:**
- Single → `POST /admin/invitations` (existing endpoint)
- Multiple → `POST /admin/invitations/bulk` (new endpoint)
- Both call `queryClient.invalidateQueries({ queryKey: ['admin', 'invitations'] })` on success

**Success feedback** — inline dismissible banner below the send button:
- Single: "Invitation sent to alice@uiu.ac.bd"
- Bulk: "3 invitations sent"
- Green tint using `var(--uc-mint-bg)` / `var(--uc-mint-l)` tokens
- Auto-dismisses after 5 seconds or on manual close

**Error feedback** — inline below the button using `var(--uc-orange-l)` for the message text.

**Past invitations list** — unchanged, paginated, rendered below the send panel.

---

## Data flow

```
Admin fills form → clicks Send
  → [single]  POST /admin/invitations       → DB insert → emailQueue.add(invitation job)
  → [bulk]    POST /admin/invitations/bulk  → DB transaction (N rows) → N × emailQueue.add()
                                                    ↓
                                            email.worker processes job
                                                    ↓
                                            emailService.sendInvitationEmail(to, registerUrl, role, uniName)
                                                    ↓
                                            Resend API delivers email
                                                    ↓
                                            Recipient clicks link → /register/:token
```

---

## Error handling

- Duplicate email in bulk list: deduplicate silently on the frontend before sending; backend also deduplicates at parse time.
- Duplicate token in DB (extremely unlikely with 32-byte random): Knex will throw a unique constraint error → 409 from `AppError`.
- Email send failure (Resend API down): job fails in Bull → retried per Bull default retry policy (3 attempts). Invitation row remains in DB; admin can see it in the list and resend manually if needed.
- Bulk > 50 emails: rejected by Zod schema validation with a 422 from `errorHandler`.

---

## Constraints

- Max 50 emails per bulk request (Zod schema + frontend validation)
- Invitation expiry range: 1–30 days (unchanged from existing schema)
- `WEB_URL` env var in `apps/api/.env` must be set correctly for the registration link in the email (`http://localhost:5173` in dev, production URL in prod)
- No new dependencies required — uses existing Bull queue, Resend client, and Knex

---

## Files touched

| File | Change |
|------|--------|
| `apps/api/src/services/email.service.ts` | Add `sendInvitationEmail` method + HTML template |
| `apps/api/src/workers/email.worker.ts` | Add `invitation` branch in `handleTemplateEmail` |
| `apps/api/src/modules/admin/schema.ts` | Add `CreateBulkInvitationsSchema` |
| `apps/api/src/modules/admin/service.ts` | Wire email into `createInvitation`; add `createBulkInvitations` |
| `apps/api/src/modules/admin/controller.ts` | Add `createBulkInvitations` handler |
| `apps/api/src/modules/admin/router.ts` | Add `POST /admin/invitations/bulk` route |
| `apps/web/src/pages/AdminPage.tsx` | Rename tab, rewrite `InvitationsTab` send panel |
