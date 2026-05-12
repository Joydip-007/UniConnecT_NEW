# API Reference

**Base URL:** `https://api.uniconnect.app/api/v1` (production) · `http://localhost:4000/api/v1` (dev)

All endpoints return JSON. Authentication uses a Bearer token in the `Authorization` header unless noted.

---

## Conventions

### Request headers
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

### Success response
```json
{ "data": <payload> }
```

### Error response
```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE"
}
```

### Common error codes
| Code | HTTP | Meaning |
|------|------|---------|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Authenticated but not permitted |
| `NOT_FOUND` | 404 | Resource does not exist |
| `VALIDATION_ERROR` | 422 | Request body failed Zod schema |
| `RATE_LIMITED` | 429 | Too many requests |
| `CONFLICT` | 409 | Unique constraint violation |

### Pagination
List endpoints accept `?page=1&limit=20`. Response includes:
```json
{
  "data": { "items": [...], "total": 120, "page": 1, "limit": 20, "hasMore": true }
}
```

---

## Auth

### `POST /auth/register`
Create a new user account (requires a valid invitation token).
```json
// body
{ "token": "inv_abc123", "password": "min8chars", "fullName": "Joydip Datta" }

// response 201
{ "data": { "user": { "id": "uuid", "email": "jd@uiu.ac.bd", "role": "student" }, "accessToken": "..." } }
```

### `POST /auth/login`
```json
// body
{ "email": "jd@uiu.ac.bd", "password": "..." }

// response 200  — also sets httpOnly refreshToken cookie
{ "data": { "user": {...}, "accessToken": "..." } }
```

### `POST /auth/logout`
Revokes the refresh token. Requires auth.
```json
// response 204 — no body
```

### `POST /auth/refresh`
Issue a new access token using the refresh token cookie. No body required.
```json
// response 200
{ "data": { "accessToken": "..." } }
```

### `POST /auth/verify-otp`
```json
// body
{ "email": "jd@uiu.ac.bd", "otp": "481923" }
// response 200
{ "data": { "verified": true } }
```

### `GET /auth/me`
Returns the authenticated user + profile.
```json
{ "data": { "id": "uuid", "email": "...", "role": "student", "profile": { ... } } }
```

---

## Users & Profiles

### `GET /users/:id`
Public profile of any user in the same university.
```json
{ "data": { "id": "uuid", "fullName": "...", "role": "student", "profile": {...}, "followersCount": 94 } }
```

### `PATCH /users/me`
Update own profile. Requires auth.
```json
// body (all optional)
{
  "fullName": "Joydip Datta",
  "bio": "CSE student, building UniConnecT",
  "avatarUrl": "https://s3.amazonaws.com/...",
  "coverUrl": "https://s3.amazonaws.com/...",
  "headline": "Software Engineer @ UIU",
  "department": "CSE",
  "batchYear": "2022",
  "linkedinUrl": "https://linkedin.com/in/...",
  "phone": "+8801...",
  "skills": ["React", "Node.js", "PostgreSQL"],
  "isOpenToWork": true
}
```

### `POST /users/:id/follow`
Follow a user. Requires auth.
```json
// response 201
{ "data": { "following": true } }
```

### `DELETE /users/:id/follow`
```json
// response 200
{ "data": { "following": false } }
```

### `GET /users/:id/followers`
```json
{ "data": { "items": [{ "id": "uuid", "fullName": "...", "profile": {...} }], ... } }
```

### `GET /users/:id/following`
Same shape as followers.

### `GET /users/suggestions`
People you may know (mutual connections, same department/batch). Requires auth.

---

## Posts

### `GET /posts`
Home feed. Requires auth. Supports `?type=post|announcement|event_promo&groupId=uuid`.
```json
{ "data": { "items": [<Post>, ...], "total": 342, "page": 1, ... } }
```

