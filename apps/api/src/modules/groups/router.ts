import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { requireAcademicGroup } from '../../middleware/requireAcademicGroup'
import { resolveUniversity } from '../../middleware/university'
import { validate, validateRequest } from '../../middleware/validate'
import {
  cancelJoinRequest,
  createFlashcard,
  createFlashcardDeck,
  createGroup,
  createResource,
  createSharedNote,
  createStudySession,
  deleteFlashcard,
  deleteFlashcardDeck,
  deleteGroup,
  deleteResource,
  deleteSharedNote,
  deleteStudySession,
  getFlashcardReviewQueue,
  getGroup,
  getGroupStats,
  inviteToGroup,
  joinOrRequestGroup,
  leaveGroup,
  listFlashcardDecks,
  listFlashcards,
  listGroupCollaborations,
  listGroupEvents,
  listGroupMembers,
  listGroupPosts,
  listGroups,
  listJoinRequests,
  listMyGroups,
  listResources,
  listSharedNotes,
  listStudySessions,
  removeMember,
  reviewFlashcard,
  reviewJoinRequest,
  rsvpStudySession,
  setPinned,
  setRules,
  trackResource,
  updateFlashcard,
  updateFlashcardDeck,
  updateGroup,
  updateMember,
  updateSharedNote,
} from './controller'
import {
  CreateFlashcardDeckSchema,
  CreateFlashcardSchema,
  CreateGroupSchema,
  CreateResourceSchema,
  CreateSharedNoteSchema,
  CreateStudySessionSchema,
  FlashcardReviewSchema,
  GroupListQuerySchema,
  InviteToGroupSchema,
  JoinGroupSchema,
  JoinRequestActionSchema,
  MembersQuerySchema,
  PaginationQuerySchema,
  ResourceListQuerySchema,
  RsvpStudySessionSchema,
  SetPinnedSchema,
  SetRulesSchema,
  UpdateFlashcardDeckSchema,
  UpdateFlashcardSchema,
  UpdateGroupSchema,
  UpdateMemberSchema,
  UpdateSharedNoteSchema,
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

// Study sessions
groupsRouter.get('/:groupId/study-sessions', validateRequest({ query: PaginationQuerySchema }), listStudySessions)
groupsRouter.post('/:groupId/study-sessions', validate(CreateStudySessionSchema), createStudySession)
groupsRouter.delete('/:groupId/study-sessions/:sessionId', deleteStudySession)
groupsRouter.post('/:groupId/study-sessions/:sessionId/rsvp', validate(RsvpStudySessionSchema), rsvpStudySession)

groupsRouter.get('/:groupId/flashcard-decks', requireAcademicGroup, listFlashcardDecks)
groupsRouter.post(
  '/:groupId/flashcard-decks',
  requireAcademicGroup,
  validate(CreateFlashcardDeckSchema),
  createFlashcardDeck,
)
groupsRouter.patch(
  '/:groupId/flashcard-decks/:deckId',
  requireAcademicGroup,
  validate(UpdateFlashcardDeckSchema),
  updateFlashcardDeck,
)
groupsRouter.delete('/:groupId/flashcard-decks/:deckId', requireAcademicGroup, deleteFlashcardDeck)
groupsRouter.get('/:groupId/flashcard-decks/:deckId/cards', requireAcademicGroup, listFlashcards)
groupsRouter.post(
  '/:groupId/flashcard-decks/:deckId/cards',
  requireAcademicGroup,
  validate(CreateFlashcardSchema),
  createFlashcard,
)
groupsRouter.get(
  '/:groupId/flashcard-decks/:deckId/review',
  requireAcademicGroup,
  validateRequest({ query: PaginationQuerySchema }),
  getFlashcardReviewQueue,
)
groupsRouter.patch(
  '/:groupId/flashcards/:cardId',
  requireAcademicGroup,
  validate(UpdateFlashcardSchema),
  updateFlashcard,
)
groupsRouter.delete('/:groupId/flashcards/:cardId', requireAcademicGroup, deleteFlashcard)
groupsRouter.post(
  '/:groupId/flashcards/:cardId/review',
  requireAcademicGroup,
  validate(FlashcardReviewSchema),
  reviewFlashcard,
)
groupsRouter.get('/:groupId/shared-notes', validateRequest({ query: PaginationQuerySchema }), listSharedNotes)
groupsRouter.post('/:groupId/shared-notes', validate(CreateSharedNoteSchema), createSharedNote)
groupsRouter.patch('/:groupId/shared-notes/:noteId', validate(UpdateSharedNoteSchema), updateSharedNote)
groupsRouter.delete('/:groupId/shared-notes/:noteId', deleteSharedNote)
