import { Router } from 'express'
import { prisma } from '../config/db.js'
import { redis } from '../config/redis.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { adminMiddleware } from '../middleware/admin.middleware.js'
import { auditService } from '../services/audit.service.js'
import { emailService } from '../services/email.service.js'
import { notificationService } from '../services/notification.service.js'
import { AppError } from '../lib/errors.js'

const router = Router()

// ============================================================
// HANDLERS
// ============================================================
const listUsersHandler = async (req: any, res: any, next: any) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || req.query.pageSize) || 20))
    const skip = (page - 1) * limit

    const status = req.query.status
    const role = req.query.role
    const search = req.query.search as string | undefined

    const where: any = {
      deletedAt: null,
      ...(status && { status }),
      ...(role && { role }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
          { employeeId: { contains: search } },
        ],
      }),
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          employeeId: true,
          role: true,
          status: true,
          lastLogin: true,
          createdAt: true,
          departmentAccess: {
            where: { deletedAt: null },
            include: {
              department: {
                select: { id: true, name: true, satellite: { select: { code: true } } },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const totalPages = Math.ceil(total / limit)

    res.json({
      data: users,
      total,
      page,
      limit,
      pagination: {
        total,
        page,
        pageSize: limit,
        totalPages,
      },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
}

const pendingUsersHandler = async (req: any, res: any, next: any) => {
  try {
    const pendingUsers = await prisma.user.findMany({
      where: { status: 'PENDING', deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    res.json({
      data: pendingUsers,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
}

const getUserHandler = async (req: any, res: any, next: any) => {
  try {
    const rawUserId = req.params.userId
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId

    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        role: true,
        status: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        departmentAccess: {
          where: { deletedAt: null },
          include: {
            department: {
              include: { satellite: true },
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
}

const approveUserHandler = async (req: any, res: any, next: any) => {
  try {
    const rawUserId = req.params.userId
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId

    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    })

    if (!user) {
      throw new AppError('user_not_found', 'User not found', 404)
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
      select: { id: true, name: true, email: true, status: true },
    })

    auditService.log({
      userId: req.user!.id,
      action: 'POST:/users/:id/approve',
      resourceType: 'user',
      resourceId: user.id,
    })

    emailService.sendApprovalEmail(user.email, user.name)

    notificationService.send({
      type: 'APPROVAL_RESULT',
      category: 'account',
      recipientIds: [user.id],
      actorId: req.user!.id,
      message: 'Your registration request has been approved.',
    })

    res.json({
      data: {
        message: 'User approved successfully',
        user: updated,
      },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
}

const rejectUserHandler = async (req: any, res: any, next: any) => {
  try {
    const rawUserId = req.params.userId
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId
    const { reason } = req.body

    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    })

    if (!user) {
      throw new AppError('user_not_found', 'User not found', 404)
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { status: 'REJECTED' },
      select: { id: true, name: true, email: true, status: true },
    })

    auditService.log({
      userId: req.user!.id,
      action: 'POST:/users/:id/reject',
      resourceType: 'user',
      resourceId: user.id,
    })

    emailService.sendRejectionEmail(user.email, user.name, reason)

    res.json({
      data: {
        message: 'User registration rejected',
        user: updated,
      },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
}

const suspendUserHandler = async (req: any, res: any, next: any) => {
  try {
    const rawUserId = req.params.userId
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId

    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    })

    if (!user) {
      throw new AppError('user_not_found', 'User not found', 404)
    }

    const nextStatus = user.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED'

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { status: nextStatus },
      select: { id: true, name: true, email: true, status: true },
    })

    if (nextStatus === 'SUSPENDED') {
      await prisma.refreshToken.updateMany({
        where: { userId: user.id, revoked: false },
        data: { revoked: true, revokedAt: new Date() },
      })
      emailService.sendSuspensionEmail(user.email, user.name)
    }

    auditService.log({
      userId: req.user!.id,
      action: `POST:/users/:id/${nextStatus.toLowerCase()}`,
      resourceType: 'user',
      resourceId: user.id,
    })

    res.json({
      data: {
        message: `User account is now ${nextStatus.toLowerCase()}`,
        user: updated,
      },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
}

const forceLogoutHandler = async (req: any, res: any, next: any) => {
  try {
    const rawUserId = req.params.userId
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId

    await prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    })

    res.json({
      data: { message: 'User forced logout successfully' },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
}

// ============================================================
// ROUTES
// ============================================================
router.get('/admin/users', authMiddleware, adminMiddleware, listUsersHandler)
router.get('/users', authMiddleware, adminMiddleware, listUsersHandler)

router.get('/admin/users/pending', authMiddleware, adminMiddleware, pendingUsersHandler)
router.get('/users/pending', authMiddleware, adminMiddleware, pendingUsersHandler)

router.get('/admin/users/:userId', authMiddleware, adminMiddleware, getUserHandler)
router.get('/users/:userId', authMiddleware, adminMiddleware, getUserHandler)

router.post('/admin/users/:userId/approve', authMiddleware, adminMiddleware, approveUserHandler)
router.post('/users/:userId/approve', authMiddleware, adminMiddleware, approveUserHandler)

router.post('/admin/users/:userId/reject', authMiddleware, adminMiddleware, rejectUserHandler)
router.post('/users/:userId/reject', authMiddleware, adminMiddleware, rejectUserHandler)

router.post('/admin/users/:userId/suspend', authMiddleware, adminMiddleware, suspendUserHandler)
router.post('/users/:userId/suspend', authMiddleware, adminMiddleware, suspendUserHandler)

router.post('/users/:userId/force-logout', authMiddleware, adminMiddleware, forceLogoutHandler)

router.put('/admin/users/:userId', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawUserId = req.params.userId
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId
    const { name, employeeId, role } = req.body
    const validRole = role === 'ADMIN' ? 'ADMIN' : role === 'MEMBER' ? 'MEMBER' : undefined

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name !== undefined ? name : undefined,
        employeeId: employeeId !== undefined ? employeeId : undefined,
        role: validRole,
      },
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        role: true,
        status: true,
      },
    })

    auditService.log({
      userId: req.user!.id,
      action: 'PUT:/users/:id',
      resourceType: 'user',
      resourceId: updated.id,
    })

    res.json({
      data: updated,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

export { router as userRouter }
