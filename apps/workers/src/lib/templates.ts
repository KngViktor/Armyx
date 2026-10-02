/**
 * Notification templates. Plain, short SMS (one 160-char segment where
 * possible) and simple accessible HTML emails. No personal data beyond the
 * first name and application number is ever placed in a message.
 */
import { NotificationTemplate, STATUS_LABELS, ApplicationStatus } from '@armyx/shared';
import { env } from './env';

export interface Rendered {
  subject: string;
  text: string;
  sms: string;
}

const FREE = 'Recruitment is FREE. Never pay anyone.';

export function render(t: NotificationTemplate, v: Record<string, string>): Rendered {
  const name = v.firstName ? `Dear ${v.firstName},` : 'Dear Applicant,';
  switch (t) {
    case 'otp':
      return {
        subject: 'Your verification code',
        text: `${name}\n\nYour Nigerian Army recruitment portal verification code is ${v.code}. It expires in 10 minutes.\n\nIf you did not request this, ignore this message.`,
        sms: `NA Recruitment code: ${v.code}. Expires in 10 min. Do not share it. ${FREE}`,
      };
    case 'welcome':
      return {
        subject: 'Your recruitment portal account is ready',
        text: `${name}\n\nYour account has been verified. Sign in at ${env.publicWebUrl}/portal to complete your application before the closing date.\n\n${FREE}`,
        sms: `Your NA recruitment account is verified. Complete your application at ${env.publicWebUrl}/portal. ${FREE}`,
      };
    case 'submission_received':
      return {
        subject: `Application received — ${v.applicationNo}`,
        text: `${name}\n\nYour application has been received.\nApplication number: ${v.applicationNo}\n\nDownload and print your acknowledgement slip from the portal dashboard. You will be notified by email and SMS when your status changes.\n\n${FREE}`,
        sms: `NA Recruitment: application ${v.applicationNo} received. Print your slip on the portal. ${FREE}`,
      };
    case 'status_changed': {
      const label = STATUS_LABELS[v.status as ApplicationStatus] ?? v.status;
      return {
        subject: `Application status update: ${label}`,
        text: `${name}\n\nThe status of your application has changed to: ${label}.\nSign in at ${env.publicWebUrl}/portal for details.\n\n${FREE}`,
        sms: `NA Recruitment: your application status is now "${label}". Check ${env.publicWebUrl}/portal`,
      };
    }
    case 'screening_invite':
      return {
        subject: 'Invitation for screening',
        text: `${name}\n\nCongratulations. You have been invited for screening.\n\nVenue: ${v.centre}\nAddress: ${v.address}\nDate: ${v.date}\n\nBring your printed acknowledgement slip, original credentials and sportswear.\n\n${FREE}`,
        sms: `NA Recruitment: screening at ${v.centre} on ${v.date}. Bring your slip & originals. ${FREE}`,
      };
    case 'password_reset':
      return {
        subject: 'Reset your password',
        text: `${name}\n\nUse this link within 30 minutes to reset your password:\n${env.publicWebUrl}/portal/reset-password?token=${v.token}\n\nIf you did not request this, ignore this email.`,
        sms: '',
      };
    case 'admin_invite':
      return {
        subject: 'Recruitment portal administrator invitation',
        text: `Dear ${v.name},\n\nYou have been granted access to the recruitment administration console. Set your password within 72 hours:\n${env.publicWebUrl}/admin/accept-invite?token=${v.token}\n\nTwo-factor authentication will be required at first sign-in.`,
        sms: '',
      };
  }
}

export const htmlEmail = (subject: string, text: string) => `<!doctype html><html lang="en"><body style="margin:0;background:#f4f3ee;font-family:Arial,Helvetica,sans-serif;color:#1f2a1c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="600" style="max-width:600px;background:#fff;border-top:6px solid #3b4a2a">
<tr><td style="padding:20px 28px;background:#2f3b22;color:#fff;font-family:Georgia,serif;font-size:20px">Nigerian Army &mdash; Recruitment</td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.6">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</td></tr>
<tr><td style="padding:16px 28px;background:#f4f3ee;font-size:12px;color:#5b6150">This is an automated message about "${subject.replace(/</g, '&lt;')}". Please do not reply.</td></tr>
</table></td></tr></table></body></html>`;
