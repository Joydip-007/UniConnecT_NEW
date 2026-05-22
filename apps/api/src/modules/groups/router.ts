import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validate, validateRequest } from '../../middleware/validate'
import {
  cancelJoinRequest,
  createGroup,
  deleteGroup,
  getGroup,
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
  removeMember,
  reviewJoinRequest,
  updateGroup,
  updateMember,
} from './controller'
import {
  CreateGroupSchema,
  GroupListQuerySchema,
  InviteToGroupSchema,
  JoinGroupSchema,
  JoinRequestActionSchema,
  MembersQuerySchema,
  PaginationQuerySchema,
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
