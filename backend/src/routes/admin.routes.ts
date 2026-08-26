import { Router } from 'express'
import { prisma } from '../config/db.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { adminMiddleware } from '../middleware/admin.middleware.js'
import { auditService } from '../services/audit.service.js'
import { hddService } from '../services/hdd.service.js'
import { driveDetectorService } from '../services/driveDetector.service.js'
import { bootstrapService } from '../services/bootstrap.service.js'
import { AppError } from '../lib/errors.js'

const router = Router()

// ============================================================
// ADMIN STATS OVERVIEW
// ============================================================
router.get('/admin/stats', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const [
      usersCount,
      filesCount,
      deptsCount,
      satellitesCount,
      pendingUsersCount,
      storageAgg,
      recentFiles,
      recentLogs,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.file.count({ where: { nodeType: 'FILE', deletedAt: null } }),
      prisma.department.count({ where: { deletedAt: null } }),
      prisma.satellite.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { status: 'PENDING', deletedAt: null } }),
      prisma.file.aggregate({
        _sum: { sizeBytes: true },
        where: { nodeType: 'FILE', deletedAt: null },
      }),
      prisma.file.findMany({
        where: { nodeType: 'FILE', deletedAt: null },
        take: 5,
        orderBy: { updatedAt: 'desc' },
        include: {
          department: { select: { id: true, name: true, code: true } },
          report: { select: { id: true, title: true, spacecraft: true, category: true } },
        },
      }),
      prisma.auditLog.findMany({
        take: 6,
        orderBy: { id: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
    ])

    const storageUsedBytes = Number(storageAgg._sum.sizeBytes || 0n)

    res.json({
      data: {
        users: usersCount,
        files: filesCount,
        departments: deptsCount,
        satellites: satellitesCount,
        pendingUsers: pendingUsersCount,
        storageUsedBytes,
        recentFiles: recentFiles.map((f: any) => ({
          id: f.id,
          name: f.name,
          extension: (f.extension || 'DAT').toUpperCase(),
          sizeBytes: f.sizeBytes ? f.sizeBytes.toString() : '0',
          sha256: f.sha256,
          department: f.department,
          report: f.report,
          updatedAt: f.updatedAt,
        })),
        recentLogs: recentLogs.map((l: any) => ({
          id: Number(l.id),
          userName: l.user?.name || 'System Authority',
          action: l.action,
          resourceType: l.resourceType,
          resourceId: l.resourceId,
          createdAt: l.createdAt,
        })),
      },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// ADMIN AUDIT LOGS (CURSOR PAGINATION)
// ============================================================
router.get('/admin/audit-logs', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 30))
    const cursor = req.query.cursor ? BigInt(req.query.cursor as string) : undefined
    const action = req.query.action as string | undefined
    const userId = req.query.userId as string | undefined
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined

    const where: any = {
      ...(action && { action: { contains: action } }),
      ...(userId && { userId }),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom && { gte: dateFrom }),
              ...(dateTo && { lte: dateTo }),
            },
          }
        : {}),
    }

    const logs = await prisma.auditLog.findMany({
      where,
      take: pageSize + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { id: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
      },
    })

    let nextCursor: string | null = null
    if (logs.length > pageSize) {
      const nextItem = logs.pop()!
      nextCursor = nextItem.id.toString()
    }

    res.json({
      data: logs.map((l: any) => ({
        id: Number(l.id),
        userId: l.userId,
        userName: l.user?.name || 'System',
        action: l.action,
        resourceType: l.resourceType,
        resourceId: l.resourceId,
        oldValue: l.oldValue ? (typeof l.oldValue === 'string' ? JSON.parse(l.oldValue as string) : l.oldValue) : null,
        newValue: l.newValue ? (typeof l.newValue === 'string' ? JSON.parse(l.newValue as string) : l.newValue) : null,
        ipAddress: l.ipAddress,
        createdAt: l.createdAt.toISOString(),
      })),
      nextCursor,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// SYSTEM CONFIGURATION (SETTINGS)
// ============================================================
router.get('/admin/settings', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const configs = await prisma.systemConfig.findMany({
      where: { deletedAt: null },
    })

    // Default configuration blueprint
    const defaults: Record<string, any> = {
      maxUploadSizeBytes: 524288000, // 500MB
      allowedExtensions: ['pdf', 'docx', 'xlsx', 'pptx', 'csv', 'txt', 'png', 'jpg', 'zip'],
      virusScanEnabled: false,
      guestAccessExpiryDays: 7,
      hddSyncIntervalMinutes: 15,
      downloadRateLimitPerHour: 100,
    }

    configs.forEach((c: any) => {
      try {
        defaults[c.configKey] = JSON.parse(c.configValue)
      } catch {
        defaults[c.configKey] = c.configValue
      }
    })

    res.json({
      data: defaults,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// UPDATE SYSTEM CONFIGURATION KEY
// ============================================================
router.put('/admin/settings/:key', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawKey = req.params.key
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey
    const { value } = req.body

    if (value === undefined) {
      throw new AppError('missing_value', 'Config value is required', 400)
    }

    const serializedValue = typeof value === 'string' ? value : JSON.stringify(value)

    const updated = await prisma.systemConfig.upsert({
      where: { configKey: key },
      update: {
        configValue: serializedValue,
        updatedBy: req.user!.id,
      },
      create: {
        configKey: key,
        configValue: serializedValue,
        updatedBy: req.user!.id,
      },
    })

    auditService.log({
      userId: req.user!.id,
      action: `PUT:/admin/settings/${key}`,
      resourceType: 'system_config',
      resourceId: key,
      newValue: { key, value },
    })

    res.json({
      data: {
        key: updated.configKey,
        value,
        updatedAt: updated.updatedAt,
      },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// STORAGE MOUNT STATUS (HDD / SSD / RAID)
// ============================================================
router.get('/admin/storage/status', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const status = await hddService.getMountStatus()
    res.json({
      data: status,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// INITIALIZE PHYSICAL STORAGE MOUNT
// ============================================================
router.post('/admin/storage/initialize-mount', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { customPath } = req.body
    const result = await hddService.initializeMount(customPath)

    if (customPath) {
      await prisma.systemConfig.upsert({
        where: { configKey: 'STORAGE_MOUNT_PATH' },
        update: { configValue: result.path, updatedBy: req.user!.id },
        create: { configKey: 'STORAGE_MOUNT_PATH', configValue: result.path, updatedBy: req.user!.id },
      })
    }

    auditService.log({
      userId: req.user!.id,
      action: 'STORAGE:INITIALIZE_MOUNT',
      resourceType: 'system_storage',
      resourceId: result.path,
      newValue: result,
    })

    res.json({
      data: result,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// SCAN ALL HOST VOLUMES & PHYSICAL STORAGE DRIVES
// ============================================================
router.get('/admin/storage/drives', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const drives = await driveDetectorService.getAvailableDrives()
    res.json({
      data: drives,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// STORAGE REDUNDANCY & FAILOVER SETTINGS
// ============================================================
router.get('/admin/storage/redundancy', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const config = await driveDetectorService.getStorageConfig()
    res.json({
      data: config,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

router.put('/admin/storage/redundancy', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const updated = await driveDetectorService.updateStorageConfig(req.user!.id, req.body)

    auditService.log({
      userId: req.user!.id,
      action: 'STORAGE:UPDATE_REDUNDANCY_SETTINGS',
      resourceType: 'system_storage',
      resourceId: 'storage_redundancy',
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
// STORAGE MIGRATION & DRIVE SWITCHING (WITH AUTOMATIC COPY)
// ============================================================
router.post('/admin/storage/migrate', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { newPrimaryPath, oldPrimaryPath, newSecondaryPath, copyFiles } = req.body

    if (!newPrimaryPath) {
      throw new AppError('missing_path', 'New primary storage mount path is required', 400)
    }

    const result = await driveDetectorService.migrateStorage(req.user!.id, {
      newPrimaryPath,
      oldPrimaryPath,
      newSecondaryPath,
      copyFiles: !!copyFiles,
    })

    auditService.log({
      userId: req.user!.id,
      action: 'STORAGE:MIGRATE_PRIMARY_DRIVE',
      resourceType: 'system_storage',
      resourceId: newPrimaryPath,
      newValue: result as unknown as Record<string, unknown>,
    })

    res.json({
      data: result,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// GROUND STATION INITIALIZATION STATE & BOOTSTRAP
// ============================================================
router.get('/admin/setup/initialization-state', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const state = await bootstrapService.getInitializationState()
    res.json({
      data: state,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

router.post('/admin/setup/bootstrap-defaults', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { customStoragePath } = req.body
    const result = await bootstrapService.bootstrapDefaults(customStoragePath)

    auditService.log({
      userId: req.user!.id,
      action: 'STATION:BOOTSTRAP_DEFAULTS',
      resourceType: 'ground_station',
      resourceId: 'fleet_and_storage',
      newValue: result,
    })

    res.json({
      data: result,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

export { router as adminRouter }
