"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
require("dotenv/config");
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().int().positive().default(3001),
    CLIENT_URL: zod_1.z.string().optional(),
    WEB_URL: zod_1.z.string().optional(),
    DATABASE_URL: zod_1.z.string().default('postgresql://postgres@localhost:5432/uniconnect_db'),
    REDIS_URL: zod_1.z.string().default('redis://localhost:6379'),
    JWT_SECRET: zod_1.z.string().min(32).default('development-jwt-secret-change-before-production'),
    JWT_REFRESH_SECRET: zod_1.z.string().min(32).default('development-refresh-secret-change-before-production'),
    RESEND_API_KEY: zod_1.z.string().optional(),
    RESEND_FROM_EMAIL: zod_1.z.string().optional(),
    EMAIL_FROM: zod_1.z.string().optional(),
    AWS_REGION: zod_1.z.string().default('ap-southeast-1'),
    AWS_S3_BUCKET: zod_1.z.string().default('uniconnect-local'),
    AWS_ACCESS_KEY_ID: zod_1.z.string().optional(),
    AWS_SECRET_ACCESS_KEY: zod_1.z.string().optional(),
    OTP_EXPIRES_MINUTES: zod_1.z.coerce.number().int().positive().default(10),
    OTP_RESEND_COOLDOWN_SECONDS: zod_1.z.coerce.number().int().positive().default(60),
    DEV_INVITE_TOKEN: zod_1.z.string().default('dev-invite'),
    DEV_INVITE_EMAIL: zod_1.z.string().email().default('student@uiu.ac.bd'),
    DEV_INVITE_ROLE: zod_1.z.enum(['student', 'alumni', 'faculty', 'admin']).default('student'),
});
const parsedEnv = envSchema.parse(process.env);
const clientUrl = parsedEnv.CLIENT_URL ?? parsedEnv.WEB_URL ?? 'http://localhost:5173';
const resendFromEmail = parsedEnv.RESEND_FROM_EMAIL ?? parsedEnv.EMAIL_FROM ?? 'UniConnecT <noreply@uniconnectt.me>';
exports.env = {
    ...parsedEnv,
    CLIENT_URL: clientUrl,
    WEB_URL: clientUrl,
    RESEND_FROM_EMAIL: resendFromEmail,
    EMAIL_FROM: resendFromEmail,
};
