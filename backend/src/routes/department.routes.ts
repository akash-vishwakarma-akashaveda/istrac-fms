import { Router } from 'express'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { prisma } from '../config/db.js'
import { redis } from '../config/redis.js'
import { env } from '../config/env.js'
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware.js'
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
        pageTitle: d.pageTitle,
        pageAbout: d.pageAbout,
        pageLeadOfficer: d.pageLeadOfficer,
        pageLeadRole: d.pageLeadRole,
        pageContact: d.pageContact,
        pageBannerUrl: d.pageBannerUrl,
        isPageEnabled: d.isPageEnabled,
        createdAt: d.createdAt,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// PUBLIC: GET LIVE SYSTEM COUNTS (FOR LANDING & PUBLIC STATS)
// ============================================================
router.get('/public/stats', async (_req, res, next) => {
  try {
    const [satellitesCount, deptsCount, filesCount, passesCount] = await Promise.all([
      prisma.satellite.count({ where: { deletedAt: null } }),
      prisma.department.count({ where: { deletedAt: null, isActive: true } }),
      prisma.file.count({ where: { deletedAt: null, nodeType: 'FILE' } }),
      prisma.missionEvent.count({ where: { deletedAt: null } }),
    ])

    res.json({
      data: {
        satellitesCount,
        departmentsCount: deptsCount,
        filesCount,
        passesCount,
        stationsCount: 5,
      },
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

    const department = await prisma.department.findFirst({
      where: {
        OR: [{ id: deptId }, { code: deptId }],
        deletedAt: null,
      },
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
        pageTitle: department.pageTitle,
        pageAbout: department.pageAbout,
        pageLeadOfficer: department.pageLeadOfficer,
        pageLeadRole: department.pageLeadRole,
        pageContact: department.pageContact,
        pageBannerUrl: department.pageBannerUrl,
        isPageEnabled: department.isPageEnabled,
        createdAt: department.createdAt,
      },
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// PUBLIC/AUTH: GET FILES FOR SPECIFIC DEPARTMENT
// ============================================================
router.get('/departments/:deptId/files', optionalAuthMiddleware, async (req, res, next) => {
  try {
    const rawDeptId = req.params.deptId
    const deptId = Array.isArray(rawDeptId) ? rawDeptId[0] : rawDeptId
    const search = req.query.search ? String(req.query.search).trim() : ''
    const extension = req.query.extension ? String(req.query.extension).trim().toUpperCase() : ''
    const spacecraft = req.query.spacecraft ? String(req.query.spacecraft).trim() : ''
    const parentId = req.query.parentId !== undefined ? ((req.query.parentId as string) || null) : undefined

    const department = await prisma.department.findFirst({
      where: {
        OR: [{ id: deptId }, { code: deptId }],
        deletedAt: null,
      },
    })

    if (!department) {
      throw new AppError('department_not_found', 'Department not found', 404)
    }

    const isAdmin = req.user?.role === 'ADMIN'

    // If department is deactivated/archived and user is not admin, deny
    if (!department.isActive && !isAdmin) {
      throw new AppError('dept_archived', 'Department is archived', 403)
    }

    // Access check for authenticated non-admin users
    if (req.user && !isAdmin) {
      const access = await prisma.userDepartmentAccess.findFirst({
        where: {
          userId: req.user.id,
          departmentId: department.id,
          deletedAt: null,
        },
      })
      if (!access) {
        throw new AppError('dept_access_denied', 'You do not have access to this department repository', 403)
      }
    }

    const where: any = {
      departmentId: department.id,
      deletedAt: null,
      nodeType: 'FILE',
      ...(parentId !== undefined ? { parentId } : {}),
      ...(extension && extension !== 'ALL' && { extension }),
      // Regular members and guests ONLY see files that have at least one visible published version
      ...(!isAdmin ? {
        versions: {
          some: {
            isVisible: true,
            deletedAt: null,
          },
        },
      } : {}),
    }

    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { name: { contains: search } },
            { description: { contains: search } },
            { extension: { contains: search } },
            { report: { title: { contains: search } } },
            { report: { spacecraft: { contains: search } } },
          ],
        },
      ]
    }

    if (spacecraft && spacecraft !== 'ALL') {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { report: { spacecraft: { contains: spacecraft } } },
            { name: { contains: spacecraft } },
            { hddPath: { contains: spacecraft } },
          ],
        },
      ]
    }

    const files = await prisma.file.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: {
        report: { select: { id: true, title: true, category: true, spacecraft: true, classificationLevel: true } },
        versions: {
          where: {
            deletedAt: null,
            ...(!isAdmin ? { isVisible: true } : {}),
          },
          orderBy: { versionNum: 'desc' },
          take: 1,
          select: { id: true, versionNum: true, sizeBytes: true, sha256: true, createdAt: true, name: true, mimeType: true },
        },
        _count: {
          select: {
            versions: {
              where: {
                deletedAt: null,
                ...(!isAdmin ? { isVisible: true } : {}),
              },
            },
          },
        },
      },
    })

    res.json({
      data: files.map((f: any) => {
        const activeVer = f.versions?.[0]
        const displayName = (!isAdmin && activeVer?.name) ? activeVer.name : f.name
        const displaySize = (!isAdmin && activeVer?.sizeBytes) ? activeVer.sizeBytes.toString() : (f.sizeBytes ? f.sizeBytes.toString() : '0')
        const displaySha256 = (!isAdmin && activeVer?.sha256) ? activeVer.sha256 : (f.sha256 || 'Verified SHA-256')
        const versionCount = !isAdmin ? (f._count?.versions ?? (activeVer ? 1 : 0)) : (f.versionCount || 1)

        return {
          id: f.id,
          name: displayName,
          nodeType: f.nodeType,
          extension: (f.extension || 'DAT').toUpperCase(),
          sizeBytes: displaySize,
          sha256: displaySha256,
          versionCount,
          status: f.status,
          description: f.description,
          hddPath: f.hddPath,
          report: f.report,
          title: f.report?.title || displayName.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
          spacecraft: f.report?.spacecraft || 'General',
          category: f.report?.category || 'DAILY_REPORT',
          isFeatured: Boolean(f.isFeatured),
          latestVersion: activeVer ? {
            id: activeVer.id,
            versionNum: activeVer.versionNum,
            sizeBytes: activeVer.sizeBytes ? activeVer.sizeBytes.toString() : '0',
            sha256: activeVer.sha256,
            createdAt: activeVer.createdAt,
          } : null,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
        }
      }),
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// DEPARTMENT WORKSPACE & SHOWCASE HUB
// ============================================================
router.get('/departments/:deptId/hub', authMiddleware, async (req, res, next) => {
  try {
    const rawDeptId = req.params.deptId
    const deptId = Array.isArray(rawDeptId) ? rawDeptId[0] : rawDeptId
    const search = (req.query.search as string) || ''

    // 1. Fetch Department Details
    const department = await prisma.department.findFirst({
      where: {
        OR: [{ id: deptId }, { code: deptId }],
        deletedAt: null,
      },
      include: {
        satellite: { select: { id: true, name: true, code: true, description: true } },
        _count: { select: { files: { where: { deletedAt: null } } } },
      },
    })

    if (!department) {
      throw new AppError('department_not_found', 'Department not found', 404)
    }

    // 2. Fetch Files with optional search
    const filesWhere: any = {
      departmentId: department.id,
      deletedAt: null,
      status: 'ACTIVE',
      ...(search && {
        OR: [
          { name: { contains: search } },
          { extension: { contains: search } },
        ],
      }),
    }

    const files = await prisma.file.findMany({
      where: filesWhere,
      take: 50,
      orderBy: [{ nodeType: 'asc' }, { updatedAt: 'desc' }],
      include: {
        uploader: { select: { id: true, name: true } },
      },
    })

    // 3. Fetch Reports for this department
    const reports = await prisma.report.findMany({
      where: {
        departmentId: department.id,
        deletedAt: null,
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    })

    // 4. Fetch Mission Events for this department
    const events = await prisma.missionEvent.findMany({
      where: {
        OR: [{ departmentId: department.id }, { satelliteId: department.satelliteId }],
        deletedAt: null,
      },
      take: 10,
      orderBy: { eventDate: 'asc' },
    })

    res.json({
      data: {
        department: {
          id: department.id,
          name: department.name,
          code: department.code,
          description: department.description,
          hddPath: department.hddPath,
          satellite: department.satellite,
          fileCount: department._count.files,
          pageTitle: department.pageTitle || `${department.name} Operational Division`,
          pageAbout: department.pageAbout || department.description || 'ISRO Telemetry, Tracking & Command Operational Hub.',
          pageLeadOfficer: department.pageLeadOfficer || 'Division Mission Controller',
          pageLeadRole: department.pageLeadRole || 'Lead Flight Director',
          pageContact: department.pageContact || `${(department.code || 'ops').toLowerCase()}@istrac.isro.gov.in`,
          isPageEnabled: department.isPageEnabled,
        },
        files: files.map((f: any) => ({
          id: f.id,
          name: f.name,
          nodeType: f.nodeType,
          mimeType: f.mimeType,
          extension: f.extension,
          sizeBytes: f.sizeBytes ? f.sizeBytes.toString() : null,
          versionCount: f.versionCount,
          uploader: f.uploader?.name || 'Mission Control',
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
        })),
        reports: reports.map((r: any) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          category: r.category,
          spacecraft: r.spacecraft,
          status: r.status,
          createdBy: r.createdBy?.name || 'Operator',
          createdAt: r.createdAt,
        })),
        events,
      },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// UPDATE DEPARTMENT LANDING PAGE SETTINGS (ADMIN)
// ============================================================
router.put('/departments/:deptId/page-settings', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawDeptId = req.params.deptId
    const deptId = Array.isArray(rawDeptId) ? rawDeptId[0] : rawDeptId

    const {
      pageTitle,
      pageAbout,
      pageLeadOfficer,
      pageLeadRole,
      pageContact,
      isPageEnabled,
    } = req.body

    const updated = await prisma.department.update({
      where: { id: deptId },
      data: {
        ...(pageTitle !== undefined && { pageTitle: pageTitle?.trim() }),
        ...(pageAbout !== undefined && { pageAbout: pageAbout?.trim() }),
        ...(pageLeadOfficer !== undefined && { pageLeadOfficer: pageLeadOfficer?.trim() }),
        ...(pageLeadRole !== undefined && { pageLeadRole: pageLeadRole?.trim() }),
        ...(pageContact !== undefined && { pageContact: pageContact?.trim() }),
        ...(isPageEnabled !== undefined && { isPageEnabled: Boolean(isPageEnabled) }),
      },
    })

    auditService.log({
      userId: req.user!.id,
      action: 'DEPARTMENT:UPDATE_PAGE_SETTINGS',
      resourceType: 'department_page',
      resourceId: deptId,
      newValue: updated as unknown as Record<string, unknown>,
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

    const storageConfig = await prisma.systemConfig.findFirst({
      where: { configKey: { in: ['STORAGE_PRIMARY_PATH', 'STORAGE_MOUNT_PATH'] } },
    })
    const baseMount = (storageConfig?.configValue || env.HDD_MOUNT_PATH).replace(/[\\/]+$/, '')

    res.json({
      data: departments.map((d: any) => {
        let displayPath = d.hddPath
        if (!displayPath || displayPath.startsWith('/mnt/istrac_storage')) {
          const sub = (d.code || d.name).toLowerCase().replace(/[^a-z0-9_-]/g, '_')
          displayPath = path.join(baseMount, sub)
        }
        return {
          id: d.id,
          name: d.name,
          code: d.code,
          description: d.description,
          hddPath: displayPath,
          isActive: d.isActive,
          archived: !d.isActive,
          allowUserFolderCreation: d.allowUserFolderCreation,
          maxFolderDepth: d.maxFolderDepth,
          satellite: d.satellite,
          fileCount: d._count.files,
          userCount: d._count.userAccess,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        }
      }),
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
      pageTitle,
      pageAbout,
      pageLeadOfficer,
      pageLeadRole,
      pageContact,
      pageBannerUrl,
      isPageEnabled,
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

    const existingName = await prisma.department.findFirst({
      where: { satelliteId, name, deletedAt: null },
    })
    if (existingName) {
      throw new AppError(
        'department_exists',
        'A department with this name already exists in this satellite station',
        409,
      )
    }

    const storageConfig = await prisma.systemConfig.findFirst({
      where: { configKey: { in: ['STORAGE_PRIMARY_PATH', 'STORAGE_MOUNT_PATH'] } },
    })
    const baseMount = (storageConfig?.configValue || env.HDD_MOUNT_PATH).replace(/[\\/]+$/, '')
    const finalHddPath = hddPath && !hddPath.startsWith('/mnt/istrac_storage')
      ? hddPath
      : path.join(baseMount, (code || name).toLowerCase().replace(/[^a-z0-9_-]/g, '_'))

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
        pageTitle: pageTitle || null,
        pageAbout: pageAbout || null,
        pageLeadOfficer: pageLeadOfficer || null,
        pageLeadRole: pageLeadRole || null,
        pageContact: pageContact || null,
        pageBannerUrl: pageBannerUrl || null,
        isPageEnabled: isPageEnabled !== undefined ? Boolean(isPageEnabled) : true,
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
      pageTitle,
      pageAbout,
      pageLeadOfficer,
      pageLeadRole,
      pageContact,
      pageBannerUrl,
      isPageEnabled,
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

    // EDGE CASE: If department is being archived / deactivated, automatically unfeature ALL its files
    if (isDeptActive === false) {
      await prisma.file.updateMany({
        where: { departmentId: deptId, isFeatured: true },
        data: { isFeatured: false },
      })
    }

    const updated = await prisma.department.update({
      where: { id: deptId },
      data: {
        name: name !== undefined ? name : undefined,
        code: code !== undefined ? code : undefined,
        description: description !== undefined ? description : undefined,
        hddPath: hddPath !== undefined ? hddPath : undefined,
        allowUserFolderCreation: allowUserFolderCreation !== undefined ? Boolean(allowUserFolderCreation) : undefined,
        maxFolderDepth: maxFolderDepth !== undefined ? Number(maxFolderDepth) : undefined,
        pageTitle: pageTitle !== undefined ? pageTitle : undefined,
        pageAbout: pageAbout !== undefined ? pageAbout : undefined,
        pageLeadOfficer: pageLeadOfficer !== undefined ? pageLeadOfficer : undefined,
        pageLeadRole: pageLeadRole !== undefined ? pageLeadRole : undefined,
        pageContact: pageContact !== undefined ? pageContact : undefined,
        pageBannerUrl: pageBannerUrl !== undefined ? pageBannerUrl : undefined,
        isPageEnabled: isPageEnabled !== undefined ? Boolean(isPageEnabled) : undefined,
        isActive: isDeptActive,
      },
      include: {
        satellite: true,
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
