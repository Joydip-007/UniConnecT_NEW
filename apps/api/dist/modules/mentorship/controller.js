"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redeemGiftCard = exports.listGiftCards = exports.getMyRewards = exports.updateRequest = exports.getIncomingRequests = exports.getMyRequests = exports.createRequest = exports.listAlumni = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const response_1 = require("../../utils/response");
const errors_1 = require("../../utils/errors");
const service_1 = require("./service");
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
function sendPage(res, result) {
    return res.json({ data: result });
}
exports.listAlumni = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { universityId } = getAuthContext(req);
    const query = req.query;
    sendPage(res, await service_1.mentorshipService.listAlumni(universityId, query));
});
exports.createRequest = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.mentorshipService.createRequest(context, req.body), 201);
});
exports.getMyRequests = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const query = req.query;
    sendPage(res, await service_1.mentorshipService.getMyRequests(context.universityId, context.userId, query));
});
exports.getIncomingRequests = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const query = req.query;
    sendPage(res, await service_1.mentorshipService.getIncomingRequests(context.universityId, context.userId, query));
});
exports.updateRequest = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const requestId = req.params.id;
    (0, response_1.sendSuccess)(res, await service_1.mentorshipService.updateRequest(context, requestId, req.body));
});
exports.getMyRewards = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { userId, universityId } = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.mentorshipService.getMyRewards(universityId, userId));
});
exports.listGiftCards = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    (0, response_1.sendSuccess)(res, await service_1.mentorshipService.listGiftCards());
});
exports.redeemGiftCard = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.mentorshipService.redeem(context, req.body), 201);
});
