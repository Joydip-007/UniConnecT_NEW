"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResendOtpSchema = exports.ResetPasswordSchema = exports.ForgotPasswordSchema = exports.VerifyOtpSchema = exports.LoginSchema = exports.RegisterSchema = exports.OtpPurposeSchema = exports.AuthRoleSchema = void 0;
const zod_1 = require("zod");
exports.AuthRoleSchema = zod_1.z.enum(['student', 'alumni', 'faculty', 'admin']);
exports.OtpPurposeSchema = zod_1.z.enum(['verify', 'login', 'reset']);
exports.RegisterSchema = zod_1.z
    .object({
    email: zod_1.z.string().trim().email('Valid email is required').transform((value) => value.toLowerCase()).optional(),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters').optional(),
    full_name: zod_1.z.string().trim().min(1, 'Full name is required').optional(),
    fullName: zod_1.z.string().trim().min(1, 'Full name is required').optional(),
    role: exports.AuthRoleSchema.optional(),
    invitation_token: zod_1.z.string().trim().min(1).optional(),
    token: zod_1.z.string().trim().min(1).optional(),
    department: zod_1.z.string().trim().min(1).max(100).optional().nullable(),
})
    .transform((value) => ({
    email: value.email,
    password: value.password,
    full_name: value.full_name ?? value.fullName,
    role: value.role,
    invitation_token: value.invitation_token ?? value.token,
    department: value.department ?? null,
}))
    .refine((value) => Boolean(value.full_name), {
    message: 'Full name is required',
});
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email('Valid email is required').transform((value) => value.toLowerCase()),
    password: zod_1.z.string().min(1, 'Password is required'),
});
exports.VerifyOtpSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email('Valid email is required').transform((value) => value.toLowerCase()),
    otp: zod_1.z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
    purpose: exports.OtpPurposeSchema,
});
exports.ForgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email('Valid email is required').transform((value) => value.toLowerCase()),
});
exports.ResetPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email('Valid email is required').transform((value) => value.toLowerCase()),
    otp: zod_1.z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
    new_password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
});
exports.ResendOtpSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email('Valid email is required').transform((value) => value.toLowerCase()),
    purpose: exports.OtpPurposeSchema,
});