**Post object:**
```json
{
  "id": "uuid",
  "type": "post",
  "content": "Just shipped the prototype!",
  "mediaUrls": [],
  "author": { "id": "uuid", "fullName": "Joydip Datta", "profile": {...} },
  "isPinned": false,
  "viewCount": 142,
  "reactionCounts": { "like": 48, "love": 3, "insightful": 12, "celebrate": 5 },
  "myReaction": "like",
  "commentCount": 12,
  "isSaved": false,
  "poll": null,
  "createdAt": "2026-05-11T10:00:00Z"
}
```

### `POST /posts`
```json
// body
{
  "type": "post",
  "content": "...",
  "mediaUrls": ["https://s3..."],
  "groupId": null,
  "poll": {
    "question": "Which stack?",
    "options": ["React + Node", "Next.js + Supabase"],
    "expiresAt": "2026-05-18T00:00:00Z"
  }
}
// response 201 → Post object
```

### `GET /posts/:id` · `PATCH /posts/:id` · `DELETE /posts/:id`
Owner or admin only for PATCH/DELETE.

### `POST /posts/:id/reactions`
```json
// body
{ "reactionType": "like" }  // like | love | insightful | celebrate
// response 201 or 200 (updates existing reaction)
```

### `DELETE /posts/:id/reactions`
Remove own reaction. Response 204.

### `POST /posts/:id/save` · `DELETE /posts/:id/save`
Save or unsave a post for the authenticated user.

### `GET /posts/:id/comments`
Supports `?parentId=uuid` to fetch replies for a specific comment.
```json
{ "data": { "items": [<Comment>, ...] } }
```

**Comment object:** `{ "id", "content", "author", "parentId", "replyCount", "createdAt" }`

### `POST /posts/:id/comments`
```json
// body
{ "content": "Great work!", "parentId": null }
// response 201 → Comment object
```

### `POST /polls/:pollId/vote`
```json
// body
{ "optionId": "uuid" }
// response 201 · 409 CONFLICT if already voted
```

---

## Jobs

### `GET /jobs`
```
?type=full_time|part_time|internship|remote|contract
?isActive=true
?search=engineer
```

**Job object:**
```json
{
  "id": "uuid",
  "title": "Software Engineering Intern",
  "company": "Pathao Bangladesh",
  "location": "Remote",
  "type": "internship",
  "description": "...",
  "requirements": ["React.js", "Node.js"],
  "salaryRange": "15,000–20,000 BDT/month",
  "applicationUrl": null,
  "deadline": "2026-06-01T00:00:00Z",
  "postedBy": { "id": "uuid", "fullName": "Saem Ferdous", "profile": {...} },
  "applicationCount": 23,
  "myApplication": null,
  "isSaved": false,
  "viewCount": 312
}
```

### `POST /jobs`
Alumni and staff only.
```json
// body
{
  "title": "...", "company": "...", "location": "...", "type": "internship",
  "description": "...", "requirements": [...], "salaryRange": "...",
  "applicationUrl": null, "deadline": "2026-06-01T00:00:00Z"
}
// response 201 → Job object
```

### `GET /jobs/:id` · `PATCH /jobs/:id` · `DELETE /jobs/:id`

### `POST /jobs/:id/apply`
Student only. `409 CONFLICT` if already applied.
```json
// body
{ "resumeUrl": "https://s3...", "coverLetter": "..." }
// response 201 → JobApplication object
```

### `GET /jobs/:id/applications`
Job poster / admin only. Returns list of `JobApplication` objects.

### `PATCH /jobs/:id/applications/:applicationId`
Update application status. Job poster / admin only.
```json
// body
{ "status": "shortlisted", "notes": "Strong React background" }
// status enum: pending | reviewed | shortlisted | interviewed | offered | rejected
```

### `POST /jobs/:id/save` · `DELETE /jobs/:id/save`

---

## Events

### `GET /events`
```
?type=general|career_fair|seminar|alumni_meetup|workshop|club
?from=2026-05-01&to=2026-06-30
```

