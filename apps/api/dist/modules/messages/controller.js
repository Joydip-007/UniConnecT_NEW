"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markRead = exports.deleteMessage = exports.updateMessage = exports.createMessage = exports.listMessages = exports.leaveConversation = exports.updateConversation = exports.getConversation = exports.createConversation = exports.listConversations = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const response_1 = require("../../utils/response");
const errors_1 = require("../../utils/errors");
const service_1 = require("./service");
exports.listConversations = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.messagesService.listConversations(context));
});
exports.createConversation = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const { data, created } = await service_1.messagesService.createConversation(context, req.body);
    (0, response_1.sendSuccess)(res, data, created ? 201 : 200);
});
exports.getConversation = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.messagesService.getConversation(context, getConversationIdParam(req)));
});
exports.updateConversation = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.messagesService.updateConversation(context, getConversationIdParam(req), req.body));
});
exports.leaveConversation = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.messagesService.leaveConversation(context, getConversationIdParam(req)));
});
exports.listMessages = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const items = await service_1.messagesService.listMessages(context, getConversationIdParam(req), req.query);
    (0, response_1.sendSuccess)(res, { items });
});
exports.createMessage = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.messagesService.createMessage(context, getConversationIdParam(req), req.body), 201);
});
exports.updateMessage = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.messagesService.updateMessage(context, getConversationIdParam(req), getMessageIdParam(req), req.body));
});
exports.deleteMessage = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.messagesService.deleteMessage(context, getConversationIdParam(req), getMessageIdParam(req)));
});
exports.markRead = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.messagesService.markRead(context, getConversationIdParam(req)));
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
function getConversationIdParam(req) {
    const value = req.params.convId;
    return Array.isArray(value) ? value[0] : value;
}
function getMessageIdParam(req) {
    const value = req.params.msgId;
    return Array.isArray(value) ? value[0] : value;
}
