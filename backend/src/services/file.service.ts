import * as path from 'node:path'
import { prisma } from '../config/db.js'
import { env } from '../config/env.js'
import { hddService } from './hdd.service.js'
import { auditService } from './audit.service.js'
import { notificationService } from './notification.service.js'
import { AppError } from '../lib/errors.js'
import { createReadStream, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'

export function incrementVersionLabel(currentLabel?: string | null, versionNum = 1): string {
  if (!currentLabel) return `V${versionNum}.0`
  const clean = currentLabel.trim().replace(/^[vV]/, '')
  const parts = clean.split('.')
  if (parts.length >= 2) {
    const major = parseInt(parts[0], 10)
    const minor = parseInt(parts[1], 10)
    if (!isNaN(major) && !isNaN(minor)) {
      return `V${major}.${minor + 1}`
    }
  } else if (parts.length === 1) {
    const major = parseInt(parts[0], 10)
    if (!isNaN(major)) {
      return `V${major}.1`
    }
  }
  return `V${versionNum}.0`
}

export interface UploadFileParams {
  fileBuffer?: Buffer
  filePath?: string
  originalName: string
  mimeType: string
  departmentId: string
  parentId?: string | null
  uploaderId: string
  uploaderName: string
  title?: string
  description?: string
  spacecraft?: string
  category?: string
  classificationLevel?: string
  versionLabel?: string
  reportNumber?: string
  isFeatured?: boolean
  targetFileId?: string
  changeLog?: string
  isVisible?: boolean
}


export interface UploadFileResult {
  id: string
  name: string
  hddPath: string
  sizeBytes: string
  mimeType: string | null
  versionNum: number
  versionLabel?: string
  reportId?: string | null
}

const ALLOWED_EXTENSIONS = new Set([
  // Document formats
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
  // Text / data
  'txt', 'csv', 'json', 'xml', 'md', 'log', 'dat', 'tsv',
  // Images
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'tiff', 'bmp', 'svg',
  // Video
  'mp4', 'mov', 'avi', 'mkv', 'webm',
  // Scientific / Telemetry formats
  'fits', 'fit', 'hdf', 'hdf5', 'h5', 'nc', 'cdf', 'sav', 'mat',
  // Archive
  'zip', 'tar', 'gz', 'bz2', '7z', 'rar',
])


export const fileService = {
  /**
   * Orchestrates the complete file upload pipeline:
   * validation → disk write → sha256 checksum → DB insert (transaction) → compensation on failure
   */
  async uploadFile(params: UploadFileParams): Promise<UploadFileResult> {

    if (!params.fileBuffer && !params.filePath) {
  throw new AppError(
    'missing_file_data',
    'Either fileBuffer or filePath must be provided',
    400,
  )
}
  // ============================================================
  // D1: Validate file extension against allowlist
  // ============================================================
const ext = path.extname(params.originalName).replace('.', '').toLowerCase()
if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
  throw new AppError('unsupported_file_type', `File type .${ext} is not permitted. Contact your administrator to add support for this format.`, 415)
}

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

    // 3. Build physical destination path in hierarchy: Mount / Department / Spacecraft / Folder / File
    const sanitizedFilename = params.originalName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const satFolder = (params.spacecraft || 'GENERAL').replace(/[^a-zA-Z0-9_-]/g, '_')
    const deptFolder = dept.code || (dept.hddPath ? path.basename(dept.hddPath) : 'GENERAL')
    const storageConfig = await prisma.systemConfig.findFirst({
      where: { configKey: { in: ['STORAGE_PRIMARY_PATH', 'STORAGE_MOUNT_PATH'] } },
    })
    const baseMount = storageConfig?.configValue
      ? path.resolve(storageConfig.configValue)
      : path.resolve(env.HDD_MOUNT_PATH)
    const destDir = path.join(baseMount, deptFolder, satFolder, parentPath)
    const destPath = path.join(destDir, sanitizedFilename)

    // Check if an active file already exists at this path OR if targetFileId was passed
    let existingFile = null
    if (params.targetFileId) {
      existingFile = await prisma.file.findFirst({
        where: { id: params.targetFileId, deletedAt: null },
        include: {
          versions: { orderBy: { versionNum: 'desc' }, take: 1 },
          report: true,
          department: true,
        },
      })
      if (!existingFile) {
        throw new AppError('file_not_found', 'Target file for version upload not found', 404)
      }
    } else {
      existingFile = await prisma.file.findFirst({
        where: { hddPath: destPath, deletedAt: null },
        include: {
          versions: { orderBy: { versionNum: 'desc' }, take: 1 },
          report: true,
          department: true,
        },
      })
    }

    const versionNum = existingFile ? existingFile.versionCount + 1 : 1
    const latestVersion = existingFile?.versions?.[0]
    const baseLabel = existingFile?.report?.versionLabel || latestVersion?.versionLabel || (existingFile ? `V${existingFile.versionCount}.0` : 'V1.0')
    const finalVersionLabel = params.versionLabel || (existingFile ? incrementVersionLabel(baseLabel, versionNum) : 'V1.0')

    let targetDir = destDir
    if (existingFile && existingFile.hddPath) {
      targetDir = path.dirname(existingFile.hddPath)
    }

    const versionedPath = existingFile
      ? path.join(targetDir, `.v${versionNum}_${sanitizedFilename}`)
      : destPath

    // 4. Write to physical storage
    if (params.filePath) {
      await hddService.copyFile(
        params.filePath,
        versionedPath,
      )
    } else {
      await hddService.writeFile(
        versionedPath,
        params.fileBuffer!,
      )
    }

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
              versionLabel: finalVersionLabel,
              isVisible: params.isVisible !== undefined ? Boolean(params.isVisible) : true,
              changeLog: params.changeLog || null,
              name: sanitizedFilename,
              mimeType: params.mimeType,
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
              hddPath: versionedPath,
              name: sanitizedFilename,
              mimeType: params.mimeType,
              extension: path.extname(sanitizedFilename).replace('.', '') || existingFile.extension,
              description: params.description !== undefined ? params.description : existingFile.description,
              updatedAt: new Date(),
            },
          })

          if (existingFile.reportId) {
            await tx.report.update({
              where: { id: existingFile.reportId },
              data: {
                title: params.title || undefined,
                description: params.description !== undefined ? params.description : undefined,
                spacecraft: params.spacecraft || undefined,
                versionLabel: finalVersionLabel,
                updatedAt: new Date(),
              },
            })
            reportId = existingFile.reportId
          }
        })
        fileId = existingFile.id
      } else {
        // Map category string to valid ReportCategory enum or OTHER + customCategory
        let catEnum: any = 'DAILY_REPORT'
        if (params.category) {
          const upper = String(params.category).toUpperCase().replace(/\s+/g, '_')
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
                category: catEnum,
                customCategory: params.category || null,
                status: 'ACTIVE',
                spacecraft: params.spacecraft || null,
                classificationLevel: params.classificationLevel || null,
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
              isFeatured: params.isFeatured ? true : false,
              versionCount: 1,
            },
          })

          await tx.fileVersion.create({
            data: {
              fileId: f.id,
              versionNum: 1,
              versionLabel: finalVersionLabel,
              isVisible: true,
              changeLog: params.changeLog || 'Initial release',
              name: sanitizedFilename,
              mimeType: params.mimeType,
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
        versionLabel: finalVersionLabel,
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
      data: { deletedAt: new Date(), isFeatured: false },
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
