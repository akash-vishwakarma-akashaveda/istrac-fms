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
      where: {
        isActive: true,
        deletedAt: null,
        status: { notIn: ['DECOMMISSIONED', 'INACTIVE'] },
      },
      include: {
        departmentSatellites: {
          include: {
            department: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        departments: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    const data = satellites.map((s) => {
      const linkedDeptIds = Array.from(
        new Set([
          ...s.departmentSatellites.map((ds) => ds.department.id),
          ...s.departments.map((d) => d.id),
        ])
      )
      return {
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
        departmentIds: linkedDeptIds,
        departments: s.departmentSatellites.map((ds) => ds.department),
        createdAt: s.createdAt,
      }
    })

    res.json({
      data,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// OPERATIONAL: GET DETAILED SATELLITE INFO VIEW (REQUIRES AUTH)
// ============================================================
router.get('/satellites/:satelliteId', authMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.satelliteId
    const satelliteId = Array.isArray(rawId) ? rawId[0] : rawId

    const whereClause: any = {
      OR: [{ id: satelliteId }, { satId: satelliteId }, { code: satelliteId }],
    }
    if (req.user?.role !== 'ADMIN') {
      whereClause.deletedAt = null
    }

    const satellite = await prisma.satellite.findFirst({
      where: whereClause,
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
        departments: {
          select: {
            id: true,
            name: true,
            code: true,
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

    const linkedDeptIds = Array.from(
      new Set([
        ...satellite.departmentSatellites.map((ds) => ds.department.id),
        ...satellite.departments.map((d) => d.id),
      ])
    )

    // Role-based authorization: Admin can see all satellites; members can only see satellites of departments they have READ_ONLY or READ_WRITE access to
    if (req.user?.role !== 'ADMIN') {
      const userAccess = await prisma.userDepartmentAccess.findMany({
        where: {
          userId: req.user!.id,
          deletedAt: null,
          accessLevel: { in: ['READ_ONLY', 'READ_WRITE'] },
        },
        select: { departmentId: true },
      })
      const userDeptIds = new Set(userAccess.map((a) => a.departmentId))

      const hasAccess = linkedDeptIds.some((deptId) => userDeptIds.has(deptId))

      if (!hasAccess) {
        throw new AppError('forbidden', 'You are not authorized to see', 403)
      }
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
        isActive: Boolean(satellite.isActive && !satellite.deletedAt),
        deletedAt: satellite.deletedAt,
        departmentIds: linkedDeptIds,
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
        isActive: Boolean(s.isActive && !s.deletedAt),
        deletedAt: s.deletedAt,
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

// ============================================================
// ADMIN: RESTORE / REACTIVATE SATELLITE
// ============================================================
router.post('/admin/satellites/:satelliteId/restore', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.satelliteId
    const satelliteId = Array.isArray(rawId) ? rawId[0] : rawId

    const restored = await prisma.satellite.update({
      where: { id: satelliteId },
      data: { deletedAt: null, isActive: true, status: 'OPERATIONAL' },
    })

    auditService.log({
      userId: req.user!.id,
      action: 'POST:/admin/satellites/:id/restore',
      resourceType: 'satellite',
      resourceId: satelliteId,
    })

    res.json({
      data: restored,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// HELPER: BUILD CONDITIONS FOR FILES ASSOCIATED WITH A SATELLITE
// ============================================================
export function buildSatelliteFileConditions(satellite: {
  id: string
  name: string
  code?: string | null
  satId?: string | null
}) {
  const conditions: any[] = [
    { department: { satelliteId: satellite.id } },
  ]

  const terms = new Set<string>()

  const addTerm = (val?: string | null) => {
    if (!val) return
    const clean = val.trim()
    // Avoid short (<3 chars) or purely numeric terms from matching random file names/paths in production
    if (clean.length < 3 || /^\d+$/.test(clean)) return
    terms.add(clean)

    // Variant with underscores instead of hyphens
    if (clean.includes('-')) {
      const u = clean.replace(/-/g, '_')
      if (u.length >= 3) terms.add(u)
      const n = clean.replace(/-/g, '')
      if (n.length >= 3 && !/^\d+$/.test(n)) terms.add(n)
    }
    // Variant with hyphens instead of underscores
    if (clean.includes('_')) {
      const h = clean.replace(/_/g, '-')
      if (h.length >= 3) terms.add(h)
      const n = clean.replace(/_/g, '')
      if (n.length >= 3 && !/^\d+$/.test(n)) terms.add(n)
    }
  }

  addTerm(satellite.name)
  addTerm(satellite.code)

  // Satellite satId can still match report spacecraft / mission if provided
  if (satellite.satId && satellite.satId.trim().length >= 2) {
    const sId = satellite.satId.trim()
    conditions.push(
      { report: { spacecraft: { equals: sId } } },
      { report: { mission: { equals: sId } } }
    )
  }

  // Also check mission keyword from code if applicable, avoiding generic prefixes
  if (satellite.code) {
    const parts = satellite.code.split(/[-_\s]+/)
    const prefix = parts[0]?.trim()
    if (
      prefix &&
      prefix.length >= 4 &&
      !['ISRO', 'INSP', 'TEST', 'SATS', 'DEMO', 'USER', 'FILE', 'MISSION'].includes(prefix.toUpperCase())
    ) {
      terms.add(prefix)
    }
  }

  for (const term of terms) {
    if (term.length >= 3) {
      conditions.push(
        { report: { spacecraft: { contains: term } } },
        { report: { mission: { contains: term } } },
        { name: { contains: term } },
        { hddPath: { contains: term } }
      )
    }
  }

  return conditions
}

// ============================================================
// ADMIN: CHECK RELATED FILES BEFORE HARD DELETION
// ============================================================
router.get('/admin/satellites/:satelliteId/related-files', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.satelliteId
    const satelliteId = Array.isArray(rawId) ? rawId[0] : rawId

    const satellite = await prisma.satellite.findUnique({
      where: { id: satelliteId },
      select: { id: true, name: true, code: true, satId: true },
    })

    if (!satellite) {
      throw new AppError('satellite_not_found', 'Satellite not found', 404)
    }

    const conditions = buildSatelliteFileConditions(satellite)
    const fileWhere = {
      deletedAt: null,
      OR: conditions,
    }

    const [count, sampleFiles] = await Promise.all([
      prisma.file.count({ where: fileWhere }),
      prisma.file.findMany({
        where: fileWhere,
        take: 5,
        select: {
          id: true,
          name: true,
          hddPath: true,
          sizeBytes: true,
          createdAt: true,
          department: { select: { id: true, name: true, code: true } },
          report: { select: { id: true, title: true, spacecraft: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    res.json({
      data: {
        satelliteId: satellite.id,
        satelliteName: satellite.name,
        count,
        canDelete: count === 0,
        sampleFiles: sampleFiles.map((f) => ({
          id: f.id,
          name: f.name,
          departmentName: f.department?.name,
          departmentCode: f.department?.code,
          reportTitle: f.report?.title,
          createdAt: f.createdAt,
        })),
      },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// ADMIN: PERMANENT (HARD) DELETE SATELLITE
// Stops if active files are associated; requires admin to delete files manually first
// ============================================================
router.delete('/admin/satellites/:satelliteId/hard-delete', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.satelliteId
    const satelliteId = Array.isArray(rawId) ? rawId[0] : rawId

    const satellite = await prisma.satellite.findUnique({
      where: { id: satelliteId },
    })

    if (!satellite) {
      throw new AppError('satellite_not_found', 'Satellite not found', 404)
    }

    const conditions = buildSatelliteFileConditions(satellite)
    const fileWhere = {
      deletedAt: null,
      OR: conditions,
    }

    const count = await prisma.file.count({ where: fileWhere })

    if (count > 0) {
      const sample = await prisma.file.findMany({
        where: fileWhere,
        take: 3,
        select: { name: true },
      })
      const fileNames = sample.map((f) => `"${f.name}"`).join(', ')
      const extraMsg = count > 3 ? ` and ${count - 3} other(s)` : ''
      throw new AppError(
        'satellite_has_files',
        `Cannot permanently delete satellite "${satellite.name}". There are ${count} file(s) associated with this satellite (${fileNames}${extraMsg}). Please delete all related files manually first.`,
        400,
        { fileCount: count }
      )
    }

    // Zero files associated - execute hard deletion in transaction
    try {
      await prisma.$transaction(
        async (tx) => {
          // Disconnect any foreign key references
          await tx.department.updateMany({
            where: { satelliteId: satellite.id },
            data: { satelliteId: null },
          })
          await tx.missionEvent.updateMany({
            where: { satelliteId: satellite.id },
            data: { satelliteId: null },
          })
          // Remove many-to-many junction rows
          await tx.departmentSatellite.deleteMany({
            where: { satelliteId: satellite.id },
          })
          // Hard delete the satellite record permanently
          await tx.satellite.delete({
            where: { id: satellite.id },
          })
        },
        {
          maxWait: 10000,
          timeout: 25000,
        }
      )
    } catch (dbErr: any) {
      if (dbErr?.code === 'P2003') {
        throw new AppError(
          'satellite_foreign_key_violation',
          `Cannot permanently delete satellite "${satellite.name}" because database foreign key constraints are still referencing it (e.g. unmigrated database columns or related records). Please run "npx prisma migrate deploy" on production to ensure schema constraints are up to date.`,
          409
        )
      }
      if (dbErr?.code === 'P2028') {
        throw new AppError(
          'transaction_timeout',
          `The deletion transaction timed out due to high database load. Please retry.`,
          504
        )
      }
      throw dbErr
    }

    auditService.log({
      userId: req.user!.id,
      action: 'DELETE_PERMANENT:/admin/satellites',
      resourceType: 'satellite',
      resourceId: satellite.id,
      oldValue: {
        name: satellite.name,
        code: satellite.code,
        satId: satellite.satId,
      },
    })

    res.json({
      data: {
        message: `Satellite "${satellite.name}" has been permanently deleted from the database.`,
      },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

export { router as satelliteRouter }


