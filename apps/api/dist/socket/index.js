"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSocketServer = exports.initializeSocket = void 0;
exports.setupSocket = setupSocket;
exports.getIo = getIo;
const redis_adapter_1 = require("@socket.io/redis-adapter");
const socket_io_1 = require("socket.io");
const env_1 = require("../config/env");
const token_service_1 = require("../services/token.service");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
let io = null;
function setupSocket(httpServer, redisClient) {
    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: env_1.env.CLIENT_URL,
            credentials: true,
        },
    });
    io.adapter((0, redis_adapter_1.createAdapter)(pubClient, subClient));
    void connectAdapterClients(pubClient, subClient);
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (typeof token !== 'string' || !token) {
            next(new Error('Unauthorized'));
            return;
        }
        const payload = token_service_1.tokenService.verifyAccessToken(token);
        if (!payload) {
            next(new Error('Unauthorized'));
            return;
        }
        socket.data.user = {
            userId: payload.userId,
            universityId: payload.universityId,
            role: payload.role,
        };
        next();
    });
    io.on('connection', (socket) => {
        const user = socket.data.user;
        socket.join(`uni:${user.universityId}`);
        socket.join(`user:${user.userId}`);
        socket.on('typing:start', (payload) => {
            const convId = getConversationId(payload);
            if (!convId)
                return;
            socket.to(`conv:${convId}`).emit('typing:start', { userId: user.userId, convId });
            socket.to(`conv:${convId}`).emit('conv:typing', { conversationId: convId, userId: user.userId, isTyping: true });
        });
        socket.on('typing:stop', (payload) => {
            const convId = getConversationId(payload);
            if (!convId)
                return;
            socket.to(`conv:${convId}`).emit('typing:stop', { userId: user.userId, convId });
            socket.to(`conv:${convId}`).emit('conv:typing', { conversationId: convId, userId: user.userId, isTyping: false });
        });
        socket.on('conv:typing:start', (payload) => {
            const convId = getConversationId(payload);
            if (!convId)
                return;
            socket.to(`conv:${convId}`).emit('conv:typing', { conversationId: convId, userId: user.userId, isTyping: true });
        });
        socket.on('conv:typing:stop', (payload) => {
            const convId = getConversationId(payload);
            if (!convId)
                return;
            socket.to(`conv:${convId}`).emit('conv:typing', { conversationId: convId, userId: user.userId, isTyping: false });
        });
        socket.on('join:conversation', (convId) => {
            if (typeof convId !== 'string' || !convId)
                return;
            socket.join(`conv:${convId}`);
        });
        socket.on('conv:join', (payload) => {
            const convId = getConversationId(payload);
            if (!convId)
                return;
            socket.join(`conv:${convId}`);
        });
        socket.on('leave:conversation', (convId) => {
            if (typeof convId !== 'string' || !convId)
                return;
            socket.leave(`conv:${convId}`);
        });
        socket.on('conv:leave', (payload) => {
            const convId = getConversationId(payload);
            if (!convId)
                return;
            socket.leave(`conv:${convId}`);
        });
        logger_1.logger.info('Socket connected', { socketId: socket.id, userId: user.userId });
    });
    return io;
}
function getIo() {
    if (!io) {
        throw new errors_1.AppError('Socket server is not initialized', 500, 'SOCKET_NOT_INITIALIZED');
    }
    return io;
}
exports.initializeSocket = setupSocket;
exports.getSocketServer = getIo;
async function connectAdapterClients(pubClient, subClient) {
    try {
        await Promise.all([connectIfWaiting(pubClient), connectIfWaiting(subClient)]);
    }
    catch (error) {
        logger_1.logger.error('Socket redis adapter connection failed', { error });
    }
}
async function connectIfWaiting(client) {
    if (client.status === 'wait') {
        await client.connect();
    }
}
function getConversationId(payload) {
    if (typeof payload === 'string' && payload)
        return payload;
    if (typeof payload !== 'object' || payload === null)
        return null;
    const convId = payload.convId
        ?? payload.conversationId;
    return typeof convId === 'string' && convId ? convId : null;
}
