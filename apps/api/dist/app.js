"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const env_1 = require("./config/env");
const redis_1 = require("./config/redis");
const admin_1 = require("./modules/admin");
const auth_1 = require("./modules/auth");
const events_1 = require("./modules/events");
const feed_1 = require("./modules/feed");
const groups_1 = require("./modules/groups");
const jobs_1 = require("./modules/jobs");
const messages_1 = require("./modules/messages");
const news_1 = require("./modules/news");
const notifications_1 = require("./modules/notifications");
const campus_1 = require("./modules/campus");
const upload_1 = require("./modules/upload");
const users_1 = require("./modules/users");
const error_handler_1 = require("./middleware/error-handler");
const asyncHandler_1 = require("./utils/asyncHandler");
const db_1 = require("./config/db");
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, helmet_1.default)());
    app.use((0, cors_1.default)({ origin: env_1.env.CLIENT_URL, credentials: true }));
    app.use((0, morgan_1.default)(env_1.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
    app.use(express_1.default.json());
    app.use((0, cookie_parser_1.default)());
    app.get('/health', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
        await db_1.db.raw('SELECT 1');
        await (0, redis_1.pingRedis)();
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            db: 'connected',
            redis: 'connected',
        });
    }));
    app.use('/api/v1/admin', admin_1.adminRouter);
    app.use('/api/v1/auth', auth_1.authRouter);
    app.use('/api/v1/users', users_1.usersRouter);
    app.use('/api/v1/upload', upload_1.uploadRouter);
    app.use('/api/v1/posts', feed_1.feedRouter);
    app.use('/api/v1/polls', feed_1.pollsRouter);
    app.use('/api/v1/jobs', jobs_1.jobsRouter);
    app.use('/api/v1/events', events_1.eventsRouter);
    app.use('/api/v1/groups', groups_1.groupsRouter);
    app.use('/api/v1/conversations', messages_1.messagesRouter);
    app.use('/api/v1/notifications', notifications_1.notificationsRouter);
    app.use('/api/v1/news', news_1.newsRouter);
    app.use('/api/v1', campus_1.campusRouter);
    // Global error handler. Keep this mounted last.
    app.use(error_handler_1.errorHandler);
    return app;
}
