---
type: community
cohesion: 0.11
members: 41
---

# Groups Join-Request Logic

**Cohesion:** 0.11 - loosely connected
**Members:** 41 nodes

## Members
- [[.cancelJoinRequest()]] - code - api/src/modules/groups/service.ts
- [[.createResource()]] - code - api/src/modules/groups/service.ts
- [[.deleteGroup()]] - code - api/src/modules/groups/service.ts
- [[.deleteResource()]] - code - api/src/modules/groups/service.ts
- [[.deleteStudySession()]] - code - api/src/modules/groups/service.ts
- [[.getGroup()]] - code - api/src/modules/groups/service.ts
- [[.getGroupStats()]] - code - api/src/modules/groups/service.ts
- [[.inviteToGroup()]] - code - api/src/modules/groups/service.ts
- [[.joinGroup()]] - code - api/src/modules/groups/service.ts
- [[.joinGroupViaInvite()]] - code - api/src/modules/groups/service.ts
- [[.leaveGroup()]] - code - api/src/modules/groups/service.ts
- [[.listGroupCollaborations()]] - code - api/src/modules/groups/service.ts
- [[.listGroupEvents()]] - code - api/src/modules/groups/service.ts
- [[.listGroupPosts()]] - code - api/src/modules/groups/service.ts
- [[.listJoinRequests()]] - code - api/src/modules/groups/service.ts
- [[.listMembers()]] - code - api/src/modules/groups/service.ts
- [[.listResources()]] - code - api/src/modules/groups/service.ts
- [[.listStudySessions()]] - code - api/src/modules/groups/service.ts
- [[.removeMember()]] - code - api/src/modules/groups/service.ts
- [[.reviewJoinRequest()]] - code - api/src/modules/groups/service.ts
- [[.rsvpStudySession()]] - code - api/src/modules/groups/service.ts
- [[.setPinned()]] - code - api/src/modules/groups/service.ts
- [[.setRules()]] - code - api/src/modules/groups/service.ts
- [[.trackResource()]] - code - api/src/modules/groups/service.ts
- [[.transferOwnership()]] - code - api/src/modules/groups/service.ts
- [[.updateGroup()]] - code - api/src/modules/groups/service.ts
- [[Group Admin Controls]] - code - apps/api/src/modules/groups/service.ts
- [[Group Invite Flow]] - code - apps/api/src/modules/groups/service.ts
- [[Group Role Administration Policy]] - code - apps/api/src/modules/groups/service.ts
- [[GroupsService]] - code - api/src/modules/groups/service.ts
- [[NotificationsService Invite Creation]] - code - apps/api/src/modules/groups/service.ts
- [[PaginationQuery_1]] - code - api/src/modules/groups/schema.ts
- [[System Group Constraints]] - code - apps/api/src/modules/groups/service.ts
- [[assertCanAdminGroup()]] - code - api/src/modules/groups/service.ts
- [[assertCanRemoveRole()]] - code - api/src/modules/groups/service.ts
- [[assertGroupAccess()]] - code - api/src/modules/groups/service.ts
- [[assertGroupAdminAccess()]] - code - api/src/modules/groups/service.ts
- [[assertMemberAccess()]] - code - api/src/modules/groups/service.ts
- [[forbidden()]] - code - api/src/utils/errors.ts
- [[isUniqueViolation()]] - code - api/src/modules/groups/service.ts
- [[joinOrRequestGroup]] - code - api/src/modules/groups/controller.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Groups_Join-Request_Logic
SORT file.name ASC
```

## Connections to other communities
- 35 edges to [[_COMMUNITY_Groups Service Layer]]
- 16 edges to [[_COMMUNITY_Notifications Backend]]
- 9 edges to [[_COMMUNITY_Mentorship Backend]]
- 9 edges to [[_COMMUNITY_Admin Controller Logic]]
- 9 edges to [[_COMMUNITY_Groups Controller]]
- 6 edges to [[_COMMUNITY_Jobs Backend Module]]
- 6 edges to [[_COMMUNITY_Messages Backend]]
- 5 edges to [[_COMMUNITY_Events Backend Module]]
- 5 edges to [[_COMMUNITY_Feed Backend Module]]
- 5 edges to [[_COMMUNITY_Users Backend]]
- 4 edges to [[_COMMUNITY_Community 69]]
- 3 edges to [[_COMMUNITY_Community 41]]
- 3 edges to [[_COMMUNITY_Campus Tools Backend]]
- 3 edges to [[_COMMUNITY_News Backend]]
- 3 edges to [[_COMMUNITY_Community 73]]
- 2 edges to [[_COMMUNITY_Middleware & Explore API]]
- 2 edges to [[_COMMUNITY_Community 190]]
- 2 edges to [[_COMMUNITY_Community 243]]
- 1 edge to [[_COMMUNITY_Community 68]]
- 1 edge to [[_COMMUNITY_Community 200]]

## Top bridge nodes
- [[forbidden()]] - degree 57, connects to 13 communities
- [[GroupsService]] - degree 51, connects to 9 communities
- [[assertGroupAccess()]] - degree 20, connects to 4 communities
- [[joinOrRequestGroup]] - degree 12, connects to 3 communities
- [[PaginationQuery_1]] - degree 12, connects to 3 communities