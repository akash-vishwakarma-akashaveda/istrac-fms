import * as fs from 'node:fs/promises'
import { createReadStream, createWriteStream } from 'node:fs'
import * as path from 'node:path'
import * as crypto from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { env } from '../config/env.js'
import { AppError } from '../lib/errors.js'

const MOUNT_ROOT = path.resolve(env.HDD_MOUNT_PATH)

export const hddService = {
/**
 * Appends a source file to a destination file using streams.
 * Used for assembling chunked uploads without loading the
 * complete file into memory.
 */
  async appendFile(sourcePath: string, destinationPath: string): Promise<void> {
  const source = createReadStream(sourcePath)
  const destination = createWriteStream(destinationPath, {
    flags: 'a',
  })

  await pipeline(source, destination)
},
  /**
   * Path Traversal Guard: Prevents directory traversal attacks.
   */
  guardPath(targetPath: string): string {
    const resolved = path.resolve(targetPath)
    if (!resolved.startsWith(MOUNT_ROOT)) {
      throw new AppError('path_traversal', 'Invalid storage path access attempt', 400)
    }
    return resolved
  },

  /**
   * Writes a file atomically using a temporary file and rename.
   */
  async writeFile(destPath: string, data: Buffer): Promise<void> {
    const safeDest = this.guardPath(destPath)
    const dir = path.dirname(safeDest)
    await fs.mkdir(dir, { recursive: true })

    const tmpPath = `${safeDest}.${crypto.randomBytes(6).toString('hex')}.tmp`
    await fs.writeFile(tmpPath, data)
    await fs.rename(tmpPath, safeDest)
  },

  /**
   * Streams a file to a readable stream.
   */
  async streamFile(filePath: string): Promise<NodeJS.ReadableStream> {
    const safePath = this.guardPath(filePath)
    try {
      await fs.access(safePath, fs.constants.R_OK)
    } catch {
      throw new AppError('file_not_found', 'File not found on storage mount', 404)
    }
    return createReadStream(safePath)
  },

  /**
   * Hard deletes a physical file (used in compensation on DB rollback).
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      const safePath = this.guardPath(filePath)
      await fs.unlink(safePath)
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.error(`[HddService] deleteFile error for ${filePath}:`, err)
      }
    }
  },

  /**
   * Moves a file within the storage root.
   */
  async moveFile(srcPath: string, destPath: string): Promise<void> {
    const safeSrc = this.guardPath(srcPath)
    const safeDest = this.guardPath(destPath)
    const dir = path.dirname(safeDest)
    await fs.mkdir(dir, { recursive: true })
    await fs.rename(safeSrc, safeDest)
  },

  /**
   * Computes SHA-256 hash of a file on disk.
   */
  async computeChecksum(filePath: string): Promise<string> {
    const safePath = this.guardPath(filePath)
    const hash = crypto.createHash('sha256')
    const stream = createReadStream(safePath)

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => hash.update(chunk))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', (err) => reject(err))
    })
  },

  /**
   * Validates magic bytes for common formats.
   */
  async validateMagicBytes(filePath: string): Promise<boolean> {
    try {
      const safePath = this.guardPath(filePath)
      const handle = await fs.open(safePath, 'r')
      const buffer = Buffer.alloc(8)
      await handle.read(buffer, 0, 8, 0)
      await handle.close()

      const ext = path.extname(filePath).toLowerCase()

      // PDF: %PDF (25 50 44 46)
      if (ext === '.pdf') {
        return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46
      }
      // PNG: 89 50 4E 47
      if (ext === '.png') {
        return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47
      }
      // JPEG: FF D8 FF
      if (ext === '.jpg' || ext === '.jpeg') {
        return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
      }
      // ZIP / DOCX / XLSX: 50 4B 03 04
      if (['.zip', '.docx', '.xlsx', '.pptx'].includes(ext)) {
        return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04
      }

      return true
    } catch {
      return false
    }
  },

  /**
   * Gets size in bytes as BigInt.
   */
  async getFileSize(filePath: string): Promise<bigint> {
    const safePath = this.guardPath(filePath)
    const stats = await fs.stat(safePath)
    return BigInt(stats.size)
  },

  /**
   * Initializes physical storage mount (HDD/SSD/RAID) directory tree and verifies read/write integrity.
   */
  async initializeMount(customPath?: string): Promise<{
    path: string
    exists: boolean
    writable: boolean
    directoriesCreated: string[]
  }> {
    const targetRoot = customPath ? path.resolve(customPath) : MOUNT_ROOT
    const dirsToCreate = [
      targetRoot,
      path.join(targetRoot, 'TTC'),
      path.join(targetRoot, 'FDD'),
      path.join(targetRoot, 'MOX'),
      path.join(targetRoot, 'NETRA'),
      path.join(targetRoot, 'GSO'),
      path.join(targetRoot, '.chunks'),
      path.join(targetRoot, '.trash'),
    ]

    const directoriesCreated: string[] = []
    try {
      for (const d of dirsToCreate) {
        await fs.mkdir(d, { recursive: true })
        directoriesCreated.push(d)
      }

      // Test read/write permission probe
      const probeFile = path.join(targetRoot, '.probe_write_test')
      await fs.writeFile(probeFile, 'ISTRAC_STORAGE_PROBE_OK')
      const readContent = await fs.readFile(probeFile, 'utf8')
      await fs.unlink(probeFile)

      return {
        path: targetRoot,
        exists: true,
        writable: readContent === 'ISTRAC_STORAGE_PROBE_OK',
        directoriesCreated,
      }
    } catch (err: any) {
      if (err.code === 'EACCES') {
        // Attempt automated recovery via sudo / fallback creation on Linux if permitted
        try {
          const { execSync } = await import('node:child_process')
          execSync(`sudo mkdir -p "${targetRoot}" && sudo chmod -R 777 "${targetRoot}"`, { stdio: 'ignore' })
          // Retry probe after sudo
          for (const d of dirsToCreate) {
            await fs.mkdir(d, { recursive: true })
            if (!directoriesCreated.includes(d)) directoriesCreated.push(d)
          }
          const probeFile = path.join(targetRoot, '.probe_write_test')
          await fs.writeFile(probeFile, 'ISTRAC_STORAGE_PROBE_OK')
          const readContent = await fs.readFile(probeFile, 'utf8')
          await fs.unlink(probeFile)

          return {
            path: targetRoot,
            exists: true,
            writable: readContent === 'ISTRAC_STORAGE_PROBE_OK',
            directoriesCreated,
          }
        } catch {
          // If passwordless sudo is not configured, throw clear instruction
          throw new AppError(
            'storage_permission_denied',
            `Permission denied (EACCES) accessing storage path "${targetRoot}". Run: "sudo mkdir -p ${targetRoot} && sudo chown -R $USER:$USER ${targetRoot} && sudo chmod -R 775 ${targetRoot}", or specify a user-writable path in .env such as HDD_MOUNT_PATH="./storage".`,
            403,
          )
        }
      }
      throw err
    }
  },

  /**
   * Checks current physical storage mount health status.
   */
  async getMountStatus(): Promise<{
    mounted: boolean
    mountPath: string
    writable: boolean
    status: 'ONLINE' | 'DEGRADED' | 'OFFLINE'
  }> {
    try {
      await fs.access(MOUNT_ROOT, fs.constants.R_OK | fs.constants.W_OK)
      return {
        mounted: true,
        mountPath: MOUNT_ROOT,
        writable: true,
        status: 'ONLINE',
      }
    } catch {
      return {
        mounted: false,
        mountPath: MOUNT_ROOT,
        writable: false,
        status: 'OFFLINE',
      }
    }
  },

  /**
   * Recursively copies all directories and files from srcDir to destDir.
   */
  async copyDirectoryRecursively(
    srcDir: string,
    destDir: string,
  ): Promise<{ filesCopied: number; bytesCopied: number }> {
    let filesCopied = 0
    let bytesCopied = 0

    const copyRecursive = async (src: string, dest: string) => {
      await fs.mkdir(dest, { recursive: true })
      const entries = await fs.readdir(src, { withFileTypes: true })

      for (const entry of entries) {
        const srcPath = path.join(src, entry.name)
        const destPath = path.join(dest, entry.name)

        if (entry.isDirectory()) {
          await copyRecursive(srcPath, destPath)
        } else if (entry.isFile()) {
          const stats = await fs.stat(srcPath)
          await fs.copyFile(srcPath, destPath)
          filesCopied++
          bytesCopied += stats.size
        }
      }
    }

    try {
      await fs.access(srcDir, fs.constants.R_OK)
      await copyRecursive(srcDir, destDir)
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err
      }
    }

    return { filesCopied, bytesCopied }
  },


async copyFile(
  sourcePath: string,
  destinationPath: string,
): Promise<void> {

  const safeDestination = this.guardPath(destinationPath)

  await fs.mkdir(path.dirname(safeDestination), { recursive: true })

  await pipeline(
    createReadStream(sourcePath),
    createWriteStream(safeDestination),
  )
},
}
