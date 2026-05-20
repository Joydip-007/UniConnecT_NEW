"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedeemGiftCardSchema = exports.UpdateRequestSchema = exports.CreateRequestSchema = exports.IncomingRequestsQuerySchema = exports.AlumniListQuerySchema = exports.PaginationQuerySchema = exports.MentorshipStatusSchema = void 0;
const zod_1 = require("zod");
exports.MentorshipStatusSchema = zod_1.z.enum(['pending', 'accepted', 'declined', 'completed']);
exports.PaginationQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
});
exports.AlumniListQuerySchema = exports.PaginationQuerySchema;
exports.IncomingRequestsQuerySchema = exports.PaginationQuerySchema.extend({
    status: exports.MentorshipStatusSchema.optional(),
});
exports.CreateRequestSchema = zod_1.z.object({
    alumniId: zod_1.z.string().uuid(),
    message: zod_1.z.string().trim().min(1).max(500),
});
exports.UpdateRequestSchema = zod_1.z
    .object({
    status: exports.MentorshipStatusSchema.optional(),
    session_notes: zod_1.z.string().trim().max(2000).nullable().optional(),
    sessionNotes: zod_1.z.string().trim().max(2000).nullable().optional(),
})
    .refine((v) => v.status !== undefined || v.session_notes !== undefined || v.sessionNotes !== undefined, { message: 'At least one field is required' })
    .transform((v) => ({
    status: v.status,
    session_notes: v.session_notes ?? v.sessionNotes,
}));
exports.RedeemGiftCardSchema = zod_1.z.object({
    giftCardId: zod_1.z.string().uuid(),
});
