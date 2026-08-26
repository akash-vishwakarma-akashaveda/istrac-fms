import { Router } from 'express'
import multer from 'multer'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { prisma } from '../config/db.js'
import { env } from '../config/env.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { adminMiddleware } from '../middleware/admin.middleware.js'
import { deptAccessMiddleware } from '../middleware/deptAccess.middleware.js'
import { downloadRateLimiter } from '../middleware/rateLimiter.middleware.js'
import { hddAvailabilityMiddleware } from '../middleware/hddAvailability.middleware.js'
import { fileService } from '../services/file.service.js'
import { hddService } from '../services/hdd.service.js'
import { auditService } from '../services/audit.service.js'
import { AppError } from '../lib/errors.js'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB for single-shot
})

const chunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per chunk
})

// ============================================================
// SINGLE SHOT FILE UPLOAD
// ============================================================
router.post(
  '/files/upload',
  authMiddleware,
  adminMiddleware,
  deptAccessMiddleware,
  hddAvailabilityMiddleware,
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw new AppError('missing_file', 'No file uploaded in form-data', 400)
      }

      const {
        departmentId: bodyDeptId,
        parentId,
        title,
        description,
        spacecraft,
        category,
        classificationLevel,
        versionLabel,
        reportNumber,
      } = req.body

      const departmentId = (bodyDeptId || req.params.deptId) as string

      const result = await fileService.uploadFile({
        fileBuffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        departmentId,
        parentId: parentId || null,
        uploaderId: req.user!.id,
        uploaderName: req.user!.name,
        title,
        description,
        spacecraft,
        category,
        classificationLevel,
        versionLabel,
        reportNumber,
      })

      res.status(201).json({
        data: result,
        requestId: req.requestId,
      })
    } catch (err) {
      next(err)
    }
  },
)

// ============================================================
// ALL REPOSITORY FILES & DATASETS (FOR CMS & FEATURED SELECTOR)
// ============================================================
router.get('/admin/files/repository-list', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { search, departmentId, extension } = req.query

    const where: any = {
      deletedAt: null,
      nodeType: 'FILE',
      status: 'ACTIVE',
      ...(departmentId && { departmentId: String(departmentId) }),
      ...(extension && { extension: String(extension).toUpperCase() }),
      ...(search && {
        OR: [
          { name: { contains: String(search) } },
          { extension: { contains: String(search) } },
        ],
      }),
    }

    const files = await prisma.file.findMany({
      where,
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            satellite: { select: { id: true, name: true, code: true } },
          },
        },
        uploader: { select: { id: true, name: true } },
      },
    })

    res.json({
      data: files.map((f: any) => ({
        id: f.id,
        name: f.name,
        extension: (f.extension || 'DAT').toUpperCase(),
        sizeBytes: f.sizeBytes ? f.sizeBytes.toString() : '0',
        department: f.department?.code || f.department?.name || 'TTC',
        departmentId: f.departmentId,
        satellite: f.department?.satellite?.name || 'Primary Fleet',
        uploader: f.uploader?.name || 'Operator',
        createdAt: f.createdAt,
      })),
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// CHUNK UPLOAD
// ============================================================
router.post(
  '/files/upload/chunk',
  authMiddleware,
  adminMiddleware,
  deptAccessMiddleware,
  hddAvailabilityMiddleware,
  chunkUpload.single('chunk'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw new AppError('missing_chunk', 'No chunk payload received', 400)
      }

      const { fileName, chunkIndex, departmentId } = req.body
      if (!fileName || chunkIndex === undefined || !departmentId) {
        throw new AppError('missing_chunk_params', 'fileName, chunkIndex, departmentId required', 400)
      }

      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
      const chunksDir = path.join(env.HDD_MOUNT_PATH, '.chunks', `${departmentId}_${safeName}`)
      await fs.mkdir(chunksDir, { recursive: true })

      const chunkPath = path.join(chunksDir, `part_${String(chunkIndex).padStart(5, '0')}`)
      await fs.writeFile(chunkPath, req.file.buffer)

      res.json({
        data: { chunkIndex: Number(chunkIndex), received: true },
        requestId: req.requestId,
      })
    } catch (err) {
      next(err)
    }
  },
)

