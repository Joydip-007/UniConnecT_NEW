"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unsaveJob = exports.saveJob = exports.updateApplication = exports.listJobApplications = exports.applyToJob = exports.deleteJob = exports.updateJob = exports.getJob = exports.listMyApplications = exports.listMyJobs = exports.listSavedJobs = exports.createJob = exports.listJobs = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const response_1 = require("../../utils/response");
const errors_1 = require("../../utils/errors");
const service_1 = require("./service");
exports.listJobs = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const result = await service_1.jobsService.listJobs(context.universityId, context.userId, req.query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
});
exports.createJob = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.jobsService.createJob(context, req.body), 201);
});
exports.listSavedJobs = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const result = await service_1.jobsService.listSavedJobs(context.universityId, context.userId, req.query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
});
exports.listMyJobs = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const result = await service_1.jobsService.listMyJobs(context.universityId, context.userId, req.query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
});
exports.listMyApplications = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const result = await service_1.jobsService.listMyApplications(context.universityId, context.userId, req.query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
});
exports.getJob = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.jobsService.getJob(context.universityId, context.userId, getJobIdParam(req)));
});
exports.updateJob = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.jobsService.updateJob(context, getJobIdParam(req), req.body));
});
exports.deleteJob = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.jobsService.deleteJob(context, getJobIdParam(req)));
});
exports.applyToJob = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.jobsService.applyToJob(context, getJobIdParam(req), req.body), 201);
});
exports.listJobApplications = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const result = await service_1.jobsService.listJobApplications(context, getJobIdParam(req), req.query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
});
exports.updateApplication = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.jobsService.updateApplication(context, getJobIdParam(req), getApplicationIdParam(req), req.body));
});
exports.saveJob = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.jobsService.saveJob(context, getJobIdParam(req)), 201);
});
exports.unsaveJob = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.jobsService.unsaveJob(context, getJobIdParam(req)));
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
function getJobIdParam(req) {
    const value = req.params.jobId;
    return Array.isArray(value) ? value[0] : value;
}
function getApplicationIdParam(req) {
    const value = req.params.appId;
    return Array.isArray(value) ? value[0] : value;
}
