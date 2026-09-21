import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { requireAcademicGroup } from '../../middleware/requireAcademicGroup'
import { resolveUniversity } from '../../middleware/university'
import { validate, validateRequest } from '../../middleware/validate'
import {
  approvePendingAiContent,
  askTeacher,
  askTeacherQueue,
  bookConsultationSlot,
  cancelInvite,
  cancelJoinRequest,
  createAnnouncement,
  createConsultationSlot,
  createFlashcard,
  createFlashcardDeck,
  createGroup,
  createResource,
  createSharedNote,
  createStudySession,
  deleteAnnouncement,
  deleteConsultationSlot,
  deleteFlashcard,
  deleteFlashcardDeck,
  deleteGroup,
  deleteResource,
  deleteSharedNote,
  deleteStudySession,
  discardPendingAiContent,
  getAiSettings,
  getAnalytics,
  getFlashcardReviewQueue,
  getGroup,
  getGroupStats,
  getMySessionPrivateNotes,
  getSessionCreatorNotes,
  getSessionCreatorNotesUploadUrl,
  getSessionPrivateNotesUploadUrl,
  getSharedNoteUploadUrl,
  inviteToGroup,
  joinOrRequestGroup,
  leaveGroup,
  updateMyMute,
  listAnnouncements,
  listConsultationSlots,
  listFlashcardDecks,
  listFlashcards,
  listGroupCollaborations,
  listGroupEvents,
  listGroupMembers,
  listGroupPosts,
  listGroups,
  listJoinRequests,
  listModerationLog,
  listMyGroups,
  listPendingAiContent,
  listPendingEvents,
  listPendingInvites,
  listPendingPosts,
  listResources,
  listSharedNotes,
  listStudySessions,
  listSuggestions,
  openGroupChat,
  putMySessionPrivateNotes,
  putSessionCreatorNotes,
  removeMember,
  reviewConsultationBooking,
  reviewEvent,
  reviewFlashcard,
  reviewJoinRequest,
  reviewPost,
  reviewSummary,
  rsvpStudySession,
  setPinned,
  setRules,
  trackResource,
  updateAnnouncement,
  updateFlashcard,
  updateAiSettings,
  updateFlashcardDeck,
  updateGroup,
  updateMember,
  updateSettings,
  updateSharedNote,
} from './controller'
import {
  BookSlotSchema,
  CreateAnnouncementSchema,
  CreateFlashcardDeckSchema,
  CreateFlashcardSchema,
  CreateGroupSchema,
  CreateResourceSchema,
  CreateSharedNoteSchema,
  CreateSlotSchema,
  CreateStudySessionSchema,
  FlashcardReviewSchema,
  GroupListQuerySchema,
  InviteToGroupSchema,
  JoinGroupSchema,
  JoinRequestActionSchema,
  JoinRequestsQuerySchema,
  MembersQuerySchema,
  ModLogQuerySchema,
  NoteUploadUrlRequestSchema,
  PaginationQuerySchema,
  PutSessionCreatorNotesSchema,
  PutSessionPrivateNotesSchema,
  ResourceListQuerySchema,
  ReviewActionSchema,
  ReviewBookingSchema,
  RsvpStudySessionSchema,
  SetPinnedSchema,
  SetRulesSchema,
  SuggestionsQuerySchema,
  UpdateAnnouncementSchema,
  UpdateFlashcardDeckSchema,
  UpdateFlashcardSchema,
  UpdateGroupAISettingsSchema,
  UpdateGroupSchema,
  UpdateGroupSettingsSchema,
  UpdateMemberSchema,
  UpdateMyMuteSchema,
  UpdateSharedNoteSchema,
  UploadUrlQuerySchema,
} from './schema'

export const groupsRouter = Router()

groupsRouter.use(requireAuth, resolveUniversity)

