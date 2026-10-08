import { Router } from 'express'
import { prisma } from '../config/db.js'
import { redis } from '../config/redis.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { adminMiddleware } from '../middleware/admin.middleware.js'
import { auditService } from '../services/audit.service.js'
import { emailService } from '../services/email.service.js'
import { notificationService } from '../services/notification.service.js'
import { AppError } from '../lib/errors.js'
import { categoryCodeOf } from '../lib/reportCategory.js'

const router = Router()
const VALID_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'] as const
const VALID_ROLES = ['ADMIN', 'MEMBER'] as const

// ============================================================
// HANDLERS
// ============================================================
const listUsersHandler = async (req: any, res: any, next: any) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || req.query.pageSize) || 20))
    const skip = (page - 1) * limit

const status = VALID_STATUSES.includes(req.query.status as any) ? req.query.status : undefined
const role   = VALID_ROLES.includes(req.query.role as any) ? req.query.role : undefined
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
          designation: true,
          email: true,
          employeeId: true,
          phone: true,
          departmentPreference: true,
          reasonForAccess: true,
          role: true,
          status: true,
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
        designation: true,
        email: true,
        employeeId: true,
        phone: true,
        departmentPreference: true,
        reasonForAccess: true,
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
        designation: true,
        email: true,
        employeeId: true,
        phone: true,
        departmentPreference: true,
        reasonForAccess: true,
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
    const { role, employeeId, departments } = req.body

    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    })

    if (!user) {
      throw new AppError('user_not_found', 'User not found', 404)
    }

    const validRole = role === 'ADMIN' ? 'ADMIN' : 'MEMBER'

    if (validRole === 'ADMIN') {
      const existingAdmin = await prisma.user.findFirst({
        where: { role: 'ADMIN', deletedAt: null, id: { not: userId } },
      })
      if (existingAdmin) {
        throw new AppError(
          'single_admin_constraint',
          'Only one System Administrator account is permitted in the system.',
          400
        )
      }
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: {
          status: 'ACTIVE',
          role: validRole,
          ...(employeeId && { employeeId: employeeId.trim() }),
        },
        select: { id: true, name: true, email: true, status: true, role: true, employeeId: true },
      })

      if (Array.isArray(departments) && departments.length > 0) {
        await tx.userDepartmentAccess.deleteMany({
          where: { userId },
        })

        await tx.userDepartmentAccess.createMany({
          data: departments.map((d: any) => ({
            userId,
            departmentId: typeof d === 'string' ? d : d.departmentId,
            accessLevel: typeof d === 'object' && d.accessLevel === 'READ_WRITE' ? 'READ_WRITE' : 'READ_ONLY',
          })),
        })
      }

      return u
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
        message: 'User approved successfully with multi-department clearance',
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

    if (user.email === 'admin@istrac.local' || user.employeeId === 'ISRO-DIR-001') {
      throw new AppError('root_protected', 'System Root Super Admin account is permanent and cannot be suspended.', 403)
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

// ============================================================
// SELF PROFILE UPDATE (ANY AUTHENTICATED USER)
// ============================================================
const updateSelfProfileHandler = async (req: any, res: any, next: any) => {
  try {
    const { name, designation, phone } = req.body

    if (name !== undefined && typeof name === 'string' && name.trim().length < 2) {
      throw new AppError('invalid_name', 'Name must be at least 2 characters', 400)
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        designation: designation !== undefined ? (designation ? String(designation).trim() : null) : undefined,
        phone: phone !== undefined ? (phone ? String(phone).trim() : null) : undefined,
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
        departmentPreference: true,
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

    auditService.log({
      userId: req.user!.id,
      action: 'PUT:/user/profile',
      resourceType: 'user',
      resourceId: updatedUser.id,
      newValue: { name: updatedUser.name, designation: updatedUser.designation, phone: updatedUser.phone },
    })

    res.json({
      data: updatedUser,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
}

router.put('/user/profile', authMiddleware, updateSelfProfileHandler)
router.put('/users/profile', authMiddleware, updateSelfProfileHandler)

router.put('/admin/users/:userId', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawUserId = req.params.userId
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId

    const targetUser = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    })

    if (!targetUser) {
      throw new AppError('user_not_found', 'User not found', 404)
    }

    if (targetUser.email === 'admin@istrac.local' || targetUser.employeeId === 'ISRO-DIR-001') {
      throw new AppError('root_protected', 'System Root Super Admin account is permanently locked from external modification.', 403)
    }

    const { name, designation, phone, employeeId, role, status, departments } = req.body
    const validRole = role === 'ADMIN' ? 'ADMIN' : role === 'MEMBER' ? 'MEMBER' : undefined

    if (validRole === 'ADMIN') {
      const existingAdmin = await prisma.user.findFirst({
        where: { role: 'ADMIN', deletedAt: null, id: { not: userId } },
      })
      if (existingAdmin) {
        throw new AppError(
          'single_admin_constraint',
          'Only one System Administrator account is permitted in the system.',
          400
        )
      }
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: {
          name: name !== undefined ? name : undefined,
          designation: designation !== undefined ? (designation ? String(designation).trim() : null) : undefined,
          phone: phone !== undefined ? (phone ? String(phone).trim() : null) : undefined,
          employeeId: employeeId !== undefined ? employeeId : undefined,
          role: validRole,
          status: status !== undefined ? status : undefined,
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
        },
      })

      if (Array.isArray(departments)) {
        await tx.userDepartmentAccess.deleteMany({
          where: { userId },
        })

        if (departments.length > 0) {
          await tx.userDepartmentAccess.createMany({
            data: departments.map((d: any) => ({
              userId,
              departmentId: typeof d === 'string' ? d : d.departmentId,
              accessLevel: typeof d === 'object' && d.accessLevel === 'READ_WRITE' ? 'READ_WRITE' : 'READ_ONLY',
            })),
          })
        }
      }

      return u
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

// ============================================================
// ADMIN: USER REGISTRATION APPROVAL & DECISION HISTORY
// ============================================================
router.get('/admin/approvals/history', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { status, search } = req.query

    const where: any = {
      deletedAt: null,
      status: status ? String(status) : { in: ['ACTIVE', 'REJECTED', 'SUSPENDED'] },
      ...(search && {
        OR: [
          { name: { contains: String(search) } },
          { email: { contains: String(search) } },
          { employeeId: { contains: String(search) } },
        ],
      }),
    }

    const users = await prisma.user.findMany({
      where,
      take: 100,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
        departmentAccess: {
          where: { deletedAt: null },
          select: {
            department: { select: { id: true, name: true, code: true } },
            accessLevel: true,
          },
        },
      },
    })

    // Fetch audit logs for these users to extract reviewer name
    const userIds = users.map((u) => u.id)
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        resourceType: 'user',
        resourceId: { in: userIds },
        action: { in: ['POST:/users/:id/approve', 'POST:/users/:id/reject', 'POST:/users/:id/suspend', 'PUT:/users/:id'] },
      },
      orderBy: { id: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    })

    const auditMap = new Map<string, any>()
    auditLogs.forEach((log) => {
      if (log.resourceId && !auditMap.has(log.resourceId)) {
        auditMap.set(log.resourceId, log)
      }
    })

    const historyItems = users.map((u) => {
      const log = auditMap.get(u.id)
      const isSuperAdmin = u.email === 'admin@istrac.local' || u.employeeId === 'ISRO-DIR-001'
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        employeeId: u.employeeId,
        role: u.role,
        status: u.status,
        appliedAt: u.createdAt,
        decidedAt: u.updatedAt,
        lastLogin: u.lastLogin,
        isRootSuperAdmin: isSuperAdmin,
        departments: u.departmentAccess.map((da: any) => ({
          id: da.department.id,
          name: da.department.name,
          code: da.department.code,
          accessLevel: da.accessLevel,
        })),
        reviewedBy: isSuperAdmin
          ? { name: 'System Root Authority', email: 'root@istrac.isro.gov.in' }
          : log?.user
          ? { name: log.user.name, email: log.user.email }
          : { name: 'Admin Officer', email: 'admin@isro.gov.in' },
        decisionAction: isSuperAdmin ? 'ROOT_PRE_CLEARED' : log?.action || (u.status === 'ACTIVE' ? 'APPROVED' : u.status),
      }
    })

    res.json({
      data: historyItems,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// ADMIN: DOCUMENT & REPORT ACCESS REQUESTS
// ============================================================
router.get('/admin/approvals/document-requests', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { status } = req.query

    const where: any = {
      deletedAt: null,
      ...(status && { status: String(status) }),
    }

    const requests = await prisma.reportAccessRequest.findMany({
      where,
      take: 100,
      orderBy: { requestedAt: 'desc' },
      include: {
        requestedBy: { select: { id: true, name: true, email: true, employeeId: true } },
        department: { select: { id: true, name: true, code: true } },
        report: { select: { id: true, title: true, reportNumber: true } },
        processedBy: { select: { id: true, name: true, email: true } },
      },
    })

    res.json({
      data: requests,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// ADMIN: DECIDE ON DOCUMENT ACCESS REQUEST
// ============================================================
router.put('/admin/approvals/document-requests/:requestId', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.requestId
    const requestId = Array.isArray(rawId) ? rawId[0] : rawId
    const { status, adminComment } = req.body

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      throw new AppError('invalid_status', 'Status must be APPROVED or REJECTED', 400)
    }

    const request = await prisma.reportAccessRequest.findUnique({
      where: { id: requestId, deletedAt: null },
    })

    if (!request) {
      throw new AppError('request_not_found', 'Access request not found', 404)
    }

    const updated = await prisma.reportAccessRequest.update({
      where: { id: requestId },
      data: {
        status,
        adminComment: adminComment || null,
        processedById: req.user!.id,
        processedAt: new Date(),
      },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true } },
      },
    })

    // If approved, grant department access if not already present
    if (status === 'APPROVED') {
      await prisma.userDepartmentAccess.upsert({
        where: {
          userId_departmentId: {
            userId: request.requestedById,
            departmentId: request.departmentId,
          },
        },
        create: {
          userId: request.requestedById,
          departmentId: request.departmentId,
          accessLevel: request.requestedLevel,
        },
        update: {
          accessLevel: request.requestedLevel,
          deletedAt: null,
        },
      })
    }

    res.json({
      data: updated,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// MISSION OVERVIEW (MEMBER DASHBOARD COMPLETE STATE)
// ============================================================
router.get('/user/mission-overview', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user!.id
    const isAdmin = req.user!.role === 'ADMIN'

    // 1. Get user's accessible departments
    const userAccess = await prisma.userDepartmentAccess.findMany({
      where: {
        userId,
        deletedAt: null,
        department: {
          isActive: true,
          deletedAt: null,
        },
      },
      select: { departmentId: true, accessLevel: true },
    })
    const deptIds = isAdmin
      ? []
      : userAccess.map((ua) => ua.departmentId)

    const fileWhere: any = {
      nodeType: 'FILE',
      deletedAt: null,
      status: { in: ['ACTIVE', 'ORPHANED'] },
      ...(!isAdmin ? { departmentId: { in: deptIds } } : {}),
      ...(!isAdmin
        ? {
            versions: {
              some: {
                isVisible: true,
                deletedAt: null,
              },
            },
          }
        : {}),
    }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [
      totalFiles,
      todayFiles,
      storageAgg,
      allFiles,
      departments,
      notices,
      presets,
      satellites,
    ] = await Promise.all([
      prisma.file.count({ where: fileWhere }),
      prisma.file.count({ where: { ...fileWhere, createdAt: { gte: todayStart } } }),
      prisma.file.aggregate({
        _sum: { sizeBytes: true },
        where: fileWhere,
      }),
      prisma.file.findMany({
        where: fileWhere,
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          department: {
            select: {
              id: true,
              name: true,
              code: true,
              satellite: { select: { id: true, name: true, code: true } },
            },
          },
          uploader: { select: { id: true, name: true } },
          versions: {
            where: {
              deletedAt: null,
              ...(!isAdmin ? { isVisible: true } : {}),
            },
            orderBy: { versionNum: 'desc' },
            take: 1,
            select: { name: true, sizeBytes: true, versionLabel: true },
          },
          report: {
            select: {
              id: true,
              title: true,
              spacecraft: true,
              category: true,
              customCategory: true,
              versionLabel: true,
              status: true,
              classificationLevel: true,
              reportNumber: true,
            },
          },
        },
      }),
      prisma.department.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          ...(!isAdmin ? { id: { in: deptIds } } : {}),
        },
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
          pageLeadOfficer: true,
          pageLeadRole: true,
          files: {
            where: {
              nodeType: 'FILE',
              deletedAt: null,
              status: { in: ['ACTIVE', 'ORPHANED'] },
              ...(!isAdmin
                ? {
                    versions: {
                      some: {
                        isVisible: true,
                        deletedAt: null,
                      },
                    },
                  }
                : {}),
            },
            take: 10,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              name: true,
              mimeType: true,
              extension: true,
              sizeBytes: true,
              createdAt: true,
              versions: {
                where: {
                  deletedAt: null,
                  ...(!isAdmin ? { isVisible: true } : {}),
                },
                orderBy: { versionNum: 'desc' },
                take: 1,
                select: { name: true, sizeBytes: true },
              },
            },
          },
          _count: {
            select: {
              files: {
                where: {
                  nodeType: 'FILE',
                  deletedAt: null,
                  status: { in: ['ACTIVE', 'ORPHANED'] },
                  ...(!isAdmin
                    ? {
                        versions: {
                          some: {
                            isVisible: true,
                            deletedAt: null,
                          },
                        },
                      }
                    : {}),
                },
              },
            },
          },
        },
      }),
      prisma.notification.findMany({
        where: {
          userId,
          deletedAt: null,
        },
        distinct: ['message'],
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.reportCategoryPreset.findMany({
        select: { code: true, name: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.satellite.findMany({
        where: { deletedAt: null, isActive: true },
        select: { id: true, name: true, code: true },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    const totalStorageBytes = Number(storageAgg._sum.sizeBytes || 0n)

    // Palette & dynamic colors for satellites / spacecraft
    const satPalette = [
      '#FF6B00', '#00A3FF', '#8B5CF6', '#10B981', '#F59E0B',
      '#EC4899', '#3B82F6', '#EF4444', '#06B6D4', '#14B8A6',
      '#84CC16', '#F43F5E', '#A855F7', '#6366F1', '#D946EF',
      '#0EA5E9', '#22C55E', '#EAB308', '#F97316', '#64748B',
    ]

    const knownSatColors: Record<string, string> = {
      'Aditya-L1': '#FF6B00',
      'Chandrayaan-3': '#00A3FF',
      'Gaganyaan-1': '#8B5CF6',
      'Gaganyaan': '#8B5CF6',
      'Cartosat-3': '#10B981',
      'NISAR': '#F59E0B',
      'XPoSat': '#EC4899',
      'PSLV-C59': '#3B82F6',
      'NETRA SSA': '#EF4444',
      'NETRA': '#EF4444',
      'IS4OM': '#EF4444',
      'EOS-08': '#00D8B6',
      'General': '#64748B',
    }

    const getSatColor = (name: string, index: number): string => {
      if (knownSatColors[name]) return knownSatColors[name]
      const foundKey = Object.keys(knownSatColors).find(
        (k) => k.toUpperCase() === name.toUpperCase() || name.toUpperCase().includes(k.toUpperCase())
      )
      if (foundKey) return knownSatColors[foundKey]
      return satPalette[index % satPalette.length]
    }

    // Resolve spacecraft for each file against report metadata, filename, and DB satellites
    const resolveFileSpacecraft = (f: any): string => {
      if (f.report?.spacecraft && f.report.spacecraft !== 'General') {
        return f.report.spacecraft
      }
      const text = `${f.name || ''} ${f.report?.title || ''}`.toUpperCase()
      const textClean = text.replace(/[^A-Z0-9]/g, '')

      for (const s of satellites) {
        if (s.code === 'ISTRAC-BLR' || s.code === 'GENERAL' || s.name.includes('Ground Complex')) continue
        if (s.code) {
          const codeClean = s.code.replace(/[^A-Z0-9]/g, '')
          if (codeClean && textClean.includes(codeClean)) {
            return s.name.replace(/ (Solar Observatory|Lunar Relay|Optical Constellation|Orbital Module|Earth Observatory)$/i, '').trim() || s.name
          }
        }
        const primaryName = s.name.split(/[\s-_]/)[0]
        if (primaryName && primaryName.length >= 4 && text.includes(primaryName.toUpperCase())) {
          return s.name.replace(/ (Solar Observatory|Lunar Relay|Optical Constellation|Orbital Module|Earth Observatory)$/i, '').trim() || s.name
        }
      }
      if (/PSLV[-_]?C59/i.test(text)) return 'PSLV-C59'
      if (/NETRA|IS4OM/i.test(text)) return 'NETRA SSA'
      if (/XPOSAT/i.test(text)) return 'XPoSat'
      if (/EOS[-_]?08/i.test(text)) return 'EOS-08'
      return 'General'
    }

    const spacecraftMap: Record<string, number> = {}
    satellites.forEach((s: any) => {
      if (s.code !== 'ISTRAC-BLR' && s.code !== 'GENERAL' && !s.name.includes('Ground Complex')) {
        const cleanName = s.name.replace(/ (Solar Observatory|Lunar Relay|Optical Constellation|Orbital Module|Earth Observatory|Ground Complex)$/i, '').trim() || s.name
        spacecraftMap[cleanName] = 0
      }
    })

    allFiles.forEach((f: any) => {
      const sat = resolveFileSpacecraft(f)
      spacecraftMap[sat] = (spacecraftMap[sat] || 0) + 1
    })

    const spacecraftData = Object.entries(spacecraftMap)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([spacecraft, count], i) => ({
        spacecraft,
        count,
        color: getSatColor(spacecraft, i),
      }))

    // Dynamic Category breakdown & Pie chart colors
    const catPalette = [
      '#0066FF', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444',
      '#EC4899', '#06B6D4', '#14B8A6', '#84CC16', '#F43F5E',
      '#A855F7', '#EAB308', '#3B82F6', '#F97316', '#6366F1',
    ]

    const knownCatColors: Record<string, string> = {
      DAILYOPS: '#10B981',
      DAILY_REPORT: '#10B981',
      STUDY: '#8B5CF6',
      PAYLOADOPS: '#F59E0B',
      ANOMALY: '#EF4444',
      SPECOPS: '#EC4899',
      SPECIAL_OPERATIONS: '#EC4899',
      GENERAL: '#0066FF',
      OTHER: '#0066FF',
    }

    const presetNames = new Map<string, string>()
    const presetColors = new Map<string, string>()
    presets.forEach((p: any, idx: number) => {
      presetNames.set(p.code, p.name)
      const color = knownCatColors[p.code] || catPalette[idx % catPalette.length]
      presetColors.set(p.code, color)
    })
    const presetCodes = new Set<string>(presets.map((p: any) => String(p.code)))

    const resolveFileCategory = (f: any): string => {
      if (f.report?.customCategory) return f.report.customCategory
      if (f.report?.category && f.report.category !== 'OTHER') {
        const mapped = categoryCodeOf(f.report)
        if (mapped && mapped !== 'GENERAL') return mapped
      }
      const text = `${f.name || ''} ${f.report?.title || ''}`.toUpperCase()
      if (/ANOMALY|INCIDENT|ALERT|FAILURE/.test(text)) return 'ANOMALY'
      if (/STUDY|ANALYSIS|ASSESSMENT|REPORT_Q\d|SURVEY/.test(text)) return 'STUDY'
      if (/SIM|SPECOPS|MANEUVER|EPHEMERIS|ORBIT_PLAN/.test(text)) return 'SPECOPS'
      if (/PAYLOAD|PASS|SBAND|RECEIVER|TELEMETRY/.test(text)) return 'PAYLOADOPS'
      if (/DAILY|LOG|DUMP|SHIFT/.test(text)) return 'DAILYOPS'
      for (const code of presetCodes) {
        if (code !== 'GENERAL' && text.includes(code)) return code
      }
      return 'GENERAL'
    }

    const categoryMap: Record<string, number> = {}
    presets.forEach((p: any) => {
      categoryMap[p.code] = 0
    })

    allFiles.forEach((f: any) => {
      const cat = resolveFileCategory(f)
      categoryMap[cat] = (categoryMap[cat] || 0) + 1
    })

    const totalCategoryCount = Math.max(1, allFiles.length)
    const categoryData = Object.entries(categoryMap)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count], i) => {
        const label = presetNames.get(cat) || cat
        const color = presetColors.get(cat) || catPalette[i % catPalette.length]
        return {
          category: cat,
          label,
          count,
          percentage: Math.round((count / totalCategoryCount) * 100),
          color,
        }
      })

    res.json({
      data: {
        metrics: {
          totalReports: totalFiles,
          todaysUploads: todayFiles,
          totalStorageBytes,
          accessibleDeptsCount: departments.length,
          totalDepartments: departments.length,
        },
        spacecraftBreakdown: spacecraftData,
        categoryBreakdown: categoryData,
        recentFiles: allFiles.map((f: any) => {
          const activeVer = f.versions?.[0]
          const displayName = (!isAdmin && activeVer?.name) ? activeVer.name : f.name
          const displaySize = (!isAdmin && activeVer?.sizeBytes) ? activeVer.sizeBytes.toString() : (f.sizeBytes ? f.sizeBytes.toString() : '0')
          const displayVer = (!isAdmin && activeVer?.versionLabel) ? activeVer.versionLabel : (f.report?.versionLabel || `V${f.versionCount || 1}.0`)

          const fileSat = resolveFileSpacecraft(f)
          const fileCat = resolveFileCategory(f)

          return {
            id: f.id,
            name: displayName,
            title: f.report?.title || displayName.replace(/_/g, ' ').replace(/\.[^.]+$/, ''),
            category: fileCat,
            version: displayVer,
            status: f.report?.status || 'Published',
            reportDate: f.createdAt,
            author: f.uploader?.name || 'Mission Ops',
            classification: f.report?.classificationLevel || 'ISRO_LEVEL',
            spacecraft: fileSat,
            departmentName: f.department?.name || 'Mission Operations',
            departmentCode: f.department?.code || 'MOX',
            sizeBytes: displaySize,
            mimeType: f.mimeType,
            extension: (f.extension || 'DAT').toUpperCase(),
          }
        }),
        departments: departments.map((d: any) => {
          const access = userAccess.find((ua) => ua.departmentId === d.id)
          return {
            id: d.id,
            name: d.name,
            code: d.code,
            description: d.description,
            leadOfficer: d.pageLeadOfficer || 'Division Director',
            leadRole: d.pageLeadRole || 'Head of Division',
            fileCount: d._count.files,
            accessLevel: isAdmin ? 'READ_WRITE' : access?.accessLevel || 'READ_ONLY',
            isAssigned: isAdmin || !!access,
            files: d.files.map((f: any) => {
              const activeVer = f.versions?.[0]
              const name = (!isAdmin && activeVer?.name) ? activeVer.name : f.name
              const size = (!isAdmin && activeVer?.sizeBytes) ? activeVer.sizeBytes.toString() : (f.sizeBytes ? f.sizeBytes.toString() : '0')
              return {
                id: f.id,
                name,
                mimeType: f.mimeType,
                extension: (f.extension || 'DAT').toUpperCase(),
                sizeBytes: size,
                createdAt: f.createdAt,
              }
            }),
          }
        }),
        notices: notices.map((n: any) => ({
          id: n.id.toString(),
          type: n.type,
          category: n.category || 'BROADCAST',
          message: n.message,
          createdAt: n.createdAt,
        })),
      },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

export { router as userRouter }

