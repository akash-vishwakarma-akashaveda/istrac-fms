import { prisma } from '../config/db.js'
import { logger } from '../lib/logger.js'
import { pubsub } from '../lib/pubsub.js'

export interface SendNotificationOpts {
  type: string
  category: string
  actorId?: string
  recipientIds: string[]
  resourceType?: string
  resourceId?: string
  message: string
  metadata?: Record<string, unknown>
}

export const notificationService = {
  async send(opts: SendNotificationOpts): Promise<void> {
    if (!opts.recipientIds || opts.recipientIds.length === 0) return

    // 1. Insert notifications into DB
    const data = opts.recipientIds.map((userId) => ({
      userId,
      type: opts.type,
      category: opts.category,
      actorId: opts.actorId ?? null,
      resourceType: opts.resourceType ?? null,
      resourceId: opts.resourceId ?? null,
      message: opts.message,
      metadata: opts.metadata ? JSON.stringify(opts.metadata) : undefined,
    }))

    try {
      await prisma.notification.createMany({ data })

      // 2. Publish to Redis channels for WebSocket push
      opts.recipientIds.forEach((userId) => {
        pubsub
          .publish(`notification.${userId}`, {
            type: opts.type,
            category: opts.category,
            message: opts.message,
            resourceType: opts.resourceType,
            resourceId: opts.resourceId,
            timestamp: new Date().toISOString(),
            metadata: opts.metadata,
          })
          .catch((err: unknown) => logger.error('[NotificationService] Pubsub error for userId:', userId, err))
      })
    } catch (err: unknown) {
      logger.error('[NotificationService] Batch insert failed:', err)
    }
  },

  async sendBroadcast(opts: Omit<SendNotificationOpts, 'recipientIds'>): Promise<void> {
    try {
      const activeUsers = await prisma.user.findMany({
        where: { status: 'ACTIVE', deletedAt: null },
        select: { id: true },
      })

      const recipientIds = activeUsers.map((u: any) => u.id)
      if (opts.actorId && !recipientIds.includes(opts.actorId)) {
        recipientIds.push(opts.actorId)
      }

      await this.send({ ...opts, recipientIds })

      // Global broadcast event for connected sockets
      pubsub
        .publish('notification.broadcast', {
          type: opts.type,
          category: opts.category,
          message: opts.message,
          timestamp: new Date().toISOString(),
        })
        .catch((err: unknown) => logger.error('[NotificationService] Broadcast pubsub error:', err))
    } catch (err) {
      logger.error('[NotificationService] sendBroadcast failed:', err)
    }
  },

  /**
   * When a user's department access permissions are granted or updated,
   * sync recent active department notifications to the user so they can view them.
   */
  async syncDepartmentNotificationsForUser(userId: string, departmentIds: string[]): Promise<void> {
    if (!departmentIds || departmentIds.length === 0) return

    try {
      // Find existing notification messages for this user to prevent duplicates
      const existing = await prisma.notification.findMany({
        where: { userId, deletedAt: null },
        select: { message: true },
      })
      const userMessageSet = new Set(existing.map((n) => n.message))

      // Find department notifications created within the last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const recentNotifs = await prisma.notification.findMany({
        where: {
          createdAt: { gte: thirtyDaysAgo },
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })

      const toInsert: Array<{
        userId: string
        type: string
        category: string
        actorId: string | null
        resourceType: string | null
        resourceId: string | null
        message: string
        metadata: string | undefined
        createdAt: Date
      }> = []

      for (const n of recentNotifs) {
        if (userMessageSet.has(n.message)) continue

        let meta: any = n.metadata
        if (typeof meta === 'string') {
          try {
            meta = JSON.parse(meta)
          } catch {
            meta = {}
          }
        } else if (!meta) {
          meta = {}
        }

        const notifDeptId = meta.departmentId || (Array.isArray(meta.departmentIds) ? meta.departmentIds[0] : null)
        if (notifDeptId && departmentIds.includes(notifDeptId)) {
          userMessageSet.add(n.message)
          toInsert.push({
            userId,
            type: n.type,
            category: n.category,
            actorId: n.actorId,
            resourceType: n.resourceType,
            resourceId: n.resourceId,
            message: n.message,
            metadata: n.metadata ? (typeof n.metadata === 'string' ? n.metadata : JSON.stringify(n.metadata)) : undefined,
            createdAt: n.createdAt,
          })
        }
      }

      if (toInsert.length > 0) {
        await prisma.notification.createMany({ data: toInsert })
        logger.info(`[NotificationService] Synced ${toInsert.length} department notification(s) for user ${userId}`)
      }
    } catch (err) {
      logger.error('[NotificationService] Failed to sync department notifications for user:', err)
    }
  },
}
