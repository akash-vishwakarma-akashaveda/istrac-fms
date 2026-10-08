import { Router } from 'express'
import bcrypt from 'bcrypt'
import * as crypto from 'node:crypto'
import { prisma } from '../config/db.js'
import { redis } from '../config/redis.js'
import { env } from '../config/env.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import {
  loginRateLimiter,
  refreshRateLimiter,
  registerRateLimiter,
  forgotPasswordRateLimiter,
  otpRateLimiter,
  hitCounter,
  resetCounter,
  assertAccountNotLocked,
  recordFailedLogin,
  clearFailedLogins,
  ACCOUNT_LOCK_MAX_FAILURES,
} from '../middleware/rateLimiter.middleware.js'
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from '../lib/jwt.js'
import { emailService } from '../services/email.service.js'
import { auditService } from '../services/audit.service.js'
import { AppError } from '../lib/errors.js'
import { sessionStore } from '../services/sessionStore.js'

import { validate } from '../lib/validate.js'
import { LoginSchema, RegisterSchema } from '../lib/schema.js'
import { encryptField } from '../lib/encryption.js'
import { logger } from '../lib/logger.js'
const router = Router()

function validatePassword(password: string): void {
  if (password.length < 10) throw new AppError('weak_password', 'Password must be at least 10 characters', 400)
  if (!/[A-Z]/.test(password)) throw new AppError('weak_password', 'Password must contain an uppercase letter', 400)
  if (!/[0-9]/.test(password)) throw new AppError('weak_password', 'Password must contain a number', 400)
  if (!/[^A-Za-z0-9]/.test(password)) throw new AppError('weak_password', 'Password must contain a special character', 400)
}
// ============================================================
// REGISTER (PUBLIC)
// ============================================================
router.post('/register', registerRateLimiter, validate(RegisterSchema), async (req, res, next) => {
  try {
    const { name, designation, email, employeeId, password, phone, departmentPreference, reasonForAccess } = req.body

    if (!name || !email || !password) {
      throw new AppError('missing_fields', 'Name, email, and password are required', 400)
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, employeeId ? { employeeId } : { email }],
      },
    })

    if (existing) {
      throw new AppError('user_exists', 'User with this email or employee ID already exists', 409)
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        designation: designation?.trim() || null,
        email: email.trim().toLowerCase(),
        employeeId: employeeId?.trim() || null,
        phone: phone?.trim() || null,
        departmentPreference: departmentPreference?.trim() || null,
        reasonForAccess: reasonForAccess?.trim() || null,
        passwordHash,
        role: 'MEMBER',
        status: 'PENDING',
      },
      select: {
        id: true,
        name: true,
        designation: true,
        email: true,
        employeeId: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
      },
    })

    auditService.log({
      userId: user.id,
      action: 'POST:/auth/register',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    })

    res.status(201).json({
      data: {
        message: 'Registration submitted successfully and is pending administrator approval',
        user,
      },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// LOGIN (PUBLIC)
// ============================================================
router.post('/login', loginRateLimiter, validate(LoginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      throw new AppError('invalid_credentials', 'Email and password are required', 400)
    }

    await assertAccountNotLocked(email)

    const user = await prisma.user.findFirst({
      where: { email },
      orderBy: { deletedAt: 'asc' },
    })

    // ponytail: distinct "no account" vs "wrong password" messages were requested (BUG-02).
    // This reveals whether an email is registered; /register already does the same.
    if (!user || user.deletedAt) {
      auditService.log({
        action: 'AUTH:LOGIN_FAILED',
        resourceType: 'user',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        newValue: { email, reason: 'user_not_found' },
      })
      throw new AppError('account_not_found', 'Account not found. Check the email address, or request access if you are new.', 401)
    }

    if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      auditService.log({
        userId: user.id,
        action: 'AUTH:LOGIN_FAILED',
        resourceType: 'user',
        resourceId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        newValue: { email, reason: 'bad_password' },
      })
      // Generic on purpose: never confirm which half of the credentials was wrong.
      const failures = await recordFailedLogin(email)
      if (failures >= ACCOUNT_LOCK_MAX_FAILURES) {
        await assertAccountNotLocked(email) // throws the "locked" message
      }
      throw new AppError('invalid_credentials', 'Incorrect email or password.', 401)
    }

    await clearFailedLogins(email)

    if (user.status === 'PENDING') {
      throw new AppError('account_pending', 'Your account is waiting for administrator approval. You can sign in once it is approved.', 403)
    }

    if (user.status === 'SUSPENDED') {
      throw new AppError('account_suspended', 'Your account has been suspended. Contact your administrator to restore access.', 403)
    }

    if (user.status === 'REJECTED') {
      throw new AppError('account_rejected', 'Your registration request was not approved. Contact your administrator for details.', 403)
    }

    const activeSessionCount = await prisma.refreshToken.count({
  where: { userId: user.id, revoked: false, expiresAt: { gt: new Date() } },
})
if (activeSessionCount >= 3) {
  // Revoke oldest session to enforce limit
  const oldest = await prisma.refreshToken.findFirst({
    where: { userId: user.id, revoked: false },
    orderBy: { createdAt: 'asc' },
  })
  if (oldest) {
    await prisma.refreshToken.update({ where: { id: oldest.id }, data: { revoked: true, revokedAt: new Date() } })
  }
}


    const authUser = {
      id: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
    }

    const accessToken = signAccessToken(authUser)
    const rawRefreshToken = signRefreshToken(user.id)
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex')

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    })

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })

    const isProd = env.NODE_ENV === 'production'
    res.cookie('refreshToken', rawRefreshToken, {
      httpOnly: true,
      sameSite: isProd ? 'none' : 'lax',
      secure: isProd,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    auditService.log({
      userId: user.id,
      action: 'POST:/auth/login',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    })

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        designation: true,
        email: true,
        employeeId: true,
        phone: true,
        role: true,
        status: true,
        departmentPreference: true,
        departmentAccess: {
          where: { deletedAt: null },
          include: {
            department: {
              select: { id: true, name: true, code: true, satellite: { select: { code: true } } },
            },
          },
        },
      },
    })

    res.json({
      data: {
        accessToken,
        refreshToken: rawRefreshToken,
        user: fullUser,
      },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// REFRESH TOKEN (PUBLIC)
// ============================================================
router.post('/refresh',refreshRateLimiter, async (req, res, next) => {
  try {
    const rawRefreshToken =
      req.cookies?.refreshToken ||
      req.body?.refreshToken ||
      (req.headers['x-refresh-token'] as string | undefined)

    if (!rawRefreshToken) {
      throw new AppError('missing_refresh_token', 'No refresh token provided', 401)
    }

    const payload = verifyRefreshToken(rawRefreshToken)
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex')

    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    })

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new AppError('refresh_token_invalid', 'Invalid or expired session', 401)
    }

    // Grace period for concurrent requests:
    // If the token was revoked within the last 30 seconds (due to network race or multi-tab refresh),
    // do NOT fail the request. Re-issue an access token for the active user session!
    const isWithinGracePeriod =
      tokenRecord.revoked &&
      tokenRecord.revokedAt &&
      Date.now() - new Date(tokenRecord.revokedAt).getTime() < 30_000

    if (tokenRecord.revoked && !isWithinGracePeriod) {
      throw new AppError('refresh_token_invalid', 'Invalid or expired session', 401)
    }

    if (!tokenRecord.revoked) {
      // Revoke old token
      await prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { revoked: true, revokedAt: new Date() },
      })
    }

    const user = tokenRecord.user
    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      throw new AppError('unauthorized', 'User is inactive or deleted', 401)
    }

    const authUser = {
      id: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
    }

    const newAccessToken = signAccessToken(authUser)
    const newRawRefreshToken = signRefreshToken(user.id)
    const newTokenHash = crypto.createHash('sha256').update(newRawRefreshToken).digest('hex')

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: newTokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    const isProdRefresh = env.NODE_ENV === 'production'
    res.cookie('refreshToken', newRawRefreshToken, {
      httpOnly: true,
      sameSite: isProdRefresh ? 'none' : 'lax',
      secure: isProdRefresh,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        designation: true,
        email: true,
        employeeId: true,
        phone: true,
        role: true,
        status: true,
        departmentPreference: true,
        departmentAccess: {
          where: { deletedAt: null },
          include: {
            department: {
              select: { id: true, name: true, code: true, satellite: { select: { code: true } } },
            },
          },
        },
      },
    })

    res.json({
      data: {
        accessToken: newAccessToken,
        refreshToken: newRawRefreshToken,
        user: fullUser,
      },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// LOGOUT (AUTHENTICATED)
// ============================================================
router.post('/logout', authMiddleware, async (req, res, next) => {
  try {
    // The SPA keeps the refresh token in storage and sends it in the body/header when
    // cookies are not forwarded (cross-origin / HTTP intranet), so revoke whichever arrives.
    const rawRefreshToken =
      req.cookies?.refreshToken ||
      req.body?.refreshToken ||
      (req.headers['x-refresh-token'] as string | undefined)
    if (rawRefreshToken) {
      const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex')
      // Expire as well as revoke: /refresh allows a 30s grace for *rotated* tokens (multi-tab
      // races), but a logged-out session must stop working immediately.
      const now = new Date()
      await prisma.refreshToken.updateMany({
        where: { tokenHash, userId: req.user!.id },
        data: { revoked: true, revokedAt: now, expiresAt: now },
      })
    }

    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const decoded = verifyAccessToken(authHeader.slice(7)) // already verified by authMiddleware
      await sessionStore.revoke(decoded.jti)
    }

    const isProdLogout = env.NODE_ENV === 'production'
    res.clearCookie('refreshToken', {
      httpOnly: true,
      sameSite: isProdLogout ? 'none' : 'lax',
      secure: isProdLogout,
    })

    res.json({
      data: { message: 'Logged out successfully' },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// GET CURRENT USER /auth/me
// ============================================================
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id, deletedAt: null },
      select: {
        id: true,
        name: true,
        designation: true,
        email: true,
        employeeId: true,
        phone: true,
        role: true,
        status: true,
        departmentPreference: true,
        reasonForAccess: true,
        lastLogin: true,
        createdAt: true,
        departmentAccess: {
          where: { deletedAt: null },
          include: {
            department: {
              select: { id: true, name: true, code: true, satellite: { select: { code: true } } },
            },
          },
        },
      },
    })

    if (!user) {
      throw new AppError('user_not_found', 'User not found', 404)
    }

    res.json({
      data: user,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// FORGOT PASSWORD / REQUEST OTP
// ============================================================
router.post('/forgot-password', forgotPasswordRateLimiter, async (req, res, next) => {
  try {
    const { email } = req.body
    if (!email) {
      throw new AppError('missing_email', 'Email is required', 400)
    }

    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(email)) throw new AppError('invalid_email', 'Invalid email format', 400)

    const normalizedEmail = email.toLowerCase().trim()

    // At most 3 codes per account per hour, so nobody can flood administrators with requests.
    const perAccount = await hitCounter(`rate:forgot-email:${normalizedEmail}`, 3600)
    if (perAccount.count > 3) {
      throw new AppError('rate_limit_exceeded', 'A reset code was already requested several times for this account. Please wait an hour or contact your administrator.', 429)
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail, deletedAt: null },
    })

    if (user && user.status === 'ACTIVE') {
      // 1. Read admin-configured OTP expiry timing from SystemConfig
      const expiryConfig = await prisma.systemConfig.findFirst({
        where: {
          configKey: { in: ['passwordResetOtpExpiryMinutes', 'password_reset_otp_expiry_minutes'] },
          deletedAt: null,
        },
      })
      let expiryMinutes = 15
      if (expiryConfig?.configValue) {
        const parsed = parseInt(expiryConfig.configValue, 10)
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 120) {
          expiryMinutes = parsed
        }
      }

      // 2. Generate secure 6-digit OTP
      const otp = Math.floor(100000 + crypto.randomInt(900000)).toString()
      const tokenHash = crypto.createHash('sha256').update(`${normalizedEmail}:${otp}`).digest('hex')
      const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000)

      // 3. Invalidate any existing unused reset tokens for this user
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id },
      })
      await resetCounter(otpFailKey(normalizedEmail))

      // 4. Create new reset token record
      const resetToken = await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      })

      // If the requester is an ADMIN, print OTP to terminal stdout ONLY in non-production environments.
      // In production, sensitive verification codes are never exposed to stdout/log collectors.
      if (user.role === 'ADMIN') {
        const formattedExpiry = expiresAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        if (env.NODE_ENV !== 'production') {
          console.log('\n' + '='.repeat(74))
          console.log(' [SECURITY] SYSTEM ADMINISTRATOR PASSWORD RESET VERIFICATION CODE')
          console.log('='.repeat(74))
          console.log(` Administrator:   ${user.name} (${user.email})`)
          console.log(` Verification OTP: ${otp}`)
          console.log(` Validity Window:  ${expiryMinutes} minutes (Expires at ${formattedExpiry} IST)`)
          console.log('')
          console.log(' Enter this 6-digit code on the portal verification screen to reset password.')
          console.log(' Alternatively, reset directly from the terminal:')
          console.log('   npm run admin:reset-password')
          console.log('='.repeat(74) + '\n')
        } else {
          logger.info(`[SECURITY] Administrator password reset requested for ${user.email}. Verification notification dispatched to active administrators.`)
        }
      }

      // 5. Fetch all active ADMIN users to notify them
      const adminUsers = await prisma.user.findMany({
        where: { role: 'ADMIN', status: 'ACTIVE', deletedAt: null },
        select: { id: true, email: true, name: true },
      })

      // 6. Create in-app Notifications for admins with encrypted OTP metadata
      const encryptedOtp = encryptField(otp)
      const notificationPromises = adminUsers.map((admin) =>
        prisma.notification.create({
          data: {
            userId: admin.id,
            type: 'PASSWORD_RESET_OTP',
            category: 'SECURITY',
            resourceType: 'PASSWORD_RESET',
            resourceId: resetToken.id,
            message: `Password reset verification code generated for ${user.name} (${user.email}) (Valid for ${expiryMinutes}m)`,
            metadata: {
              otp: encryptedOtp,
              tokenRecordId: resetToken.id,
              userId: user.id,
              userName: user.name,
              userEmail: user.email,
              employeeId: user.employeeId,
              expiresAt: expiresAt.toISOString(),
              expiryMinutes,
            },
          },
        })
      )
      await Promise.allSettled(notificationPromises)

      // 7. Dispatch email to configured admin email and admin users
      const branding = await emailService.getSystemBranding()
      const rawRecipients = [env.ADMIN_EMAIL, ...adminUsers.map((a) => a.email)]
      const recipientEmails = Array.from(new Set(rawRecipients.filter((e): e is string => Boolean(e))))

      if (recipientEmails.length > 0) {
        emailService.sendPasswordResetOtpToAdmin(
          recipientEmails,
          {
            userName: user.name,
            userEmail: user.email,
            employeeId: user.employeeId,
            otp,
            expiryMinutes,
            expiresAt,
          },
          branding
        )
      }

      // 8. Log audit record
      auditService.log({
        userId: user.id,
        action: 'PASSWORD_RESET_OTP_REQUESTED',
        resourceType: 'user',
        resourceId: user.id,
        newValue: {
          email: user.email,
          expiryMinutes,
          expiresAt: expiresAt.toISOString(),
        },
      })
    }

    res.json({
      data: {
        message: 'Password reset request submitted. Please contact your System Administrator to obtain your 6-digit verification code.',
        email: normalizedEmail,
      },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// OTP ATTEMPT CAP
// A 6-digit code has only 1,000,000 values. After 5 wrong codes for an account, every
// outstanding code for it is burned and a new one must be requested.
// ============================================================
const OTP_MAX_FAILURES = 5
const otpFailKey = (email: string) => `lock:otp:${email.toLowerCase()}`

async function registerOtpFailure(email: string, userId?: string): Promise<void> {
  const { count } = await hitCounter(otpFailKey(email), 3600)
  if (count >= OTP_MAX_FAILURES) {
    if (userId) {
      await prisma.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      })
    }
    await resetCounter(otpFailKey(email))
    throw new AppError(
      'otp_attempts_exceeded',
      'Too many incorrect verification codes. This code has been cancelled; please request a new one.',
      429,
    )
  }
}

