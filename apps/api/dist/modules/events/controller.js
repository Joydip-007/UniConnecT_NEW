"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEventIcal = exports.listAttendees = exports.deleteRsvp = exports.rsvpEvent = exports.publishEvent = exports.deleteEvent = exports.updateEvent = exports.getEvent = exports.listMyEvents = exports.createEvent = exports.listEvents = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const response_1 = require("../../utils/response");
const errors_1 = require("../../utils/errors");
const service_1 = require("./service");
exports.listEvents = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const result = await service_1.eventsService.listEvents(context, req.query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
});
exports.createEvent = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.eventsService.createEvent(context, req.body), 201);
});
exports.listMyEvents = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const result = await service_1.eventsService.listMyEvents(context, req.query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
});
exports.getEvent = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.eventsService.getEvent(context, getEventIdParam(req)));
});
exports.updateEvent = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.eventsService.updateEvent(context, getEventIdParam(req), req.body));
});
exports.deleteEvent = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.eventsService.deleteEvent(context, getEventIdParam(req)));
});
exports.publishEvent = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.eventsService.publishEvent(context, getEventIdParam(req)));
});
exports.rsvpEvent = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.eventsService.rsvpEvent(context, getEventIdParam(req), req.body.status), 201);
});
exports.deleteRsvp = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.eventsService.deleteRsvp(context, getEventIdParam(req)));
});
exports.listAttendees = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const result = await service_1.eventsService.listAttendees(context, getEventIdParam(req), req.query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
});
exports.getEventIcal = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const calendar = await service_1.eventsService.getEventIcal(context, getEventIdParam(req));
    res.type('text/calendar').send(calendar);
});
function getAuthContext(req) {
    if (!req.user)
        throw (0, errors_1.unauthorized)();
    return {
        userId: req.user.userId,
        universityId: req.university?.id ?? req.user.universityId,
        role: req.user.role,
    };
}
function getEventIdParam(req) {
    const value = req.params.eventId;
    return Array.isArray(value) ? value[0] : value;
}
