import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { prisma } from '../config/db.js'
import { hddService } from './hdd.service.js'

export interface DriveInfo {
  mountPoint: string
  label: string
  totalBytes: number
  freeBytes: number
  usedBytes: number
  usedPercent: number
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL'
  isDefaultTarget: boolean
  isWritable: boolean
}

export interface StorageConfigSettings {
  primaryPath: string
  secondaryPath?: string
  failoverEnabled: boolean
  autoMirrorEnabled: boolean
  warnThresholdPercent: number
  criticalThresholdPercent: number
}

export const driveDetectorService = {
  /**
   * Scans available physical drives and volumes on the host system.
   */
  async getAvailableDrives(): Promise<DriveInfo[]> {
    const drives: DriveInfo[] = []
    const isWindows = os.platform() === 'win32'

    // Windows letters A-Z or POSIX root and mounts
    const candidatePaths: string[] = []

    if (isWindows) {
      const letters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
      for (const l of letters) {
        candidatePaths.push(`${l}:\\`)
      }
    } else {
      candidatePaths.push('/')
      // Common mount points on Linux/Unix
      candidatePaths.push('/mnt', '/media', '/data', '/var')
    }

    for (const candidate of candidatePaths) {
      try {
        const stats = await fs.statfs(candidate)
        const totalBytes = stats.bsize * stats.blocks
        const freeBytes = stats.bsize * stats.bfree
        const usedBytes = totalBytes - freeBytes

        if (totalBytes > 0) {
          const usedPercent = Math.round((usedBytes / totalBytes) * 100)
          let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY'
          if (usedPercent >= 90) status = 'CRITICAL'
          else if (usedPercent >= 80) status = 'WARNING'

          // Test writable probe
          let isWritable = false
          try {
            const probeFile = path.join(candidate, '.istrac_probe')
            await fs.writeFile(probeFile, 'PROBE')
            await fs.unlink(probeFile)
            isWritable = true
          } catch {
            isWritable = false
          }

          drives.push({
            mountPoint: candidate,
            label: isWindows ? `Local Volume (${candidate.replace('\\', '')})` : `Mount (${candidate})`,
            totalBytes,
            freeBytes,
            usedBytes,
            usedPercent,
            status,
            isDefaultTarget: candidate.startsWith('D:') || candidate === '/',
            isWritable,
          })
        }
      } catch {
        // Drive letter not present or unmounted
      }
    }

    return drives
  },

  /**
   * Retrieves persistent storage redundancy settings from DB.
   */
  async getStorageConfig(): Promise<StorageConfigSettings> {
    const configs = await prisma.systemConfig.findMany({
      where: {
        configKey: {
          in: [
            'STORAGE_PRIMARY_PATH',
            'STORAGE_SECONDARY_PATH',
            'STORAGE_FAILOVER_ENABLED',
            'STORAGE_AUTO_MIRROR_ENABLED',
            'STORAGE_WARN_THRESHOLD_PERCENT',
            'STORAGE_CRITICAL_THRESHOLD_PERCENT',
          ],
        },
      },
    })

    const configMap: Record<string, string> = {}
    for (const c of configs) {
      configMap[c.configKey] = c.configValue
    }

    return {
      primaryPath: configMap['STORAGE_PRIMARY_PATH'] || 'D:\\istrac_storage',
      secondaryPath: configMap['STORAGE_SECONDARY_PATH'] || '',
      failoverEnabled: configMap['STORAGE_FAILOVER_ENABLED'] === 'true',
      autoMirrorEnabled: configMap['STORAGE_AUTO_MIRROR_ENABLED'] === 'true',
      warnThresholdPercent: Number(configMap['STORAGE_WARN_THRESHOLD_PERCENT']) || 85,
      criticalThresholdPercent: Number(configMap['STORAGE_CRITICAL_THRESHOLD_PERCENT']) || 95,
    }
  },

  /**
   * Updates and persists storage redundancy settings in DB.
   */
  async updateStorageConfig(userId: string, settings: Partial<StorageConfigSettings>): Promise<StorageConfigSettings> {
    const updates: Array<{ key: string; value: string }> = []

    if (settings.primaryPath !== undefined) {
      updates.push({ key: 'STORAGE_PRIMARY_PATH', value: settings.primaryPath })
    }
    if (settings.secondaryPath !== undefined) {
      updates.push({ key: 'STORAGE_SECONDARY_PATH', value: settings.secondaryPath })
    }
    if (settings.failoverEnabled !== undefined) {
      updates.push({ key: 'STORAGE_FAILOVER_ENABLED', value: String(settings.failoverEnabled) })
    }
    if (settings.autoMirrorEnabled !== undefined) {
      updates.push({ key: 'STORAGE_AUTO_MIRROR_ENABLED', value: String(settings.autoMirrorEnabled) })
    }
    if (settings.warnThresholdPercent !== undefined) {
      updates.push({ key: 'STORAGE_WARN_THRESHOLD_PERCENT', value: String(settings.warnThresholdPercent) })
    }
    if (settings.criticalThresholdPercent !== undefined) {
      updates.push({ key: 'STORAGE_CRITICAL_THRESHOLD_PERCENT', value: String(settings.criticalThresholdPercent) })
    }

    for (const u of updates) {
      await prisma.systemConfig.upsert({
        where: { configKey: u.key },
        update: { configValue: u.value, updatedBy: userId },
        create: { configKey: u.key, configValue: u.value, updatedBy: userId },
      })
    }

    return this.getStorageConfig()
  },

  /**
   * Migrates primary storage mount to a new volume, with optional automatic recursive file copying.
   */
  async migrateStorage(
    userId: string,
    params: {
      newPrimaryPath: string
      oldPrimaryPath?: string
      newSecondaryPath?: string
      copyFiles: boolean
    },
  ) {
    const { newPrimaryPath, oldPrimaryPath, newSecondaryPath, copyFiles } = params

    // 1. Initialize destination folder tree
    const mountResult = await hddService.initializeMount(newPrimaryPath)

    let filesCopied = 0
    let bytesCopied = 0

    // 2. Copy existing data if requested and old path exists
    if (copyFiles && oldPrimaryPath && oldPrimaryPath !== newPrimaryPath) {
      const copyRes = await hddService.copyDirectoryRecursively(oldPrimaryPath, newPrimaryPath)
      filesCopied = copyRes.filesCopied
      bytesCopied = copyRes.bytesCopied

      // 3. Update database file paths
      const allFiles = await prisma.file.findMany({
        where: { deletedAt: null },
      })

      for (const f of allFiles) {
        if (f.hddPath && f.hddPath.includes(oldPrimaryPath)) {
          const updatedHddPath = f.hddPath.replace(oldPrimaryPath, newPrimaryPath)
          await prisma.file.update({
            where: { id: f.id },
            data: { hddPath: updatedHddPath },
          })
        }
      }

      const allVersions = await prisma.fileVersion.findMany()
      for (const v of allVersions) {
        if (v.hddPath && v.hddPath.includes(oldPrimaryPath)) {
          const updatedHddPath = v.hddPath.replace(oldPrimaryPath, newPrimaryPath)
          await prisma.fileVersion.update({
            where: { id: v.id },
            data: { hddPath: updatedHddPath },
          })
        }
      }
    }

    // 4. Persist updated configuration
    const updatedConfig = await this.updateStorageConfig(userId, {
      primaryPath: newPrimaryPath,
      secondaryPath: newSecondaryPath,
    })

    const migrationLog = {
      timestamp: new Date().toISOString(),
      migratedBy: userId,
      oldPrimaryPath: oldPrimaryPath || 'unknown',
      newPrimaryPath,
      newSecondaryPath: newSecondaryPath || '',
      copyFiles,
      filesCopied,
      bytesCopied,
    }

    await prisma.systemConfig.upsert({
      where: { configKey: 'STORAGE_LAST_MIGRATION' },
      update: { configValue: JSON.stringify(migrationLog), updatedBy: userId },
      create: { configKey: 'STORAGE_LAST_MIGRATION', configValue: JSON.stringify(migrationLog), updatedBy: userId },
    })

    return {
      success: true,
      mountResult,
      updatedConfig,
      filesCopied,
      bytesCopied,
      migrationLog,
    }
  },
}
