"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteInvitation = exports.listInvitations = exports.createInvitation = exports.resolveReport = exports.listReports = exports.updateUserStatus = exports.updateUserRole = exports.listUsers = exports.getStats = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const response_1 = require("../../utils/response");
const errors_1 = require("../../utils/errors");
const service_1 = require("./service");
exports.getStats = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { universityId } = getAdminContext(req);
    (0, response_1.sendSuccess)(res, await service_1.adminService.getStats(universityId));
});
exports.listUsers = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { universityId } = getAdminContext(req);
    const result = await service_1.adminService.listUsers(universityId, req.query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
});
exports.updateUserRole = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { universityId } = getAdminContext(req);
    const userId = req.params.userId;
    (0, response_1.sendSuccess)(res, await service_1.adminService.updateUserRole(universityId, userId, req.body));
});
exports.updateUserStatus = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { universityId } = getAdminContext(req);
    const userId = req.params.userId;
    (0, response_1.sendSuccess)(res, await service_1.adminService.updateUserStatus(universityId, userId, req.body));
});
exports.listReports = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { universityId } = getAdminContext(req);
    const result = await service_1.adminService.listReports(universityId, req.query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
});
exports.resolveReport = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { userId } = getAdminContext(req);
    const reportId = req.params.reportId;
    (0, response_1.sendSuccess)(res, await service_1.adminService.resolveReport(userId, reportId, req.body));
});
exports.createInvitation = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { universityId, userId } = getAdminContext(req);
    (0, response_1.sendSuccess)(res, await service_1.adminService.createInvitation(universityId, userId, req.body), 201);
});
exports.listInvitations = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { universityId } = getAdminContext(req);
    const result = await service_1.adminService.listInvitations(universityId, req.query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
});
exports.deleteInvitation = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { universityId } = getAdminContext(req);
    const invitationId = req.params.invitationId;
    (0, response_1.sendSuccess)(res, await service_1.adminService.deleteInvitation(universityId, invitationId));
});
function getAdminContext(req) {
    if (!req.user)
        throw new errors_1.AppError('Unauthorized', 401, 'AUTH_REQUIRED');
    if (!req.university)
        throw new errors_1.AppError('University not resolved', 500, 'UNIVERSITY_NOT_RESOLVED');
    return { userId: req.user.userId, universityId: req.university.id, role: req.user.role };
}
