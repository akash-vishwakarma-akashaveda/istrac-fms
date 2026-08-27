import { Router } from 'express'
import bcrypt from 'bcrypt'
import * as crypto from 'node:crypto'
import { prisma } from '../config/db.js'
import { redis } from '../config/redis.js'
import { env } from '../config/env.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { loginRateLimiter } from '../middleware/rateLimiter.middleware.js'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt.js'
import { emailService } from '../services/email.service.js'
import { auditService } from '../services/audit.service.js'
import { AppError } from '../lib/errors.js'

const router = Router()

// ============================================================
// REGISTER (PUBLIC)
// ============================================================
router.post('/register', loginRateLimiter, async (req, res, next) => {
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
router.post('/login', loginRateLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      throw new AppError('invalid_credentials', 'Email and password are required', 400)
    }

    const user = await prisma.user.findUnique({
      where: { email, deletedAt: null },
    })

    if (!user || !user.passwordHash) {
      throw new AppError('invalid_credentials', 'Invalid email or password', 401)
    }

    if (user.status === 'PENDING') {
      throw new AppError('account_pending', 'Your account is pending administrator approval', 403)
    }

    if (user.status === 'SUSPENDED') {
      throw new AppError('account_suspended', 'Your account has been suspended', 403)
    }

    if (user.status === 'REJECTED') {
      throw new AppError('account_rejected', 'Your registration was rejected', 403)
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash)
    if (!passwordValid) {
      throw new AppError('invalid_credentials', 'Invalid email or password', 401)
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

    res.cookie('refreshToken', rawRefreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: env.NODE_ENV === 'production',
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
router.post('/refresh', async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies?.refreshToken

    if (!rawRefreshToken) {
      throw new AppError('missing_refresh_token', 'No refresh token provided', 401)
    }

    const payload = verifyRefreshToken(rawRefreshToken)
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex')

    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    })

    if (!tokenRecord || tokenRecord.revoked || tokenRecord.expiresAt < new Date()) {
      throw new AppError('refresh_token_invalid', 'Invalid or expired session', 401)
    }

    // Revoke old token
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revoked: true, revokedAt: new Date() },
    })

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

    res.cookie('refreshToken', newRawRefreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    res.json({
      data: { accessToken: newAccessToken },
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
    const rawRefreshToken = req.cookies?.refreshToken
    if (rawRefreshToken) {
      const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex')
      await prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { revoked: true, revokedAt: new Date() },
      })
    }

    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      // Blacklist token in Redis for 15 minutes (900 seconds)
      await redis.setex(`blacklist:${token}`, 900, 'revoked')
    }

    res.clearCookie('refreshToken')

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
// FORGOT PASSWORD
// ============================================================
router.post('/forgot-password', loginRateLimiter, async (req, res, next) => {
  try {
    const { email } = req.body
    if (!email) {
      throw new AppError('missing_email', 'Email is required', 400)
    }

    const user = await prisma.user.findUnique({
      where: { email, deletedAt: null },
    })

    if (user && user.status === 'ACTIVE') {
      const rawToken = crypto.randomBytes(32).toString('hex')
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 mins

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      })

      const resetLink = `${env.APP_URL}/reset-password?token=${rawToken}`
      emailService.sendPasswordResetEmail(user.email, user.name, resetLink)
    }

    res.json({
      data: { message: 'If an account exists, a password reset link has been dispatched.' },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// RESET PASSWORD
// ============================================================
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body

    if (!token || !newPassword) {
      throw new AppError('missing_fields', 'Token and newPassword are required', 400)
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    })

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new AppError('token_invalid', 'Invalid or expired password reset token', 400)
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

    res.json({
      data: { message: 'Password reset successfully. You can now log in.' },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// CHANGE PASSWORD (AUTHENTICATED)
// ============================================================
router.put('/change-password', authMiddleware, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      throw new AppError('missing_fields', 'Current and new password are required', 400)
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

    res.json({
      data: { message: 'Password updated successfully' },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

export { router as authRouter }
