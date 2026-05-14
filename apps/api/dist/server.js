"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = require("node:http");
const app_1 = require("./app");
const db_1 = require("./config/db");
const redis_1 = require("./config/redis");
const env_1 = require("./config/env");
const socket_1 = require("./socket");
const logger_1 = require("./utils/logger");
require("./workers");
const app = (0, app_1.createApp)();
const httpServer = (0, node_http_1.createServer)(app);
(0, socket_1.setupSocket)(httpServer, redis_1.redis);
httpServer.listen(env_1.env.PORT, () => {
    logger_1.logger.info('API listening', { port: env_1.env.PORT });
});
for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
        httpServer.close(() => {
            void Promise.allSettled([db_1.db.destroy(), redis_1.redis.quit()]).finally(() => process.exit(0));
        });
    });
}
