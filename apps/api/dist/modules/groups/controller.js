"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listGroupPosts = exports.removeMember = exports.updateMember = exports.listGroupMembers = exports.leaveGroup = exports.joinGroup = exports.deleteGroup = exports.updateGroup = exports.getGroup = exports.listMyGroups = exports.createGroup = exports.listGroups = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const response_1 = require("../../utils/response");
const errors_1 = require("../../utils/errors");
const service_1 = require("./service");
exports.listGroups = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const result = await service_1.groupsService.listGroups(context, req.query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
});
exports.createGroup = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.groupsService.createGroup(context, req.body), 201);
});
exports.listMyGroups = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const result = await service_1.groupsService.listMyGroups(context, req.query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
});
exports.getGroup = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.groupsService.getGroup(context, getGroupIdParam(req)));
});
exports.updateGroup = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.groupsService.updateGroup(context, getGroupIdParam(req), req.body));
});
exports.deleteGroup = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.groupsService.deleteGroup(context, getGroupIdParam(req)));
});
exports.joinGroup = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.groupsService.joinGroup(context, getGroupIdParam(req)), 201);
});
exports.leaveGroup = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.groupsService.leaveGroup(context, getGroupIdParam(req)));
});
exports.listGroupMembers = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const result = await service_1.groupsService.listMembers(context, getGroupIdParam(req), req.query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
});
exports.updateMember = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.groupsService.updateMember(context, getGroupIdParam(req), getUserIdParam(req), req.body.role));
});
exports.removeMember = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.groupsService.removeMember(context, getGroupIdParam(req), getUserIdParam(req)));
});
exports.listGroupPosts = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const result = await service_1.groupsService.listGroupPosts(context, getGroupIdParam(req), req.query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
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
function getGroupIdParam(req) {
    const value = req.params.groupId;
    return Array.isArray(value) ? value[0] : value;
}
function getUserIdParam(req) {
    const value = req.params.userId;
    return Array.isArray(value) ? value[0] : value;
}
