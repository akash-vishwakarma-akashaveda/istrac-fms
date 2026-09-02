import { Router } from 'express'
import { prisma } from '../config/db.js'
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware.js'
import { adminMiddleware } from '../middleware/admin.middleware.js'
import { auditService } from '../services/audit.service.js'
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

    // 2. Fetch latest broadcast notifications
    const recentBroadcasts = await prisma.notification.findMany({
      where: {
        type: 'BROADCAST',
        deletedAt: null,
        createdAt: { gte: prev24h },
      },
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        message: true,
        createdAt: true,
        metadata: true,
      },
    })

    res.json({
      data: {
        events: activeEvents,
        broadcasts: recentBroadcasts.map((b) => ({
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

    res.json({
      data: { id, deleted: true },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})


export { router as eventRouter }
