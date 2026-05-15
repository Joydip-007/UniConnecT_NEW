"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
exports.pingRedis = pingRedis;
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("./env");
exports.redis = new ioredis_1.default(env_1.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
        if (times > 3)
            return null;
        return 500;
    },
});
async function pingRedis() {
    if (exports.redis.status === 'wait') {
        await exports.redis.connect();
    }
    await exports.redis.ping();
}
