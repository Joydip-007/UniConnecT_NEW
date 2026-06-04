---
type: community
cohesion: 0.10
members: 65
---

# Messages Backend

**Cohesion:** 0.10 - loosely connected
**Members:** 65 nodes

## Members
- [[.createConversation()]] - code - api/src/modules/messages/service.ts
- [[.createGroupConversation()]] - code - api/src/modules/messages/service.ts
- [[.createMessage()]] - code - api/src/modules/messages/service.ts
- [[.deleteMessage()]] - code - api/src/modules/messages/service.ts
- [[.leaveConversation()]] - code - api/src/modules/messages/service.ts
- [[.listConversations()]] - code - api/src/modules/messages/service.ts
- [[.listMessages()]] - code - api/src/modules/messages/service.ts
- [[.markRead()]] - code - api/src/modules/messages/service.ts
- [[.updateConversation()]] - code - api/src/modules/messages/service.ts
- [[.updateMessage()]] - code - api/src/modules/messages/service.ts
- [[ConversationAccessRow]] - code - api/src/modules/messages/service.ts
- [[CreateMessageInput]] - code - api/src/modules/messages/schema.ts
- [[CreateMessageSchema]] - code - api/src/modules/messages/schema.ts
- [[Message Zod Schemas]] - code - apps/api/src/modules/messages/schema.ts
- [[MessageListQuery]] - code - api/src/modules/messages/schema.ts
- [[MessageListQuerySchema]] - code - api/src/modules/messages/schema.ts
- [[MessageOwnerRow]] - code - api/src/modules/messages/service.ts
- [[MessageRow]] - code - api/src/modules/messages/service.ts
- [[MessageType]] - code - api/src/modules/messages/service.ts
- [[MessageTypeSchema]] - code - api/src/modules/messages/schema.ts
- [[Messages Controller]] - code - apps/api/src/modules/messages/controller.ts
- [[Messages Module Barrel (messagesRouter)]] - code - /Users/joydipdatta/UniConnecT_NEW/apps/api/src/modules/messages/index.ts
- [[Messages Router]] - code - /Users/joydipdatta/UniConnecT_NEW/apps/api/src/modules/messages/router.ts
- [[MessagesService]] - code - api/src/modules/messages/service.ts
- [[UpdateConversationSchema]] - code - api/src/modules/messages/schema.ts
- [[UpdateMessageSchema]] - code - api/src/modules/messages/schema.ts
- [[UserRow]] - code - api/src/modules/messages/service.ts
- [[assertParticipant()]] - code - api/src/modules/messages/service.ts
- [[controller.ts]] - code - api/src/modules/messages/controller.ts
- [[controller.ts_16]] - code - apps/api/src/modules/messages/controller.ts
- [[conversationListQuery()]] - code - apps/api/src/modules/messages/service.ts
- [[createConversation]] - code - api/src/modules/messages/controller.ts
- [[createMessage]] - code - api/src/modules/messages/controller.ts
- [[deleteMessage]] - code - api/src/modules/messages/controller.ts
- [[enqueueMessageNotifications()]] - code - api/src/modules/messages/service.ts
- [[findDirectConversation()]] - code - api/src/modules/messages/service.ts
- [[getAuthContext()]] - code - api/src/modules/messages/controller.ts
- [[getConversation]] - code - apps/api/src/modules/messages/controller.ts
- [[getConversationId()]] - code - api/src/socket/index.ts
- [[getConversationParticipantIds()]] - code - api/src/modules/messages/service.ts
- [[getMessageById()]] - code - api/src/modules/messages/service.ts
- [[getMessageIdParam()]] - code - api/src/modules/messages/controller.ts
- [[getMessageOwner()]] - code - api/src/modules/messages/service.ts
- [[getParticipantsForConversations()]] - code - api/src/modules/messages/service.ts
- [[index.ts_13]] - code - api/src/modules/messages/index.ts
- [[index.ts_43]] - code - apps/api/src/modules/messages/index.ts
- [[isString()]] - code - api/src/modules/messages/service.ts
- [[leaveConversation]] - code - api/src/modules/messages/controller.ts
- [[listConversations]] - code - api/src/modules/messages/controller.ts
- [[listMessages]] - code - api/src/modules/messages/controller.ts
- [[markRead]] - code - api/src/modules/messages/controller.ts
- [[messageSelectQuery()]] - code - api/src/modules/messages/service.ts
- [[pickDefined()]] - code - api/src/modules/messages/service.ts
- [[router.ts]] - code - api/src/modules/messages/router.ts
- [[router.ts_15]] - code - apps/api/src/modules/messages/router.ts
- [[schema.ts]] - code - api/src/modules/messages/schema.ts
- [[schema.ts_16]] - code - apps/api/src/modules/messages/schema.ts
- [[service.ts_1]] - code - api/src/modules/messages/service.ts
- [[service.ts_16]] - code - apps/api/src/modules/messages/service.ts
- [[toLastMessage()]] - code - api/src/modules/messages/service.ts
- [[toMessage()]] - code - api/src/modules/messages/service.ts
- [[toParticipant()]] - code - api/src/modules/messages/service.ts
- [[uniqueIds()]] - code - api/src/modules/messages/service.ts
- [[updateConversation]] - code - api/src/modules/messages/controller.ts
- [[updateMessage]] - code - api/src/modules/messages/controller.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Messages_Backend
SORT file.name ASC
```

## Connections to other communities
- 20 edges to [[_COMMUNITY_Middleware & Explore API]]
- 16 edges to [[_COMMUNITY_Notifications Backend]]
- 9 edges to [[_COMMUNITY_Community 68]]
- 8 edges to [[_COMMUNITY_Connections Backend]]
- 6 edges to [[_COMMUNITY_Community 84]]
- 6 edges to [[_COMMUNITY_Groups Join-Request Logic]]
- 5 edges to [[_COMMUNITY_Admin Controller Logic]]
- 4 edges to [[_COMMUNITY_App Config & Express]]
- 4 edges to [[_COMMUNITY_Socket, Workers & Bull]]
- 3 edges to [[_COMMUNITY_Auth & Flow Concepts]]
- 3 edges to [[_COMMUNITY_Mentorship Backend]]
- 2 edges to [[_COMMUNITY_Community 78]]
- 2 edges to [[_COMMUNITY_Server Core & Middleware]]
- 2 edges to [[_COMMUNITY_Community 59]]
- 1 edge to [[_COMMUNITY_Community 156]]

## Top bridge nodes
- [[service.ts_16]] - degree 43, connects to 12 communities
- [[service.ts_1]] - degree 40, connects to 11 communities
- [[controller.ts_16]] - degree 24, connects to 3 communities
- [[controller.ts]] - degree 23, connects to 3 communities
- [[getConversationId()]] - degree 13, connects to 3 communities