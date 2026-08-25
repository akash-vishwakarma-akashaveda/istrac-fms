import { prisma } from '../config/db.js'
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
  send(opts: SendNotificationOpts): void {
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

    prisma.notification
      .createMany({ data })
      .then(() => {
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
            })
            .catch((err: unknown) => console.error(`[NotificationService] PubSub failed for ${userId}:`, err))
        })
      })
      .catch((err: unknown) => console.error('[NotificationService] Batch insert failed:', err))
  },

  async sendBroadcast(opts: Omit<SendNotificationOpts, 'recipientIds'>): Promise<void> {
    try {
      const activeUsers = await prisma.user.findMany({
        where: { status: 'ACTIVE', deletedAt: null },
        select: { id: true },
      })

      const recipientIds = activeUsers.map((u: any) => u.id)
      this.send({ ...opts, recipientIds })

      // Global broadcast event for connected sockets
      pubsub
        .publish('notification.broadcast', {
          type: opts.type,
          category: opts.category,
          message: opts.message,
          timestamp: new Date().toISOString(),
        })
        .catch((err: unknown) => console.error('[NotificationService] Broadcast pubsub error:', err))
    } catch (err) {
      console.error('[NotificationService] sendBroadcast failed:', err)
    }
  },
}
