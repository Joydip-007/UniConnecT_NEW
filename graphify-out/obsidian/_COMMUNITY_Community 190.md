---
type: community
cohesion: 0.29
members: 7
---

# Community 190

**Cohesion:** 0.29 - loosely connected
**Members:** 7 nodes

## Members
- [[Group Join Requests Table]] - code - apps/api/src/database/migrations/039_create_group_join_requests.ts
- [[Group Notification Queue Usage]] - code - apps/api/src/modules/groups/service.ts
- [[Group Pinned Text And Rules]] - code - apps/api/src/modules/groups/service.ts
- [[Invitations Table]] - code - apps/api/src/database/migrations/005_create_invitations.ts
- [[Staff To Faculty Role Migration]] - code - apps/api/src/database/migrations/025_rename_staff_to_faculty.ts
- [[System Group Role Restriction Fields]] - code - apps/api/src/database/migrations/027_add_groups_role_restriction_and_system_flag.ts
- [[getDomainError()]] - code - web/src/pages/AdminPage.tsx

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Community_190
SORT file.name ASC
```

## Connections to other communities
- 3 edges to [[_COMMUNITY_Community 74]]
- 2 edges to [[_COMMUNITY_Admin Module]]
- 2 edges to [[_COMMUNITY_Groups Join-Request Logic]]
- 2 edges to [[_COMMUNITY_Community 73]]
- 2 edges to [[_COMMUNITY_Community 135]]
- 2 edges to [[_COMMUNITY_Community 113]]
- 1 edge to [[_COMMUNITY_Mentorship Backend]]

## Top bridge nodes
- [[Group Join Requests Table]] - degree 8, connects to 6 communities
- [[Invitations Table]] - degree 5, connects to 3 communities
- [[Staff To Faculty Role Migration]] - degree 3, connects to 1 community
- [[System Group Role Restriction Fields]] - degree 3, connects to 1 community
- [[Group Notification Queue Usage]] - degree 3, connects to 1 community