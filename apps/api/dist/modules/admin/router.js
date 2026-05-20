"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const university_1 = require("../../middleware/university");
const validate_1 = require("../../middleware/validate");
const errors_1 = require("../../utils/errors");
const controller_1 = require("./controller");
const schema_1 = require("./schema");
function validateContentKind(req, _res, next) {
    const result = schema_1.ContentKindSchema.safeParse(req.params.kind);
    if (!result.success) {
        return next(new errors_1.AppError('Invalid content kind', 404, 'NOT_FOUND'));
    }
    next();
}
exports.adminRouter = (0, express_1.Router)();
exports.adminRouter.use(auth_1.requireAuth, university_1.resolveUniversity, (0, auth_1.requireRole)('faculty', 'admin'));
exports.adminRouter.get('/stats', (0, auth_1.requireRole)('admin'), controller_1.getStats);
exports.adminRouter.get('/users', (0, validate_1.validateRequest)({ query: schema_1.PaginationQuerySchema }), controller_1.listUsers);
exports.adminRouter.patch('/users/:userId/role', (0, auth_1.requireRole)('admin'), (0, validate_1.validate)(schema_1.UpdateUserRoleSchema), controller_1.updateUserRole);
exports.adminRouter.patch('/users/:userId/status', (0, auth_1.requireRole)('admin'), (0, validate_1.validate)(schema_1.UpdateUserStatusSchema), controller_1.updateUserStatus);
exports.adminRouter.delete('/users/:userId', (0, auth_1.requireRole)('admin'), controller_1.deleteUser);
exports.adminRouter.get('/reports', (0, validate_1.validateRequest)({ query: schema_1.PaginationQuerySchema }), controller_1.listReports);
exports.adminRouter.patch('/reports/:reportId', (0, validate_1.validate)(schema_1.ResolveReportSchema), controller_1.resolveReport);
exports.adminRouter.post('/invitations/bulk', (0, auth_1.requireRole)('admin'), (0, validate_1.validate)(schema_1.CreateBulkInvitationsSchema), controller_1.createBulkInvitations);
exports.adminRouter.post('/invitations', (0, validate_1.validate)(schema_1.CreateInvitationSchema), controller_1.createInvitation);
exports.adminRouter.get('/invitations', (0, validate_1.validateRequest)({ query: schema_1.PaginationQuerySchema }), controller_1.listInvitations);
exports.adminRouter.delete('/invitations/:invitationId', (0, auth_1.requireRole)('admin'), controller_1.deleteInvitation);
exports.adminRouter.get('/university/domains', (0, auth_1.requireRole)('admin'), controller_1.getAllowedDomains);
exports.adminRouter.patch('/university/domains', (0, auth_1.requireRole)('admin'), (0, validate_1.validate)(schema_1.UpdateAllowedDomainsSchema), controller_1.updateAllowedDomains);
exports.adminRouter.get('/content/:kind', validateContentKind, (0, validate_1.validateRequest)({ query: schema_1.ContentListQuerySchema }), controller_1.listContent);
exports.adminRouter.delete('/content/:kind/:id', validateContentKind, controller_1.deleteContentItem);
exports.adminRouter.patch('/content/:kind/:id/pin', validateContentKind, (0, validate_1.validate)(schema_1.TogglePinSchema), controller_1.togglePin);
exports.adminRouter.patch('/content/:kind/:id/publish', validateContentKind, (0, validate_1.validate)(schema_1.TogglePublishSchema), controller_1.togglePublish);
exports.adminRouter.patch('/content/:kind/:id/active', validateContentKind, (0, validate_1.validate)(schema_1.ToggleActiveSchema), controller_1.toggleActive);
exports.adminRouter.get('/mentorship/redemptions', (0, auth_1.requireRole)('admin'), (0, validate_1.validateRequest)({ query: schema_1.AdminRedemptionListSchema }), controller_1.listAdminRedemptions);
exports.adminRouter.patch('/mentorship/redemptions/:redemptionId', (0, auth_1.requireRole)('admin'), (0, validate_1.validate)(schema_1.AdminFulfillRedemptionSchema), controller_1.updateAdminRedemption);
