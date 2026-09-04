  import { Router } from 'express'
  import multer from 'multer'
  import * as path from 'node:path'
  import * as os from 'node:os'
  import * as fs from 'node:fs/promises'
  import { createReadStream, createWriteStream } from 'node:fs'
  import { prisma } from '../config/db.js'
  import { env } from '../config/env.js'
  import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware.js'
  import { adminMiddleware } from '../middleware/admin.middleware.js'
  import { deptAccessMiddleware } from '../middleware/deptAccess.middleware.js'
  import { downloadRateLimiter } from '../middleware/rateLimiter.middleware.js'
  import { hddAvailabilityMiddleware } from '../middleware/hddAvailability.middleware.js'
  import { fileService } from '../services/file.service.js'
  import { hddService } from '../services/hdd.service.js'
  import { auditService } from '../services/audit.service.js'
  import { AppError } from '../lib/errors.js'
  import express from 'express'
  const router = Router()
  router.use('/files', express.json({ limit: '50mb' }))


  async function assembleChunks(
  chunksDir: string,
  totalChunks: number,
  outputPath: string,
): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true })

  const output = createWriteStream(outputPath)

  try {
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(
        chunksDir,
        `part_${String(i).padStart(5, '0')}`,
      )

      // Make sure the expected chunk exists
      try {
        await fs.access(chunkPath)
      } catch {
        throw new AppError(
          'missing_chunk_file',
          `Chunk ${i} is missing on server`,
          400,
        )
      }

      await new Promise<void>((resolve, reject) => {
        const input = createReadStream(chunkPath)

        input.on('error', reject)
        input.on('end', resolve)

        input.pipe(output, { end: false })
      })
    }

    await new Promise<void>((resolve, reject) => {
      output.once('error', reject)
      output.once('finish', resolve)
      output.end()
    })
  } catch (error) {
    output.destroy()

    await fs.rm(outputPath, {
      force: true,
    }).catch(() => {})

    throw error
  }
}
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB hardware ceiling; dynamic limit enforced via systemConfig
  })

  const chunkUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB per chunk
  })

  // ============================================================
  // SINGLE SHOT FILE UPLOAD
  // ============================================================
  router.post(
    '/files/upload',
    authMiddleware,
    upload.single('file'),
    deptAccessMiddleware,
    (req, _res, next) => {
      if (req.user?.role !== 'ADMIN' && req.deptAccessLevel !== 'READ_WRITE') {
        throw new AppError('dept_write_denied', 'Write clearance required to upload files to this department', 403)
      }
      next()
    },
    hddAvailabilityMiddleware,
    async (req, res, next) => {
      try {
        if (!req.file) {
          throw new AppError('missing_file', 'No file uploaded in form-data', 400)
        }

        // Validate file size against dynamic systemConfig limit
        const configRow = await prisma.systemConfig.findUnique({
          where: { configKey: 'maxUploadSizeBytes' },
        })
        const maxBytes = configRow
          ? Number(JSON.parse(configRow.configValue))
          : 524288000 // default 500MB
        if (req.file.size > maxBytes) {
          const limitMb = Math.round(maxBytes / (1024 * 1024))
          throw new AppError(
            'file_too_large',
            `Uploaded file (${(req.file.size / (1024 * 1024)).toFixed(1)} MB) exceeds configured system limit of ${limitMb} MB`,
            413,
          )
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
          isFeatured,
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
          isFeatured: isFeatured === 'true' || isFeatured === true,
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
  // PUBLIC FEATURED DATASETS (FOR PUBLIC LANDING PAGE & DEPT PAGES)
  // ============================================================
  router.get('/files/featured-list', async (req, res, next) => {
    try {
      const { departmentId } = req.query
      const where: any = {
        deletedAt: null,
        nodeType: 'FILE',
        status: { in: ['ACTIVE', 'ORPHANED'] },
        department: { isActive: true, deletedAt: null },
      }

      if (departmentId && departmentId !== 'ALL') {
        where.departmentId = String(departmentId)
      }

      // Only query files explicitly marked as featured
      const files = await prisma.file.findMany({
        where: {
          ...where,
          isFeatured: true,
        },
        take: 50,
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
          report: {
            select: {
              id: true,
              title: true,
              spacecraft: true,
              category: true,
              classificationLevel: true,
              description: true,
            },
          },
          uploader: { select: { id: true, name: true } },
        },
      })

      res.json({
        data: files.map((f: any) => ({
          id: f.id,
          name: f.name,
          title: f.report?.title || f.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
          filename: f.name,
          extension: (f.extension || 'DAT').toUpperCase(),
          sizeBytes: f.sizeBytes ? f.sizeBytes.toString() : '0',
          mimeType: f.mimeType || null,
          department: f.department?.code || f.department?.name || 'TTC',
          departmentName: f.department?.name || 'TTC Operations',
          departmentCode: f.department?.code || 'TTC',
          departmentId: f.departmentId,
          satellite: (f.report?.spacecraft && f.report.spacecraft.includes('General') ? 'General' : f.report?.spacecraft) || (f.department?.satellite?.name && f.department.satellite.name.includes('General') ? 'General' : f.department?.satellite?.name) || 'General',
          uploader: f.uploader?.name || 'Flight Operator',
          classification: f.report?.classificationLevel || 'RESTRICTED',
          description: f.description || f.report?.description || `Official telemetry archive and observation report for ${f.department?.name || 'ISRO'}.`,
          isFeatured: true,
          createdAt: f.createdAt,
          date: f.createdAt ? f.createdAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        })),
      })
    } catch (err) {
      next(err)
    }
  })

  // ============================================================
  // TOGGLE / UPDATE FEATURED STATUS OF A FILE (R/W OR ADMIN ONLY)
  // ============================================================
  router.patch('/files/:fileId/feature', authMiddleware, async (req, res, next) => {
    try {
      const rawId = req.params.fileId
      const fileId = Array.isArray(rawId) ? rawId[0] : rawId

      const file = await prisma.file.findUnique({
        where: { id: fileId, deletedAt: null },
        include: { department: true },
      })

      if (!file || file.nodeType === 'FOLDER') {
        throw new AppError('file_not_found', 'File not found', 404)
      }

      // Check permissions: Admin or User with READ_WRITE clearance for this department
      if (req.user!.role !== 'ADMIN') {
        const hasAccess = await prisma.userDepartmentAccess.findFirst({
          where: {
            userId: req.user!.id,
            departmentId: file.departmentId,
            deletedAt: null,
            accessLevel: 'READ_WRITE',
            department: { isActive: true, deletedAt: null },
          },
        })
        if (!hasAccess) {
          throw new AppError(
            'dept_write_denied',
            'Read & Write clearance for this department (or Admin privileges) is required to feature or unfeature mission reports',
            403,
          )
        }
      }

      const newFeaturedStatus = typeof req.body.isFeatured === 'boolean' ? req.body.isFeatured : !file.isFeatured

      if (newFeaturedStatus && (!file.department || !file.department.isActive || file.department.deletedAt)) {
        throw new AppError(
          'archived_dept_feature_denied',
          'Cannot feature files from an archived or inactive division. Please restore the division first.',
          400,
        )
      }

      const updated = await prisma.file.update({
        where: { id: file.id },
        data: {
          isFeatured: newFeaturedStatus,
        },
      })

      auditService.log({
        userId: req.user!.id,
        action: newFeaturedStatus ? 'FILE:FEATURE' : 'FILE:UNFEATURE',
        resourceType: 'file',
        resourceId: file.id,
      })

      res.json({
        data: {
          id: updated.id,
          name: updated.name,
          isFeatured: updated.isFeatured,
          message: updated.isFeatured
            ? 'Mission report featured successfully in public showcase'
            : 'Mission report removed from featured showcase',
        },
        requestId: req.requestId,
      })
    } catch (err) {
      next(err)
    }
  })

  // ============================================================
  // ALL REPOSITORY FILES & DATASETS (FOR CMS & FEATURED SELECTOR)
  // ============================================================
  router.get('/admin/files/repository-list', authMiddleware, adminMiddleware, async (req, res, next) => {
    try {
      const { search, departmentId, extension } = req.query

      const where: any = {
        deletedAt: null,
        nodeType: 'FILE',
        department: { isActive: true, deletedAt: null },
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
        take: 200,
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
          report: {
            select: {
              id: true,
              title: true,
              spacecraft: true,
              category: true,
              classificationLevel: true,
              versionLabel: true,
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
          satellite: f.report?.spacecraft || f.department?.satellite?.name || 'Primary Fleet',
          uploader: f.uploader?.name || 'Operator',
          createdAt: f.createdAt,
          isFeatured: Boolean(f.isFeatured),
          versionCount: f.versionCount || 1,
          versionLabel: f.report?.versionLabel || `V${f.versionCount || 1}.0`,
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
    chunkUpload.single('chunk'),
    deptAccessMiddleware,
    (req, _res, next) => {
      if (req.user?.role !== 'ADMIN' && req.deptAccessLevel !== 'READ_WRITE') {
        throw new AppError('dept_write_denied', 'Write clearance required to upload files to this department', 403)
      }
      next()
    },
    hddAvailabilityMiddleware,
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
    
        const chunksDir = path.join(os.tmpdir(), 'istrac-chunks', `${departmentId}_${safeName}`)
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
    deptAccessMiddleware,
    (req, _res, next) => {
      if (req.user?.role !== 'ADMIN' && req.deptAccessLevel !== 'READ_WRITE') {
        throw new AppError('dept_write_denied', 'Write clearance required to upload files to this department', 403)
      }
      next()
    },
    hddAvailabilityMiddleware,
    async (req, res, next) => {
       let assembledPath: string | null = null
      try {
           
        const { fileName, departmentId, parentId, totalChunks } = req.body

        if (!fileName || !departmentId || !totalChunks) {
          throw new AppError('missing_complete_params', 'fileName, departmentId, and totalChunks required', 400)
        }
        const totalChunksNum = Number(totalChunks)
        if (!Number.isInteger(totalChunksNum) || totalChunksNum < 1 || totalChunksNum > 1000) {
          throw new AppError('invalid_chunk_count', 'totalChunks must be between 1 and 1000', 400)
        }

        const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
        const chunksDir = path.join(os.tmpdir(), 'istrac-chunks', `${departmentId}_${safeName}`)

        // // Concatenate all chunks

        // const chunkBuffers: Buffer[] = []
        // for (let i = 0; i < totalChunksNum; i++) {
        //   const chunkPath = path.join(chunksDir, `part_${String(i).padStart(5, '0')}`)
        //   try {
        //     const buf = await fs.readFile(chunkPath)
        //     chunkBuffers.push(buf)
        //   } catch {
        //     throw new AppError('missing_chunk_file', `Chunk ${i} is missing on server`, 400)
        //   }
        // }

        // const fullBuffer = Buffer.concat(chunkBuffers)

      // Temporary file used to assemble the upload.
      const assembledDir = path.join(
        os.tmpdir(),
        'istrac-assembled',
      )

      assembledPath = path.join(
        assembledDir,
        `${departmentId}_${safeName}_${Date.now()}.uploading`,
      )

      // --------------------------------------------------------
      // Assemble chunks using streams.
      //
      // IMPORTANT:
      // We never use fs.readFile() or Buffer.concat().
      // Therefore the complete file is never loaded into RAM.
      // --------------------------------------------------------
      await assembleChunks(
        chunksDir,
        totalChunksNum,
        assembledPath,
      )

      // --------------------------------------------------------
      // Get file information from the assembled file
      // --------------------------------------------------------
      const stats = await fs.stat(assembledPath)

      if (stats.size === 0) {
        throw new AppError(
          'empty_file',
          'Uploaded file is empty',
          400,
        )
      }

      // --------------------------------------------------------
      // Read the assembled file only through the existing
      // upload service.
      //
      // NOTE:
      // Your current uploadFile() accepts Buffer, so we use
      // a stream-based version below instead of Buffer.
      // --------------------------------------------------------

      const result = await fileService.uploadFile({
        filePath: assembledPath,
        originalName: fileName,
        mimeType: 'application/octet-stream',
        departmentId,
        parentId: parentId || null,
        uploaderId: req.user!.id,
        uploaderName: req.user!.name,
      })


        // Clean up temp chunks
        await fs.rm(chunksDir, { recursive: true, force: true }).catch(() => {})
        await fs.rm(assembledPath, { force: true })
   

        res.status(201).json({
          data: result,
          requestId: req.requestId,
        })
      } catch (err) {
  if (assembledPath) {
    await fs.rm(assembledPath, { force: true }).catch(() => {})
  }
        next(err)
      }
    },
  )

  // ============================================================
  // LOG FILE ACCESS (PREVIEW / AUDIT)
  // ============================================================
  router.post(
    '/files/:fileId/log-access',
    optionalAuthMiddleware,
    async (req, res, next) => {
      try {
        const rawId = req.params.fileId
        const fileId = Array.isArray(rawId) ? rawId[0] : rawId
        const action = req.body?.action || 'PREVIEW'

        if (req.user) {
          auditService.log({
            userId: req.user.id,
            action: `FILE:${action.toUpperCase()}`,
            resourceType: 'file',
            resourceId: fileId,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
          })
        }

        res.json({
          data: { success: true, fileId },
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
    optionalAuthMiddleware,
    downloadRateLimiter,
    hddAvailabilityMiddleware,
    async (req, res, next) => {
      try {
        const rawId = req.params.fileId
        const fileId = Array.isArray(rawId) ? rawId[0] : rawId

        const file = await prisma.file.findUnique({
          where: { id: fileId, deletedAt: null },
          include: { department: true },
        })

        if (!file || file.nodeType === 'FOLDER') {
          throw new AppError('file_not_found', 'File not found', 404)
        }

        // Publicly accessible if featured and belonging to an active, non-archived department
        const isPubliclyAccessible = Boolean(file.isFeatured && file.department?.isActive && !file.department?.deletedAt)

        if (!isPubliclyAccessible) {
          if (!req.user) {
            throw new AppError('missing_token', 'Authentication required to download this file', 401)
          }

          if (req.user.role !== 'ADMIN') {
            const hasAccess = await prisma.userDepartmentAccess.findFirst({
              where: {
                userId: req.user.id,
                departmentId: file.departmentId,
                deletedAt: null,
                department: { isActive: true, deletedAt: null },
              },
            })
            if (!hasAccess) {
              throw new AppError('dept_access_denied', 'No access to this department', 403)
            }
          }
        }

        const activeVersion = await prisma.fileVersion.findFirst({
          where: {
            fileId: file.id,
            deletedAt: null,
            ...(req.user?.role === 'ADMIN' ? {} : { isVisible: true }),
          },
          orderBy: { versionNum: 'desc' },
        })

        if (!activeVersion && req.user?.role !== 'ADMIN') {
          throw new AppError('version_hidden', 'This file has no published versions accessible to regular members', 403)
        }

        const filePath = activeVersion ? activeVersion.hddPath : file.hddPath
        const downloadName = activeVersion?.name || file.name
        const mimeType = activeVersion?.mimeType || file.mimeType || 'application/octet-stream'
        const sizeBytes = activeVersion?.sizeBytes ?? file.sizeBytes

        const stream = await hddService.streamFile(filePath)

        res.setHeader('Content-Type', mimeType)
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`)
        res.setHeader('Cache-Control', 'private, max-age=3600')
        if (sizeBytes) {
          res.setHeader('Content-Length', sizeBytes.toString())
        }

        stream.pipe(res)

        if (req.user) {
          auditService.log({
            userId: req.user.id,
            action: 'FILE:DOWNLOAD',
            resourceType: 'file',
            resourceId: file.id,
          })
        }
      } catch (err) {
        next(err)
      }
    },
  )

  // ============================================================
  // SOFT DELETE FILE
  // ============================================================
  router.delete('/files/:fileId', authMiddleware,adminMiddleware, async (req, res, next) => {
    try {
      const rawId = req.params.fileId
      const fileId = Array.isArray(rawId) ? rawId[0] : rawId

      const file = await prisma.file.findUnique({
        where: { id: fileId, deletedAt: null },
      })

      if (!file) {
        throw new AppError('file_not_found', 'File not found', 404)
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
      const file = await prisma.file.findUnique({
        where: { id: fileId },
        include: {
          department: {
            select: {
              id: true,
              name: true,
              code: true,
              satellite: { select: { id: true, name: true, code: true } },
            },
          },
          report: true,
          uploader: { select: { id: true, name: true, email: true } },
        },
      })

      if (!file) throw new AppError('file_not_found', 'File not found', 404)
      const isAdmin = req.user!.role === 'ADMIN'
      if (!isAdmin) {
        const hasAccess = await prisma.userDepartmentAccess.findFirst({
          where: { userId: req.user!.id, departmentId: file.departmentId, deletedAt: null },
        })
        if (!hasAccess) throw new AppError('dept_access_denied', 'No access to this department', 403)
      }

      const versions = await prisma.fileVersion.findMany({
        where: {
          fileId,
          deletedAt: null,
          ...(isAdmin ? {} : { isVisible: true }),
        },
        include: {
          uploader: { select: { id: true, name: true, email: true } },
        },
        orderBy: { versionNum: 'desc' },
      })

      if (!isAdmin && versions.length === 0) {
        throw new AppError('version_hidden', 'This file has no published versions accessible to regular members', 403)
      }

      const activeVer = versions[0]
      const displayName = (!isAdmin && activeVer?.name) ? activeVer.name : file.name
      const displaySize = (!isAdmin && activeVer?.sizeBytes) ? activeVer.sizeBytes.toString() : (file.sizeBytes ? file.sizeBytes.toString() : '0')
      const displaySha256 = (!isAdmin && activeVer?.sha256) ? activeVer.sha256 : file.sha256

      res.json({
        file: {
          id: file.id,
          name: displayName,
          title: file.report?.title || displayName.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
          description: file.description || file.report?.description || '',
          extension: (file.extension || displayName.split('.').pop() || 'FILE').toUpperCase(),
          mimeType: (!isAdmin && activeVer?.mimeType) ? activeVer.mimeType : file.mimeType,
          sizeBytes: displaySize,
          sha256: displaySha256,
          createdAt: file.createdAt,
          uploaderName: file.uploader?.name || 'Authorized Officer',
          uploaderEmail: file.uploader?.email,
          departmentId: file.department?.id,
          departmentName: file.department?.name,
          departmentCode: file.department?.code,
          spacecraft: file.report?.spacecraft || file.department?.satellite?.name || 'General',
          category: file.report?.category || 'DAILY_REPORT',
          classificationLevel: file.report?.classificationLevel || 'RESTRICTED',
          versionCount: !isAdmin ? versions.length : (file.versionCount || versions.length || 1),
        },
        data: versions.map((v: any) => ({
          id: v.id,
          versionNum: v.versionNum,
          versionLabel: v.versionLabel || `V${v.versionNum}.0`,
          isVisible: Boolean(v.isVisible),
          changeLog: v.changeLog || null,
          name: v.name || file.name,
          mimeType: v.mimeType || file.mimeType,
          sizeBytes: v.sizeBytes ? v.sizeBytes.toString() : null,
          sha256: v.sha256,
          uploadedBy: v.uploader?.name || 'Unknown Officer',
          uploaderEmail: v.uploader?.email,
          createdAt: v.createdAt,
        })),
        requestId: req.requestId,
      })
    } catch (err) {
      next(err)
    }
  })

  // ============================================================
  // UPLOAD NEW VERSION FOR AN EXISTING FILE
  // ============================================================
  router.post(
    '/files/:fileId/version',
    authMiddleware,
    upload.single('file'),
    hddAvailabilityMiddleware,
    async (req, res, next) => {
      try {
        if (!req.file) {
          throw new AppError('missing_file', 'No file uploaded in form-data', 400)
        }

        const rawId = req.params.fileId
        const fileId = Array.isArray(rawId) ? rawId[0] : rawId

        const existingFile = await prisma.file.findFirst({
          where: { id: fileId, deletedAt: null },
          include: { report: true, department: true },
        })

        if (!existingFile) {
          throw new AppError('file_not_found', 'Target file for version update not found', 404)
        }

        // Verify write access
        if (req.user!.role !== 'ADMIN') {
          const access = await prisma.userDepartmentAccess.findFirst({
            where: {
              userId: req.user!.id,
              departmentId: existingFile.departmentId,
              deletedAt: null,
            },
          })
          if (!access || access.accessLevel !== 'READ_WRITE') {
            throw new AppError('dept_write_denied', 'Write access required to upload new versions in this department', 403)
          }
        }

        const {
          title,
          description,
          spacecraft,
          category,
          versionLabel,
          changeLog,
          isVisible,
        } = req.body

        const result = await fileService.uploadFile({
          targetFileId: fileId,
          fileBuffer: req.file.buffer,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          departmentId: existingFile.departmentId,
          parentId: existingFile.parentId,
          uploaderId: req.user!.id,
          uploaderName: req.user!.name,
          title: title || existingFile.report?.title || undefined,
          description: description !== undefined ? description : (existingFile.description || undefined),
          spacecraft: spacecraft || existingFile.report?.spacecraft || undefined,
          category: category || existingFile.report?.category || undefined,
          versionLabel: versionLabel || undefined,
          changeLog: changeLog || undefined,
          isVisible: isVisible !== undefined ? (isVisible === 'true' || isVisible === true) : true,
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
  // ADMIN TOGGLE VERSION VISIBILITY (SHOW / HIDE TO MEMBERS)
  // ============================================================
  router.patch(
    '/files/:fileId/versions/:versionId/visibility',
    authMiddleware,
    adminMiddleware,
    async (req, res, next) => {
      try {
        const rawFileId = req.params.fileId
        const fileId = Array.isArray(rawFileId) ? rawFileId[0] : rawFileId
        const rawVerId = req.params.versionId
        const versionId = Array.isArray(rawVerId) ? rawVerId[0] : rawVerId

        const { isVisible } = req.body
        if (typeof isVisible !== 'boolean') {
          throw new AppError('invalid_payload', 'isVisible must be a boolean', 400)
        }

        const targetVersion = await prisma.fileVersion.findFirst({
          where: { id: versionId, fileId, deletedAt: null },
        })

        if (!targetVersion) {
          throw new AppError('version_not_found', 'Specified file version not found', 404)
        }

        const updated = await prisma.fileVersion.update({
          where: { id: versionId },
          data: { isVisible },
        })

        auditService.log({
          userId: req.user!.id,
          action: 'FILE_VERSION:TOGGLE_VISIBILITY',
          resourceType: 'file_version',
          resourceId: versionId,
          newValue: { fileId, versionNum: updated.versionNum, isVisible },
        })

        res.json({
          data: {
            id: updated.id,
            versionNum: updated.versionNum,
            versionLabel: updated.versionLabel,
            isVisible: updated.isVisible,
          },
          requestId: req.requestId,
        })
      } catch (err) {
        next(err)
      }
    },
  )

  // ============================================================
  // DOWNLOAD SPECIFIC FILE VERSION
  // ============================================================
  router.get(
    '/files/:fileId/versions/:versionId/download',
    authMiddleware,
    downloadRateLimiter,
    async (req, res, next) => {
      try {
        const rawFileId = req.params.fileId
        const fileId = Array.isArray(rawFileId) ? rawFileId[0] : rawFileId
        const rawVerId = req.params.versionId
        const versionId = Array.isArray(rawVerId) ? rawVerId[0] : rawVerId

        const version = await prisma.fileVersion.findFirst({
          where: { id: versionId, fileId, deletedAt: null },
          include: { file: { select: { id: true, name: true, mimeType: true, departmentId: true } } },
        })

        if (!version) {
          throw new AppError('version_not_found', 'Specified file version not found', 404)
        }

        // Access check
        if (req.user!.role !== 'ADMIN') {
          const hasAccess = await prisma.userDepartmentAccess.findFirst({
            where: {
              userId: req.user!.id,
              departmentId: version.file.departmentId,
              deletedAt: null,
            },
          })
          if (!hasAccess) {
            throw new AppError('dept_access_denied', 'No access to this department', 403)
          }

          // If not admin and version is hidden, forbid download!
          if (!version.isVisible) {
            throw new AppError('version_hidden', 'This version is restricted by administrators', 403)
          }
        }

        const stream = await hddService.streamFile(version.hddPath)
        const downloadName = version.name || version.file.name

        res.setHeader('Content-Type', version.mimeType || version.file.mimeType || 'application/octet-stream')
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`)
        res.setHeader('Cache-Control', 'private, max-age=3600')
        if (version.sizeBytes) {
          res.setHeader('Content-Length', version.sizeBytes.toString())
        }

        stream.pipe(res)

        auditService.log({
          userId: req.user!.id,
          action: 'FILE_VERSION:DOWNLOAD',
          resourceType: 'file_version',
          resourceId: version.id,
          newValue: { fileId, versionNum: version.versionNum },
        })
      } catch (err) {
        next(err)
      }
    },
  )

  // ============================================================
  // CREATE FOLDER NODE
  // ============================================================
  router.post('/files/folders', authMiddleware, deptAccessMiddleware,adminMiddleware, async (req, res, next) => {
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
      const deptFolder = dept.code || (dept.hddPath ? path.basename(dept.hddPath) : 'GENERAL')
      const folderPath = path.join(path.resolve(env.HDD_MOUNT_PATH), deptFolder, safeName)

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
      const { search, departmentId, satelliteId, extension, status, isFeatured, includeArchived, sortBy, sortOrder, category, dateFilter, startDate, endDate } = req.query
      const page = Math.max(1, Number(req.query.page) || 1)
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50))
      const skip = (page - 1) * limit

      const shouldIncludeArchived = String(includeArchived).toLowerCase() === 'true'

      const where: any = {
        deletedAt: null,
        nodeType: 'FILE',
        ...(status && { status: String(status) }),
        ...(departmentId && departmentId !== 'ALL'
          ? { departmentId: String(departmentId) }
          : shouldIncludeArchived
            ? { department: { deletedAt: null } }
            : { department: { isActive: true, deletedAt: null } }),
        ...(extension && extension !== 'ALL' && { extension: String(extension).toUpperCase() }),
        ...(String(isFeatured).toLowerCase() === 'true' ? { isFeatured: true } : {}),
      }

      // Category filter
      if (category && category !== 'ALL') {
        where.report = {
          ...(where.report || {}),
          category: String(category),
        }
      }

      // Date of upload filter
      if (dateFilter && dateFilter !== 'ALL') {
        const now = new Date()
        let gteDate: Date | null = null
        if (dateFilter === 'today') {
          gteDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        } else if (dateFilter === '7days') {
          gteDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        } else if (dateFilter === '30days') {
          gteDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        }
        if (gteDate) {
          where.createdAt = { ...(where.createdAt || {}), gte: gteDate }
        }
      } else if (startDate || endDate) {
        where.createdAt = {
          ...(where.createdAt || {}),
          ...(startDate && { gte: new Date(String(startDate)) }),
          ...(endDate && { lte: new Date(String(endDate)) }),
        }
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

      // Dynamic sorting logic
      const allowedSortFields = ['createdAt', 'sizeBytes', 'name', 'versionCount', 'updatedAt']
      const field = allowedSortFields.includes(String(sortBy)) ? String(sortBy) : 'createdAt'
      const order = String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc'
      const orderBy = { [field]: order }

      const [total, files] = await Promise.all([
        prisma.file.count({ where }),
        prisma.file.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            department: {
              select: {
                id: true,
                name: true,
                code: true,
                isActive: true,
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
            isActive: Boolean(f.department?.isActive),
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
          isFeatured: Boolean(f.isFeatured),
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
          let catEnum: any = undefined
          if (category) {
            const upper = String(category).toUpperCase().replace(/\s+/g, '_')
            if (['SPECIAL_OPERATIONS', 'ANOMALY', 'STUDY', 'DAILY_REPORT', 'OTHER'].includes(upper)) {
              catEnum = upper
            } else if (upper.includes('DAILY') || upper.includes('OPS')) {
              catEnum = 'DAILY_REPORT'
            } else if (upper.includes('SPECIAL')) {
              catEnum = 'SPECIAL_OPERATIONS'
            } else if (upper.includes('ANOMALY')) {
              catEnum = 'ANOMALY'
            } else if (upper.includes('STUDY')) {
              catEnum = 'STUDY'
            } else {
              catEnum = 'OTHER'
            }
          }

          await tx.report.update({
            where: { id: file.reportId },
            data: {
              ...(title && { title: title.trim() }),
              ...(description !== undefined && { description: description?.trim() || null }),
              ...(spacecraft && { spacecraft: spacecraft.trim() }),
              ...(catEnum && { category: catEnum }),
              ...(category && { customCategory: category }),
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
