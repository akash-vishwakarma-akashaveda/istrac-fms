import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { prisma } from '../config/db.js'
import { pubsub } from '../lib/pubsub.js'
import { env } from '../config/env.js'

let syncTimer: NodeJS.Timeout | null = null

/**
 * Reconciles physical files on the HDD mount with DB records.
 */
export async function runHddSync(): Promise<{ registered: number; orphaned: number; updated: number }> {
  const mountRoot = path.resolve(env.HDD_MOUNT_PATH)
  let registered = 0
  let orphaned = 0
  let updated = 0

  try {
    // 1. Fetch all active departments to map folder paths
    const depts = await prisma.department.findMany({
      where: { deletedAt: null },
      select: { id: true, hddPath: true },
    })

    // Walk disk files
    async function getFiles(dir: string): Promise<string[]> {
      const dirents = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
      const files = await Promise.all(
        dirents.map((dirent) => {
          const res = path.resolve(dir, dirent.name)
          return dirent.isDirectory() ? getFiles(res) : res
        }),
      )
      return Array.prototype.concat(...files)
    }

    const diskFiles = await getFiles(mountRoot)
    const diskFileSet = new Set(diskFiles)

    // 2. Check each disk file in DB
    for (const diskFile of diskFiles) {
      if (path.basename(diskFile).startsWith('.')) continue // skip dotfiles

      const existing = await prisma.file.findUnique({
        where: { hddPath: diskFile },
      })

      const stat = await fs.stat(diskFile).catch(() => null)
      if (!stat) continue

      if (!existing) {
        // Try to match department
        const matchingDept = depts.find((d: any) => diskFile.startsWith(path.resolve(d.hddPath)))
        if (matchingDept) {
          const fallbackUser = await prisma.user.findFirst({
            where: { role: 'ADMIN', deletedAt: null },
            select: { id: true },
          })

          if (fallbackUser) {
            await prisma.file.create({
              data: {
                name: path.basename(diskFile),
                hddPath: diskFile,
                nodeType: 'FILE',
                sizeBytes: BigInt(stat.size),
                extension: path.extname(diskFile).replace('.', '') || undefined,
                departmentId: matchingDept.id,
                uploaderId: fallbackUser.id,
                status: 'UNREGISTERED',
                lastSynced: new Date(),
              },
            })
            registered++
          }
        }
      } else {
        await prisma.file.update({
          where: { id: existing.id },
          data: {
            lastSynced: new Date(),
            sizeBytes: BigInt(stat.size),
          },
        })
        updated++
      }
    }

    // 3. Check for files in DB that no longer exist on disk
    const activeDbFiles = await prisma.file.findMany({
      where: { nodeType: 'FILE', status: 'ACTIVE', deletedAt: null },
      select: { id: true, hddPath: true },
    })

    for (const dbFile of activeDbFiles) {
      if (!diskFileSet.has(path.resolve(dbFile.hddPath))) {
        await prisma.file.update({
          where: { id: dbFile.id },
          data: { status: 'ORPHANED' },
        })
        orphaned++
      }
    }

    pubsub
      .publish('hdd.sync', {
        completedAt: new Date().toISOString(),
        stats: { registered, orphaned, updated },
      })
      .catch(() => {})
  } catch (err) {
    console.error('[HddSyncService] Sync failed:', err)
  }

  return { registered, orphaned, updated }
}

export function startHddSyncService(intervalMinutes = 15): void {
  if (syncTimer) return
  runHddSync().catch(() => {})
  syncTimer = setInterval(() => {
    runHddSync().catch((err) => console.error('[HddSyncService] Periodic sync error:', err))
  }, intervalMinutes * 60 * 1000)
}
