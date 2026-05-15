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
    if (!parsed || parsed.template !== 'welcome')
        return false;
    const result = await email_service_1.emailService.sendWelcomeEmail(input.to, parsed.userName, parsed.role, parsed.universityName);
    if (!result.success) {
        throw new Error(result.error ?? 'Welcome email failed');
    }
    return true;
}
function parseTemplatePayload(value) {
    try {
        const parsed = JSON.parse(value);
        if (typeof parsed.template !== 'string' ||
            typeof parsed.userName !== 'string' ||
            typeof parsed.role !== 'string' ||
            typeof parsed.universityName !== 'string') {
            return null;
        }
        return {
            template: parsed.template,
            userName: parsed.userName,
            role: parsed.role,
            universityName: parsed.universityName,
        };
    }
    catch {
        return null;
    }
}
