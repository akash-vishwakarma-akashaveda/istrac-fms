import { Router } from 'express'
import { prisma } from '../config/db.js'
import { pubsub } from '../lib/pubsub.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { adminMiddleware } from '../middleware/admin.middleware.js'
import { auditService } from '../services/audit.service.js'
import { AppError } from '../lib/errors.js'

const router = Router()

// ============================================================
// PUBLIC: GET ALL CMS BLOCKS (FOR LANDING / PORTAL)
// ============================================================
router.get('/cms/blocks', async (_req, res, next) => {
  try {
    const blocks = await prisma.cmsBlock.findMany({
      where: { deletedAt: null },
    })

    const blockMap: Record<string, unknown> = {}
    blocks.forEach((b: any) => {
      blockMap[b.blockKey] = typeof b.content === 'string' ? JSON.parse(b.content) : b.content
    })

    res.json({
      data: blockMap,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// PUBLIC: GET SINGLE CMS BLOCK BY KEY
// ============================================================
router.get('/cms/blocks/:blockKey', async (req, res, next) => {
  try {
    const rawKey = req.params.blockKey
    const blockKey = Array.isArray(rawKey) ? rawKey[0] : rawKey

    const block = await prisma.cmsBlock.findUnique({
      where: { blockKey },
    })

    if (!block || block.deletedAt) {
      throw new AppError('block_not_found', 'CMS block not found', 404)
    }

    res.json({
      data: typeof block.content === 'string' ? JSON.parse(block.content) : block.content,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// ADMIN: UPSERT CMS BLOCK
// ============================================================
router.put('/cms/blocks/:blockKey', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { content } = req.body
    const rawKey = req.params.blockKey
    const blockKey = Array.isArray(rawKey) ? rawKey[0] : rawKey

    if (!content) {
      throw new AppError('missing_content', 'Block content is required', 400)
    }

    const updated = await prisma.cmsBlock.upsert({
      where: { blockKey },
      update: {
        content: content as any,
        updatedBy: req.user!.id,
      },
      create: {
        blockKey,
        content: content as any,
        updatedBy: req.user!.id,
      },
    })

    auditService.log({
      userId: req.user!.id,
      action: 'PUT:/cms/blocks/:key',
      resourceType: 'cms_block',
      resourceId: blockKey,
    })

    pubsub
      .publish('cms.update', {
        blockKey,
        content,
        updatedBy: req.user!.name,
        timestamp: new Date().toISOString(),
      })
      .catch(() => {})

    res.json({
      data: updated,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

export { router as cmsRouter }
