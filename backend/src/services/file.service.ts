import * as path from 'node:path'
import { prisma } from '../config/db.js'
import { hddService } from './hdd.service.js'
import { auditService } from './audit.service.js'
import { notificationService } from './notification.service.js'
import { AppError } from '../lib/errors.js'

export interface UploadFileParams {
  fileBuffer: Buffer
  originalName: string
  mimeType: string
  departmentId: string
  parentId?: string | null
  uploaderId: string
  uploaderName: string
  title?: string
  description?: string
  spacecraft?: string
  category?: 'SPECIAL_OPERATIONS' | 'ANOMALY' | 'STUDY' | 'DAILY_REPORT' | 'OTHER'
  classificationLevel?: string
  versionLabel?: string
  reportNumber?: string
}

export interface UploadFileResult {
  id: string
  name: string
  hddPath: string
  sizeBytes: string
  mimeType: string | null
  versionNum: number
  reportId?: string | null
}

export const fileService = {
  /**
   * Orchestrates the complete file upload pipeline:
   * validation → disk write → sha256 checksum → DB insert (transaction) → compensation on failure
   */
  async uploadFile(params: UploadFileParams): Promise<UploadFileResult> {
    // 1. Validate department
    const dept = await prisma.department.findFirst({
      where: { id: params.departmentId, deletedAt: null, isActive: true },
    })
    if (!dept) {
      throw new AppError('department_not_found', 'Department does not exist or is inactive', 404)
    }

    // 2. Validate parent folder if specified
    let parentPath = ''
    if (params.parentId) {
      const parent = await prisma.file.findFirst({
        where: { id: params.parentId, departmentId: dept.id, nodeType: 'FOLDER', deletedAt: null },
      })
      if (!parent) {
        throw new AppError('parent_not_found', 'Specified parent folder not found', 404)
      }
      parentPath = parent.name
    }

    // 3. Build physical destination path in hierarchy: Department / Spacecraft / Folder / File
    const sanitizedFilename = params.originalName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const satFolder = (params.spacecraft || 'GENERAL').replace(/[^a-zA-Z0-9_-]/g, '_')
    const destDir = path.join(dept.hddPath, satFolder, parentPath)
    const destPath = path.join(destDir, sanitizedFilename)

    // Check if an active file already exists at this path
    const existingFile = await prisma.file.findFirst({
      where: { hddPath: destPath, deletedAt: null },
      include: { versions: { orderBy: { versionNum: 'desc' }, take: 1 } },
    })

    const versionNum = existingFile ? existingFile.versionCount + 1 : 1
    const versionedPath = existingFile
      ? path.join(destDir, `.v${versionNum}_${sanitizedFilename}`)
      : destPath

    // 4. Write to physical storage
    await hddService.writeFile(versionedPath, params.fileBuffer)

    // 5. Compute checksum & size
    const sha256 = await hddService.computeChecksum(versionedPath)
    const sizeBytes = await hddService.getFileSize(versionedPath)

    try {
      let fileId = ''
      let reportId: string | null = null

      if (existingFile) {
        // Create new version in a transaction
        await prisma.$transaction(async (tx: any) => {
          await tx.fileVersion.create({
            data: {
              fileId: existingFile.id,
              versionNum,
              hddPath: versionedPath,
              sizeBytes,
              sha256,
              uploadedBy: params.uploaderId,
            },
          })

          await tx.file.update({
            where: { id: existingFile.id },
            data: {
              versionCount: { increment: 1 },
              sizeBytes,
              sha256,
              updatedAt: new Date(),
            },
          })

          if (existingFile.reportId && params.versionLabel) {
            await tx.report.update({
              where: { id: existingFile.reportId },
              data: {
                versionLabel: params.versionLabel,
                updatedAt: new Date(),
              },
            })
            reportId = existingFile.reportId
          }
        })
        fileId = existingFile.id
      } else {
        // Create report record if report metadata provided
        const created = await prisma.$transaction(async (tx: any) => {
          let rep: any = null
          if (params.title || params.spacecraft || params.category) {
            rep = await tx.report.create({
              data: {
                departmentId: dept.id,
                createdById: params.uploaderId,
                title: params.title || sanitizedFilename,
                description: params.description || null,
                category: params.category || 'DAILY_REPORT',
                status: 'ACTIVE',
                spacecraft: params.spacecraft || null,
                classificationLevel: params.classificationLevel || 'ISRO_LEVEL',
                versionLabel: params.versionLabel || 'V1.0',
                reportNumber: params.reportNumber || null,
              },
            })
            reportId = rep.id
          }

          const f = await tx.file.create({
            data: {
              departmentId: dept.id,
              reportId: rep ? rep.id : null,
              parentId: params.parentId || null,
              nodeType: 'FILE',
              name: sanitizedFilename,
              hddPath: destPath,
              sizeBytes,
              mimeType: params.mimeType,
              extension: path.extname(sanitizedFilename).replace('.', '') || undefined,
              sha256,
              uploaderId: params.uploaderId,
              description: params.description || null,
              status: 'ACTIVE',
              versionCount: 1,
            },
          })

          await tx.fileVersion.create({
            data: {
              fileId: f.id,
              versionNum: 1,
              hddPath: destPath,
              sizeBytes,
              sha256,
              uploadedBy: params.uploaderId,
            },
          })

          return f
        })
        fileId = created.id
      }

      // 6. Non-blocking audit and notification
      auditService.log({
        userId: params.uploaderId,
        action: existingFile ? 'FILE:NEW_VERSION' : 'FILE:UPLOAD',
        resourceType: 'file',
        resourceId: fileId,
      })

      notificationService.sendBroadcast({
        type: 'FILE_UPLOAD',
        category: 'file',
        actorId: params.uploaderId,
        message: `${params.uploaderName} uploaded ${sanitizedFilename} to ${dept.name}`,
        resourceType: 'file',
        resourceId: fileId,
      })

      return {
        id: fileId,
        name: sanitizedFilename,
        hddPath: versionedPath,
        sizeBytes: sizeBytes.toString(),
        mimeType: params.mimeType,
        versionNum,
        reportId,
      }
    } catch (dbErr) {
      // COMPENSATION PATTERN: Delete physical file if database transaction fails
      await hddService.deleteFile(versionedPath)
      throw dbErr
    }
  },

  async softDeleteFile(fileId: string, userId: string): Promise<void> {
    const file = await prisma.file.findUnique({
      where: { id: fileId, deletedAt: null },
    })
    if (!file) {
      throw new AppError('file_not_found', 'File not found', 404)
    }

    await prisma.file.update({
      where: { id: fileId },
      data: { deletedAt: new Date() },
    })

    auditService.log({
      userId,
      action: 'FILE:DELETE',
      resourceType: 'file',
      resourceId: fileId,
    })
  },

  async restoreFile(fileId: string, userId: string): Promise<void> {
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    })
    if (!file || !file.deletedAt) {
      throw new AppError('file_not_found', 'File is not in trash', 404)
    }

    await prisma.file.update({
      where: { id: fileId },
      data: { deletedAt: null },
    })

    auditService.log({
      userId,
      action: 'FILE:RESTORE',
      resourceType: 'file',
      resourceId: fileId,
    })
  },

  async getFileWithVersions(fileId: string) {
    const file = await prisma.file.findUnique({
      where: { id: fileId, deletedAt: null },
      include: {
        versions: { orderBy: { versionNum: 'desc' } },
        uploader: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true, hddPath: true } },
        report: true,
      },
    })
    if (!file) {
      throw new AppError('file_not_found', 'File not found', 404)
    }
    return file
  },
}
