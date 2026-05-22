import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validate, validateRequest } from '../../middleware/validate'
import {
  cancelJoinRequest,
  createGroup,
  createResource,
  deleteGroup,
  deleteResource,
  getGroup,
  getGroupStats,
  inviteToGroup,
  joinOrRequestGroup,
  leaveGroup,
  listGroupCollaborations,
  listGroupEvents,
  listGroupMembers,
  listGroupPosts,
  listGroups,
  listJoinRequests,
  listMyGroups,
  listResources,
  removeMember,
  reviewJoinRequest,
  setPinned,
  setRules,
  trackResource,
  updateGroup,
  updateMember,
} from './controller'
import {
  CreateGroupSchema,
  CreateResourceSchema,
  GroupListQuerySchema,
  InviteToGroupSchema,
  JoinGroupSchema,
  JoinRequestActionSchema,
  MembersQuerySchema,
  PaginationQuerySchema,
  ResourceListQuerySchema,
  SetPinnedSchema,
  SetRulesSchema,
  UpdateGroupSchema,
  UpdateMemberSchema,
} from './schema'

export const groupsRouter = Router()

groupsRouter.use(requireAuth, resolveUniversity)

groupsRouter.get('/', validateRequest({ query: GroupListQuerySchema }), listGroups)
groupsRouter.post('/', validate(CreateGroupSchema), createGroup)
groupsRouter.get('/my', validateRequest({ query: PaginationQuerySchema }), listMyGroups)
groupsRouter.get('/:groupId', getGroup)
groupsRouter.patch('/:groupId', validate(UpdateGroupSchema), updateGroup)
groupsRouter.delete('/:groupId', deleteGroup)
groupsRouter.post('/:groupId/join', validate(JoinGroupSchema), joinOrRequestGroup)
groupsRouter.delete('/:groupId/leave', leaveGroup)
groupsRouter.post('/:groupId/members', validate(JoinGroupSchema), joinOrRequestGroup)
groupsRouter.delete('/:groupId/members/me', leaveGroup)
groupsRouter.get('/:groupId/members', validateRequest({ query: MembersQuerySchema }), listGroupMembers)
groupsRouter.patch('/:groupId/members/:userId', validate(UpdateMemberSchema), updateMember)
groupsRouter.delete('/:groupId/members/:userId', removeMember)
groupsRouter.get('/:groupId/join-requests', validateRequest({ query: PaginationQuerySchema }), listJoinRequests)
groupsRouter.patch('/:groupId/join-requests/:requestId', validate(JoinRequestActionSchema), reviewJoinRequest)
groupsRouter.delete('/:groupId/join-requests/me', cancelJoinRequest)
groupsRouter.get('/:groupId/posts', validateRequest({ query: PaginationQuerySchema }), listGroupPosts)
groupsRouter.get('/:groupId/events', validateRequest({ query: PaginationQuerySchema }), listGroupEvents)
groupsRouter.get(
  '/:groupId/collaborations',
  validateRequest({ query: PaginationQuerySchema }),
  listGroupCollaborations,
)
groupsRouter.post('/:groupId/invitations', validate(InviteToGroupSchema), inviteToGroup)

// Resources
groupsRouter.get('/:groupId/resources', validateRequest({ query: ResourceListQuerySchema }), listResources)
groupsRouter.post('/:groupId/resources', validate(CreateResourceSchema), createResource)
groupsRouter.delete('/:groupId/resources/:resourceId', deleteResource)
groupsRouter.patch('/:groupId/resources/:resourceId/track', trackResource)

// Pinned announcement + rules
groupsRouter.patch('/:groupId/pinned', validate(SetPinnedSchema), setPinned)
groupsRouter.patch('/:groupId/rules', validate(SetRulesSchema), setRules)

// Analytics stats
groupsRouter.get('/:groupId/stats', getGroupStats)