**Event object:**
```json
{
  "id": "uuid",
  "title": "Career Fair 2026",
  "description": "...",
  "location": "UIU Campus, Madani Ave",
  "isOnline": false,
  "onlineLink": null,
  "coverUrl": "https://s3...",
  "startsAt": "2026-05-16T10:00:00Z",
  "endsAt": "2026-05-16T16:00:00Z",
  "capacity": 500,
  "type": "career_fair",
  "organizer": { "id": "uuid", "fullName": "UIU Career Club" },
  "rsvpCounts": { "going": 148, "maybe": 34, "not_going": 12 },
  "myRsvp": "going"
}
```

### `POST /events`
Staff / admin only.

### `GET /events/:id` · `PATCH /events/:id` · `DELETE /events/:id`

### `POST /events/:id/rsvp`
```json
// body
{ "status": "going" }  // going | maybe | not_going
// response 201 or 200 (updates existing RSVP)
```

---

## Groups

### `GET /groups`
Lists all groups in the university. Supports `?type=department|club|batch|research|interest`.

**Group object:**
```json
{
  "id": "uuid",
  "name": "CSE Batch 2022",
  "description": "...",
  "type": "batch",
  "avatarUrl": "...",
  "isPrivate": false,
  "memberCount": 87,
  "myRole": "member"
}
```

### `POST /groups`
Any authenticated user.
```json
// body
{ "name": "...", "description": "...", "type": "club", "isPrivate": false }
```

### `GET /groups/:id` · `PATCH /groups/:id` · `DELETE /groups/:id`
PATCH/DELETE: owner or admin only.

### `POST /groups/:id/join` · `DELETE /groups/:id/leave`

### `GET /groups/:id/members`
Returns members with their roles.

### `PATCH /groups/:id/members/:userId`
Group owner / group admin only.
```json
// body
{ "role": "admin" }  // admin | moderator | member
```

---

## Conversations & Messages

### `GET /conversations`
Lists all conversations for the authenticated user, ordered by last message.

**Conversation object:**
```json
{
  "id": "uuid",
  "name": null,
  "isGroup": false,
  "participants": [{ "id": "uuid", "fullName": "...", "profile": {...}, "isOnline": true }],
  "lastMessage": { "content": "Let's meet tomorrow", "sentAt": "...", "senderId": "uuid" },
  "unreadCount": 2
}
```

### `POST /conversations`
Start a new DM or group chat.
```json
// body
{ "participantIds": ["uuid", "uuid"], "name": null }
// Response 201 → Conversation object (or existing DM if already exists)
```

### `GET /conversations/:id`

### `GET /conversations/:id/messages`
Supports `?before=messageId` for cursor-based pagination (newest first).

**Message object:**
```json
{
  "id": "uuid",
  "content": "Hey, are you available?",
  "mediaUrls": [],
  "type": "text",
  "sender": { "id": "uuid", "fullName": "...", "profile": {...} },
  "replyTo": null,
  "isDeleted": false,
  "createdAt": "2026-05-11T10:32:00Z"
}
```

### `POST /conversations/:id/messages`
```json
// body
{ "content": "...", "mediaUrls": [], "replyToId": null }
// response 201 → Message object
// Also emits socket event to conv:{conversationId} room
```

### `DELETE /conversations/:id/messages/:messageId`
Sets `isDeleted = true`. Content replaced with "Message deleted" on client.

### `POST /conversations/:id/read`
Mark all messages as read up to now. Updates `last_read_at` in `conversation_participants`.

---

## Notifications

### `GET /notifications`
Supports `?isRead=false` to filter unread.
```json
{
  "data": {
    "items": [{
      "id": "uuid",
      "type": "like",
      "content": "Saem liked your post",
      "actor": { "id": "uuid", "fullName": "Saem Ferdous", "profile": {...} },
      "referenceId": "post-uuid",
      "referenceType": "post",
      "isRead": false,
      "createdAt": "..."
    }],
    "unreadCount": 7
  }
}
```