// ============================================================
// VERIFY RESET OTP
// ============================================================
router.post('/verify-reset-otp', otpRateLimiter, async (req, res, next) => {
  try {
    const { email, otp } = req.body

    if (!email || !otp) {
      throw new AppError('missing_fields', 'Email and verification code are required', 400)
    }

    const normalizedEmail = email.toLowerCase().trim()
    const cleanOtp = String(otp).trim()

    if (!/^\d{6}$/.test(cleanOtp)) {
      throw new AppError('invalid_otp_format', 'Verification code must be a 6-digit number', 400)
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail, deletedAt: null },
    })

    if (!user || user.status !== 'ACTIVE') {
      await registerOtpFailure(normalizedEmail, user?.id)
      throw new AppError('invalid_otp', 'Invalid or expired verification code. Account must be active and approved by administrator.', 400)
    }

    const tokenHash = crypto.createHash('sha256').update(`${normalizedEmail}:${cleanOtp}`).digest('hex')

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    })

    if (!resetToken || resetToken.userId !== user.id || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      await registerOtpFailure(normalizedEmail, user.id)
      throw new AppError('invalid_otp', 'Invalid or expired verification code. Please check with your administrator.', 400)
    }

    res.json({
      data: {
        valid: true,
        message: 'Verification code verified successfully. You may now set your new password.',
        email: normalizedEmail,
      },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// RESET PASSWORD
// ============================================================
router.post('/reset-password', otpRateLimiter, async (req, res, next) => {
  try {
    const { token, email, otp, newPassword } = req.body

    if (!newPassword) {
      throw new AppError('missing_fields', 'New password is required', 400)
    }

    validatePassword(newPassword)

    let resetToken: any = null

    // Method A: Verify via OTP & Email
    if (email && otp) {
      const normalizedEmail = email.toLowerCase().trim()
      const cleanOtp = String(otp).trim()
      const tokenHash = crypto.createHash('sha256').update(`${normalizedEmail}:${cleanOtp}`).digest('hex')

      resetToken = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
      })
      if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
        const owner = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } })
        await registerOtpFailure(normalizedEmail, owner?.id)
      }
    } else if (token) {
      // Method B: Legacy token support
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      resetToken = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
      })
    } else {
      throw new AppError('missing_fields', 'Verification code and email are required', 400)
    }

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new AppError('token_invalid', 'Invalid or expired verification code. Please request a new code from admin.', 400)
    }

    const userToReset = await prisma.user.findUnique({
      where: { id: resetToken.userId, deletedAt: null },
    })

    if (!userToReset || userToReset.status !== 'ACTIVE') {
      throw new AppError('account_not_active', 'User account is not active or approved by administrator.', 403)
    }

    const passwordHash = await bcrypt.hash(newPassword, 12)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: resetToken.userId, revoked: false },
        data: { revoked: true, revokedAt: new Date() },
      }),
    ])

    auditService.log({
      userId: resetToken.userId,
      action: 'PASSWORD_RESET_SUCCESS',
      resourceType: 'user',
      resourceId: resetToken.userId,
    })

    res.json({
      data: { message: 'Password updated successfully. You can now log in with your new password.' },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// CHANGE PASSWORD (AUTHENTICATED)
// ============================================================
const handleChangePassword = async (req: any, res: any, next: any) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      throw new AppError('missing_fields', 'Current and new password are required', 400)
    }

    validatePassword(newPassword)

    if (currentPassword === newPassword) {
      throw new AppError('same_password', 'New password cannot be the same as your current password', 400)
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    })

    if (!user || !user.passwordHash) {
      throw new AppError('user_not_found', 'User not found', 404)
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!isValid) {
      throw new AppError('invalid_password', 'Current password is incorrect', 400)
    }

    const passwordHash = await bcrypt.hash(newPassword, 12)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: user.id, revoked: false },
        data: { revoked: true, revokedAt: new Date() },
      }),
    ])

    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = verifyAccessToken(authHeader.slice(7))
        const remainingTtl = Math.ceil(decoded.exp! - Date.now() / 1000)
        if (remainingTtl > 0 && redis && redis.status === 'ready') {
          await redis.setex(`blacklist:${decoded.jti}`, remainingTtl, '1')
        }
      } catch {}
    }

    res.json({
      data: { message: 'Password updated successfully' },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
}

router.put('/change-password', authMiddleware, handleChangePassword)
router.post('/change-password', authMiddleware, handleChangePassword)

export { router as authRouter }
