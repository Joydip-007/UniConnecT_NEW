---
type: community
cohesion: 0.10
members: 40
---

# Groups Service Layer

**Cohesion:** 0.10 - loosely connected
**Members:** 40 nodes

## Members
- [[.createGroup()]] - code - api/src/modules/groups/service.ts
- [[.getMember()]] - code - api/src/modules/groups/service.ts
- [[.listGroups()]] - code - api/src/modules/groups/service.ts
- [[.listMyGroups()]] - code - api/src/modules/groups/service.ts
- [[AllowedRole_1]] - code - api/src/modules/groups/schema.ts
- [[AuthContext_1]] - code - api/src/modules/groups/service.ts
- [[CollabJobRow]] - code - api/src/modules/groups/service.ts
- [[CountRow_4]] - code - api/src/modules/groups/service.ts
- [[CreateStudySessionInput]] - code - api/src/modules/groups/schema.ts
- [[EventListRow]] - code - api/src/modules/groups/service.ts
- [[EventPromoPostRow]] - code - api/src/modules/groups/service.ts
- [[GroupAccessRow]] - code - api/src/modules/groups/service.ts
- [[GroupListQuery]] - code - api/src/modules/groups/schema.ts
- [[GroupRole]] - code - api/src/modules/groups/service.ts
- [[GroupRow]] - code - api/src/modules/groups/service.ts
- [[GroupType_1]] - code - api/src/modules/groups/service.ts
- [[MemberRow]] - code - api/src/modules/groups/service.ts
- [[applyGroupFilters()]] - code - api/src/modules/groups/service.ts
- [[assertCanAssignRole()]] - code - api/src/modules/groups/service.ts
- [[assertCanJoinGroup()]] - code - api/src/modules/groups/service.ts
- [[assertCanViewGroup()]] - code - api/src/modules/groups/service.ts
- [[countOwners()]] - code - api/src/modules/groups/service.ts
- [[createGroup]] - code - api/src/modules/groups/controller.ts
- [[getMembership()]] - code - api/src/modules/groups/service.ts
- [[groupSelectQuery()]] - code - api/src/modules/groups/service.ts
- [[isBelowAdmin()]] - code - api/src/modules/groups/service.ts
- [[memberSelectQuery()]] - code - api/src/modules/groups/service.ts
- [[pickDefined()_2]] - code - api/src/modules/groups/service.ts
- [[resolveAllowedRoleOnCreate()]] - code - api/src/modules/groups/service.ts
- [[service.ts_5]] - code - api/src/modules/groups/service.ts
- [[service.ts_20]] - code - apps/api/src/modules/groups/service.ts
- [[sortEventsDesc()]] - code - api/src/modules/groups/service.ts
- [[toGroup()]] - code - api/src/modules/groups/service.ts
- [[toJoinRequest()]] - code - api/src/modules/groups/service.ts
- [[toMember()]] - code - api/src/modules/groups/service.ts
- [[toMiniEvent()]] - code - api/src/modules/groups/service.ts
- [[toMiniJob()]] - code - api/src/modules/groups/service.ts
- [[toMiniPost()]] - code - api/src/modules/groups/service.ts
- [[toResource()]] - code - api/src/modules/groups/service.ts
- [[visibleGroupsBaseQuery()]] - code - api/src/modules/groups/service.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Groups_Service_Layer
SORT file.name ASC
```

## Connections to other communities
- 35 edges to [[_COMMUNITY_Groups Join-Request Logic]]
- 16 edges to [[_COMMUNITY_Community 69]]
- 12 edges to [[_COMMUNITY_Groups Controller]]
- 11 edges to [[_COMMUNITY_Notifications Backend]]
- 6 edges to [[_COMMUNITY_Community 73]]
- 4 edges to [[_COMMUNITY_Community 68]]
- 4 edges to [[_COMMUNITY_Feed Backend Module]]
- 4 edges to [[_COMMUNITY_Auth & Flow Concepts]]
- 3 edges to [[_COMMUNITY_Admin Controller Logic]]
- 3 edges to [[_COMMUNITY_Users Backend]]
- 2 edges to [[_COMMUNITY_Community 78]]
- 2 edges to [[_COMMUNITY_Middleware & Explore API]]
- 2 edges to [[_COMMUNITY_Jobs Backend Module]]
- 2 edges to [[_COMMUNITY_Groups Frontend]]
- 2 edges to [[_COMMUNITY_Community 59]]
- 1 edge to [[_COMMUNITY_Mentorship Backend]]

## Top bridge nodes
- [[service.ts_20]] - degree 67, connects to 14 communities
- [[service.ts_5]] - degree 65, connects to 13 communities
- [[assertCanJoinGroup()]] - degree 5, connects to 3 communities
- [[getMembership()]] - degree 5, connects to 3 communities
- [[.getMember()]] - degree 5, connects to 3 communities