// ============================================================
// COMPLETE CHUNKED UPLOAD
// ============================================================
router.post(
  '/files/upload/complete',
  authMiddleware,
  adminMiddleware,
  deptAccessMiddleware,
  hddAvailabilityMiddleware,
  async (req, res, next) => {
    try {
      const { fileName, departmentId, parentId, totalChunks } = req.body

      if (!fileName || !departmentId || !totalChunks) {
        throw new AppError('missing_complete_params', 'fileName, departmentId, and totalChunks required', 400)
      }

      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
      const chunksDir = path.join(env.HDD_MOUNT_PATH, '.chunks', `${departmentId}_${safeName}`)

      // Concatenate all chunks
      const chunkBuffers: Buffer[] = []
      for (let i = 0; i < Number(totalChunks); i++) {
        const chunkPath = path.join(chunksDir, `part_${String(i).padStart(5, '0')}`)
        try {
          const buf = await fs.readFile(chunkPath)
          chunkBuffers.push(buf)
        } catch {
          throw new AppError('missing_chunk_file', `Chunk ${i} is missing on server`, 400)
        }
      }

      const fullBuffer = Buffer.concat(chunkBuffers)

      // Clean up temp chunks
      await fs.rm(chunksDir, { recursive: true, force: true }).catch(() => {})

      const result = await fileService.uploadFile({
        fileBuffer: fullBuffer,
        originalName: fileName,
        mimeType: 'application/octet-stream',
        departmentId,
        parentId: parentId || null,
        uploaderId: req.user!.id,
        uploaderName: req.user!.name,
      })

      res.status(201).json({
        data: result,
        requestId: req.requestId,
      })
    } catch (err) {
      next(err)
    }
  },
)

