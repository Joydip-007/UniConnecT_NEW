"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSuggestions = exports.listFollowing = exports.listFollowers = exports.unfollowUser = exports.followUser = exports.listUsers = exports.getUser = exports.updateMe = exports.getMe = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const response_1 = require("../../utils/response");
const errors_1 = require("../../utils/errors");
const service_1 = require("./service");
exports.getMe = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.usersService.getCurrentUser(context.userId, context.universityId));
});
exports.updateMe = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.usersService.updateCurrentUser(context.userId, context.universityId, req.body));
});
exports.getUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.usersService.getPublicProfile(context.userId, getUserIdParam(req), context.universityId));
});
exports.listUsers = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const result = await service_1.usersService.listUsers(context.universityId, req.query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
});
exports.followUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.usersService.followUser(context.userId, getUserIdParam(req), context.universityId));
});
exports.unfollowUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.usersService.unfollowUser(context.userId, getUserIdParam(req), context.universityId));
});
exports.listFollowers = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const result = await service_1.usersService.listFollowers(getUserIdParam(req), context.universityId, req.query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
});
exports.listFollowing = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const result = await service_1.usersService.listFollowing(getUserIdParam(req), context.universityId, req.query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
});
exports.getSuggestions = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.usersService.getSuggestions(context.userId, context.universityId));
});
function getAuthContext(req) {
    if (!req.user)
        throw (0, errors_1.unauthorized)();
    return req.user;
}
function getUserIdParam(req) {
    const value = req.params.userId;
    return Array.isArray(value) ? value[0] : value;
}
