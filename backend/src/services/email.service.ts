import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST || 'localhost',
  port: env.SMTP_PORT || 25,
  secure: false,
  ignoreTLS: true,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
})

export const emailService = {
  sendApprovalEmail(to: string, name: string): void {
    const html = `
      <h2>Account Approved</h2>
      <p>Hello ${name},</p>
      <p>Your ISTRAC-FMS account registration has been approved. You may now log in to the portal.</p>
      <p><a href="${env.APP_URL}/login">Access ISTRAC-FMS</a></p>
    `
    transporter
      .sendMail({
        from: '"ISTRAC-FMS" <no-reply@istrac.gov.in>',
        to,
        subject: 'Your ISTRAC-FMS account has been approved',
        html,
      })
      .catch((err) => console.error('[EmailService] Approval email failed:', err))
  },

  sendRejectionEmail(to: string, name: string, reason?: string): void {
    const html = `
      <h2>Registration Update</h2>
      <p>Hello ${name},</p>
      <p>Your request to register for ISTRAC-FMS could not be approved at this time.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
    `
    transporter
      .sendMail({
        from: '"ISTRAC-FMS" <no-reply@istrac.gov.in>',
        to,
        subject: 'ISTRAC-FMS Registration Update',
        html,
      })
      .catch((err) => console.error('[EmailService] Rejection email failed:', err))
  },

  sendSuspensionEmail(to: string, name: string): void {
    const html = `
      <h2>Account Status Notification</h2>
      <p>Hello ${name},</p>
      <p>Your ISTRAC-FMS account has been suspended. Please contact your department administrator for details.</p>
    `
    transporter
      .sendMail({
        from: '"ISTRAC-FMS" <no-reply@istrac.gov.in>',
        to,
        subject: 'ISTRAC-FMS Account Suspended',
        html,
      })
      .catch((err) => console.error('[EmailService] Suspension email failed:', err))
  },

  sendPasswordResetEmail(to: string, name: string, resetLink: string): void {
    const html = `
      <h2>Password Reset Request</h2>
      <p>Hello ${name},</p>
      <p>We received a request to reset your ISTRAC-FMS password. Click the link below to set a new password:</p>
      <p><a href="${resetLink}">Reset Password</a></p>
      <p>This link expires in 15 minutes. If you did not request this, please ignore this email.</p>
    `
    transporter
      .sendMail({
        from: '"ISTRAC-FMS" <no-reply@istrac.gov.in>',
        to,
        subject: 'ISTRAC-FMS Password Reset',
        html,
      })
      .catch((err) => console.error('[EmailService] Password reset email failed:', err))
  },

  sendBroadcastEmail(recipients: string[], subject: string, body: string): void {
    if (!recipients.length) return
    transporter
      .sendMail({
        from: '"ISTRAC-FMS Notification" <no-reply@istrac.gov.in>',
        to: env.ADMIN_EMAIL,
        bcc: recipients,
        subject: `[ISTRAC-FMS Broadcast] ${subject}`,
        text: body,
      })
      .catch((err) => console.error('[EmailService] Broadcast email failed:', err))
  },

  sendAdminAlert(subject: string, body: string): void {
    if (!env.ADMIN_EMAIL) return
    transporter
      .sendMail({
        from: '"ISTRAC-FMS System" <system@istrac.gov.in>',
        to: env.ADMIN_EMAIL,
        subject: `[ALERT] ${subject}`,
        text: body,
      })
      .catch((err) => console.error('[EmailService] Admin alert failed:', err))
  },
}
