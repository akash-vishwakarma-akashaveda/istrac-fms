import { Router } from 'express'
import { prisma } from '../config/db.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { adminMiddleware } from '../middleware/admin.middleware.js'
import { notificationService } from '../services/notification.service.js'
import { AppError } from '../lib/errors.js'

const router = Router()

// ============================================================
// PUBLIC: LIST RECENT SYSTEM BROADCAST NOTIFICATIONS
// ============================================================
router.get('/notifications/public', async (_req, res, next) => {
  try {
    const broadcasts = await prisma.notification.findMany({
      where: {
        type: { in: ['BROADCAST', 'SYSTEM', 'MAINTENANCE', 'PASS'] },
        deletedAt: null,
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
      distinct: ['message'],
    })

    res.json({
      data: broadcasts.map((n: any) => ({
        id: n.id.toString(),
        type: n.type,
        category: n.category,
        message: n.message,
        createdAt: n.createdAt,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// LIST USER NOTIFICATIONS
// ============================================================
router.get('/notifications', authMiddleware, async (req, res, next) => {
  try {
    const unreadOnly = req.query.unread === 'true'
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
    const skip = (page - 1) * limit

    const where: any = {
      userId: req.user!.id,
      deletedAt: null,
      ...(unreadOnly && { readAt: null }),
    }

    const [total, notifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ])

    res.json({
      data: notifications.map((n: any) => ({
        id: n.id.toString(),
        type: n.type,
        category: n.category,
        message: n.message,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
      total,
      page,
      limit,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// GET UNREAD NOTIFICATION COUNT
// ============================================================
router.get('/notifications/count', authMiddleware, async (req, res, next) => {
  try {
    const unread = await prisma.notification.count({
      where: {
        userId: req.user!.id,
        readAt: null,
        deletedAt: null,
      },
    })

    res.json({
      data: { unread },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// MARK SINGLE NOTIFICATION AS READ
// ============================================================
router.put('/notifications/:notifId/read', authMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.notifId
    const notifIdStr = Array.isArray(rawId) ? rawId[0] : rawId
    const id = BigInt(notifIdStr)

    await prisma.notification.updateMany({
      where: { id, userId: req.user!.id },
      data: { readAt: new Date() },
    })

    res.json({
      data: { message: 'Notification marked as read' },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// MARK ALL NOTIFICATIONS AS READ
// ============================================================
router.put('/notifications/read-all', authMiddleware, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    })

    res.json({
      data: { message: 'All notifications marked as read' },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// DISMISS / DELETE NOTIFICATION
// ============================================================
router.delete('/notifications/:notifId', authMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.notifId
    const notifIdStr = Array.isArray(rawId) ? rawId[0] : rawId
    const id = BigInt(notifIdStr)

    await prisma.notification.updateMany({
      where: { id, userId: req.user!.id },
      data: { deletedAt: new Date(), dismissedAt: new Date() },
    })

    res.json({
      data: { message: 'Notification dismissed' },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// ADMIN: BROADCAST NOTIFICATION TO ALL USERS
// ============================================================
router.post('/admin/notifications/broadcast', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { message, type = 'BROADCAST', category = 'system' } = req.body

    if (!message) {
      throw new AppError('missing_message', 'Broadcast message is required', 400)
    }

    await notificationService.sendBroadcast({
      type,
      category,
      message,
      actorId: req.user!.id,
    })

    res.status(201).json({
      data: { message: 'Broadcast notification transmitted to all stations and members' },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

export { router as notificationRouter }
