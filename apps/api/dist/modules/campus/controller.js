"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMyCourses = exports.enrollCourse = exports.updateCourse = exports.createCourse = exports.listCourses = exports.createShuttleLocation = exports.listShuttleLocations = exports.updateShuttleRoute = exports.createShuttleRoute = exports.listShuttleRoutes = exports.resolveLostFound = exports.updateLostFound = exports.getLostFound = exports.createLostFound = exports.listLostFound = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const response_1 = require("../../utils/response");
const errors_1 = require("../../utils/errors");
const service_1 = require("./service");
exports.listLostFound = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const result = await service_1.campusService.listLostFound(context.universityId, req.query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
});
exports.createLostFound = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.campusService.createLostFound(context, req.body), 201);
});
exports.getLostFound = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.campusService.getLostFound(context.universityId, getItemIdParam(req)));
});
exports.updateLostFound = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.campusService.updateLostFound(context, getItemIdParam(req), req.body));
});
exports.resolveLostFound = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.campusService.resolveLostFound(context, getItemIdParam(req)));
});
exports.listShuttleRoutes = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.campusService.listShuttleRoutes(context.universityId));
});
exports.createShuttleRoute = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.campusService.createShuttleRoute(context.universityId, req.body), 201);
});
exports.updateShuttleRoute = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.campusService.updateShuttleRoute(context.universityId, getRouteIdParam(req), req.body));
});
exports.listShuttleLocations = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.campusService.listShuttleLocations(context.universityId));
});
exports.createShuttleLocation = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.campusService.createShuttleLocation(context, req.body), 201);
});
exports.listCourses = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const result = await service_1.campusService.listCourses(context.universityId, req.query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
});
exports.createCourse = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.campusService.createCourse(context.universityId, req.body), 201);
});
exports.updateCourse = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.campusService.updateCourse(context.universityId, getCourseIdParam(req), req.body));
});
exports.enrollCourse = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.campusService.enrollCourse(context, getCourseIdParam(req), req.body), 201);
});
exports.listMyCourses = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.campusService.listMyCourses(context));
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
function getItemIdParam(req) {
    const value = req.params.itemId;
    return Array.isArray(value) ? value[0] : value;
}
function getRouteIdParam(req) {
    const value = req.params.routeId;
    return Array.isArray(value) ? value[0] : value;
}
function getCourseIdParam(req) {
    const value = req.params.courseId;
    return Array.isArray(value) ? value[0] : value;
}
