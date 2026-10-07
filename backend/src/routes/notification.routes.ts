import { Router } from 'express'
import { prisma } from '../config/db.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { adminMiddleware } from '../middleware/admin.middleware.js'
import { notificationService } from '../services/notification.service.js'
import { pubsub } from '../lib/pubsub.js'
import { broadcastRateLimiter } from '../middleware/rateLimiter.middleware.js'
import { AppError } from '../lib/errors.js'
import { auditService } from '../services/audit.service.js'
import { BROADCAST_CATEGORY, BROADCAST_WHERE, broadcastLabel, notificationKind } from '../lib/notificationKind.js'

const router = Router()

// ============================================================
// PUBLIC: LIST RECENT SYSTEM BROADCAST NOTIFICATIONS
// ============================================================
router.get('/notifications/public', async (_req, res, next) => {
  try {
    const broadcasts = await prisma.notification.findMany({
      where: {
        type: { in: ['BROADCAST', 'SYSTEM', 'MAINTENANCE', 'PASS', 'EVENT', 'CRITICAL', 'NOTICE', 'FILE_UPLOAD', 'TELEMETRY'] },
        deletedAt: null,
      },
      take: 40,
      orderBy: { createdAt: 'desc' },
      distinct: ['message'],
    })

    // Filter out targeted department broadcasts from public guest view
    const publicItems = broadcasts.filter((n: any) => {
      if (!n.metadata) return true
      try {
        const meta = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata
        if (meta.target === 'departments' || meta.target === 'all_departments') {
          return false
        }
      } catch {}
      return true
    }).slice(0, 20)

    res.json({
      data: publicItems.map((n: any) => ({
        id: n.id.toString(),
        type: n.type,
        category: n.category,
        kind: notificationKind(n),
        label: broadcastLabel(n),
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
        kind: notificationKind(n),
        label: broadcastLabel(n),
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
// ADMIN: LIST BROADCAST NOTIFICATION HISTORY
// ============================================================
router.get('/admin/notifications/broadcasts', authMiddleware, adminMiddleware, async (_req, res, next) => {
  try {
    // Only admin-composed broadcasts; event and file notifications have their own feeds.
    const broadcasts = await prisma.notification.findMany({
      where: {
        ...BROADCAST_WHERE,
        deletedAt: null,
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
      distinct: ['message'],
    })

    const senderIds = Array.from(new Set(broadcasts.map((b: any) => b.actorId).filter(Boolean)))
    const users = await prisma.user.findMany({
      where: { id: { in: senderIds as string[] } },
      select: { id: true, name: true, email: true, role: true },
    })
    const userMap = new Map(users.map((u: any) => [u.id, u]))

    res.json({
      data: broadcasts.map((b: any) => ({
        id: b.id.toString(),
        type: b.type,
        category: b.category,
        message: b.message,
        label: broadcastLabel(b),
        actorId: b.actorId,
        senderName: b.actorId ? (userMap.get(b.actorId)?.name || 'Command Authority') : 'System Broadcaster',
        createdAt: b.createdAt,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// ADMIN: BROADCAST NOTIFICATION TO ALL USERS
// ============================================================
router.post('/admin/notifications/broadcast', authMiddleware, adminMiddleware, broadcastRateLimiter, async (req, res, next) => {
  try {
    const { message, type = 'BROADCAST', departmentIds, target = 'all', label: rawLabel } = req.body
    const category = BROADCAST_CATEGORY
    const label = typeof rawLabel === 'string' && rawLabel.trim() ? rawLabel.trim().slice(0, 60) : null

    if (!message || !String(message).trim()) {
      throw new AppError('missing_message', 'Write a message before sending the broadcast.', 400)
    }
    if (target === 'departments' && (!Array.isArray(departmentIds) || departmentIds.length === 0)) {
      throw new AppError('missing_departments', 'Select at least one department to send this broadcast to.', 400)
    }

    // Fetch all active admins to ensure all admins receive broadcast notifications
    const allAdmins = await prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    })
    const adminIds = allAdmins.map((a: any) => a.id)

    if (target === 'departments' && Array.isArray(departmentIds) && departmentIds.length > 0) {
      const usersInDepts = await prisma.userDepartmentAccess.findMany({
        where: { departmentId: { in: departmentIds }, deletedAt: null },
        select: { userId: true },
      })
      const recipientIds = Array.from(new Set([
        ...usersInDepts.map((u: any) => u.userId),
        ...adminIds,
        req.user!.id,
      ]))

      await notificationService.send({
        type,
        category,
        message,
        actorId: req.user!.id,
        recipientIds,
        metadata: { target: 'departments', departmentIds, label },
      })

      pubsub
        .publish('notification.broadcast', {
          type,
          category,
          message,
          target: 'departments',
          departmentIds,
          timestamp: new Date().toISOString(),
        })
        .catch(() => {})
    } else if (target === 'all_departments') {
      const allDeptUsers = await prisma.userDepartmentAccess.findMany({
        where: { deletedAt: null },
        select: { userId: true },
      })
      const recipientIds = Array.from(new Set([
        ...allDeptUsers.map((u: any) => u.userId),
        ...adminIds,
        req.user!.id,
      ]))

      await notificationService.send({
        type,
        category,
        message,
        actorId: req.user!.id,
        recipientIds,
        metadata: { target: 'all_departments', label },
      })

      pubsub
        .publish('notification.broadcast', {
          type,
          category,
          message,
          target: 'all_departments',
          timestamp: new Date().toISOString(),
        })
        .catch(() => {})
    } else {
      await notificationService.sendBroadcast({
        type,
        category,
        message,
        actorId: req.user!.id,
        metadata: { target: 'all', label },
      })
    }

    res.status(201).json({
      data: { message: 'Broadcast notification transmitted to all stations and members' },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// ADMIN: REVOKE A BROADCAST (BUG-13)
// A broadcast is stored as one row per recipient, so revoking removes every row of the
// same transmission: same sender + message + type, created within a few seconds.
// ============================================================
router.delete('/admin/notifications/broadcasts/:notifId', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.notifId
    const idStr = Array.isArray(rawId) ? rawId[0] : rawId
    if (!/^\d+$/.test(idStr)) {
      throw new AppError('invalid_id', 'This broadcast reference is not valid.', 400)
    }

    const source = await prisma.notification.findFirst({
      where: { id: BigInt(idStr), ...BROADCAST_WHERE },
    })
    if (!source) {
      throw new AppError('broadcast_not_found', 'This broadcast no longer exists. It may already have been revoked.', 404)
    }
    if (source.deletedAt) {
      throw new AppError('already_revoked', 'This broadcast has already been revoked.', 409)
    }

    const windowMs = 10_000
    const revoked = await prisma.notification.updateMany({
      where: {
        deletedAt: null,
        message: source.message,
        type: source.type,
        actorId: source.actorId,
        ...BROADCAST_WHERE,
        createdAt: {
          gte: new Date(source.createdAt.getTime() - windowMs),
          lte: new Date(source.createdAt.getTime() + windowMs),
        },
      },
      data: { deletedAt: new Date() },
    })

    auditService.log({
      userId: req.user!.id,
      action: 'NOTIFICATION:REVOKE_BROADCAST',
      resourceType: 'notification',
      resourceId: idStr,
      oldValue: { message: source.message.slice(0, 200), sentAt: source.createdAt.toISOString() },
      newValue: { recipientsAffected: revoked.count },
    })

    pubsub
      .publish('notification.broadcast', { type: 'REVOKED', message: source.message, timestamp: new Date().toISOString() })
      .catch(() => {})

    res.json({
      data: { message: `Broadcast revoked. It was removed for ${revoked.count} recipient(s).`, recipientsAffected: revoked.count },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// BROADCAST CATEGORIES (BUG-12)
// Stored like the mission-event categories: a JSON list in SystemConfig.
// ============================================================
const BROADCAST_CATEGORIES_KEY = 'broadcast_categories'
const DEFAULT_BROADCAST_CATEGORIES = [
  { id: 'GENERAL', label: 'General' },
  { id: 'OPERATIONS', label: 'Operations' },
  { id: 'MAINTENANCE', label: 'Maintenance' },
]

async function getBroadcastCategories(): Promise<Array<{ id: string; label: string }>> {
  const row = await prisma.systemConfig.findUnique({ where: { configKey: BROADCAST_CATEGORIES_KEY } })
  if (!row?.configValue) return DEFAULT_BROADCAST_CATEGORIES
  try {
    const parsed = JSON.parse(row.configValue)
    return Array.isArray(parsed) ? parsed : DEFAULT_BROADCAST_CATEGORIES
  } catch {
    return DEFAULT_BROADCAST_CATEGORIES
  }
}

async function saveBroadcastCategories(list: Array<{ id: string; label: string }>, userId: string) {
  await prisma.systemConfig.upsert({
    where: { configKey: BROADCAST_CATEGORIES_KEY },
    update: { configValue: JSON.stringify(list), updatedBy: userId },
    create: { configKey: BROADCAST_CATEGORIES_KEY, configValue: JSON.stringify(list), updatedBy: userId },
  })
}

router.get('/notifications/broadcast-categories', authMiddleware, async (req, res, next) => {
  try {
    res.json({ data: await getBroadcastCategories(), requestId: req.requestId })
  } catch (err) {
    next(err)
  }
})

router.post('/admin/notifications/broadcast-categories', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const label = typeof req.body?.label === 'string' ? req.body.label.trim() : ''
    if (!label) throw new AppError('invalid_category', 'Enter a name for the category.', 400)
    if (label.length > 40) throw new AppError('invalid_category', 'Category names can be at most 40 characters.', 400)

    const id = label.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 30)
    if (!id) throw new AppError('invalid_category', 'Category names must contain letters or numbers.', 400)

    const list = await getBroadcastCategories()
    if (list.some((c) => c.id === id || c.label.toLowerCase() === label.toLowerCase())) {
      throw new AppError('category_exists', `A category named "${label}" already exists.`, 409)
    }
    list.push({ id, label })
    await saveBroadcastCategories(list, req.user!.id)
    res.status(201).json({ data: list, requestId: req.requestId })
  } catch (err) {
    next(err)
  }
})

router.delete('/admin/notifications/broadcast-categories/:categoryId', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.categoryId
    const id = Array.isArray(rawId) ? rawId[0] : rawId
    const list = await getBroadcastCategories()
    const target = list.find((c) => c.id === id)
    if (!target) throw new AppError('category_not_found', 'This category no longer exists.', 404)
    if (id === 'GENERAL') throw new AppError('cannot_delete_default', 'The General category is built in and cannot be deleted.', 400)

    const next_ = list.filter((c) => c.id !== id)
    await saveBroadcastCategories(next_, req.user!.id)
    // Past broadcasts keep their label text, so history stays readable.
    res.json({ data: next_, requestId: req.requestId })
  } catch (err) {
    next(err)
  }
})

export { router as notificationRouter }
