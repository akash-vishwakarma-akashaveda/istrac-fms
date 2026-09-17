import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { adminMiddleware } from '../middleware/admin.middleware.js'
import { emailService } from '../services/email.service.js'
import { auditService } from '../services/audit.service.js'
import { AppError } from '../lib/errors.js'

const router = Router()

// ============================================================
// GET CURRENT SMTP CONFIGURATION (PASSWORD MASKED)
// ============================================================
router.get('/admin/smtp', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const config = await emailService.getPublicConfig()
    res.json({
      data: config,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// UPDATE SMTP CONFIGURATION (DYNAMIC RELOAD)
// ============================================================
router.put('/admin/smtp', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { host, port, securityMode, allowSelfSigned, user, pass, fromEmail, fromName, adminAlertEmail, enabled, ...matrix } = req.body

    if (port !== undefined && (isNaN(Number(port)) || Number(port) <= 0 || Number(port) > 65535)) {
      throw new AppError('invalid_port', 'SMTP Port must be a valid port number (1-65535)', 400)
    }

    const updated = await emailService.updateConfig(
      {
        enabled: enabled !== undefined ? Boolean(enabled) : undefined,
        host: host ? String(host).trim() : undefined,
        port: port ? Number(port) : undefined,
        securityMode: securityMode || undefined,
        allowSelfSigned: allowSelfSigned !== undefined ? Boolean(allowSelfSigned) : undefined,
        user: user !== undefined ? String(user).trim() : undefined,
        pass: pass !== undefined ? String(pass) : undefined,
        fromEmail: fromEmail ? String(fromEmail).trim() : undefined,
        fromName: fromName ? String(fromName).trim() : undefined,
        adminAlertEmail: adminAlertEmail ? String(adminAlertEmail).trim() : undefined,
        ...matrix,
      },
      req.user!.id,
    )

    auditService.log({
      userId: req.user!.id,
      action: 'SMTP:UPDATE_CONFIG',
      resourceType: 'smtp_config',
      resourceId: 'SMTP_CONFIG',
      newValue: {
        enabled: updated.enabled,
        host: updated.host,
        port: updated.port,
        securityMode: updated.securityMode,
        fromEmail: updated.fromEmail,
        hasPassword: updated.hasPassword,
      },
    })

    res.json({
      data: updated,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// TEST CONNECTION & SEND TEST PROBE
// ============================================================
router.post('/admin/smtp/test', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { config, testEmail } = req.body
    const result = await emailService.testConnection(config, testEmail)

    res.json({
      data: result,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

export { router as smtpRouter }
