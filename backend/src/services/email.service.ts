import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { env } from '../config/env.js'
import { prisma } from '../config/db.js'
import { logger } from '../lib/logger.js'
import { SmtpConfig } from '../types/types.js'

let cachedConfig: SmtpConfig | null = null
let activeTransporter: Transporter | null = null
let lastFetchedAt = 0
const CACHE_TTL_MS = 60000

function getDefaultConfig(): SmtpConfig {
  const port = env.SMTP_PORT || 25
  const isSsl = port === 465
  const isStarttls = port === 587
  return {
    enabled: Boolean(env.SMTP_HOST && env.SMTP_HOST !== 'localhost'),
    host: env.SMTP_HOST || 'localhost',
    port,
    securityMode: isSsl ? 'SSL' : isStarttls ? 'STARTTLS' : 'PLAIN',
    allowSelfSigned: true,
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    fromEmail: env.SMTP_USER || 'no-reply@istrac.gov.in',
    fromName: 'ISTRAC-FMS',
    adminAlertEmail: env.ADMIN_EMAIL || 'admin@istrac.local',
    notifyUserApproval: true,
    notifyPasswordReset: true,
    notifyStorageHealth: true,
    notifyBroadcasts: true,
    notifyDocumentRequests: true,
  }
}

function buildTransporter(cfg: SmtpConfig): Transporter {
  const isSsl = cfg.securityMode === 'SSL' || cfg.port === 465
  const isStarttls = cfg.securityMode === 'STARTTLS' || cfg.port === 587
  const isPlain = cfg.securityMode === 'PLAIN' || (!isSsl && !isStarttls)

  const transportOpts: any = {
    host: cfg.host || 'localhost',
    port: cfg.port || (isSsl ? 465 : isStarttls ? 587 : 25),
    secure: isSsl,
    requireTLS: isStarttls,
    ignoreTLS: isPlain,
    tls: {
      rejectUnauthorized: !cfg.allowSelfSigned,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  }

  if (cfg.user && cfg.user.trim().length > 0) {
    transportOpts.auth = {
      user: cfg.user.trim(),
      pass: cfg.pass || '',
    }
  }

  return nodemailer.createTransport(transportOpts)
}

async function resolveConfig(forceRefresh = false): Promise<SmtpConfig> {
  const now = Date.now()
  if (!forceRefresh && cachedConfig && now - lastFetchedAt < CACHE_TTL_MS) {
    return cachedConfig
  }

  try {
    const record = await prisma.systemConfig.findUnique({
      where: { configKey: 'SMTP_CONFIG' },
    })

    if (record?.configValue) {
      const parsed = JSON.parse(record.configValue)
      cachedConfig = {
        ...getDefaultConfig(),
        ...parsed,
      }
    } else {
      cachedConfig = getDefaultConfig()
    }
  } catch (err) {
    logger.error('EmailService', 'Failed to read SMTP config from database, falling back to defaults:', err)
    if (!cachedConfig) {
      cachedConfig = getDefaultConfig()
    }
  }

  const finalConfig = cachedConfig || getDefaultConfig()
  cachedConfig = finalConfig
  activeTransporter = buildTransporter(finalConfig)
  lastFetchedAt = now
  return finalConfig
}

async function getTransporter(): Promise<{ transporter: Transporter; config: SmtpConfig }> {
  const config = await resolveConfig()
  if (!activeTransporter) {
    activeTransporter = buildTransporter(config)
  }
  return { transporter: activeTransporter, config }
}

export const emailService = {
  async getConfig(): Promise<SmtpConfig> {
    return resolveConfig()
  },

  async getPublicConfig(): Promise<Omit<SmtpConfig, 'pass'> & { pass: string; hasPassword: boolean }> {
    const cfg = await resolveConfig()
    return {
      ...cfg,
      pass: '',
      hasPassword: Boolean(cfg.pass && cfg.pass.length > 0),
    }
  },

  async updateConfig(
    newConfig: Partial<SmtpConfig>,
    updatedBy?: string,
  ): Promise<Omit<SmtpConfig, 'pass'> & { pass: string; hasPassword: boolean }> {
    const current = await resolveConfig(true)

    // Preserve existing password if not supplied in update
    const pass = newConfig.pass && newConfig.pass.trim().length > 0 ? newConfig.pass : current.pass

    const merged: SmtpConfig = {
      ...current,
      ...newConfig,
      pass,
    }

    await prisma.systemConfig.upsert({
      where: { configKey: 'SMTP_CONFIG' },
      update: {
        configValue: JSON.stringify(merged),
        updatedBy: updatedBy || null,
      },
      create: {
        configKey: 'SMTP_CONFIG',
        configValue: JSON.stringify(merged),
        updatedBy: updatedBy || null,
      },
    })

    cachedConfig = merged
    activeTransporter = buildTransporter(merged)
    lastFetchedAt = Date.now()
    logger.info('EmailService', 'SMTP Configuration updated and reloaded in memory')

    return {
      ...merged,
      pass: '',
      hasPassword: Boolean(merged.pass && merged.pass.length > 0),
    }
  },

  async testConnection(
    testConfig?: Partial<SmtpConfig>,
    targetEmail?: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const current = await resolveConfig()
      const merged: SmtpConfig = {
        ...current,
        ...(testConfig || {}),
        pass:
          testConfig?.pass && testConfig.pass.trim().length > 0
            ? testConfig.pass
            : current.pass,
      }

      const tempTransporter = buildTransporter(merged)

      // 1. Verify handshake
      await tempTransporter.verify()

      // 2. Dispatch probe if test recipient email is provided
      if (targetEmail && targetEmail.trim().length > 0) {
        await tempTransporter.sendMail({
          from: `"${merged.fromName || 'ISTRAC-FMS'}" <${merged.fromEmail || 'no-reply@istrac.gov.in'}>`,
          to: targetEmail.trim(),
          subject: '[ISTRAC-FMS] SMTP Gateway Verification Probe',
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #0c1427; border: 1px solid #1e293b; border-radius: 12px; color: #f8fafc;">
              <div style="border-bottom: 1px solid #1e293b; padding-bottom: 16px; margin-bottom: 20px;">
                <span style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #38bdf8;">ISTRAC Mission Network</span>
                <h2 style="margin: 4px 0 0 0; color: #ffffff; font-size: 20px;">SMTP Gateway Verification Probe</h2>
              </div>
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
                This automated probe confirms that the <strong>ISTRAC-FMS Outgoing Mail Gateway</strong> is successfully authenticated and communicating with your mail server.
              </p>
              <div style="background: #111e38; border: 1px solid #1e3a8a; border-radius: 8px; padding: 14px 18px; margin: 20px 0;">
                <p style="margin: 3px 0; font-size: 13px; color: #94a3b8;"><strong>Server Host:</strong> <span style="font-family: monospace; color: #f8fafc;">${merged.host}:${merged.port}</span></p>
                <p style="margin: 3px 0; font-size: 13px; color: #94a3b8;"><strong>Security Protocol:</strong> <span style="color: #38bdf8;">${merged.securityMode}</span></p>
                <p style="margin: 3px 0; font-size: 13px; color: #94a3b8;"><strong>Sender Identity:</strong> ${merged.fromName} &lt;${merged.fromEmail}&gt;</p>
                <p style="margin: 6px 0 2px 0; font-size: 13px; color: #4ade80;"><strong>Status:</strong> ✅ Handshake OK &amp; Message Delivered</p>
              </div>
              <p style="font-size: 11px; color: #64748b; margin-top: 24px; border-top: 1px solid #1e293b; padding-top: 12px;">
                Dispatched at ${new Date().toUTCString()} | ISRO Telemetry, Tracking and Command Network (ISTRAC)
              </p>
            </div>
          `,
        })
      }

      return {
        success: true,
        message: targetEmail
          ? `Handshake verified and test probe delivered to ${targetEmail}`
          : `SMTP handshake and authentication successful on ${merged.host}:${merged.port}`,
      }
    } catch (err: any) {
      logger.error('EmailService', 'SMTP connection test failed:', err)
      return {
        success: false,
        message: err.message || 'SMTP handshake or authentication failed. Check credentials and firewall.',
      }
    }
  },

  async sendApprovalEmail(to: string, name: string): Promise<void> {
    const { transporter, config } = await getTransporter()
    if (!config.enabled || !config.notifyUserApproval) return

    const html = `
      <div style="font-family: sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #0c1427; border: 1px solid #1e293b; border-radius: 12px; color: #f8fafc;">
        <h2 style="color: #4ade80; margin-top: 0;">Account Clearance Approved</h2>
        <p>Hello ${name},</p>
        <p>Your ISTRAC-FMS operator account registration has been approved. Multi-department clearance has been provisioned.</p>
        <div style="margin: 24px 0;">
          <a href="${env.APP_URL}/login" style="background: #0284c7; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Access ISTRAC-FMS Portal</a>
        </div>
        <p style="font-size: 12px; color: #64748b;">ISTRAC Flight Operations Division, Bangalore</p>
      </div>
    `
    transporter
      .sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to,
        subject: 'ISTRAC-FMS: Your account registration has been approved',
        html,
      })
      .catch((err) => logger.error('EmailService', 'Approval email failed:', err))
  },

  async sendRejectionEmail(to: string, name: string, reason?: string): Promise<void> {
    const { transporter, config } = await getTransporter()
    if (!config.enabled || !config.notifyUserApproval) return

    const html = `
      <div style="font-family: sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #0c1427; border: 1px solid #1e293b; border-radius: 12px; color: #f8fafc;">
        <h2 style="color: #f87171; margin-top: 0;">Registration Update</h2>
        <p>Hello ${name},</p>
        <p>Your request to register for ISTRAC-FMS could not be approved at this time.</p>
        ${reason ? `<div style="background: #1e1b2e; border: 1px solid #432874; padding: 12px; border-radius: 6px; margin: 16px 0; color: #e2e8f0;"><strong>Reason:</strong> ${reason}</div>` : ''}
        <p style="font-size: 12px; color: #64748b;">Please reach out to your Mission Director or System Administrator if you believe this is in error.</p>
      </div>
    `
    transporter
      .sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to,
        subject: 'ISTRAC-FMS: Registration Request Decision',
        html,
      })
      .catch((err) => logger.error('EmailService', 'Rejection email failed:', err))
  },

  async sendSuspensionEmail(to: string, name: string): Promise<void> {
    const { transporter, config } = await getTransporter()
    if (!config.enabled) return

    const html = `
      <div style="font-family: sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #0c1427; border: 1px solid #1e293b; border-radius: 12px; color: #f8fafc;">
        <h2 style="color: #fb923c; margin-top: 0;">Account Status Notice</h2>
        <p>Hello ${name},</p>
        <p>Your ISTRAC-FMS terminal access has been suspended. Active sessions and refresh tokens have been revoked.</p>
        <p style="font-size: 12px; color: #64748b;">Please contact your ground station security administrator for details.</p>
      </div>
    `
    transporter
      .sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to,
        subject: 'ISTRAC-FMS: Account Suspended',
        html,
      })
      .catch((err) => logger.error('EmailService', 'Suspension email failed:', err))
  },

  async sendPasswordResetEmail(to: string, name: string, resetLink: string): Promise<void> {
    const { transporter, config } = await getTransporter()
    if (!config.enabled || !config.notifyPasswordReset) return

    const html = `
      <div style="font-family: sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #0c1427; border: 1px solid #1e293b; border-radius: 12px; color: #f8fafc;">
        <h2 style="color: #38bdf8; margin-top: 0;">Password Reset Request</h2>
        <p>Hello ${name},</p>
        <p>A request was received to reset your ISTRAC-FMS credentials. Click the secure link below to set a new password:</p>
        <div style="margin: 24px 0;">
          <a href="${resetLink}" style="background: #0284c7; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p style="font-size: 12px; color: #94a3b8;">This link expires in 15 minutes. If you did not initiate this request, contact mission IT security immediately.</p>
      </div>
    `
    transporter
      .sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to,
        subject: 'ISTRAC-FMS: Password Reset Request',
        html,
      })
      .catch((err) => logger.error('EmailService', 'Password reset email failed:', err))
  },

  async sendBroadcastEmail(recipients: string[], subject: string, body: string): Promise<void> {
    if (!recipients.length) return
    const { transporter, config } = await getTransporter()
    if (!config.enabled || !config.notifyBroadcasts) return

    transporter
      .sendMail({
        from: `"${config.fromName} Alert" <${config.fromEmail}>`,
        to: config.adminAlertEmail || env.ADMIN_EMAIL,
        bcc: recipients,
        subject: `[ISTRAC-FMS Broadcast] ${subject}`,
        text: body,
      })
      .catch((err) => logger.error('EmailService', 'Broadcast email failed:', err))
  },

  async sendAdminAlert(subject: string, body: string): Promise<void> {
    const { transporter, config } = await getTransporter()
    if (!config.enabled || !config.notifyStorageHealth) return

    const to = config.adminAlertEmail || env.ADMIN_EMAIL
    if (!to) return

    transporter
      .sendMail({
        from: `"${config.fromName} Alert Relay" <${config.fromEmail}>`,
        to,
        subject: `[ALERT] ${subject}`,
        text: body,
      })
      .catch((err) => logger.error('EmailService', 'Admin alert failed:', err))
  },

  async sendDocumentAccessDecisionEmail(
    to: string,
    name: string,
    departmentName: string,
    reportTitle?: string | null,
    status?: string,
    adminComment?: string | null,
  ): Promise<void> {
    const { transporter, config } = await getTransporter()
    if (!config.enabled || !config.notifyDocumentRequests) return

    const isApproved = status === 'APPROVED'
    const color = isApproved ? '#4ade80' : '#f87171'

    const html = `
      <div style="font-family: sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #0c1427; border: 1px solid #1e293b; border-radius: 12px; color: #f8fafc;">
        <h2 style="color: ${color}; margin-top: 0;">Document Access Request ${status}</h2>
        <p>Hello ${name},</p>
        <p>Your access request for <strong>${reportTitle ? `${reportTitle} (${departmentName})` : departmentName}</strong> has been <strong>${status}</strong>.</p>
        ${adminComment ? `<div style="background: #111e38; border: 1px solid #1e3a8a; padding: 12px; border-radius: 6px; margin: 16px 0; color: #e2e8f0;"><strong>Reviewer Comment:</strong> ${adminComment}</div>` : ''}
        ${isApproved ? `<p><a href="${env.APP_URL}/browse" style="color: #38bdf8;">Access Cleared Documents in Browser</a></p>` : ''}
        <p style="font-size: 12px; color: #64748b;">ISTRAC Ground Station Document Control Authority</p>
      </div>
    `

    transporter
      .sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to,
        subject: `ISTRAC-FMS: Document Access Request ${status}`,
        html,
      })
      .catch((err) => logger.error('EmailService', 'Document access decision email failed:', err))
  },
}
