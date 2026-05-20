"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAdminRedemption = exports.listAdminRedemptions = exports.toggleActive = exports.togglePublish = exports.togglePin = exports.deleteContentItem = exports.listContent = exports.updateAllowedDomains = exports.getAllowedDomains = exports.deleteInvitation = exports.listInvitations = exports.createBulkInvitations = exports.createInvitation = exports.resolveReport = exports.listReports = exports.deleteUser = exports.updateUserStatus = exports.updateUserRole = exports.listUsers = exports.getStats = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const response_1 = require("../../utils/response");
const errors_1 = require("../../utils/errors");
const service_1 = require("./service");
const content_service_1 = require("./content.service");
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
exports.deleteUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { universityId, userId: adminUserId } = getAdminContext(req);
    const userId = req.params.userId;
    (0, response_1.sendSuccess)(res, await service_1.adminService.deleteUser(universityId, adminUserId, userId));
});
exports.listReports = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { universityId } = getAdminContext(req);
    const result = await service_1.adminService.listReports(universityId, req.query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
});
exports.resolveReport = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { universityId, userId } = getAdminContext(req);
    const reportId = req.params.reportId;
    (0, response_1.sendSuccess)(res, await service_1.adminService.resolveReport(universityId, userId, reportId, req.body));
});
exports.createInvitation = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { universityId, userId } = getAdminContext(req);
    (0, response_1.sendSuccess)(res, await service_1.adminService.createInvitation(universityId, userId, req.body, req.university.name), 201);
});
exports.createBulkInvitations = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { universityId, userId } = getAdminContext(req);
    (0, response_1.sendSuccess)(res, await service_1.adminService.createBulkInvitations(universityId, userId, req.body, req.university.name), 201);
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
exports.getAllowedDomains = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { universityId } = getAdminContext(req);
    (0, response_1.sendSuccess)(res, await service_1.adminService.getAllowedEmailDomains(universityId));
});
exports.updateAllowedDomains = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { universityId } = getAdminContext(req);
    const { allowed_email_domains } = req.body;
    (0, response_1.sendSuccess)(res, await service_1.adminService.updateAllowedEmailDomains(universityId, allowed_email_domains));
});
function getAdminContext(req) {
    if (!req.user)
        throw new errors_1.AppError('Unauthorized', 401, 'AUTH_REQUIRED');
    if (!req.university)
        throw new errors_1.AppError('University not resolved', 500, 'UNIVERSITY_NOT_RESOLVED');
    return { userId: req.user.userId, universityId: req.university.id, role: req.user.role };
}
exports.listContent = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { universityId } = getAdminContext(req);
    const kind = req.params.kind;
    const query = req.query;
    const result = kind === 'posts' ? await content_service_1.adminContentService.listPosts(universityId, query) :
        kind === 'events' ? await content_service_1.adminContentService.listEvents(universityId, query) :
            kind === 'jobs' ? await content_service_1.adminContentService.listJobs(universityId, query) :
                await content_service_1.adminContentService.listNews(universityId, query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
});
exports.deleteContentItem = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { universityId } = getAdminContext(req);
    const kind = req.params.kind;
    const id = req.params.id;
    (0, response_1.sendSuccess)(res, await content_service_1.adminContentService.deleteItem(kind, universityId, id));
});
exports.togglePin = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { universityId } = getAdminContext(req);
    const kind = req.params.kind;
    const id = req.params.id;
    const { is_pinned } = req.body;
    (0, response_1.sendSuccess)(res, await content_service_1.adminContentService.togglePin(kind, universityId, id, is_pinned));
});
exports.togglePublish = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { universityId } = getAdminContext(req);
    const kind = req.params.kind;
    const id = req.params.id;
    const { is_published } = req.body;
    (0, response_1.sendSuccess)(res, await content_service_1.adminContentService.togglePublish(kind, universityId, id, is_published));
});
exports.toggleActive = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { universityId } = getAdminContext(req);
    const kind = req.params.kind;
    const id = req.params.id;
    const { is_active } = req.body;
    (0, response_1.sendSuccess)(res, await content_service_1.adminContentService.toggleActive(kind, universityId, id, is_active));
});
exports.listAdminRedemptions = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { universityId } = getAdminContext(req);
    const result = await service_1.adminService.listRedemptions(universityId, req.query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
});
exports.updateAdminRedemption = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { universityId, userId } = getAdminContext(req);
    const redemptionId = req.params.redemptionId;
    (0, response_1.sendSuccess)(res, await service_1.adminService.updateRedemption(universityId, userId, redemptionId, req.body));
});