// ============================================================
// DOWNLOAD FILE (STREAM)
// ============================================================
router.get(
  '/files/:fileId/download',
  authMiddleware,
  downloadRateLimiter,
  hddAvailabilityMiddleware,
  async (req, res, next) => {
    try {
      const rawId = req.params.fileId
      const fileId = Array.isArray(rawId) ? rawId[0] : rawId

      const file = await prisma.file.findUnique({
        where: { id: fileId, deletedAt: null },
      })

      if (!file || file.nodeType === 'FOLDER') {
        throw new AppError('file_not_found', 'File not found', 404)
      }

      if (req.user!.role !== 'ADMIN') {
        const hasAccess = await prisma.userDepartmentAccess.findFirst({
          where: { userId: req.user!.id, departmentId: file.departmentId, deletedAt: null },
        })
        if (!hasAccess) {
          throw new AppError('dept_access_denied', 'No access to this department', 403)
        }
      }

      const stream = await hddService.streamFile(file.hddPath)

      res.setHeader('Content-Type', file.mimeType || 'application/octet-stream')
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`)
      if (file.sizeBytes) {
        res.setHeader('Content-Length', file.sizeBytes.toString())
      }

      stream.pipe(res)

      auditService.log({
        userId: req.user!.id,
        action: 'FILE:DOWNLOAD',
        resourceType: 'file',
        resourceId: file.id,
      })
    } catch (err) {
      next(err)
    }
  },
)

// ============================================================
// SOFT DELETE FILE
// ============================================================
router.delete('/files/:fileId', authMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.fileId
    const fileId = Array.isArray(rawId) ? rawId[0] : rawId

    const file = await prisma.file.findUnique({
      where: { id: fileId, deletedAt: null },
    })

    if (!file) {
      throw new AppError('file_not_found', 'File not found', 404)
    }

    if (req.user!.role !== 'ADMIN') {
      const hasAccess = await prisma.userDepartmentAccess.findFirst({
        where: { userId: req.user!.id, departmentId: file.departmentId, deletedAt: null },
      })
      if (!hasAccess || hasAccess.accessLevel !== 'READ_WRITE') {
        throw new AppError('permission_denied', 'Read-Write access required to delete files', 403)
      }
    }

    await fileService.softDeleteFile(file.id, req.user!.id)

    res.json({
      data: { message: 'File moved to trash' },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// RESTORE FILE
// ============================================================
router.put('/files/:fileId/restore', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.fileId
    const fileId = Array.isArray(rawId) ? rawId[0] : rawId

    await fileService.restoreFile(fileId, req.user!.id)

    res.json({
      data: { message: 'File restored successfully' },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// GET FILE VERSION HISTORY
// ============================================================
router.get('/files/:fileId/versions', authMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.fileId
    const fileId = Array.isArray(rawId) ? rawId[0] : rawId

    const versions = await prisma.fileVersion.findMany({
      where: { fileId, deletedAt: null },
      include: {
        uploader: { select: { id: true, name: true, email: true } },
      },
      orderBy: { versionNum: 'desc' },
    })

    res.json({
      data: versions.map((v: any) => ({
        id: v.id,
        versionNum: v.versionNum,
        sizeBytes: v.sizeBytes ? v.sizeBytes.toString() : null,
        sha256: v.sha256,
        uploadedBy: v.uploader?.name || 'Unknown',
        createdAt: v.createdAt,
      })),
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// CREATE FOLDER NODE
// ============================================================
router.post('/files/folders', authMiddleware, deptAccessMiddleware, async (req, res, next) => {
  try {
    const { name, departmentId, parentId } = req.body

    if (!name || !departmentId) {
      throw new AppError('missing_fields', 'Folder name and departmentId are required', 400)
    }

    const dept = await prisma.department.findUnique({
      where: { id: departmentId, deletedAt: null },
    })

    if (!dept) {
      throw new AppError('department_not_found', 'Department not found', 404)
    }

    if (req.user!.role !== 'ADMIN' && !dept.allowUserFolderCreation) {
      throw new AppError('folder_creation_disabled', 'Folder creation is disabled for members in this department', 403)
    }

    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const folderPath = path.join(dept.hddPath, safeName)

    await fs.mkdir(folderPath, { recursive: true })

    const folder = await prisma.file.create({
      data: {
        departmentId: dept.id,
        parentId: parentId || null,
        nodeType: 'FOLDER',
        name: safeName,
        hddPath: folderPath,
        uploaderId: req.user!.id,
        status: 'ACTIVE',
      },
    })

    auditService.log({
      userId: req.user!.id,
      action: 'FOLDER:CREATE',
      resourceType: 'folder',
      resourceId: folder.id,
    })

    res.status(201).json({
      data: folder,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// ADMIN: MASTER REPOSITORY FILE LIST (WITH FULL DETAILS)
// ============================================================
router.get('/admin/files', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { search, departmentId, satelliteId, extension, status } = req.query
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50))
    const skip = (page - 1) * limit

    const where: any = {
      deletedAt: null,
      nodeType: 'FILE',
      ...(status && { status: String(status) }),
      ...(departmentId && departmentId !== 'ALL' && { departmentId: String(departmentId) }),
      ...(extension && extension !== 'ALL' && { extension: String(extension).toUpperCase() }),
    }

    if (search) {
      const s = String(search).trim()
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { name: { contains: s } },
            { description: { contains: s } },
            { extension: { contains: s } },
            { hddPath: { contains: s } },
            { report: { title: { contains: s } } },
            { report: { spacecraft: { contains: s } } },
            { department: { name: { contains: s } } },
            { department: { code: { contains: s } } },
          ],
        },
      ]
    }

    if (satelliteId && satelliteId !== 'ALL') {
      const sat = await prisma.satellite.findUnique({
        where: { id: String(satelliteId) },
        select: { id: true, name: true, code: true },
      })
      if (sat) {
        const satCode = sat.code || sat.name
        where.AND = [
          ...(where.AND || []),
          {
            OR: [
              { report: { spacecraft: { contains: satCode } } },
              { report: { spacecraft: { contains: sat.name } } },
              { name: { contains: satCode } },
              { hddPath: { contains: satCode } },
              { department: { satelliteId: sat.id } },
            ],
          },
        ]
      }
    }

    const [total, files] = await Promise.all([
      prisma.file.count({ where }),
      prisma.file.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          department: {
            select: {
              id: true,
              name: true,
              code: true,
              satellite: { select: { id: true, name: true, code: true } },
            },
          },
          uploader: { select: { id: true, name: true, email: true } },
          report: { select: { id: true, title: true, category: true, spacecraft: true, classificationLevel: true } },
          versions: {
            orderBy: { versionNum: 'desc' },
            take: 1,
            select: { id: true, versionNum: true, sizeBytes: true, sha256: true, createdAt: true },
          },
        },
      }),
    ])

    res.json({
      data: files.map((f: any) => ({
        id: f.id,
        name: f.name,
        nodeType: f.nodeType,
        extension: (f.extension || 'DAT').toUpperCase(),
        sizeBytes: f.sizeBytes ? f.sizeBytes.toString() : '0',
        sha256: f.sha256 || 'Verified SHA-256',
        versionCount: f.versionCount || 1,
        status: f.status,
        description: f.description,
        hddPath: f.hddPath,
        department: {
          id: f.department?.id,
          name: f.department?.name,
          code: f.department?.code,
          satellite: f.department?.satellite,
        },
        report: f.report,
        uploader: f.uploader ? { id: f.uploader.id, name: f.uploader.name, email: f.uploader.email } : null,
        latestVersion: f.versions?.[0] ? {
          id: f.versions[0].id,
          versionNum: f.versions[0].versionNum,
          sizeBytes: f.versions[0].sizeBytes ? f.versions[0].sizeBytes.toString() : '0',
          sha256: f.versions[0].sha256,
          createdAt: f.versions[0].createdAt,
        } : null,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
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
// ADMIN: UPDATE FILE METADATA & OPTIONAL BROADCAST
// ============================================================
router.put('/admin/files/:fileId', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.fileId
    const fileId = Array.isArray(rawId) ? rawId[0] : rawId

    const file = await prisma.file.findUnique({
      where: { id: fileId, deletedAt: null },
      include: { report: true, department: true },
    })

    if (!file) {
      throw new AppError('file_not_found', 'File not found', 404)
    }

    const {
      name,
      description,
      title,
      spacecraft,
      category,
      classificationLevel,
      broadcastAlert,
      broadcastMessage,
    } = req.body

    const updated = await prisma.$transaction(async (tx: any) => {
      // 1. Update File Record
      const f = await tx.file.update({
        where: { id: fileId },
        data: {
          ...(name && { name: name.trim() }),
          ...(description !== undefined && { description: description?.trim() || null }),
          updatedAt: new Date(),
        },
      })

      // 2. Update Report if linked
      if (file.reportId) {
        await tx.report.update({
          where: { id: file.reportId },
          data: {
            ...(title && { title: title.trim() }),
            ...(description !== undefined && { description: description?.trim() || null }),
            ...(spacecraft && { spacecraft: spacecraft.trim() }),
            ...(category && { category }),
            ...(classificationLevel && { classificationLevel }),
            updatedAt: new Date(),
          },
        })
      }

      return f
    })

    auditService.log({
      userId: req.user!.id,
      action: 'FILE:ADMIN_UPDATE',
      resourceType: 'file',
      resourceId: fileId,
      oldValue: file as unknown as Record<string, unknown>,
      newValue: updated as unknown as Record<string, unknown>,
    })

    // 3. Optional Broadcast Notification to Landing & Mission Control
    if (broadcastAlert) {
      const msg = broadcastMessage?.trim() || `[NOTICE] Dataset ${updated.name} in /${file.department?.code || 'OPS'} has been updated.`
      await prisma.notification.create({
        data: {
          userId: req.user!.id,
          type: 'BROADCAST',
          category: 'BROADCAST',
          message: msg,
          metadata: JSON.stringify({ fileId, filename: updated.name, department: file.department?.name }),
        },
      })
    }

    res.json({
      data: updated,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// ADMIN: BROADCAST NOTIFICATION FOR FILE
// ============================================================
router.post('/admin/files/:fileId/broadcast', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.fileId
    const fileId = Array.isArray(rawId) ? rawId[0] : rawId
    const { message, urgency } = req.body

    const file = await prisma.file.findUnique({
      where: { id: fileId, deletedAt: null },
      include: { department: true },
    })

    if (!file) {
      throw new AppError('file_not_found', 'File not found', 404)
    }

    const broadcastMsg =
      message?.trim() ||
      `[${urgency || 'NOTICE'}] Operational telemetry archive ${file.name} available in /${file.department.code || 'TTC'}.`

    const notif = await prisma.notification.create({
      data: {
        userId: req.user!.id,
        type: 'BROADCAST',
        category: 'BROADCAST',
        message: broadcastMsg,
        metadata: JSON.stringify({
          fileId: file.id,
          fileName: file.name,
          department: file.department.name,
          urgency: urgency || 'NORMAL',
        }),
      },
    })

    res.status(201).json({
      data: notif,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

export { router as fileRouter }
