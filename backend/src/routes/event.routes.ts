import { Router } from 'express'
import { prisma } from '../config/db.js'
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware.js'
import { adminMiddleware } from '../middleware/admin.middleware.js'
import { auditService } from '../services/audit.service.js'
import { notificationService } from '../services/notification.service.js'
import { AppError } from '../lib/errors.js'

const router = Router()

// ============================================================
// LIST MISSION EVENTS
// ============================================================
router.get('/events', optionalAuthMiddleware, async (req, res, next) => {
  try {
    const { status, type, departmentId, satelliteId, limit } = req.query

    const where: any = {
      deletedAt: null,
      ...(status && { status: String(status) }),
      ...(type && { eventType: String(type) }),
      ...(departmentId && { departmentId: String(departmentId) }),
      ...(satelliteId && { satelliteId: String(satelliteId) }),
    }

    const take = limit ? Math.min(100, Math.max(1, Number(limit))) : 50

    const events = await prisma.missionEvent.findMany({
      where,
      take,
      orderBy: { eventDate: 'asc' },
      include: {
        satellite: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
      },
    })

    res.json({
      data: events,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// DYNAMIC ACTIVE ALERTS & EVENTS BANNER
// ============================================================
router.get('/events/active-banner', optionalAuthMiddleware, async (req, res, next) => {
  try {
    const now = new Date()
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const prev24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // 1. Fetch upcoming / in-progress events
    const activeEvents = await prisma.missionEvent.findMany({
      where: {
        deletedAt: null,
        showOnBanner: true,
        eventDate: { gte: prev24h, lte: next24h },
      },
      take: 5,
      orderBy: { eventDate: 'asc' },
      include: {
        satellite: { select: { name: true, code: true } },
        department: { select: { name: true, code: true } },
      },
    })

    // 2. Fetch latest broadcast notifications across all priority types
    const recentBroadcasts = await prisma.notification.findMany({
      where: {
        type: { in: ['BROADCAST', 'CRITICAL', 'SYSTEM', 'MAINTENANCE', 'NOTICE', 'PASS', 'EVENT', 'FILE_UPLOAD', 'TELEMETRY'] },
        deletedAt: null,
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
      distinct: ['message'],
      select: {
        id: true,
        message: true,
        type: true,
        category: true,
        createdAt: true,
        metadata: true,
      },
    })

    // Filter broadcasts so that:
    // - Events are visible to all users
    // - Targeted broadcasts are only visible to Admins and the target department audience
    let allowedBroadcasts = recentBroadcasts
    const user = req.user

    if (!user || user.role !== 'ADMIN') {
      let userDeptIds: string[] = []
      if (user) {
        const userDepts = await prisma.userDepartmentAccess.findMany({
          where: { userId: user.id, deletedAt: null },
          select: { departmentId: true },
        })
        userDeptIds = userDepts.map((d: any) => d.departmentId)
      }

      allowedBroadcasts = recentBroadcasts.filter((b) => {
        // Events are visible to all users
        if (
          b.category === 'event' ||
          b.type === 'EVENT' ||
          b.type === 'PASS' ||
          (typeof b.message === 'string' && b.message.toLowerCase().includes('mission event'))
        ) {
          return true
        }

        if (!b.metadata) return true

        let meta: any = b.metadata
        if (typeof meta === 'string') {
          try {
            meta = JSON.parse(meta)
          } catch {
            return true
          }
        }

        if (meta.target === 'departments' && Array.isArray(meta.departmentIds)) {
          return userDeptIds.some((dId) => meta.departmentIds.includes(dId))
        }

        if (meta.target === 'all_departments') {
          return userDeptIds.length > 0
        }

        return true
      })
    }

    res.json({
      data: {
        events: activeEvents,
        broadcasts: allowedBroadcasts.slice(0, 6).map((b) => ({
          id: b.id.toString(),
          message: b.message,
          createdAt: b.createdAt,
          metadata: b.metadata,
        })),
      },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// CREATE MISSION EVENT (ADMIN)
// ============================================================
router.post('/events', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const {
      title,
      description,
      eventType,
      satelliteId,
      departmentId,
      eventDate,
      endDate,
      location,
      urgency,
      status,
      showOnBanner,
    } = req.body

    if (!title || !eventDate) {
      throw new AppError('missing_required', 'Event title and eventDate are required', 400)
    }

    const event = await prisma.missionEvent.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        eventType: eventType || 'MISSION_PASS',
        satelliteId: satelliteId || null,
        departmentId: departmentId || null,
        eventDate: new Date(eventDate),
        endDate: endDate ? new Date(endDate) : null,
        location: location?.trim() || 'ISTRAC MOX BLR',
        urgency: urgency || 'NORMAL',
        status: status || 'UPCOMING',
        showOnBanner: showOnBanner ?? true,
        createdById: req.user!.id,
      },
      include: {
        satellite: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
      },
    })

    auditService.log({
      userId: req.user!.id,
      action: 'EVENT:CREATE',
      resourceType: 'mission_event',
      resourceId: event.id,
      newValue: event as unknown as Record<string, unknown>,
    })

    // Broadcast live event notification across all connected operators and banners
    notificationService.sendBroadcast({
      type: 'PASS',
      category: 'event',
      actorId: req.user!.id,
      message: `New Mission Event: ${event.title} (${event.location})`,
      resourceType: 'mission_event',
      resourceId: event.id,
    }).catch(() => {})

    res.status(201).json({
      data: event,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// UPDATE MISSION EVENT (ADMIN)
// ============================================================
router.put('/events/:id', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.id
    const id = Array.isArray(rawId) ? rawId[0] : rawId

    const existing = await prisma.missionEvent.findUnique({
      where: { id, deletedAt: null },
    })

    if (!existing) {
      throw new AppError('event_not_found', 'Mission event not found', 404)
    }

    const {
      title,
      description,
      eventType,
      satelliteId,
      departmentId,
      eventDate,
      endDate,
      location,
      urgency,
      status,
      showOnBanner,
    } = req.body

    const updated = await prisma.missionEvent.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(eventType !== undefined && { eventType }),
        ...(satelliteId !== undefined && { satelliteId: satelliteId || null }),
        ...(departmentId !== undefined && { departmentId: departmentId || null }),
        ...(eventDate !== undefined && { eventDate: new Date(eventDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(location !== undefined && { location: location?.trim() || null }),
        ...(urgency !== undefined && { urgency }),
        ...(status !== undefined && { status }),
        ...(showOnBanner !== undefined && { showOnBanner }),
      },
      include: {
        satellite: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
      },
    })

    auditService.log({
      userId: req.user!.id,
      action: 'EVENT:UPDATE',
      resourceType: 'mission_event',
      resourceId: updated.id,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: updated as unknown as Record<string, unknown>,
    })

    // Broadcast event update to all logged-in operators and live banners
    notificationService.sendBroadcast({
      type: 'EVENT',
      category: 'event',
      actorId: req.user!.id,
      message: `Mission Event Updated: ${updated.title} (${updated.location || 'ISTRAC MOX'})`,
      resourceType: 'mission_event',
      resourceId: updated.id,
    }).catch(() => {})

    res.json({
      data: updated,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// CANCEL MISSION EVENT (ADMIN ONLY)
// ============================================================
router.patch('/events/:id/cancel', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.id
    const id = Array.isArray(rawId) ? rawId[0] : rawId

    const existing = await prisma.missionEvent.findUnique({
      where: { id, deletedAt: null },
      include: {
        satellite: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
      },
    })

    if (!existing) {
      throw new AppError('event_not_found', 'Mission event not found', 404)
    }

    if (existing.status === 'CANCELLED') {
      return res.json({
        data: existing,
        requestId: req.requestId,
      })
    }

    const updated = await prisma.missionEvent.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
      include: {
        satellite: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
      },
    })

    auditService.log({
      userId: req.user!.id,
      action: 'EVENT:CANCEL',
      resourceType: 'mission_event',
      resourceId: updated.id,
      oldValue: { status: existing.status, title: existing.title },
      newValue: { status: 'CANCELLED', title: updated.title },
    })

    notificationService.sendBroadcast({
      type: 'CRITICAL',
      category: 'event',
      actorId: req.user!.id,
      message: `Mission Event Cancelled: ${updated.title} (${updated.location || 'ISTRAC'})`,
      resourceType: 'mission_event',
      resourceId: updated.id,
    }).catch(() => {})

    res.json({
      data: updated,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// DELETE MISSION EVENT (ADMIN)
// ============================================================
router.delete('/events/:id', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.id
    const id = Array.isArray(rawId) ? rawId[0] : rawId

    const existing = await prisma.missionEvent.findUnique({
      where: { id, deletedAt: null },
    })

    if (!existing) {
      throw new AppError('event_not_found', 'Mission event not found', 404)
    }

    await prisma.missionEvent.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    auditService.log({
      userId: req.user!.id,
      action: 'EVENT:DELETE',
      resourceType: 'mission_event',
      resourceId: id,
    })

    // Broadcast event deletion to all logged-in operators
    notificationService.sendBroadcast({
      type: 'CRITICAL',
      category: 'event',
      actorId: req.user!.id,
      message: `Mission Event Purged: ${existing.title}`,
      resourceType: 'mission_event',
      resourceId: id,
    }).catch(() => {})

    res.json({
      data: { id, deleted: true },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// DYNAMIC EVENT CONFIGURATION: LOCATIONS & CATEGORIES
// ============================================================

const DEFAULT_LOCATIONS = [
  'ISTRAC MOX Bengaluru',
  'IDSN Byalalu (32m)',
  'IDSN Byalalu (18m)',
  'TTC Ground Station Port Blair',
  'TTC Ground Station Mauritius',
  'TTC Ground Station Sriharikota (SHAR)',
  'IS4OM NETRA Control Centre',
]

const DEFAULT_CATEGORIES = [
  { id: 'MISSION_PASS', label: 'Spacecraft Tracking Pass' },
  { id: 'LAUNCH', label: 'Rocket Launch Window' },
  { id: 'ORBIT_MANEUVER', label: 'Orbit Correction Maneuver' },
  { id: 'MAINTENANCE', label: 'Ground Station / RAID Maintenance' },
  { id: 'SEMINAR', label: 'Operational Review / Seminar' },
  { id: 'ANOMALY', label: 'Spacecraft Anomaly Investigation' },
]

async function getStoredEventConfig() {
  const [locationsRow, categoriesRow] = await Promise.all([
    prisma.systemConfig.findUnique({ where: { configKey: 'event_locations' } }),
    prisma.systemConfig.findUnique({ where: { configKey: 'event_categories' } }),
  ])

  let locations: string[] = [...DEFAULT_LOCATIONS]
  if (locationsRow?.configValue) {
    try {
      const parsed = JSON.parse(locationsRow.configValue)
      if (Array.isArray(parsed) && parsed.length > 0) locations = parsed
    } catch {}
  }

  let categories: Array<{ id: string; label: string }> = [...DEFAULT_CATEGORIES]
  if (categoriesRow?.configValue) {
    try {
      const parsed = JSON.parse(categoriesRow.configValue)
      if (Array.isArray(parsed) && parsed.length > 0) categories = parsed
    } catch {}
  }

  return { locations, categories }
}

router.get('/events/config', optionalAuthMiddleware, async (req, res, next) => {
  try {
    const config = await getStoredEventConfig()
    res.json({
      data: config,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

router.post('/events/config/locations', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { location } = req.body
    if (!location || typeof location !== 'string' || !location.trim()) {
      throw new AppError('invalid_location', 'Location name is required', 400)
    }

    const trimmed = location.trim()
    const config = await getStoredEventConfig()

    if (!config.locations.includes(trimmed)) {
      config.locations.push(trimmed)
      await prisma.systemConfig.upsert({
        where: { configKey: 'event_locations' },
        update: {
          configValue: JSON.stringify(config.locations),
          updatedBy: req.user!.id,
        },
        create: {
          configKey: 'event_locations',
          configValue: JSON.stringify(config.locations),
          updatedBy: req.user!.id,
        },
      })
    }

    res.status(201).json({
      data: config.locations,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

router.delete('/events/config/locations/:location', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawLoc = req.params.location
    const locToDelete = decodeURIComponent(Array.isArray(rawLoc) ? rawLoc[0] : rawLoc).trim()

    const config = await getStoredEventConfig()
    config.locations = config.locations.filter((l) => l.toLowerCase() !== locToDelete.toLowerCase())

    await prisma.systemConfig.upsert({
      where: { configKey: 'event_locations' },
      update: {
        configValue: JSON.stringify(config.locations),
        updatedBy: req.user!.id,
      },
      create: {
        configKey: 'event_locations',
        configValue: JSON.stringify(config.locations),
        updatedBy: req.user!.id,
      },
    })

    res.json({
      data: config.locations,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

router.post('/events/config/categories', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { id, label } = req.body
    if (!label || typeof label !== 'string' || !label.trim()) {
      throw new AppError('invalid_category', 'Category label is required', 400)
    }

    const trimmedLabel = label.trim()
    const catId = (id && typeof id === 'string' && id.trim())
      ? id.trim().toUpperCase().replace(/\s+/g, '_')
      : trimmedLabel.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').slice(0, 30)

    const config = await getStoredEventConfig()
    const existingIndex = config.categories.findIndex((c) => c.id === catId)

    if (existingIndex >= 0) {
      config.categories[existingIndex].label = trimmedLabel
    } else {
      config.categories.push({ id: catId, label: trimmedLabel })
    }

    await prisma.systemConfig.upsert({
      where: { configKey: 'event_categories' },
      update: {
        configValue: JSON.stringify(config.categories),
        updatedBy: req.user!.id,
      },
      create: {
        configKey: 'event_categories',
        configValue: JSON.stringify(config.categories),
        updatedBy: req.user!.id,
      },
    })

    res.status(201).json({
      data: config.categories,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

router.delete('/events/config/categories/:categoryId', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.categoryId
    const catIdToDelete = decodeURIComponent(Array.isArray(rawId) ? rawId[0] : rawId).trim()

    const config = await getStoredEventConfig()
    config.categories = config.categories.filter((c) => c.id !== catIdToDelete)

    await prisma.systemConfig.upsert({
      where: { configKey: 'event_categories' },
      update: {
        configValue: JSON.stringify(config.categories),
        updatedBy: req.user!.id,
      },
      create: {
        configKey: 'event_categories',
        configValue: JSON.stringify(config.categories),
        updatedBy: req.user!.id,
      },
    })

    res.json({
      data: config.categories,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

export { router as eventRouter }
