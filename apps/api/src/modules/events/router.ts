import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validate, validateRequest } from '../../middleware/validate'
import {
  createEvent,
  deleteEvent,
  deleteRsvp,
  getEvent,
  getEventIcal,
  listAttendees,
  listEvents,
  listMyEvents,
  publishEvent,
  rsvpEvent,
  updateEvent,
} from './controller'
import {
  AttendeesQuerySchema,
  CreateEventSchema,
  EventListQuerySchema,
  PaginationQuerySchema,
  RsvpSchema,
  UpdateEventSchema,
} from './schema'

export const eventsRouter = Router()

eventsRouter.use(requireAuth, resolveUniversity)

eventsRouter.get('/', validateRequest({ query: EventListQuerySchema }), listEvents)
eventsRouter.post('/', requireRole('faculty', 'admin'), validate(CreateEventSchema), createEvent)
eventsRouter.get('/my', validateRequest({ query: PaginationQuerySchema }), listMyEvents)
eventsRouter.get('/:eventId', getEvent)
eventsRouter.patch('/:eventId', requireRole('faculty', 'admin'), validate(UpdateEventSchema), updateEvent)
eventsRouter.delete('/:eventId', requireRole('faculty', 'admin'), deleteEvent)
eventsRouter.patch('/:eventId/publish', requireRole('faculty', 'admin'), publishEvent)
eventsRouter.post('/:eventId/rsvp', validate(RsvpSchema), rsvpEvent)
eventsRouter.delete('/:eventId/rsvp', deleteRsvp)
eventsRouter.get('/:eventId/attendees', validateRequest({ query: AttendeesQuerySchema }), listAttendees)
eventsRouter.get('/:eventId/ical', getEventIcal)
