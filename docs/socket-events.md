# Socket Events

UniConnecT uses Socket.io for real-time feed updates, messaging, notifications, presence and live shuttle tracking. The Socket.io server shares the HTTP server with the Express API (`apps/api/src/socket/index.ts`). It is scaled across instances with the Redis pub/sub adapter, using two duplicated IORedis connections (`pubClient` and `subClient`).

This reference is generated from the actual `.emit(...)` and `socket.on(...)` calls in `apps/api/src`. Named constants live in `packages/shared/src/constants/socket.ts`: `UNIVERSITY_EVENTS`, `CONNECTION_EVENTS`, `CONTENT_SYNC_EVENTS`, `POST_LIFECYCLE_EVENTS`, `GROUP_EVENTS`, `PRESENCE_EVENTS`, `MESSAGE_EVENTS`. Prefer the constant over a string literal when one exists.

---

## Connection & authentication

```typescript
// Client (apps/web/src/lib/socket.ts)
const socket = io(import.meta.env.VITE_SOCKET_URL, {
  auth: { token: accessToken },
})
```

The `io.use` middleware verifies the JWT on every connection attempt:

| Failure | `connect_error` message | Client action |
|---|---|---|
| Missing token | `Unauthorized` | Stay disconnected |
| Expired access token | `TOKEN_EXPIRED` | Refresh silently, then reconnect |
| Invalid token | `Unauthorized` | Stay disconnected |

On success `socket.data.user = { userId, universityId, role }`.

---

## Rooms

| Room | Membership | Purpose |
|---|---|---|
| `uni:{universityId}` | Joined automatically on connect | Feed, news, jobs, events, shuttle, tenant settings |
| `user:{userId}` | Joined automatically on connect | Notifications, badges, connections, mentorship, presence of connections, conversation-list activity, group review queue |
| `conv:{conversationId}` | Joined on `conv:join` (membership-checked) | Messages, typing, read receipts, reactions |

On connect the server also registers presence. On a 0→1 socket transition it broadcasts `presence:update` (online), and on 1→0 it persists `users.last_seen` and broadcasts offline.

---

## Client → server

| Event | Payload | Notes |
|---|---|---|
| `conv:join` | `{ conversationId }` | Joins `conv:{id}` after checking membership. Emits `conv:error { message: 'Not a member' }` back otherwise |
| `conv:leave` | `{ conversationId }` | |
| `conv:typing:start` / `conv:typing:stop` | `{ conversationId }` | Relays `conv:typing` to the room and `conv:list:typing` to each other participant's `user:` room |
| `presence:ping` | — | Heartbeat that refreshes the presence TTL (`PRESENCE_TTL_SECONDS`) |
| `join:conversation` / `leave:conversation` | `convId` | Legacy aliases of `conv:join` / `conv:leave`. `join:conversation` does **not** check membership |
| `typing:start` / `typing:stop` | `{ convId }` | Legacy. Relays both the legacy event and `conv:typing` |
| `join:university` / `leave:university` | `{ universityId }` | Legacy |

---

## Server → client

### Feed & content (room `uni:{universityId}`)

| Event | Payload | Emitted by |
|---|---|---|
| `feed:post:new` | `{ post }` | Post created or published, group post approved, repost |
| `feed:reaction:updated` | `{ postId, reactionCounts }` | Reaction added/removed |
| `feed:comment:new` | `{ postId, comment }` | Comment created |
| `feed:comment:deleted` | `{ postId, commentId }` | Comment deleted |
| `feed:poll:updated` | `{ pollId, … }` | Poll vote |
| `post:published` (`POST_LIFECYCLE_EVENTS.PUBLISHED`) | `{ postId }` | Scheduled post went live (post-lifecycle worker) |
| `post:archived` (`POST_LIFECYCLE_EVENTS.ARCHIVED`) | `{ postId }` | Post archived manually or on expiry |
| `post:shared` (`POST_LIFECYCLE_EVENTS.SHARED`) | `{ postId, sharePost }` | Repost |
| `post:unshared` (`POST_LIFECYCLE_EVENTS.UNSHARED`) | `{ postId, sharePostId }` | Repost removed |
| `news:published` | `{ news }` | News item published |
| `job:created` | `Job` | Job published now (not a scheduled `publish_at`) |
| `event:rsvp` | `{ eventId, userId, status }` | RSVP change or waitlist promotion |
| `shuttle:location` | location row | Driver `POST /shuttle/locations` |
| `university:domains_updated` (`UNIVERSITY_EVENTS.DOMAINS_UPDATED`) | `{ allowedEmailDomains }` | Admin edits the allowed email domains |
| `post:created`, `post:reaction`, `post:comment`, `poll:vote` | — | **Legacy** duplicates of the `feed:*` events, emitted side by side. New code should listen to `feed:*` |

