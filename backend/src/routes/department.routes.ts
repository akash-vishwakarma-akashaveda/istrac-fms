import { Router } from 'express'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { prisma } from '../config/db.js'
import { redis } from '../config/redis.js'
import { env } from '../config/env.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { adminMiddleware } from '../middleware/admin.middleware.js'
import { auditService } from '../services/audit.service.js'
import { notificationService } from '../services/notification.service.js'
import { AppError } from '../lib/errors.js'

const router = Router()

// ============================================================
// PUBLIC: LIST ACTIVE DEPARTMENTS FOR PORTAL & DIRECTORY
// ============================================================
router.get('/departments/public', async (_req, res, next) => {
  try {
    const departments = await prisma.department.findMany({
      where: { isActive: true, deletedAt: null },
      include: {
        satellite: { select: { id: true, name: true, code: true } },
        _count: { select: { files: { where: { deletedAt: null } } } },
      },
      orderBy: { name: 'asc' },
    })

    res.json({
      data: departments.map((d: any) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        description: d.description,
        satellite: d.satellite,
        fileCount: d._count.files,
        createdAt: d.createdAt,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// PUBLIC: GET SINGLE DEPARTMENT PUBLIC PROFILE
// ============================================================
router.get('/departments/public/:deptId', async (req, res, next) => {
  try {
    const rawDeptId = req.params.deptId
    const deptId = Array.isArray(rawDeptId) ? rawDeptId[0] : rawDeptId

    const department = await prisma.department.findUnique({
      where: { id: deptId, deletedAt: null },
      include: {
        satellite: { select: { id: true, name: true, code: true } },
        _count: { select: { files: { where: { deletedAt: null } } } },
      },
    })

    if (!department || !department.isActive) {
      throw new AppError('department_not_found', 'Department not found', 404)
    }

    res.json({
      data: {
        id: department.id,
        name: department.name,
        code: department.code,
        description: department.description,
        satellite: department.satellite,
        fileCount: department._count.files,
        createdAt: department.createdAt,
      },
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// LIST USER'S ACCESSIBLE DEPARTMENTS
// ============================================================
router.get('/departments', authMiddleware, async (req, res, next) => {
  try {
    const isAdmin = req.user!.role === 'ADMIN'
    let departments

    if (isAdmin) {
      departments = await prisma.department.findMany({
        where: { isActive: true, deletedAt: null },
        include: {
          satellite: { select: { id: true, name: true, code: true } },
          _count: { select: { files: { where: { deletedAt: null } } } },
        },
        orderBy: { name: 'asc' },
      })
    } else {
      const userAccess = await prisma.userDepartmentAccess.findMany({
        where: { userId: req.user!.id, deletedAt: null },
        include: {
          department: {
            include: {
              satellite: { select: { id: true, name: true, code: true } },
              _count: { select: { files: { where: { deletedAt: null } } } },
            },
          },
        },
      })

      departments = userAccess
        .filter((ua: any) => ua.department.isActive && !ua.department.deletedAt)
        .map((ua: any) => ({
          ...ua.department,
          accessLevel: ua.accessLevel,
        }))
    }

    res.json({
      data: departments,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// ADMIN: LIST ALL DEPARTMENTS
// ============================================================
router.get('/admin/departments', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const satelliteId = req.query.satelliteId as string | undefined

    const departments = await prisma.department.findMany({
      where: {
        deletedAt: null,
        ...(satelliteId && { satelliteId }),
      },
      include: {
        satellite: { select: { id: true, name: true, code: true } },
        _count: {
          select: {
            files: { where: { deletedAt: null } },
            userAccess: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({
      data: departments.map((d: any) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        description: d.description,
        hddPath: d.hddPath,
        isActive: d.isActive,
        allowUserFolderCreation: d.allowUserFolderCreation,
        maxFolderDepth: d.maxFolderDepth,
        satellite: d.satellite,
        fileCount: d._count.files,
        userCount: d._count.userAccess,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// CREATE DEPARTMENT HANDLER
// ============================================================
const createDeptHandler = async (req: any, res: any, next: any) => {
  try {
    let {
      satelliteId,
      name,
      code,
      description,
      hddPath,
      allowUserFolderCreation,
      maxFolderDepth,
    } = req.body

    if (!name) {
      throw new AppError('missing_fields', 'Department name is required', 400)
    }

    if (!satelliteId) {
      const defaultSatellite = await prisma.satellite.findFirst({
        where: { isActive: true, deletedAt: null },
      })
      if (!defaultSatellite) {
        throw new AppError('no_satellite', 'No active satellite found. Please create a satellite first.', 400)
      }
      satelliteId = defaultSatellite.id
    }

    const satellite = await prisma.satellite.findUnique({
      where: { id: satelliteId, deletedAt: null },
    })
    if (!satellite) {
      throw new AppError('satellite_not_found', 'Specified satellite does not exist', 404)
    }

    const existingName = await prisma.department.findUnique({
      where: { satelliteId_name: { satelliteId, name } },
    })
    if (existingName && !existingName.deletedAt) {
      throw new AppError(
        'department_exists',
        'A department with this name already exists in this satellite station',
        409,
      )
    }

    const finalHddPath = hddPath || path.join(env.HDD_MOUNT_PATH, name.toLowerCase().replace(/[^a-z0-9]/g, '_'))

    try {
      await fs.mkdir(finalHddPath, { recursive: true })
    } catch (fsErr) {
      console.warn('[Department] Could not create physical directory:', fsErr)
    }

    const department = await prisma.department.create({
      data: {
        satelliteId,
        name,
        code: code || null,
        description: description || null,
        hddPath: finalHddPath,
        allowUserFolderCreation: Boolean(allowUserFolderCreation),
        maxFolderDepth: maxFolderDepth ? Number(maxFolderDepth) : 5,
      },
      include: {
        satellite: true,
      },
    })

    auditService.log({
      userId: req.user!.id,
      action: 'POST:/departments',
      resourceType: 'department',
      resourceId: department.id,
    })

    res.status(201).json({
      data: department,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
}

router.post('/admin/departments', authMiddleware, adminMiddleware, createDeptHandler)
router.post('/departments', authMiddleware, adminMiddleware, createDeptHandler)

// ============================================================
// GET SINGLE DEPARTMENT
// ============================================================
router.get('/admin/departments/:deptId', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawDeptId = req.params.deptId
    const deptId = Array.isArray(rawDeptId) ? rawDeptId[0] : rawDeptId

    const department = await prisma.department.findUnique({
      where: { id: deptId, deletedAt: null },
      include: {
        satellite: true,
        userAccess: {
          where: { deletedAt: null },
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    })

    if (!department) {
      throw new AppError('department_not_found', 'Department not found', 404)
    }

    res.json({
      data: department,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// UPDATE DEPARTMENT HANDLER
// ============================================================
const updateDeptHandler = async (req: any, res: any, next: any) => {
  try {
    const rawDeptId = req.params.deptId
    const deptId = Array.isArray(rawDeptId) ? rawDeptId[0] : rawDeptId

    const {
      name,
      code,
      description,
      hddPath,
      allowUserFolderCreation,
      maxFolderDepth,
      isActive,
      archived,
    } = req.body

    const existing = await prisma.department.findUnique({
      where: { id: deptId, deletedAt: null },
    })
    if (!existing) {
      throw new AppError('department_not_found', 'Department not found', 404)
    }

    const isDeptActive = archived !== undefined ? !archived : isActive !== undefined ? Boolean(isActive) : undefined

    const updated = await prisma.department.update({
      where: { id: deptId },
      data: {
        name: name !== undefined ? name : undefined,
        code: code !== undefined ? code : undefined,
        description: description !== undefined ? description : undefined,
        hddPath: hddPath !== undefined ? hddPath : undefined,
        allowUserFolderCreation: allowUserFolderCreation !== undefined ? Boolean(allowUserFolderCreation) : undefined,
        maxFolderDepth: maxFolderDepth !== undefined ? Number(maxFolderDepth) : undefined,
        isActive: isDeptActive,
      },
    })

    auditService.log({
      userId: req.user!.id,
      action: 'PUT:/departments/:id',
      resourceType: 'department',
      resourceId: updated.id,
    })

    res.json({
      data: updated,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
}

router.put('/admin/departments/:deptId', authMiddleware, adminMiddleware, updateDeptHandler)
router.put('/departments/:deptId', authMiddleware, adminMiddleware, updateDeptHandler)

// ============================================================
// DELETE DEPARTMENT
// ============================================================
const deleteDeptHandler = async (req: any, res: any, next: any) => {
  try {
    const rawDeptId = req.params.deptId
    const deptId = Array.isArray(rawDeptId) ? rawDeptId[0] : rawDeptId

    const fileCount = await prisma.file.count({
      where: { departmentId: deptId, deletedAt: null },
    })

    if (fileCount > 0) {
      throw new AppError(
        'department_has_files',
        'Cannot delete department with active files. Move or archive files first.',
        400,
      )
    }

    await prisma.department.update({
      where: { id: deptId },
      data: { deletedAt: new Date(), isActive: false },
    })

    auditService.log({
      userId: req.user!.id,
      action: 'DELETE:/departments/:id',
      resourceType: 'department',
      resourceId: deptId,
    })

    res.json({
      data: { message: 'Department deactivated successfully' },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
}

router.delete('/admin/departments/:deptId', authMiddleware, adminMiddleware, deleteDeptHandler)
router.delete('/departments/:deptId', authMiddleware, adminMiddleware, deleteDeptHandler)

// ============================================================
// GRANT USER ACCESS TO DEPARTMENT
// ============================================================
router.post('/admin/departments/:deptId/users', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { userId, accessLevel, expiresAt } = req.body
    const rawDeptId = req.params.deptId
    const deptId = Array.isArray(rawDeptId) ? rawDeptId[0] : rawDeptId

    if (!userId) {
      throw new AppError('missing_user_id', 'User ID is required', 400)
    }

    const dept = await prisma.department.findUnique({
      where: { id: deptId, deletedAt: null },
    })
    if (!dept) {
      throw new AppError('department_not_found', 'Department not found', 404)
    }

    const validLevel = accessLevel === 'READ_WRITE' ? 'READ_WRITE' : 'READ_ONLY'

    const access = await prisma.userDepartmentAccess.upsert({
      where: { userId_departmentId: { userId, departmentId: deptId } },
      update: {
        accessLevel: validLevel,
        deletedAt: null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      create: {
        userId,
        departmentId: deptId,
        accessLevel: validLevel,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    })

    await redis.del(`dept-access:${userId}:${deptId}`)

    auditService.log({
      userId: req.user!.id,
      action: 'POST:/departments/:id/users',
      resourceType: 'user_department_access',
      resourceId: access.id,
    })

    notificationService.send({
      type: 'DEPARTMENT_ACCESS_GRANTED',
      category: 'access',
      recipientIds: [userId],
      actorId: req.user!.id,
      message: `You were granted ${validLevel} access to ${dept.name}`,
    })

    res.status(201).json({
      data: access,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// REVOKE USER ACCESS
// ============================================================
router.delete('/admin/departments/:deptId/users/:userId', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawDeptId = req.params.deptId
    const deptId = Array.isArray(rawDeptId) ? rawDeptId[0] : rawDeptId
    const rawUserId = req.params.userId
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId

    await prisma.userDepartmentAccess.deleteMany({
      where: { userId, departmentId: deptId },
    })

    await redis.del(`dept-access:${userId}:${deptId}`)

    auditService.log({
      userId: req.user!.id,
      action: 'DELETE:/departments/:id/users/:uid',
      resourceType: 'user_department_access',
      resourceId: `${userId}:${deptId}`,
    })

    res.json({
      data: { message: 'User department access revoked' },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

export { router as departmentRouter }
