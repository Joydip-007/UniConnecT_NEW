---
type: community
cohesion: 0.07
members: 48
---

# Admin Controller Logic

**Cohesion:** 0.07 - loosely connected
**Members:** 48 nodes

## Members
- [[.cancelMentorshipJobs()]] - code - api/src/modules/mentorship/service.ts
- [[.createBulkInvitations()]] - code - api/src/modules/admin/service.ts
- [[.createInvitation()]] - code - api/src/modules/admin/service.ts
- [[.createRequest()]] - code - api/src/modules/mentorship/service.ts
- [[.deleteInvitation()]] - code - api/src/modules/admin/service.ts
- [[.deleteUser()]] - code - api/src/modules/admin/service.ts
- [[.getAllowedEmailDomains()]] - code - api/src/modules/admin/service.ts
- [[.getRequestById()]] - code - api/src/modules/mentorship/service.ts
- [[.getStats()]] - code - api/src/modules/admin/service.ts
- [[.listInvitations()]] - code - api/src/modules/admin/service.ts
- [[.listRedemptions()]] - code - api/src/modules/admin/service.ts
- [[.listReports()]] - code - api/src/modules/admin/service.ts
- [[.listUsers()_1]] - code - api/src/modules/admin/service.ts
- [[.resolveReport()]] - code - api/src/modules/admin/service.ts
- [[.updateAllowedEmailDomains()]] - code - api/src/modules/admin/service.ts
- [[.updateRedemption()]] - code - api/src/modules/admin/service.ts
- [[.updateRequest()]] - code - api/src/modules/mentorship/service.ts
- [[.updateUserRole()]] - code - api/src/modules/admin/service.ts
- [[.updateUserStatus()]] - code - api/src/modules/admin/service.ts
- [[.withdrawRequest()_1]] - code - api/src/modules/mentorship/service.ts
- [[Admin Controller]] - code - apps/api/src/modules/admin/controller.ts
- [[Admin Report Resolution Workflow]] - code - apps/api/src/modules/admin/service.ts
- [[Admin Service]] - code - apps/api/src/modules/admin/service.ts
- [[Admin User Lifecycle Management]] - code - apps/api/src/modules/admin/service.ts
- [[AdminUser]] - code - web/src/pages/AdminPage.tsx
- [[CountRow_2]] - code - api/src/modules/admin/service.ts
- [[Email Queue Delivery]] - code - apps/api/src/queues/email.queue.ts
- [[Invitation Aware Registration Flow]] - code - apps/api/src/modules/auth/service.ts
- [[InvitationRow_1]] - code - api/src/modules/admin/service.ts
- [[Mentor Redemption Fulfillment]] - code - apps/api/src/modules/admin/service.ts
- [[PaginationQuery]] - code - api/src/modules/admin/schema.ts
- [[RedemptionListRow]] - code - api/src/modules/admin/service.ts
- [[Redis Backed Rate Limiter]] - code - apps/api/src/middleware/rateLimiter.ts
- [[ReportRow]] - code - api/src/modules/admin/service.ts
- [[System Group Membership Sync]] - code - apps/api/src/modules/groups/system-groups.service.ts
- [[Tenant Scoped Database Tables]] - code - apps/api/src/config/db.ts
- [[Token Service]] - code - apps/api/src/services/token.service.ts
- [[University Email Domain Controls]] - code - apps/api/src/modules/admin/service.ts
- [[University Resolution Middleware]] - code - apps/api/src/middleware/university.ts
- [[badRequest()]] - code - api/src/utils/errors.ts
- [[countActive()]] - code - api/src/modules/admin/service.ts
- [[countWhere()]] - code - api/src/modules/admin/service.ts
- [[service.ts_4]] - code - api/src/modules/admin/service.ts
- [[service.ts_19]] - code - apps/api/src/modules/admin/service.ts
- [[toAdminRedemption()]] - code - api/src/modules/admin/service.ts
- [[toAdminUser()]] - code - api/src/modules/admin/service.ts
- [[toInvitation()]] - code - api/src/modules/admin/service.ts
- [[toReport()]] - code - api/src/modules/admin/service.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Admin_Controller_Logic
SORT file.name ASC
```

## Connections to other communities
- 31 edges to [[_COMMUNITY_Admin Invitations & Reports]]
- 15 edges to [[_COMMUNITY_Notifications Backend]]
- 11 edges to [[_COMMUNITY_Mentorship Backend]]
- 9 edges to [[_COMMUNITY_Groups Join-Request Logic]]
- 7 edges to [[_COMMUNITY_Community 45]]
- 6 edges to [[_COMMUNITY_Auth & Flow Concepts]]
- 5 edges to [[_COMMUNITY_Messages Backend]]
- 4 edges to [[_COMMUNITY_App Config & Express]]
- 4 edges to [[_COMMUNITY_Community 68]]
- 4 edges to [[_COMMUNITY_Middleware & Explore API]]
- 4 edges to [[_COMMUNITY_Connections Backend]]
- 4 edges to [[_COMMUNITY_Socket, Workers & Bull]]
- 4 edges to [[_COMMUNITY_Campus Tools Backend]]
- 3 edges to [[_COMMUNITY_Community 41]]
- 3 edges to [[_COMMUNITY_Admin Module]]
- 3 edges to [[_COMMUNITY_Groups Service Layer]]
- 3 edges to [[_COMMUNITY_Jobs Backend Module]]
- 2 edges to [[_COMMUNITY_Community 78]]
- 2 edges to [[_COMMUNITY_Events Backend Module]]
- 2 edges to [[_COMMUNITY_Feed Backend Module]]
- 2 edges to [[_COMMUNITY_Community 151]]
- 2 edges to [[_COMMUNITY_Auth Module]]
- 2 edges to [[_COMMUNITY_Community 58]]
- 2 edges to [[_COMMUNITY_Community 77]]
- 1 edge to [[_COMMUNITY_Users Backend]]

## Top bridge nodes
- [[badRequest()]] - degree 40, connects to 11 communities
- [[service.ts_19]] - degree 35, connects to 9 communities
- [[service.ts_4]] - degree 33, connects to 8 communities
- [[University Resolution Middleware]] - degree 9, connects to 5 communities
- [[Admin Service]] - degree 31, connects to 4 communities