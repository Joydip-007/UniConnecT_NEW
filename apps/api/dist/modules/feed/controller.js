"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unsavePost = exports.savePost = exports.votePoll = exports.createComment = exports.getComments = exports.removeReaction = exports.addReaction = exports.deletePost = exports.updatePost = exports.getPost = exports.createPost = exports.listPosts = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const response_1 = require("../../utils/response");
const errors_1 = require("../../utils/errors");
const service_1 = require("./service");
exports.listPosts = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const result = await service_1.feedService.listPosts(context.universityId, context.userId, req.query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
});
exports.createPost = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const post = await service_1.feedService.createPost(context, req.body);
    (0, response_1.sendSuccess)(res, post, 201);
});
exports.getPost = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.feedService.getPost(context.universityId, context.userId, getPostIdParam(req)));
});
exports.updatePost = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.feedService.updatePost(context, getPostIdParam(req), req.body));
});
exports.deletePost = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.feedService.deletePost(context, getPostIdParam(req)));
});
exports.addReaction = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.feedService.upsertReaction(context, getPostIdParam(req), req.body.reaction_type));
});
exports.removeReaction = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.feedService.removeReaction(context, getPostIdParam(req)));
});
exports.getComments = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const result = await service_1.feedService.listComments(context.universityId, context.userId, getPostIdParam(req), req.query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
});
exports.createComment = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.feedService.createComment(context, getPostIdParam(req), req.body), 201);
});
exports.votePoll = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const pollId = getPollIdParam(req);
    const result = pollId
        ? await service_1.feedService.votePollByPollId(context, pollId, req.body)
        : await service_1.feedService.votePoll(context, getPostIdParam(req), req.body);
    (0, response_1.sendSuccess)(res, result);
});
exports.savePost = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.feedService.savePost(context, getPostIdParam(req)), 201);
});
exports.unsavePost = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.feedService.unsavePost(context, getPostIdParam(req)));
});
function getAuthContext(req) {
    if (!req.user)
        throw (0, errors_1.unauthorized)();
    if (!req.university)
        throw new errors_1.AppError('University not resolved', 500, 'UNIVERSITY_NOT_RESOLVED');
    return {
        userId: req.user.userId,
        universityId: req.university.id,
        role: req.user.role,
    };
}
function getPostIdParam(req) {
    const value = req.params.postId;
    return Array.isArray(value) ? value[0] : value;
}
function getPollIdParam(req) {
    const value = req.params.pollId;
    return Array.isArray(value) ? value[0] : value;
}
