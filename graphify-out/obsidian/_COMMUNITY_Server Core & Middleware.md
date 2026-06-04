---
type: community
cohesion: 0.05
members: 63
---

# Server Core & Middleware

**Cohesion:** 0.05 - loosely connected
**Members:** 63 nodes

## Members
- [[API Response Helpers]] - code - apps/api/src/utils/response.ts
- [[API Server Bootstrap]] - code - apps/api/src/server.ts
- [[API TypeScript Config]] - code - apps/api/tsconfig.json
- [[App Error Helpers]] - code - apps/api/src/utils/errors.ts
- [[Application Error Contract]] - code - apps/api/src/utils/errors.ts
- [[Async Express Handler]] - code - apps/api/src/utils/asyncHandler.ts
- [[Auth Context]] - code - apps/api/src/types/auth.ts
- [[Badge Activity Count]] - code - apps/api/src/workers/badge.worker.ts
- [[Badge Award Worker]] - code - apps/api/src/workers/badge.worker.ts
- [[Conversation Socket Rooms]] - code - apps/api/src/socket/index.ts
- [[Email Queue Worker]] - code - apps/api/src/workers/email.worker.ts
- [[Events Search]] - code - apps/api/src/modules/search/service.ts
- [[Express Request Context]] - code - apps/api/src/types/express.d.ts
- [[Graceful Shutdown]] - code - apps/api/src/server.ts
- [[Group Digest Notifications]] - code - apps/api/src/workers/group-digest.worker.ts
- [[GroupResultCard Optimistic Membership Toggle]] - code - apps/web/src/features/search/components/GroupResultCard.tsx
- [[GroupResultCard Search Result Row]] - code - apps/web/src/features/search/components/GroupResultCard.tsx
- [[Groups Search]] - code - apps/api/src/modules/search/service.ts
- [[Jobs Search]] - code - apps/api/src/modules/search/service.ts
- [[Mentorship Bull Queue]] - code - apps/api/src/queues/mentorship.queue.ts
- [[Mentorship Queue Worker]] - code - apps/api/src/workers/mentorship.worker.ts
- [[Mentorship Request Expiry]] - code - apps/api/src/workers/mentorship.worker.ts
- [[Mentorship Request Reminder]] - code - apps/api/src/workers/mentorship.worker.ts
- [[Notification Bull Queue]] - code - apps/api/src/queues/notification.queue.ts
- [[Notification Content Builder]] - code - apps/api/src/workers/notification.worker.ts
- [[Notification Queue Worker]] - code - apps/api/src/workers/notification.worker.ts
- [[Notification Reference Inference]] - code - apps/api/src/workers/notification.worker.ts
- [[Notifications Controller]] - code - apps/api/src/modules/notifications/controller.ts
- [[People Search]] - code - apps/api/src/modules/search/service.ts
- [[PeopleResultCard Search Result Row]] - code - apps/web/src/features/search/components/PeopleResultCard.tsx
- [[PostResultCard Post Age Formatter]] - code - apps/web/src/features/search/components/PostResultCard.tsx
- [[PostResultCard Search Result Row]] - code - apps/web/src/features/search/components/PostResultCard.tsx
- [[Posts Search]] - code - apps/api/src/modules/search/service.ts
- [[Refresh Cookie Helpers]] - code - apps/api/src/utils/cookies.ts
- [[Refresh Token Cookie Helpers]] - code - apps/api/src/utils/cookies.ts
- [[Search All Aggregator]] - code - apps/api/src/modules/search/service.ts
- [[Search Controller]] - code - apps/api/src/modules/search/controller.ts
- [[Search Feature Public Exports]] - code - apps/web/src/features/search/index.ts
- [[Search Result DTOs]] - code - apps/api/src/modules/search/service.ts
- [[Search Result Type Contracts]] - code - apps/web/src/features/search/types.ts
- [[Search Service]] - code - apps/api/src/modules/search/service.ts
- [[SearchPanel All Tab Aggregator]] - code - apps/web/src/features/search/components/SearchPanel.tsx
- [[SearchPanel Overlay and Tab Shell]] - code - apps/web/src/features/search/components/SearchPanel.tsx
- [[SearchPanel Paginated Category Tabs]] - code - apps/web/src/features/search/components/SearchPanel.tsx
- [[Socket Payload Extractors]] - code - apps/api/src/socket/index.ts
- [[Socket Server Accessor]] - code - apps/api/src/socket/index.ts
- [[Socket Token Authentication]] - code - apps/api/src/socket/index.ts
- [[Socket.IO Server Setup]] - code - apps/api/src/socket/index.ts
- [[Structured Logger]] - code - apps/api/src/utils/logger.ts
- [[University Socket Rooms]] - code - apps/api/src/socket/index.ts
- [[Upload Controller]] - code - apps/api/src/modules/upload/controller.ts
- [[Users Controller]] - code - apps/api/src/modules/users/controller.ts
- [[Users Router]] - code - apps/api/src/modules/users/router.ts
- [[Users Validation Schemas]] - code - apps/api/src/modules/users/schema.ts
- [[Weekly Group Digest Worker]] - code - apps/api/src/workers/group-digest.worker.ts
- [[Worker Registry]] - code - apps/api/src/workers/index.ts
- [[auth.ts_1]] - code - api/src/types/auth.ts
- [[express.d.ts]] - code - api/src/types/express.d.ts
- [[useSearchAll Aggregated Search Query]] - code - apps/web/src/features/search/hooks/useSearchAll.ts
- [[useSearchEvents Infinite Event Search Query]] - code - apps/web/src/features/search/hooks/useSearchEvents.ts
- [[useSearchGroups Infinite Group Search Query]] - code - apps/web/src/features/search/hooks/useSearchGroups.ts
- [[useSearchJobs Infinite Job Search Query]] - code - apps/web/src/features/search/hooks/useSearchJobs.ts
- [[useSearchPosts Filtered Infinite Search Query]] - code - apps/web/src/features/search/hooks/useSearchPosts.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Server_Core__Middleware
SORT file.name ASC
```

## Connections to other communities
- 6 edges to [[_COMMUNITY_Socket, Workers & Bull]]
- 3 edges to [[_COMMUNITY_Auth & Flow Concepts]]
- 3 edges to [[_COMMUNITY_Middleware & Explore API]]
- 2 edges to [[_COMMUNITY_Messages Backend]]
- 2 edges to [[_COMMUNITY_Notifications Backend]]
- 2 edges to [[_COMMUNITY_Community 67]]
- 1 edge to [[_COMMUNITY_Search Backend]]
- 1 edge to [[_COMMUNITY_Community 59]]

## Top bridge nodes
- [[Auth Context]] - degree 13, connects to 2 communities
- [[Structured Logger]] - degree 9, connects to 1 community
- [[API Server Bootstrap]] - degree 6, connects to 1 community
- [[Mentorship Queue Worker]] - degree 6, connects to 1 community
- [[Notification Queue Worker]] - degree 6, connects to 1 community