"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.createKnexConfig = createKnexConfig;
const node_path_1 = __importDefault(require("node:path"));
const knex_1 = __importDefault(require("knex"));
const env_1 = require("./env");
const logger_1 = require("../utils/logger");
exports.db = (0, knex_1.default)(createKnexConfig());
function createKnexConfig() {
    const isDevelopment = env_1.env.NODE_ENV === 'development';
    return {
        client: 'pg',
        connection: env_1.env.DATABASE_URL,
        pool: {
            min: 2,
            max: 10,
        },
        migrations: {
            directory: node_path_1.default.join(__dirname, '../database/migrations'),
            extension: 'ts',
            tableName: 'knex_migrations',
        },
        log: isDevelopment
            ? {
                warn(message) {
                    logger_1.logger.warn('Knex warning', { message });
                },
                error(message) {
                    logger_1.logger.error('Knex error', { message });
                },
                deprecate(message) {
                    logger_1.logger.warn('Knex deprecation', { message });
                },
                debug(message) {
                    logger_1.logger.info('Knex debug', { message });
                },
            }
            : undefined,
    };
}
