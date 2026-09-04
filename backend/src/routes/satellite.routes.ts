import { Router } from 'express'
import { prisma } from '../config/db.js'
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware.js'
import { adminMiddleware } from '../middleware/admin.middleware.js'
import { auditService } from '../services/audit.service.js'
import { AppError } from '../lib/errors.js'

const router = Router()

// ============================================================
// LIST ACTIVE SATELLITES (PUBLIC / MEMBER / ADMIN FOR UI DROPDOWNS & CARDS)
// ============================================================
router.get('/satellites', optionalAuthMiddleware, async (req, res, next) => {
  try {
    const satellites = await prisma.satellite.findMany({
      where: { isActive: true, deletedAt: null },
      include: {
        departmentSatellites: {
          include: {
            department: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const data = satellites.map((s) => ({
      id: s.id,
      satId: s.satId,
      name: s.name,
      code: s.code,
      description: s.description,
      launchDate: s.launchDate,
      payloads: s.payloads,
      fuelBalance: s.fuelBalance,
      launchMass: s.launchMass,
      orbitType: s.orbitType,
      status: s.status,
      isActive: s.isActive,
      departments: s.departmentSatellites.map((ds) => ds.department),
      createdAt: s.createdAt,
    }))

    res.json({
      data,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// PUBLIC / OPERATIONAL: GET DETAILED SATELLITE INFO VIEW (ITEM 29)
// ============================================================
router.get('/satellites/:satelliteId', optionalAuthMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.satelliteId
    const satelliteId = Array.isArray(rawId) ? rawId[0] : rawId

    const satellite = await prisma.satellite.findFirst({
      where: {
        OR: [{ id: satelliteId }, { satId: satelliteId }, { code: satelliteId }],
        deletedAt: null,
      },
      include: {
        departmentSatellites: {
          include: {
            department: {
              select: {
                id: true,
                name: true,
                code: true,
                pageTitle: true,
                pageLeadOfficer: true,
                pageLeadRole: true,
                pageContact: true,
              },
            },
          },
        },
        events: {
          where: { deletedAt: null },
          orderBy: { eventDate: 'desc' },
          take: 6,
        },
      },
    })

    if (!satellite) {
      throw new AppError('satellite_not_found', 'Satellite program not found', 404)
    }

    res.json({
      data: {
        id: satellite.id,
        satId: satellite.satId,
        name: satellite.name,
        code: satellite.code,
        description: satellite.description,
        launchDate: satellite.launchDate,
        payloads: satellite.payloads,
        fuelBalance: satellite.fuelBalance,
        launchMass: satellite.launchMass,
        orbitType: satellite.orbitType,
        status: satellite.status,
        isActive: satellite.isActive,
        departments: satellite.departmentSatellites.map((ds) => ds.department),
        recentEvents: satellite.events,
        createdAt: satellite.createdAt,
        updatedAt: satellite.updatedAt,
      },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// ADMIN: LIST ALL SATELLITES WITH STATS & LINKED DEPARTMENTS
// ============================================================
router.get('/admin/satellites', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const satellites = await prisma.satellite.findMany({
      where: { deletedAt: null },
      include: {
        departmentSatellites: {
          include: {
            department: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({
      data: satellites.map((s) => ({
        id: s.id,
        satId: s.satId,
        name: s.name,
        code: s.code,
        description: s.description,
        launchDate: s.launchDate,
        payloads: s.payloads,
        fuelBalance: s.fuelBalance,
        launchMass: s.launchMass,
        orbitType: s.orbitType,
        status: s.status,
        isActive: s.isActive,
        departments: s.departmentSatellites.map((ds) => ds.department),
        departmentCount: s.departmentSatellites.length,
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
// ADMIN: CREATE SATELLITE (ITEM 27 & 28)
// ============================================================
router.post('/admin/satellites', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const {
      satId,
      name,
      code,
      description,
      launchDate,
      payloads,
      fuelBalance,
      launchMass,
      orbitType,
      status,
      departmentIds,
    } = req.body

    if (!name) {
      throw new AppError('missing_name', 'Satellite name is required', 400)
    }

    if (code) {
      const existingCode = await prisma.satellite.findFirst({
        where: { code, deletedAt: null },
      })
      if (existingCode) {
        throw new AppError('satellite_code_exists', 'Satellite with this code already exists', 409)
      }
    }

    if (satId) {
      const existingSatId = await prisma.satellite.findFirst({
        where: { satId, deletedAt: null },
      })
      if (existingSatId) {
        throw new AppError('sat_id_exists', 'Satellite with this SAT_ID already exists', 409)
      }
    }

    const satellite = await prisma.satellite.create({
      data: {
        satId: satId || null,
        name: name.trim(),
        code: code ? code.trim().toUpperCase() : null,
        description: description || null,
        launchDate: launchDate ? new Date(launchDate) : null,
        payloads: payloads || null,
        fuelBalance: fuelBalance || null,
        launchMass: launchMass || null,
        orbitType: orbitType || null,
        status: status || 'ACTIVE',
        isActive: true,
      },
    })

    // Assign departments via junction table (Item 27)
    if (departmentIds && Array.isArray(departmentIds) && departmentIds.length > 0) {
      const validDepts = await prisma.department.findMany({
        where: { id: { in: departmentIds }, deletedAt: null },
        select: { id: true },
      })

      if (validDepts.length > 0) {
        await prisma.departmentSatellite.createMany({
          data: validDepts.map((d) => ({
            satelliteId: satellite.id,
            departmentId: d.id,
          })),
          skipDuplicates: true,
        })
      }
    }

    auditService.log({
      userId: req.user!.id,
      action: 'POST:/admin/satellites',
      resourceType: 'satellite',
      resourceId: satellite.id,
    })

    const fullSatellite = await prisma.satellite.findUnique({
      where: { id: satellite.id },
      include: {
        departmentSatellites: {
          include: { department: { select: { id: true, name: true, code: true } } },
        },
      },
    })

    res.status(201).json({
      data: {
        ...fullSatellite,
        departments: fullSatellite?.departmentSatellites.map((ds) => ds.department) || [],
      },
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
        departmentSatellites: {
          include: {
            department: {
              include: {
                _count: { select: { files: { where: { deletedAt: null } } } },
              },
            },
          },
        },
      },
    })

    if (!satellite) {
      throw new AppError('satellite_not_found', 'Satellite program not found', 404)
    }

    res.json({
      data: {
        ...satellite,
        departments: satellite.departmentSatellites.map((ds) => ds.department),
      },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// ADMIN: UPDATE SATELLITE (ITEM 27 & 28)
// ============================================================
router.put('/admin/satellites/:satelliteId', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.satelliteId
    const satelliteId = Array.isArray(rawId) ? rawId[0] : rawId
    const {
      satId,
      name,
      code,
      description,
      launchDate,
      payloads,
      fuelBalance,
      launchMass,
      orbitType,
      status,
      isActive,
      departmentIds,
    } = req.body

    const existing = await prisma.satellite.findUnique({
      where: { id: satelliteId, deletedAt: null },
    })

    if (!existing) {
      throw new AppError('satellite_not_found', 'Satellite not found', 404)
    }

    if (code && code !== existing.code) {
      const duplicateCode = await prisma.satellite.findFirst({
        where: { code, deletedAt: null, id: { not: satelliteId } },
      })
      if (duplicateCode) {
        throw new AppError('satellite_code_exists', 'Satellite with this code already exists', 409)
      }
    }

    if (satId && satId !== existing.satId) {
      const duplicateSatId = await prisma.satellite.findFirst({
        where: { satId, deletedAt: null, id: { not: satelliteId } },
      })
      if (duplicateSatId) {
        throw new AppError('sat_id_exists', 'Satellite with this SAT_ID already exists', 409)
      }
    }

    const updated = await prisma.satellite.update({
      where: { id: satelliteId },
      data: {
        satId: satId !== undefined ? (satId ? String(satId).trim() : null) : undefined,
        name: name !== undefined ? String(name).trim() : undefined,
        code: code !== undefined ? (code ? String(code).trim().toUpperCase() : null) : undefined,
        description: description !== undefined ? description : undefined,
        launchDate: launchDate !== undefined ? (launchDate ? new Date(launchDate) : null) : undefined,
        payloads: payloads !== undefined ? payloads : undefined,
        fuelBalance: fuelBalance !== undefined ? fuelBalance : undefined,
        launchMass: launchMass !== undefined ? launchMass : undefined,
        orbitType: orbitType !== undefined ? orbitType : undefined,
        status: status !== undefined ? status : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    })

    // Sync department assignments if provided (Item 27)
    if (departmentIds !== undefined && Array.isArray(departmentIds)) {
      await prisma.departmentSatellite.deleteMany({
        where: { satelliteId },
      })

      if (departmentIds.length > 0) {
        const validDepts = await prisma.department.findMany({
          where: { id: { in: departmentIds }, deletedAt: null },
          select: { id: true },
        })

        if (validDepts.length > 0) {
          await prisma.departmentSatellite.createMany({
            data: validDepts.map((d) => ({
              satelliteId,
              departmentId: d.id,
            })),
            skipDuplicates: true,
          })
        }
      }
    }

    auditService.log({
      userId: req.user!.id,
      action: 'PUT:/admin/satellites',
      resourceType: 'satellite',
      resourceId: updated.id,
    })

    const fullSatellite = await prisma.satellite.findUnique({
      where: { id: updated.id },
      include: {
        departmentSatellites: {
          include: { department: { select: { id: true, name: true, code: true } } },
        },
      },
    })

    res.json({
      data: {
        ...fullSatellite,
        departments: fullSatellite?.departmentSatellites.map((ds) => ds.department) || [],
      },
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
      data: { message: 'Satellite program deactivated successfully' },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

export { router as satelliteRouter }