### Messaging (room `conv:{conversationId}`)

| Event | Payload |
|---|---|
| `conv:message:new` | `{ conversationId, message }` |
| `conv:message:updated` (`MESSAGE_EVENTS.UPDATED`) | `{ conversationId, message }`, sent when a message is edited |
| `conv:message:deleted` | `{ conversationId, messageId }` |
| `conv:message:once-opened` (`MESSAGE_EVENTS.ONCE_OPENED`) | `{ conversationId, messageId, userId }`, sent when a view-once photo is opened |
| `conv:typing` | `{ conversationId, userId, isTyping }` |
| `conv:read:ack` | `{ conversationId, userId, readAt }` |
| `message:reaction` | `{ messageId, reactions }` |
| `conversation:updated` | `{ convId, lastMessage }` |
| `message:new`, `message:read`, `typing:start`, `typing:stop` | **Legacy** duplicates |

### Personal (room `user:{userId}`)

| Event | Payload | When |
|---|---|---|
| `notification:new` | `{ notification }` | A notification row was written (`notification:new:legacy` carries the bare row) |
| `notification:read` | `{ notificationId }` | |
| `notification:read-all` | `{}` | |
| `notification:deleted` | `{ notificationId }` | |
| `badge:earned` | badge payload | Badge worker awarded a badge |
| `connection:request_received` (`CONNECTION_EVENTS.REQUEST_RECEIVED`) | request | To the addressee |
| `connection:accepted` (`CONNECTION_EVENTS.ACCEPTED`) | connection | To the requester |
| `presence:update` (`PRESENCE_EVENTS.UPDATE`) | `{ userId, status, lastSeenAt }` | To each accepted connection, subject to the user's online-visibility tier |
| `conv:activity` (`MESSAGE_EVENTS.ACTIVITY`) | `{ conversationId }` | New message, sent to every participant (including the sender) so the list re-sorts |
| `conv:list:typing` (`MESSAGE_EVENTS.LIST_TYPING`) | `{ conversationId, userId, isTyping }` | Typing indicator for list rows |
| `conversation:new` | `{ conversationId }` | Mentorship conversation auto-created on accept |
| `mentorship:request:new` | request | To the alumnus |
| `mentorship:request:accepted` | `{ requestId, conversationId }` | To the student |
| `mentorship:request:updated` | `{ requestId }` | Decline, undo, end, reopen, session request |
| `mentorship:request:expired` | `{ requestId }` | 7-day auto-expiry (mentorship worker) |
| `mentorship:redemption:updated` | redemption | Admin fulfilled a gift-card redemption |
| `job:new_application` | application | To the job poster |
| `job:application_withdrawn` | `{ jobId, applicantId }` | To the job poster |
| `group:review-queue-changed` (`GROUP_EVENTS.REVIEW_QUEUE_CHANGED`) | `{ groupId }` | New pending post/event, sent to owner/admin/moderator |
| `content_sync:run_completed` (`CONTENT_SYNC_EVENTS.RUN_COMPLETED`) | `{ runId, status, itemsNew }` | To the admin who triggered the run |

---

## Emitting from services

Emit **after** the DB write, from the service layer, never from a route handler or controller:

```typescript
import { getIo } from '../../socket'

const [post] = await db('posts').insert(row).returning('*')
getIo().to(`uni:${context.universityId}`).emit('feed:post:new', { post })
```

Workers run in-process in production, so `getIo()` is available there. In a standalone dev worker it may not be, so worker-path emits go through a `safeEmit` wrapper (see `feed/service.ts`) that logs and skips instead of throwing.

## Client-side pattern

Subscribe in a hook, update the TanStack Query cache (or invalidate), and always remove the listener in the effect cleanup:

```typescript
useEffect(() => {
  const onNew = ({ post }: { post: FeedPost }) => { /* setQueryData / invalidate */ }
  socket.on('feed:post:new', onNew)
  return () => { socket.off('feed:post:new', onNew) }
}, [socket])
```
