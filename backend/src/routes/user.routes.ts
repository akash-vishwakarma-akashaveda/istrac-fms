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
      where: { userId, deletedAt: null },
      select: { departmentId: true, accessLevel: true },
    })
    const deptIds = isAdmin
      ? []
      : userAccess.map((ua) => ua.departmentId)

    const fileWhere: any = {
      nodeType: 'FILE',
      deletedAt: null,
      status: { in: ['ACTIVE', 'ORPHANED'] },
      ...(!isAdmin && deptIds.length > 0 ? { departmentId: { in: deptIds } } : {}),
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
          department: { select: { id: true, name: true, code: true } },
          uploader: { select: { id: true, name: true } },
          report: {
            select: {
              id: true,
              title: true,
              spacecraft: true,
              category: true,
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
          ...(!isAdmin && deptIds.length > 0 ? { id: { in: deptIds } } : {}),
        },
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
          pageLeadOfficer: true,
          pageLeadRole: true,
          files: {
            where: { nodeType: 'FILE', deletedAt: null, status: { in: ['ACTIVE', 'ORPHANED'] } },
            take: 10,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              name: true,
              mimeType: true,
              extension: true,
              sizeBytes: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              files: {
                where: { nodeType: 'FILE', deletedAt: null, status: { in: ['ACTIVE', 'ORPHANED'] } },
              },
            },
          },
        },
      }),
      prisma.notification.findMany({
        where: {
          deletedAt: null,
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const totalStorageBytes = Number(storageAgg._sum.sizeBytes || 0n)

    // Calculate real spacecraft breakdown from active files
    const spacecraftMap: Record<string, number> = {}
    const satColors: Record<string, string> = {
      'Aditya-L1': '#FF6B00',
      'Chandrayaan-3': '#00A3FF',
      'Gaganyaan-1': '#8B5CF6',
      'Cartosat-3': '#10B981',
      'NISAR': '#F59E0B',
      'XPoSat': '#EC4899',
      'PSLV-C59': '#3B82F6',
      'NETRA SSA': '#EF4444',
      'EOS-08': '#0066FF',
    }

    allFiles.forEach((f: any) => {
      const sat = f.report?.spacecraft || 'General'
      spacecraftMap[sat] = (spacecraftMap[sat] || 0) + 1
    })

    const spacecraftData = Object.entries(spacecraftMap).map(([spacecraft, count]) => ({
      spacecraft,
      count,
      color: satColors[spacecraft] || '#0066FF',
    }))

    // Calculate real category breakdown
    const categoryMap: Record<string, number> = {}
    const categoryLabels: Record<string, { label: string; color: string }> = {
      DAILY_REPORT: { label: 'Daily Operations', color: '#0066FF' },
      ANOMALY: { label: 'Anomaly Reports', color: '#EF4444' },
      HEALTH: { label: 'Subsystem Health', color: '#10B981' },
      EVENT: { label: 'Flight Events', color: '#F59E0B' },
      PAYLOAD: { label: 'Payload Science', color: '#8B5CF6' },
      STUDY: { label: 'Mission Studies', color: '#6B7280' },
    }

    allFiles.forEach((f: any) => {
      const cat = f.report?.category || 'DAILY_REPORT'
      categoryMap[cat] = (categoryMap[cat] || 0) + 1
    })

    const totalCategoryCount = Math.max(1, allFiles.length)
    const categoryData = Object.entries(categoryMap).map(([cat, count]) => {
      const meta = categoryLabels[cat] || { label: cat, color: '#3B82F6' }
      return {
        category: cat,
        label: meta.label,
        count,
        percentage: Math.round((count / totalCategoryCount) * 100),
        color: meta.color,
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
        recentFiles: allFiles.map((f: any) => ({
          id: f.id,
          name: f.name,
          title: f.report?.title || f.name.replace(/_/g, ' ').replace(/\.[^.]+$/, ''),
          category: f.report?.category || 'DAILY_REPORT',
          version: f.report?.versionLabel || `V${f.versionCount || 1}.0`,
          status: f.report?.status || 'Published',
          reportDate: f.createdAt,
          author: f.uploader?.name || 'Mission Ops',
          classification: f.report?.classificationLevel || 'ISRO_LEVEL',
          spacecraft: f.report?.spacecraft || 'General',
          departmentName: f.department?.name || 'Mission Operations',
          departmentCode: f.department?.code || 'MOX',
          sizeBytes: f.sizeBytes ? f.sizeBytes.toString() : '0',
          mimeType: f.mimeType,
          extension: (f.extension || 'DAT').toUpperCase(),
        })),
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
            files: d.files.map((f: any) => ({
              id: f.id,
              name: f.name,
              mimeType: f.mimeType,
              extension: (f.extension || 'DAT').toUpperCase(),
              sizeBytes: f.sizeBytes ? f.sizeBytes.toString() : '0',
              createdAt: f.createdAt,
            })),
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

