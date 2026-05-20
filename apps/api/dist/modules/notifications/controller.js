"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.acceptGroupInvite = exports.deleteNotification = exports.markAllRead = exports.markRead = exports.listNotifications = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const response_1 = require("../../utils/response");
const errors_1 = require("../../utils/errors");
const service_1 = require("./service");
exports.listNotifications = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const result = await service_1.notificationsService.listNotifications(context.userId, req.query);
    (0, response_1.sendSuccess)(res, {
        items: result.items,
        total: result.total,
        page: result.page,
        hasMore: result.page * result.limit < result.total,
        unreadCount: result.unreadCount,
    });
});
exports.markRead = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.notificationsService.markRead(context.userId, getNotificationIdParam(req)));
});
exports.markAllRead = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.notificationsService.markAllRead(context.userId));
});
exports.deleteNotification = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.notificationsService.deleteNotification(context.userId, getNotificationIdParam(req)));
});
exports.acceptGroupInvite = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const universityId = req.university?.id ?? context.universityId;
    const result = await service_1.notificationsService.acceptGroupInvite(context.userId, universityId, context.role, getNotificationIdParam(req));
    (0, response_1.sendSuccess)(res, result);
});
function getAuthContext(req) {
    if (!req.user)
        throw (0, errors_1.unauthorized)();
    return req.user;
}
function getNotificationIdParam(req) {
    const value = req.params.notificationId;
    return Array.isArray(value) ? value[0] : value;
}