groupsRouter.get('/', validateRequest({ query: GroupListQuerySchema }), listGroups)
groupsRouter.post('/', validate(CreateGroupSchema), createGroup)
groupsRouter.get('/my', validateRequest({ query: PaginationQuerySchema }), listMyGroups)
groupsRouter.get('/suggestions', validateRequest({ query: SuggestionsQuerySchema }), listSuggestions)
groupsRouter.get('/:groupId', getGroup)
groupsRouter.patch('/:groupId', validate(UpdateGroupSchema), updateGroup)
groupsRouter.patch('/:groupId/settings', validate(UpdateGroupSettingsSchema), updateSettings)
groupsRouter.get('/:groupId/moderation-log', validateRequest({ query: ModLogQuerySchema }), listModerationLog)
groupsRouter.get('/:groupId/review/summary', reviewSummary)
groupsRouter.get('/:groupId/review/posts', listPendingPosts)
groupsRouter.patch('/:groupId/review/posts/:postId', validate(ReviewActionSchema), reviewPost)
groupsRouter.get('/:groupId/review/events', listPendingEvents)
groupsRouter.patch('/:groupId/review/events/:eventId', validate(ReviewActionSchema), reviewEvent)
groupsRouter.delete('/:groupId', deleteGroup)
groupsRouter.post('/:groupId/join', validate(JoinGroupSchema), joinOrRequestGroup)
groupsRouter.delete('/:groupId/leave', leaveGroup)
groupsRouter.post('/:groupId/members', validate(JoinGroupSchema), joinOrRequestGroup)
groupsRouter.delete('/:groupId/members/me', leaveGroup)
groupsRouter.patch('/:groupId/members/me/mute', validate(UpdateMyMuteSchema), updateMyMute)
groupsRouter.get('/:groupId/members', validateRequest({ query: MembersQuerySchema }), listGroupMembers)
groupsRouter.patch('/:groupId/members/:userId', validate(UpdateMemberSchema), updateMember)
groupsRouter.delete('/:groupId/members/:userId', removeMember)
groupsRouter.get('/:groupId/join-requests', validateRequest({ query: JoinRequestsQuerySchema }), listJoinRequests)
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
groupsRouter.get('/:groupId/invitations', validateRequest({ query: PaginationQuerySchema }), listPendingInvites)
groupsRouter.delete('/:groupId/invitations/:invitationId', cancelInvite)

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
groupsRouter.get('/:groupId/analytics', getAnalytics)

// Group chat + ask-teacher
groupsRouter.post('/:groupId/chat', openGroupChat)
groupsRouter.post('/:groupId/ask-teacher', askTeacher)
groupsRouter.get('/:groupId/ask-teacher/queue', askTeacherQueue)

// Study sessions
groupsRouter.get('/:groupId/study-sessions', validateRequest({ query: PaginationQuerySchema }), listStudySessions)
groupsRouter.post('/:groupId/study-sessions', validate(CreateStudySessionSchema), createStudySession)
groupsRouter.delete('/:groupId/study-sessions/:sessionId', deleteStudySession)
groupsRouter.post('/:groupId/study-sessions/:sessionId/rsvp', validate(RsvpStudySessionSchema), rsvpStudySession)
groupsRouter.get('/:groupId/study-sessions/:sessionId/notes/creator', getSessionCreatorNotes)
groupsRouter.put(
  '/:groupId/study-sessions/:sessionId/notes/creator',
  validate(PutSessionCreatorNotesSchema),
  putSessionCreatorNotes,
)
groupsRouter.get(
  '/:groupId/study-sessions/:sessionId/notes/creator/upload-url',
  validateRequest({ query: UploadUrlQuerySchema }),
  getSessionCreatorNotesUploadUrl,
)
groupsRouter.get('/:groupId/study-sessions/:sessionId/notes/private', getMySessionPrivateNotes)
groupsRouter.put(
  '/:groupId/study-sessions/:sessionId/notes/private',
  validate(PutSessionPrivateNotesSchema),
  putMySessionPrivateNotes,
)
groupsRouter.get(
  '/:groupId/study-sessions/:sessionId/notes/private/upload-url',
  validateRequest({ query: UploadUrlQuerySchema }),
  getSessionPrivateNotesUploadUrl,
)

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
groupsRouter.post(
  '/:groupId/shared-notes/upload-url',
  validate(NoteUploadUrlRequestSchema),
  getSharedNoteUploadUrl,
)

// AI settings (academic groups only — enforced in the service layer)
groupsRouter.get('/:groupId/ai-settings', getAiSettings)
groupsRouter.patch('/:groupId/ai-settings', validate(UpdateGroupAISettingsSchema), updateAiSettings)

// Pending AI content review (faculty admins approve/discard AI-generated decks/quizzes)
groupsRouter.get('/:groupId/ai-settings/pending', listPendingAiContent)
groupsRouter.post('/:groupId/ai-settings/pending/:contentId/approve', approvePendingAiContent)
groupsRouter.delete('/:groupId/ai-settings/pending/:contentId', discardPendingAiContent)

// Announcements (academic groups)
groupsRouter.get('/:groupId/announcements', listAnnouncements)
groupsRouter.post('/:groupId/announcements', validate(CreateAnnouncementSchema), createAnnouncement)
groupsRouter.patch(
  '/:groupId/announcements/:announcementId',
  validate(UpdateAnnouncementSchema),
  updateAnnouncement,
)
groupsRouter.delete('/:groupId/announcements/:announcementId', deleteAnnouncement)

// Consultation slots + bookings
groupsRouter.get('/:groupId/consultation-slots', listConsultationSlots)
groupsRouter.post('/:groupId/consultation-slots', validate(CreateSlotSchema), createConsultationSlot)
groupsRouter.delete('/:groupId/consultation-slots/:slotId', deleteConsultationSlot)
groupsRouter.post(
  '/:groupId/consultation-slots/:slotId/book',
  validate(BookSlotSchema),
  bookConsultationSlot,
)
groupsRouter.patch(
  '/:groupId/consultation-slots/:slotId/bookings/:bookingId',
  validate(ReviewBookingSchema),
  reviewConsultationBooking,
)
