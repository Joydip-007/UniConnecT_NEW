"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const email_queue_1 = require("../queues/email.queue");
const email_service_1 = require("../services/email.service");
const logger_1 = require("../utils/logger");
email_queue_1.emailQueue.process(async (job) => {
    const input = job.data;
    const handled = await handleTemplateEmail(input);
    if (handled)
        return;
    const result = await email_service_1.emailService.sendQueuedEmail(input);
    if (!result.success) {
        throw new Error(result.error ?? 'Queued email failed');
    }
});
email_queue_1.emailQueue.on('failed', (job, error) => {
    logger_1.logger.error('Email queue job failed', { jobId: job?.id, error });
});
async function handleTemplateEmail(input) {
    if (!input.text)
        return false;
    const parsed = parseTemplatePayload(input.text);
    if (!parsed)
        return false;
    if (parsed.template === 'welcome') {
        const result = await email_service_1.emailService.sendWelcomeEmail(input.to, parsed.userName, parsed.role, parsed.universityName);
        if (!result.success) {
            throw new Error(result.error ?? 'Welcome email failed');
        }
        return true;
    }
    if (parsed.template === 'otp') {
        const result = await email_service_1.emailService.sendOtpEmail(input.to, parsed.otp, parsed.purpose, parsed.userName);
        if (!result.success) {
            throw new Error(result.error ?? 'OTP email failed');
        }
        return true;
    }
    if (parsed.template === 'invitation') {
        const result = await email_service_1.emailService.sendInvitationEmail(input.to, parsed.registerUrl, parsed.role, parsed.universityName, parsed.token);
        if (!result.success) {
            throw new Error(result.error ?? 'Invitation email failed');
        }
        return true;
    }
    return false;
}
function parseTemplatePayload(value) {
    try {
        const parsed = JSON.parse(value);
        if (typeof parsed.template !== 'string' ||
            typeof parsed.userName !== 'string') {
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
}
