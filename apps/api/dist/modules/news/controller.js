"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteNews = exports.updateNews = exports.getNews = exports.createNews = exports.listNews = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const response_1 = require("../../utils/response");
const errors_1 = require("../../utils/errors");
const service_1 = require("./service");
exports.listNews = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    const result = await service_1.newsService.listNews(context, req.query);
    (0, response_1.sendPaginated)(res, result.items, result.total, result.page, result.limit);
});
exports.createNews = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.newsService.createNews(context, req.body), 201);
});
exports.getNews = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.newsService.getNews(context, getNewsIdParam(req)));
});
exports.updateNews = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.newsService.updateNews(context, getNewsIdParam(req), req.body));
});
exports.deleteNews = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const context = getAuthContext(req);
    (0, response_1.sendSuccess)(res, await service_1.newsService.deleteNews(context, getNewsIdParam(req)));
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
function getNewsIdParam(req) {
    const value = req.params.newsId;
    return Array.isArray(value) ? value[0] : value;
}
