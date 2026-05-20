"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchGroupsController = exports.searchEventsController = exports.searchJobsController = exports.searchPostsController = exports.searchPeopleController = exports.searchAllController = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const response_1 = require("../../utils/response");
const errors_1 = require("../../utils/errors");
const errors_2 = require("../../utils/errors");
const service_1 = require("./service");
function getAuthContext(req) {
    if (!req.user)
        throw (0, errors_2.unauthorized)();
    if (!req.university)
        throw new errors_1.AppError('University not resolved', 500, 'UNIVERSITY_NOT_RESOLVED');
    return { userId: req.user.userId, universityId: req.university.id };
}
exports.searchAllController = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { userId, universityId } = getAuthContext(req);
    const { q, limit } = req.query;
    const result = await (0, service_1.searchAll)(universityId, q, limit, userId);
    (0, response_1.sendSuccess)(res, result);
});
exports.searchPeopleController = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { userId, universityId } = getAuthContext(req);
    const { q, page, limit } = req.query;
    const result = await (0, service_1.searchPeople)(universityId, q, page, limit, userId);
    (0, response_1.sendSuccess)(res, result);
});
exports.searchPostsController = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { universityId } = getAuthContext(req);
    const { q, page, limit } = req.query;
    const result = await (0, service_1.searchPosts)(universityId, q, page, limit);
    (0, response_1.sendSuccess)(res, result);
});
exports.searchJobsController = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { universityId } = getAuthContext(req);
    const { q, page, limit } = req.query;
    const result = await (0, service_1.searchJobs)(universityId, q, page, limit);
    (0, response_1.sendSuccess)(res, result);
});
exports.searchEventsController = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { userId, universityId } = getAuthContext(req);
    const { q, page, limit } = req.query;
    const result = await (0, service_1.searchEvents)(universityId, q, page, limit, userId);
    (0, response_1.sendSuccess)(res, result);
});
exports.searchGroupsController = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { userId, universityId } = getAuthContext(req);
    const { q, page, limit } = req.query;
    const result = await (0, service_1.searchGroups)(universityId, q, page, limit, userId);
    (0, response_1.sendSuccess)(res, result);
});
