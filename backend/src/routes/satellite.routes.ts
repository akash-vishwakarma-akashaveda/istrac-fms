import { Router } from 'express'
import { prisma } from '../config/db.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { adminMiddleware } from '../middleware/admin.middleware.js'
import { auditService } from '../services/audit.service.js'
import { AppError } from '../lib/errors.js'

const router = Router()

// ============================================================
// LIST ACTIVE SATELLITES (PUBLIC / MEMBER / ADMIN FOR UI DROPDOWNS)
// ============================================================
router.get('/satellites', authMiddleware, async (req, res, next) => {
  try {
    const satellites = await prisma.satellite.findMany({
      where: { isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    })

    res.json({
      data: satellites,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// ADMIN: LIST ALL SATELLITES WITH STATS
// ============================================================
router.get('/admin/satellites', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const satellites = await prisma.satellite.findMany({
      where: { deletedAt: null },
      include: {
        _count: {
          select: {
            departments: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({
      data: satellites.map((s: any) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        description: s.description,
        isActive: s.isActive,
        departmentCount: s._count.departments,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// ADMIN: CREATE SATELLITE
// ============================================================
router.post('/admin/satellites', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { name, code, description } = req.body

    if (!name) {
      throw new AppError('missing_name', 'Satellite name is required', 400)
    }

    if (code) {
      const existing = await prisma.satellite.findFirst({
        where: { code, deletedAt: null },
      })
      if (existing) {
        throw new AppError('satellite_code_exists', 'Satellite with this code already exists', 409)
      }
    }

    const satellite = await prisma.satellite.create({
      data: {
        name,
        code: code || null,
        description: description || null,
      },
    })

    auditService.log({
      userId: req.user!.id,
      action: 'POST:/admin/satellites',
      resourceType: 'satellite',
      resourceId: satellite.id,
    })

    res.status(201).json({
      data: satellite,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// ADMIN: GET SINGLE SATELLITE WITH DEPARTMENTS
// ============================================================
router.get('/admin/satellites/:satelliteId', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.satelliteId
    const satelliteId = Array.isArray(rawId) ? rawId[0] : rawId

    const satellite = await prisma.satellite.findUnique({
      where: { id: satelliteId, deletedAt: null },
      include: {
        departments: {
          where: { deletedAt: null },
          include: {
            _count: { select: { files: { where: { deletedAt: null } } } },
          },
        },
      },
    })

    if (!satellite) {
      throw new AppError('satellite_not_found', 'Satellite station not found', 404)
    }

    res.json({
      data: satellite,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// ADMIN: UPDATE SATELLITE
// ============================================================
router.put('/admin/satellites/:satelliteId', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.satelliteId
    const satelliteId = Array.isArray(rawId) ? rawId[0] : rawId
    const { name, code, description, isActive } = req.body

    const existing = await prisma.satellite.findUnique({
      where: { id: satelliteId, deletedAt: null },
    })

    if (!existing) {
      throw new AppError('satellite_not_found', 'Satellite not found', 404)
    }

    const updated = await prisma.satellite.update({
      where: { id: satelliteId },
      data: {
        name: name !== undefined ? name : undefined,
        code: code !== undefined ? code : undefined,
        description: description !== undefined ? description : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    })

    auditService.log({
      userId: req.user!.id,
      action: 'PUT:/admin/satellites',
      resourceType: 'satellite',
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
// ADMIN: DELETE (SOFT) SATELLITE
// ============================================================
router.delete('/admin/satellites/:satelliteId', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.satelliteId
    const satelliteId = Array.isArray(rawId) ? rawId[0] : rawId

    const activeDepts = await prisma.department.count({
      where: { satelliteId, deletedAt: null },
    })

    if (activeDepts > 0) {
      throw new AppError(
        'satellite_has_departments',
        'Cannot deactivate satellite with active departments. Remove or migrate departments first.',
        400,
      )
    }

    await prisma.satellite.update({
      where: { id: satelliteId },
      data: { deletedAt: new Date(), isActive: false },
    })

    auditService.log({
      userId: req.user!.id,
      action: 'DELETE:/admin/satellites',
      resourceType: 'satellite',
      resourceId: satelliteId,
    })

    res.json({
      data: { message: 'Satellite station deactivated successfully' },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

export { router as satelliteRouter }
