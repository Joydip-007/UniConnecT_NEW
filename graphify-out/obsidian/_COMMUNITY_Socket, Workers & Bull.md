---
type: community
cohesion: 0.09
members: 51
---

# Socket, Workers & Bull

**Cohesion:** 0.09 - loosely connected
**Members:** 51 nodes

## Members
- [[Badge Queue]] - code - apps/api/src/queues/badge.queue.ts
- [[Badge Worker]] - code - apps/api/src/workers/badge.worker.ts
- [[BadgeQueueJob]] - code - api/src/queues/badge.queue.ts
- [[BadgeRow]] - code - api/src/workers/badge.worker.ts
- [[Email Queue]] - code - apps/api/src/queues/email.queue.ts
- [[Email Worker]] - code - apps/api/src/workers/email.worker.ts
- [[EmailQueueJob]] - code - api/src/queues/email.queue.ts
- [[Group Digest Queue]] - code - apps/api/src/queues/group-digest.queue.ts
- [[Group Digest Worker]] - code - apps/api/src/workers/group-digest.worker.ts
- [[LogMeta]] - code - api/src/utils/logger.ts
- [[Mentorship Queue]] - code - apps/api/src/queues/mentorship.queue.ts
- [[Mentorship Worker]] - code - apps/api/src/workers/mentorship.worker.ts
- [[MentorshipJobType]] - code - api/src/queues/mentorship.queue.ts
- [[Notification Socket Events]] - code - apps/api/src/modules/notifications/service.ts
- [[Notification Worker]] - code - apps/api/src/workers/notification.worker.ts
- [[Socket Gateway]] - code - apps/api/src/socket/index.ts
- [[Socket Rooms and Typing Events]] - code - apps/api/src/socket/index.ts
- [[Workers Bootstrap]] - code - apps/api/src/workers/index.ts
- [[alumniUser]] - code - api/src/workers/mentorship.worker.ts
- [[badges]] - code - api/src/workers/badge.worker.ts
- [[buildContent()]] - code - api/src/workers/notification.worker.ts
- [[bull.ts]] - code - api/src/config/bull.ts
- [[bull.ts_1]] - code - apps/api/src/config/bull.ts
- [[bullQueueOptions]] - code - api/src/config/bull.ts
- [[connectAdapterClients()]] - code - api/src/socket/index.ts
- [[connectIfWaiting()]] - code - api/src/socket/index.ts
- [[createBullRedisClient()]] - code - api/src/config/bull.ts
- [[getActorName()]] - code - api/src/workers/notification.worker.ts
- [[getUniversityId()_1]] - code - api/src/socket/index.ts
- [[groups]] - code - api/src/workers/group-digest.worker.ts
- [[handleTemplateEmail()]] - code - api/src/workers/email.worker.ts
- [[index.ts_29]] - code - api/src/socket/index.ts
- [[index.ts_12]] - code - api/src/workers/index.ts
- [[index.ts_59]] - code - apps/api/src/socket/index.ts
- [[index.ts_42]] - code - apps/api/src/workers/index.ts
- [[inferReferenceType()]] - code - api/src/workers/notification.worker.ts
- [[io]] - code - api/src/workers/badge.worker.ts
- [[isTls]] - code - api/src/config/bull.ts
- [[logger]] - code - api/src/utils/logger.ts
- [[logger.ts]] - code - api/src/utils/logger.ts
- [[logger.ts_1]] - code - apps/api/src/utils/logger.ts
- [[members]] - code - api/src/workers/group-digest.worker.ts
- [[parseTemplatePayload()]] - code - api/src/workers/email.worker.ts
- [[postIds]] - code - api/src/workers/group-digest.worker.ts
- [[readString()]] - code - api/src/workers/notification.worker.ts
- [[request]] - code - api/src/workers/mentorship.worker.ts
- [[setupSocket()]] - code - api/src/socket/index.ts
- [[sevenDaysAgo_1]] - code - api/src/workers/group-digest.worker.ts
- [[topPosts]] - code - api/src/workers/group-digest.worker.ts
- [[universities]] - code - api/src/workers/group-digest.worker.ts
- [[write()]] - code - api/src/utils/logger.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Socket_Workers__Bull
SORT file.name ASC
```

## Connections to other communities
- 22 edges to [[_COMMUNITY_App Config & Express]]
- 12 edges to [[_COMMUNITY_Community 78]]
- 11 edges to [[_COMMUNITY_Notifications Backend]]
- 7 edges to [[_COMMUNITY_Community 68]]
- 6 edges to [[_COMMUNITY_Community 59]]
- 6 edges to [[_COMMUNITY_Community 45]]
- 6 edges to [[_COMMUNITY_Feed Backend Module]]
- 6 edges to [[_COMMUNITY_Jobs Backend Module]]
- 6 edges to [[_COMMUNITY_News Backend]]
- 6 edges to [[_COMMUNITY_Mentorship Backend]]
- 6 edges to [[_COMMUNITY_Server Core & Middleware]]
- 4 edges to [[_COMMUNITY_Integration Test Suite]]
- 4 edges to [[_COMMUNITY_Messages Backend]]
- 4 edges to [[_COMMUNITY_Admin Controller Logic]]
- 4 edges to [[_COMMUNITY_Community 67]]
- 3 edges to [[_COMMUNITY_Community 151]]
- 2 edges to [[_COMMUNITY_Middleware & Explore API]]
- 2 edges to [[_COMMUNITY_Admin Invitations & Reports]]
- 2 edges to [[_COMMUNITY_Campus Tools Backend]]
- 2 edges to [[_COMMUNITY_Connections Backend]]
- 2 edges to [[_COMMUNITY_Events Backend Module]]

## Top bridge nodes
- [[index.ts_29]] - degree 28, connects to 16 communities
- [[index.ts_59]] - degree 28, connects to 16 communities
- [[logger]] - degree 26, connects to 7 communities
- [[logger.ts]] - degree 18, connects to 7 communities
- [[logger.ts_1]] - degree 18, connects to 7 communities