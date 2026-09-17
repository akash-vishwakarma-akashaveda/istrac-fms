import nodemailer from 'nodemailer'
import { env } from '../config/env.js'
import { prisma } from '../config/db.js'

export interface SystemBranding {
  appName: string
  brandTitle: string
  brandHighlight: string
  brandSubtitle: string
  orgName: string
  appUrl: string
  copyrightText?: string
}

function handleMailError(operation: string, err: any): void {
  const isConnRefused =
    err?.code === 'ECONNREFUSED' ||
    err?.code === 'ESOCKET' ||
    err?.code === 'ETIMEDOUT' ||
    err?.code === 'ENOTFOUND'
  if (isConnRefused) {
    console.warn(
      `[EmailService] SMTP server unreachable at ${env.SMTP_HOST || '127.0.0.1'}:${env.SMTP_PORT || 25} for ${operation}. Running in offline/intranet mode.`
    )
  } else {
    console.error(`[EmailService] ${operation} failed:`, err?.message || err)
  }
}

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST || 'localhost',
  port: env.SMTP_PORT || 25,
  secure: false,
  ignoreTLS: true,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
})

export const emailService = {
  /**
   * Returns true only when automated email service is explicitly enabled via environment variable.
   * In offline / intranet deployments without an active SMTP server, this defaults to false.
   */
  isEnabled(): boolean {
    return process.env.ENABLE_EMAIL_SERVICE === 'true' || process.env.SMTP_ENABLED === 'true'
  },

  async getSystemBranding(): Promise<SystemBranding> {
    const defaultAppUrl = (env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '')
    try {
      const blocks = await prisma.cmsBlock.findMany({
        where: {
          blockKey: { in: ['nav_header', 'footer_custom', 'nav_footer', 'hero'] },
          deletedAt: null,
        },
      })

      const blockMap: Record<string, any> = {}
      for (const b of blocks) {
        try {
          blockMap[b.blockKey] = typeof b.content === 'string' ? JSON.parse(b.content) : b.content
        } catch {
          blockMap[b.blockKey] = b.content
        }
      }

      const nav = blockMap['nav_header'] || {}
      const footer = blockMap['footer_custom'] || blockMap['nav_footer'] || {}
      const hero = blockMap['hero'] || {}

      const rawBrandTitle = nav.brandTitle !== undefined ? String(nav.brandTitle).trim() : 'ISTRAC'
      const rawBrandHighlight = nav.brandHighlight !== undefined ? String(nav.brandHighlight).trim() : '-FMS'
      const brandSubtitle = String(nav.brandSubtitle || footer.brandSubtitle || 'ISRO Ground Network').trim()

      let appName = 'ISTRAC-FMS'
      if (rawBrandTitle) {
        if (rawBrandHighlight.startsWith('-')) {
          appName = `${rawBrandTitle}${rawBrandHighlight}`
        } else if (rawBrandHighlight) {
          appName = `${rawBrandTitle} ${rawBrandHighlight}`
        } else {
          appName = rawBrandTitle
        }
      }

      const orgName = String(
        footer.brandDescription ||
        hero.title ||
        'ISRO Telemetry, Tracking and Command Network (ISTRAC)'
      ).trim()

      const copyrightText =
        footer.copyrightText ||
        footer.footerCopyright ||
        `© ${new Date().getFullYear()} ${appName} · Indian Space Research Organisation (ISRO).`

      return {
        appName,
        brandTitle: rawBrandTitle,
        brandHighlight: rawBrandHighlight,
        brandSubtitle,
        orgName,
        appUrl: defaultAppUrl,
        copyrightText,
      }
    } catch (err) {
      console.warn('[EmailService] Failed to load CMS branding from database, using defaults:', err)
      return {
        appName: 'ISTRAC-FMS',
        brandTitle: 'ISTRAC',
        brandHighlight: '-FMS',
        brandSubtitle: 'ISRO Ground Network',
        orgName: 'ISRO Telemetry, Tracking and Command Network (ISTRAC)',
        appUrl: defaultAppUrl,
        copyrightText: `© ${new Date().getFullYear()} ISTRAC-FMS · Indian Space Research Organisation (ISRO).`,
      }
    }
  },

  async sendApprovalEmail(to: string, name: string): Promise<void> {
    if (!emailService.isEnabled()) return
    const brand = await emailService.getSystemBranding()
    const html = `
      <h2>Account Approved</h2>
      <p>Hello ${name},</p>
      <p>Your ${brand.appName} account registration has been approved. You may now log in to the portal.</p>
      <p><a href="${brand.appUrl}/login">Access ${brand.appName}</a></p>
    `
    transporter
      .sendMail({
        from: `"${brand.appName}" <no-reply@istrac.gov.in>`,
        to,
        subject: `Your ${brand.appName} account has been approved`,
        html,
      })
      .catch((err) => handleMailError('Approval email', err))
  },

  async sendRejectionEmail(to: string, name: string, reason?: string): Promise<void> {
    if (!emailService.isEnabled()) return
    const brand = await emailService.getSystemBranding()
    const html = `
      <h2>Registration Update</h2>
      <p>Hello ${name},</p>
      <p>Your request to register for ${brand.appName} could not be approved at this time.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
    `
    transporter
      .sendMail({
        from: `"${brand.appName}" <no-reply@istrac.gov.in>`,
        to,
        subject: `${brand.appName} Registration Update`,
        html,
      })
      .catch((err) => handleMailError('Rejection email', err))
  },

  async sendSuspensionEmail(to: string, name: string): Promise<void> {
    if (!emailService.isEnabled()) return
    const brand = await emailService.getSystemBranding()
    const html = `
      <h2>Account Status Notification</h2>
      <p>Hello ${name},</p>
      <p>Your ${brand.appName} account has been suspended. Please contact your department administrator for details.</p>
    `
    transporter
      .sendMail({
        from: `"${brand.appName}" <no-reply@istrac.gov.in>`,
        to,
        subject: `${brand.appName} Account Suspended`,
        html,
      })
      .catch((err) => handleMailError('Suspension email', err))
  },

  generatePasswordResetTemplate(
    data: {
      userName: string
      userEmail: string
      employeeId?: string | null
      otp: string
      expiryMinutes: number
      expiresAt: Date
    },
    branding?: Partial<SystemBranding>
  ): string {
    const appName = branding?.appName || 'ISTRAC-FMS'
    const brandSubtitle = branding?.brandSubtitle || 'ISRO Ground Network'
    const orgName = branding?.orgName || 'ISRO Telemetry, Tracking and Command Network (ISTRAC)'
    const appUrl = (branding?.appUrl || env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '')

    const formattedExpiry = data.expiresAt.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    })

    return `Subject: [${appName}] Password Reset Verification Code

Dear ${data.userName},

We received a request to reset your ${appName} portal password. Your 6-digit verification code is:

${data.otp}

• Validity: ${data.expiryMinutes} minutes (Expires at ${formattedExpiry})
• How to reset your password:
  1. Open the ${appName} portal login screen: ${appUrl}/login
  2. Enter your email address (${data.userEmail}) and this 6-digit verification code.
  3. Enter and confirm your new password.

If you did not request a password reset, please report this immediately to ${appName} Security Administration.

Regards,
${appName} System Administration
${orgName}
${brandSubtitle}`
  },

  async sendPasswordResetOtpToAdmin(
    adminEmails: string | string[],
    data: {
      userName: string
      userEmail: string
      employeeId?: string | null
      otp: string
      expiryMinutes: number
      expiresAt: Date
    },
    branding?: SystemBranding
  ): Promise<void> {
    if (!emailService.isEnabled()) {
      // Offline / Intranet Mode: Automated SMTP email is disabled.
      // The OTP is already stored in the DB and visible in real-time in Admin Console.
      return
    }

    const brand = branding || (await emailService.getSystemBranding())
    const templateText = emailService.generatePasswordResetTemplate(data, brand)
    const formattedTime = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    const formattedExpiry = data.expiresAt.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    })

    const recipients = Array.isArray(adminEmails) ? adminEmails : [adminEmails]
    const validRecipients = Array.from(new Set(recipients.filter(Boolean)))
    if (!validRecipients.length) return

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #030712; color: #f1f5f9; border-radius: 12px; overflow: hidden; border: 1px solid #1e293b;">
        <div style="background: linear-gradient(135deg, #050b18 0%, #0c1830 100%); padding: 24px; border-bottom: 2px solid #2563eb;">
          <div style="font-size: 11px; font-weight: bold; letter-spacing: 2px; color: #38bdf8; text-transform: uppercase;">
            ${brand.brandTitle} · ${brand.appName.toUpperCase()} SECURITY DESK
          </div>
          <h1 style="margin: 8px 0 0 0; font-size: 20px; color: #ffffff; font-weight: 700;">
            Password Reset Verification Request
          </h1>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">
            A user has requested a password reset for ${brand.appName} (${brand.brandSubtitle}). Below is the generated verification OTP and forwardable dispatch template.
          </p>
        </div>

        <div style="padding: 24px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
            <tr style="border-bottom: 1px solid #1e293b;">
              <td style="padding: 8px 0; color: #94a3b8; width: 140px;">Requester Name:</td>
              <td style="padding: 8px 0; color: #ffffff; font-weight: 600;">${data.userName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #1e293b;">
              <td style="padding: 8px 0; color: #94a3b8;">Official Email:</td>
              <td style="padding: 8px 0; color: #38bdf8; font-family: monospace;">${data.userEmail}</td>
            </tr>
            ${
              data.employeeId
                ? `
            <tr style="border-bottom: 1px solid #1e293b;">
              <td style="padding: 8px 0; color: #94a3b8;">Employee ID:</td>
              <td style="padding: 8px 0; color: #ffffff; font-family: monospace;">${data.employeeId}</td>
            </tr>`
                : ''
            }
            <tr style="border-bottom: 1px solid #1e293b;">
              <td style="padding: 8px 0; color: #94a3b8;">Requested At:</td>
              <td style="padding: 8px 0; color: #cbd5e1;">${formattedTime} IST</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #94a3b8;">Validity Window:</td>
              <td style="padding: 8px 0; color: #fbbf24; font-weight: 600;">${data.expiryMinutes} Minutes (Expires at ${formattedExpiry} IST)</td>
            </tr>
          </table>

          <div style="text-align: center; margin: 24px 0; padding: 20px; background: #050c1b; border: 2px dashed #2563eb; border-radius: 12px;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; margin-bottom: 6px;">
              Verification OTP Code
            </div>
            <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 12px; color: #38bdf8;">
              ${data.otp}
            </div>
            <div style="font-size: 11px; color: #fbbf24; margin-top: 6px;">
              Active for ${data.expiryMinutes} minutes
            </div>
          </div>

          <div style="margin-top: 24px;">
            <div style="font-size: 12px; font-weight: 700; color: #cbd5e1; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
              📋 Forwardable Template (Copy & Send via Email / Intranet Chat / Phone):
            </div>
            <pre style="background: #020617; border: 1px solid #1e293b; border-radius: 8px; padding: 14px; font-size: 12px; color: #e2e8f0; line-height: 1.5; white-space: pre-wrap; word-break: break-word; font-family: monospace;">${templateText}</pre>
          </div>
        </div>

        <div style="background: #020617; padding: 16px 24px; font-size: 11px; color: #64748b; border-top: 1px solid #1e293b; text-align: center;">
          ${brand.orgName} · ${brand.appName} Automated Security Notification
        </div>
      </div>
    `

    transporter
      .sendMail({
        from: `"${brand.appName} Security" <security@istrac.gov.in>`,
        to: validRecipients,
        subject: `[${brand.appName}] Password Reset OTP for ${data.userName} (${data.userEmail})`,
        text: `Password Reset Request for ${data.userName} (${data.userEmail})\n\nOTP Code: ${data.otp}\nValidity: ${data.expiryMinutes} minutes (Expires at ${formattedExpiry})\n\nForwardable Template:\n${templateText}`,
        html,
      })
      .catch((err) => {
        const isConnRefused =
          err?.code === 'ECONNREFUSED' ||
          err?.code === 'ESOCKET' ||
          err?.code === 'ETIMEDOUT' ||
          err?.code === 'ENOTFOUND'
        if (isConnRefused) {
          console.warn(
            `[EmailService] SMTP server unreachable at ${env.SMTP_HOST || '127.0.0.1'}:${env.SMTP_PORT || 25}. Verification code for ${data.userName} (${data.userEmail}) is safely recorded in Admin Console (/admin/password-resets).`
          )
        } else {
          console.error('[EmailService] Password reset OTP email failed:', err?.message || err)
        }
      })
  },

  async sendPasswordResetEmail(to: string, name: string, resetLink: string): Promise<void> {
    if (!emailService.isEnabled()) return
    const brand = await emailService.getSystemBranding()
    const html = `
      <h2>Password Reset Request</h2>
      <p>Hello ${name},</p>
      <p>We received a request to reset your ${brand.appName} password. Click the link below to set a new password:</p>
      <p><a href="${resetLink}">Reset Password</a></p>
      <p>This link expires in 15 minutes. If you did not request this, please ignore this email.</p>
    `
    transporter
      .sendMail({
        from: `"${brand.appName}" <no-reply@istrac.gov.in>`,
        to,
        subject: `${brand.appName} Password Reset`,
        html,
      })
      .catch((err) => handleMailError('Password reset email', err))
  },

  async sendBroadcastEmail(recipients: string[], subject: string, body: string): Promise<void> {
    if (!emailService.isEnabled() || !recipients.length) return
    const brand = await emailService.getSystemBranding()
    transporter
      .sendMail({
        from: `"${brand.appName} Notification" <no-reply@istrac.gov.in>`,
        to: env.ADMIN_EMAIL || undefined,
        bcc: recipients,
        subject: `[${brand.appName} Broadcast] ${subject}`,
        text: body,
      })
      .catch((err) => handleMailError('Broadcast email', err))
  },

  async sendAdminAlert(subject: string, body: string): Promise<void> {
    if (!emailService.isEnabled() || !env.ADMIN_EMAIL) return
    const brand = await emailService.getSystemBranding()
    transporter
      .sendMail({
        from: `"${brand.appName} System" <system@istrac.gov.in>`,
        to: env.ADMIN_EMAIL,
        subject: `[${brand.appName} ALERT] ${subject}`,
        text: body,
      })
      .catch((err) => handleMailError('Admin alert', err))
  },
}