### `PATCH /notifications/:id/read`
### `POST /notifications/read-all`

---

## News

### `GET /news`
Supports `?category=academic|events|campus`.

### `POST /news`
Staff / admin only.
```json
// body
{ "title": "...", "body": "...", "coverUrl": "...", "category": "academic", "isPublished": true }
```

### `GET /news/:id` · `PATCH /news/:id` · `DELETE /news/:id`

---

## Lost & Found

### `GET /lost-found`
Supports `?type=lost|found&isResolved=false`.

### `POST /lost-found`
```json
// body
{
  "type": "lost",
  "itemName": "UIU ID Card",
  "description": "Has a blue sticker on bottom-right corner",
  "images": ["https://s3..."],
  "locationDetail": "Floor 4 cafeteria",
  "contactInfo": "+880 1700 000000"
}
```

### `PATCH /lost-found/:id/resolve`
Sets `isResolved = true`. Owner only.

---

## Mentorship

### `GET /mentorship/requests`
Students see their sent requests. Alumni see received requests.

### `POST /mentorship/request`
Student only.
```json
// body
{ "alumniId": "uuid", "message": "I'd love advice on transitioning to product management." }
```

### `PATCH /mentorship/:id`
Alumni updates status.
```json
// body
{ "status": "accepted", "sessionNotes": "Discussed PM transition roadmap." }
// status: accepted | declined | completed
```

---

## Shuttle Tracker

### `GET /shuttle/routes`
Returns all active routes with stop names and schedule.

### `GET /shuttle/locations`
Returns latest GPS location for each active route's bus.

### `POST /shuttle/locations`
Driver only — authenticated user with shuttle driver permissions.
```json
// body
{ "routeId": "uuid", "lat": 23.8041, "lng": 90.4152, "speedKmh": 28.5, "headingDeg": 180.0 }
```

---

## Badges & Gamification

### `GET /badges`
All available badges with trigger conditions and points.

### `GET /users/:id/badges`
Earned badges for a user.

---

## Upload

### `POST /upload/presign`
Returns a presigned S3 PUT URL. See [Architecture — File Upload Flow](architecture.md#file-upload-flow).
```json
// body
{ "fileName": "avatar.jpg", "fileType": "image/jpeg", "folder": "avatars" }

// response 200
{
  "data": {
    "uploadUrl": "https://s3.amazonaws.com/...?X-Amz-Signature=...",
    "publicUrl": "https://cdn.uniconnect.app/avatars/uuid.jpg",
    "expiresIn": 300
  }
}
```

---

## Admin

All admin routes require `role: admin`.

### `GET /admin/users`
Paginated user list with filters: `?role=student&isActive=true&search=joydip`.

### `PATCH /admin/users/:id`
```json
// body
{ "isActive": false, "role": "staff" }
```

### `GET /admin/stats`
```json
{
  "data": {
    "totalUsers": 1420, "activeToday": 234,
    "postsThisWeek": 312, "jobsActive": 18,
    "eventsUpcoming": 4, "reportsPending": 2
  }
}
```

### `PATCH /admin/settings`
Updates `university_settings` for the tenant.
```json
// body
{ "primaryColor": "#1a56db", "allowAlumniJobs": true, "allowPublicFeed": false }
```

### `GET /admin/reports`
Content moderation queue. Supports `?status=pending`.

### `PATCH /admin/reports/:id`
```json
// body
{ "status": "resolved" }  // reviewed | resolved | dismissed
```

---

## Search

### `GET /search`
```
?q=joydip&type=users|posts|jobs|events|groups
```
Returns up to 5 results per type (or 20 if type is specified). All results scoped to the authenticated user's university.

---

## Rate Limits

| Route group | Limit |
|-------------|-------|
| `/auth/login` | 10 req / 15 min per IP |
| `/auth/register` | 5 req / hour per IP |
| `/upload/presign` | 30 req / hour per user |
| General API | 300 req / min per user |
| Search | 60 req / min per user |
