import { Router } from 'express'
import multer from 'multer'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { prisma } from '../config/db.js'
import { pubsub } from '../lib/pubsub.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { adminMiddleware } from '../middleware/admin.middleware.js'
import { auditService } from '../services/audit.service.js'
import { AppError } from '../lib/errors.js'
import {
  isUnsafeSvgContent,
  validateImageMagicBytes,
  sanitizeCmsContent,
} from '../lib/security.js'

import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ── CMS asset storage ────────────────────────────────────────
// Resolves to <project-root>/backend/public/cms-assets/
// The backend serves this folder at /media/* (see index.ts)
export const CMS_PUBLIC_DIR = path.resolve(__dirname, '../../public')
export const CMS_ASSETS_DIR = path.resolve(CMS_PUBLIC_DIR, 'cms-assets')

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await fs.mkdir(CMS_ASSETS_DIR, { recursive: true })
      cb(null, CMS_ASSETS_DIR)
    } catch (err) {
      cb(err as Error, CMS_ASSETS_DIR)
    }
  },
  filename: (_req, file, cb) => {
    // Sanitize and normalize filename
    const rawExt = path.extname(file.originalname).trim().toLowerCase()
    const ext = rawExt === '.jpeg' ? '.jpg' : rawExt
    const rawBase = path.basename(file.originalname, rawExt).trim()
    const cleanBase = rawBase
      .toLowerCase()
      .replace(/\s+/g, '_')            // convert spaces to single underscore
      .replace(/[^a-z0-9_-]/g, '')     // remove non-alphanumeric chars
      .replace(/_+/g, '_')             // collapse consecutive underscores
      .replace(/^_+|_+$/g, '')         // trim leading/trailing underscores
      .slice(0, 50) || 'asset'
    cb(null, `${Date.now()}_${cleanBase}${ext}`)
  },
})

const cmsUpload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB hard ceiling for multer
  fileFilter: (_req, file, cb) => {
    const allowed = /^image\/(jpeg|png|gif|webp|svg\+xml)$/i
    if (allowed.test(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new AppError('invalid_type', 'Only image files are allowed (jpg, png, gif, webp, svg)', 415))
    }
  },
})

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

    const cleanContent = sanitizeCmsContent(content)

    const updated = await prisma.cmsBlock.upsert({
      where: { blockKey },
      update: {
        content: cleanContent as any,
        updatedBy: req.user!.id,
      },
      create: {
        blockKey,
        content: cleanContent as any,
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
        content: cleanContent,
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

// ============================================================
// ADMIN: UPLOAD A CMS ASSET (image) → returns /media/cms-assets/<filename>
// ============================================================
router.post('/cms/upload-asset', authMiddleware, adminMiddleware, (req, res, next) => {
  cmsUpload.single('file')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError('file_too_large', 'Image exceeds maximum allowed upload size', 413))
        }
        return next(new AppError('upload_error', err.message, 400))
      }
      return next(err)
    }

    try {
      if (!req.file) {
        throw new AppError('no_file', 'No file was uploaded', 400)
      }

      // 1. Verify Magic Bytes against claimed extension to prevent MIME confusion / masquerading
      const rawExt = path.extname(req.file.originalname).toLowerCase()
      const fileHandle = await fs.open(req.file.path, 'r')
      const headerBuf = Buffer.alloc(Math.min(req.file.size, 4096))
      await fileHandle.read(headerBuf, 0, headerBuf.length, 0)
      await fileHandle.close()

      if (!validateImageMagicBytes(headerBuf, rawExt)) {
        await fs.unlink(req.file.path).catch(() => {})
        throw new AppError('invalid_image_data', 'File binary signature does not match the specified image format', 415)
      }

      // 2. Scan SVG files for Stored XSS vectors (script tags, event handlers, XXE entities)
      if (rawExt === '.svg' || req.file.mimetype === 'image/svg+xml') {
        const fullContent = await fs.readFile(req.file.path, 'utf8')
        const scan = isUnsafeSvgContent(fullContent)
        if (scan.unsafe) {
          await fs.unlink(req.file.path).catch(() => {})
          auditService.log({
            userId: req.user!.id,
            action: 'SECURITY:BLOCKED_UNSAFE_SVG',
            resourceType: 'cms_asset',
            resourceId: req.file.filename,
          })
          throw new AppError('unsafe_svg_payload', `Security violation: ${scan.reason}`, 400)
        }
      }

      // 3. Enforce dynamic system upload size limit from Settings if configured
      const configRow = await prisma.systemConfig.findUnique({
        where: { configKey: 'maxUploadSizeBytes' },
      })
      const maxBytes = configRow ? Number(JSON.parse(configRow.configValue)) : 524288000
      if (req.file.size > maxBytes) {
        // Delete uploaded oversized file
        await fs.unlink(req.file.path).catch(() => {})
        const limitMb = Math.round(maxBytes / (1024 * 1024))
        throw new AppError(
          'file_too_large',
          `Image (${(req.file.size / (1024 * 1024)).toFixed(1)} MB) exceeds system limit of ${limitMb} MB`,
          413,
        )
      }

      const url = `/media/cms-assets/${req.file.filename}`
      auditService.log({
        userId: req.user!.id,
        action: 'POST:/cms/upload-asset',
        resourceType: 'cms_asset',
        resourceId: req.file.filename,
      })

      res.json({
        data: {
          url,
          filename: req.file.filename,
          size: req.file.size,
        },
      })
    } catch (innerErr) {
      next(innerErr)
    }
  })
})

export { router as cmsRouter }
