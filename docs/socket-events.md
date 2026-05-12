# Socket Events

UniConnecT uses Socket.io for real-time messaging, notifications, online presence, and live shuttle tracking. The Socket.io server shares the same HTTP server as the Express API.

---

## Connection & Authentication

```typescript
// Client — connect with access token in auth handshake
import { io } from 'socket.io-client';

const socket = io(import.meta.env.VITE_SOCKET_URL, {
  auth: { token: accessToken },
  reconnection: true,
  reconnectionAttempts: 5,
});

socket.on('connect', () => console.log('connected:', socket.id));
socket.on('connect_error', (err) => console.error('auth failed:', err.message));
```

The server middleware verifies the JWT on every connection attempt. On expiry the client receives `connect_error` with `message: 'TOKEN_EXPIRED'` — trigger a refresh and reconnect.

---

## Room Structure

| Room | Membership | Purpose |
|------|------------|---------|
| `uni:{universityId}` | All connected users of that university | Feed activity, news, public events |
| `user:{userId}` | Only that user | Personal notifications, DMs |
| `conv:{conversationId}` | Participants of that conversation | Messages, typing, read receipts |

Rooms are joined automatically on authentication. Conversation rooms are joined lazily when the user opens a conversation.

```typescript
// Server — socket setup (apps/api/src/sockets/index.ts)
io.use(verifyTokenMiddleware);

io.on('connection', (socket) => {
  const { universityId, userId } = socket.data.user;
  socket.join(`uni:${universityId}`);
  socket.join(`user:${userId}`);

  socket.on('conv:join', ({ conversationId }) => {
    socket.join(`conv:${conversationId}`);
  });

  socket.on('disconnect', () => {
    removeOnlineUser(universityId, userId);
  });
});
```

---

## Event Reference

### Convention

```
client → server   client emits, server listens
server → client   server emits, client listens
```

All event payloads are JSON objects. All IDs are UUIDs.

---

### Connection lifecycle

| Event | Direction | Payload | Notes |
|-------|-----------|---------|-------|
| `connect` | server → client | `{}` | Successfully authenticated |
| `connect_error` | server → client | `{ message: 'TOKEN_EXPIRED' \| 'UNAUTHORIZED' }` | Auth failed |
| `disconnect` | server → client | `{ reason: string }` | |

---

### Feed events (room: `uni:{universityId}`)

| Event | Direction | Payload |
|-------|-----------|---------|
| `feed:post:new` | server → client | `{ post: Post }` |
| `feed:post:updated` | server → client | `{ postId: string, changes: Partial<Post> }` |
| `feed:post:deleted` | server → client | `{ postId: string }` |
| `feed:reaction:new` | server → client | `{ postId: string, reactionType: string, count: number }` |
| `feed:comment:new` | server → client | `{ postId: string, comment: Comment }` |
| `feed:poll:updated` | server → client | `{ pollId: string, options: PollOption[] }` |
| `news:published` | server → client | `{ news: NewsItem }` |

---

### Messaging events (room: `conv:{conversationId}`)

| Event | Direction | Payload |
|-------|-----------|---------|
| `conv:join` | client → server | `{ conversationId: string }` |
| `conv:leave` | client → server | `{ conversationId: string }` |
| `conv:message:new` | server → client | `{ conversationId: string, message: Message }` |
| `conv:message:deleted` | server → client | `{ conversationId: string, messageId: string }` |
| `conv:typing:start` | client → server | `{ conversationId: string }` |
| `conv:typing:stop` | client → server | `{ conversationId: string }` |
| `conv:typing` | server → client | `{ conversationId: string, userId: string, isTyping: boolean }` |
| `conv:read` | client → server | `{ conversationId: string }` |
| `conv:read:ack` | server → client | `{ conversationId: string, userId: string, readAt: string }` |

**Typing throttle:** client should emit `conv:typing:start` at most once every 2 seconds. Emit `conv:typing:stop` when input is cleared or on blur.

---

### Notification events (room: `user:{userId}`)

| Event | Direction | Payload |
|-------|-----------|---------|
| `notification:new` | server → client | `{ notification: Notification }` |
| `notification:read` | server → client | `{ notificationId: string }` |
| `notification:read-all` | server → client | `{}` |
| `badge:awarded` | server → client | `{ badge: Badge, pointsTotal: number }` |

---

### Presence events (room: `uni:{universityId}`)

| Event | Direction | Payload |
|-------|-----------|---------|
| `presence:online` | server → client | `{ userId: string }` |
| `presence:offline` | server → client | `{ userId: string }` |
| `presence:list` | client → server | `{ userIds: string[] }` |
| `presence:list:ack` | server → client | `{ online: string[] }` — subset of queried userIds |

Use `presence:list` to check a batch of user IDs when rendering a conversation participant list or a profiles page. Avoid querying presence for every user individually.

---

### Shuttle tracking (room: `uni:{universityId}`)

| Event | Direction | Payload |
|-------|-----------|---------|
| `shuttle:location` | server → client | `{ routeId: string, lat: number, lng: number, speedKmh: number, headingDeg: number, updatedAt: string }` |
| `shuttle:watch` | client → server | `{ routeId: string }` — subscribe to a specific route |
| `shuttle:unwatch` | client → server | `{ routeId: string }` |

The server emits `shuttle:location` every time a driver POSTs a new GPS coordinate. The client only receives updates for routes it has subscribed to via `shuttle:watch`.

---

### Mentorship events (room: `user:{userId}`)

| Event | Direction | Payload |
|-------|-----------|---------|
| `mentorship:request` | server → client | `{ request: MentorshipRequest }` — alumni receives |
| `mentorship:updated` | server → client | `{ requestId: string, status: string }` — student receives |

---

## Error Events

| Event | Payload | When emitted |
|-------|---------|-------------|
| `error` | `{ code: string, message: string }` | Server-side socket error |
| `rate_limited` | `{ retryAfter: number }` | Too many events from client (seconds until retry) |

---

## Client-Side Pattern (React)

```typescript
// apps/web/src/hooks/useSocket.ts
import { useEffect } from 'react';
import { socket } from '../lib/socket';
import { useQueryClient } from '@tanstack/react-query';

export function useFeedSocket(universityId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    function onNewPost({ post }: { post: Post }) {
      queryClient.setQueryData(['posts', 'feed', { universityId }], (old) =>
        old ? { ...old, pages: [{ items: [post, ...old.pages[0].items] }, ...old.pages.slice(1)] } : old
      );
    }

    socket.on('feed:post:new', onNewPost);
    return () => { socket.off('feed:post:new', onNewPost); };
  }, [universityId, queryClient]);
}
```

Always clean up listeners in the `useEffect` return function. Never add the same listener twice — prefer a single socket hook per event type.

---

## Emitting from Services (Server)

```typescript
// apps/api/src/services/posts.ts
import { getIO } from '../sockets';

export async function createPost(db, universityId, authorId, body) {
  const [post] = await db('posts').insert({ ...body, university_id: universityId, author_id: authorId }).returning('*');
  const enriched = await enrichPost(db, post, authorId);

  // Emit AFTER successful DB write
  getIO().to(`uni:${universityId}`).emit('feed:post:new', { post: enriched });

  // Queue notification job
  await notificationQueue.add({ type: 'new_post', postId: post.id });

  return enriched;
}
```

`getIO()` returns the singleton `io` instance initialised in `apps/api/src/sockets/index.ts`.
