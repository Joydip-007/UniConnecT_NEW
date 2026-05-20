"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailService = exports.ResendEmailService = void 0;
const resend_1 = require("resend");
const env_1 = require("../config/env");
const otpSubjects = {
    verify: 'Verify your UniConnecT account',
    login: 'Your login code — UniConnecT',
    reset: 'Reset your UniConnecT password',
};
const otpMessages = {
    verify: 'Use this code to verify your account and finish joining your university network.',
    login: 'Use this code to complete your UniConnecT sign-in.',
    reset: 'Use this code to reset your UniConnecT password.',
};
class ResendEmailService {
    resend;
    constructor() {
        this.resend = env_1.env.RESEND_API_KEY ? new resend_1.Resend(env_1.env.RESEND_API_KEY) : null;
    }
    async sendOtpEmail(to, otp, purpose, userName) {
        return this.sendEmail({
            to,
            subject: otpSubjects[purpose],
            html: renderOtpHtml({
                userName,
                otp,
                message: otpMessages[purpose],
            }),
            text: `Hi ${userName}, your UniConnecT code is ${otp}. This code expires in 10 minutes.`,
            tags: [
                { name: 'category', value: 'auth_otp' },
                { name: 'purpose', value: purpose },
                { name: 'app', value: 'uniconnect' },
            ],
        });
    }
    async sendWelcomeEmail(to, userName, role, universityName) {
        return this.sendEmail({
            to,
            subject: 'Welcome to UniConnecT',
            html: renderSimpleHtml({
                userName,
                title: 'Welcome to UniConnecT',
                message: `Your ${role} account for ${universityName} is verified. Your campus network is ready for you.`,
                actionUrl: undefined,
                actionLabel: undefined,
            }),
            text: `Hi ${userName}, welcome to UniConnecT. Your ${role} account for ${universityName} is verified.`,
            tags: [
                { name: 'category', value: 'welcome' },
                { name: 'app', value: 'uniconnect' },
            ],
        });
    }
    async sendInvitationEmail(to, registerUrl, role, universityName, token) {
        return this.sendEmail({
            to,
            subject: "You're invited to join UniConnecT",
            html: renderInvitationHtml({ registerUrl, role, universityName, token }),
            text: `You've been invited to join ${universityName} on UniConnecT as a ${role}. Create your account here: ${registerUrl}\n\nYour invite token: ${token}`,
            tags: [
                { name: 'category', value: 'invitation' },
                { name: 'app', value: 'uniconnect' },
            ],
        });
    }
    async sendJobAlertEmail(to, userName, jobTitle, company, jobUrl) {
        return this.sendEmail({
            to,
            subject: `${jobTitle} at ${company}`,
            html: renderSimpleHtml({
                userName,
                title: 'New job opportunity',
                message: `${company} posted ${jobTitle}. Open the listing to review the details and apply when it feels right.`,
                actionUrl: jobUrl,
                actionLabel: 'View job',
            }),
            text: `Hi ${userName}, ${company} posted ${jobTitle}. View it here: ${jobUrl}`,
            tags: [
                { name: 'category', value: 'job_alert' },
                { name: 'app', value: 'uniconnect' },
            ],
        });
    }
    async sendQueuedEmail(input) {
        return this.sendEmail({
            to: input.to,
            subject: input.subject,
            html: input.html ?? input.text ?? '',
            text: input.text ?? stripHtml(input.html ?? ''),
            tags: [
                { name: 'category', value: 'queued' },
                { name: 'app', value: 'uniconnect' },
            ],
        });
    }
    async sendEmail(input) {
        if (!this.resend) {
            return {
                success: false,
                error: 'RESEND_API_KEY is not configured',
            };
        }
        try {
            const { data, error } = await this.resend.emails.send({
                from: env_1.env.RESEND_FROM_EMAIL,
                to: [input.to],
                subject: input.subject,
                html: input.html,
                text: input.text,
                tags: input.tags,
            });
            if (error) {
                return {
                    success: false,
                    error: error.message,
                };
            }
            return {
                success: true,
                id: data?.id,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Email send failed',
            };
        }
    }
}
exports.ResendEmailService = ResendEmailService;
exports.emailService = new ResendEmailService();
function renderOtpHtml(input) {
    const userName = escapeHtml(input.userName);
    const otp = escapeHtml(input.otp);
    const message = escapeHtml(input.message);
    return `
    <div style="margin:0;padding:0;background:#060D1A;color:#EEF2FF;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#060D1A;margin:0;padding:0;">
        <tr>
          <td align="center" style="padding:32px 16px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:560px;background:#0A1628;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="padding:28px 24px 8px;">
                  <div style="font-size:18px;line-height:1.3;font-weight:500;color:#F05A28;">UniConnecT</div>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 24px 0;">
                  <p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#DDE6FF;">Hi ${userName},</p>
                  <p style="margin:0;font-size:16px;line-height:1.6;color:#B8C4E6;">${message}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:24px;">
                  <div style="font-family:'Courier New',Courier,monospace;font-size:40px;line-height:1.2;letter-spacing:10px;color:#5B5BD6;background:#111D35;border-radius:12px;padding:20px;text-align:center;">${otp}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:0 24px 28px;">
                  <p style="margin:0;font-size:14px;line-height:1.6;color:#B8C4E6;">This code expires in 10 minutes.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 24px 24px;border-top:1px solid rgba(255,255,255,0.08);">
                  <p style="margin:0;font-size:12px;line-height:1.5;color:#7180A3;">UniConnecT — Your campus. One place.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}
function renderSimpleHtml(input) {
    const userName = escapeHtml(input.userName);
    const title = escapeHtml(input.title);
    const message = escapeHtml(input.message);
    const action = input.actionUrl && input.actionLabel
        ? `<a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;margin-top:22px;background:#5B5BD6;color:#FFFFFF;text-decoration:none;border-radius:999px;padding:12px 18px;font-size:14px;">${escapeHtml(input.actionLabel)}</a>`
        : '';
    return `
    <div style="margin:0;padding:0;background:#060D1A;color:#EEF2FF;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#060D1A;margin:0;padding:0;">
        <tr>
          <td align="center" style="padding:32px 16px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:560px;background:#0A1628;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="padding:28px 24px 8px;">
                  <div style="font-size:18px;line-height:1.3;font-weight:500;color:#F05A28;">UniConnecT</div>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 24px 28px;">
                  <p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#DDE6FF;">Hi ${userName},</p>
                  <h1 style="margin:0 0 14px;font-size:24px;line-height:1.3;font-weight:500;color:#EEF2FF;">${title}</h1>
                  <p style="margin:0;font-size:16px;line-height:1.6;color:#B8C4E6;">${message}</p>
                  ${action}
                </td>
              </tr>
              <tr>
                <td style="padding:18px 24px 24px;border-top:1px solid rgba(255,255,255,0.08);">
                  <p style="margin:0;font-size:12px;line-height:1.5;color:#7180A3;">UniConnecT — Your campus. One place.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}
function renderInvitationHtml(input) {
    const registerUrl = escapeHtml(input.registerUrl);
    const role = escapeHtml(input.role);
    const universityName = escapeHtml(input.universityName);
    const token = escapeHtml(input.token);
    return `
    <div style="margin:0;padding:0;background:#060D1A;color:#EEF2FF;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#060D1A;margin:0;padding:0;">
        <tr>
          <td align="center" style="padding:32px 16px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:560px;background:#0A1628;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="padding:28px 24px 8px;">
                  <div style="font-size:18px;line-height:1.3;font-weight:500;color:#F05A28;">UniConnecT</div>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 24px 28px;">
                  <h1 style="margin:0 0 14px;font-size:24px;line-height:1.3;font-weight:500;color:#EEF2FF;">You've been invited</h1>
                  <p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#B8C4E6;">You've been invited to join <strong style="color:#DDE6FF;">${universityName}</strong> on UniConnecT as a <strong style="color:#DDE6FF;">${role}</strong>.</p>
                  <p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:#B8C4E6;">Click below to create your account. This link is personal — please don't share it.</p>
                  <a href="${registerUrl}" style="display:inline-block;background:#5B5BD6;color:#FFFFFF;text-decoration:none;border-radius:999px;padding:12px 18px;font-size:14px;">Create account</a>
                  <p style="margin:22px 0 8px;font-size:14px;line-height:1.6;color:#B8C4E6;">Or enter this invite token on the registration page:</p>
                  <div style="font-family:'Courier New',Courier,monospace;font-size:14px;line-height:1.4;letter-spacing:1px;color:#DDE6FF;background:#111D35;border-radius:10px;padding:14px 16px;word-break:break-all;">${token}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 24px 24px;border-top:1px solid rgba(255,255,255,0.08);">
                  <p style="margin:0;font-size:12px;line-height:1.5;color:#7180A3;">UniConnecT — Your campus. One place.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}
function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
function stripHtml(value) {
    return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
