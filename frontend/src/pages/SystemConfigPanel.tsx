import { useState, useEffect } from 'react'
import {
  HardDrive,
  Building2,
  FileCode,
  Shield,
  Zap,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FolderTree,
  Layers,
  Save,
  AlertTriangle,
  Copy,
  ArrowRightLeft,
  Check,
  Trash2,
  X,
  Info,
} from 'lucide-react'
import { useSystemConfig } from '../hooks/useSystemConfig'
import { PageHeader, Button, Modal, SetupWizardModal } from '../components'
import { ConfigField } from '../components/ConfigField'
import { ConfigToggle } from '../components/ConfigToggle'
import { apiClient } from '../api/client'
import { useToastStore } from '../store/toastStore'
import { formatFileSize } from '../lib/formatFileSize'

interface DriveItem {
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

export function SystemConfigPanel() {
  const { data: config, isLoading, refetch } = useSystemConfig()
  const addToast = useToastStore((s) => s.addToast)

  // Storage Status
  const [storageStatus, setStorageStatus] = useState<{
    mounted: boolean
    mountPath: string
    writable: boolean
    status: 'ONLINE' | 'DEGRADED' | 'OFFLINE'
  } | null>(null)
  const [checkingStorage, setCheckingStorage] = useState(false)
  const [primaryPath, setPrimaryPath] = useState('D:\\istrac_storage')
  const [secondaryPath, setSecondaryPath] = useState('C:\\istrac_backup_storage')
  const [mountingStorage, setMountingStorage] = useState(false)

  // Redundancy Baseline for Dirty State Detection
  const [savedRedundancy, setSavedRedundancy] = useState({
    primaryPath: 'D:\\istrac_storage',
    secondaryPath: 'C:\\istrac_backup_storage',
    failoverEnabled: true,
    autoMirrorEnabled: true,
    warnThreshold: 85,
  })

  // Host Drives & Redundancy
  const [availableDrives, setAvailableDrives] = useState<DriveItem[]>([])
  const [failoverEnabled, setFailoverEnabled] = useState(true)
  const [autoMirrorEnabled, setAutoMirrorEnabled] = useState(true)
  const [warnThreshold, setWarnThreshold] = useState(85)
  const [savingRedundancy, setSavingRedundancy] = useState(false)

  // Migration Modal State
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false)
  const [pendingNewPrimary, setPendingNewPrimary] = useState('')
  const [copyExistingData, setCopyExistingData] = useState(true)
  const [migrating, setMigrating] = useState(false)

  // Setup Wizard Modal
  const [isWizardOpen, setIsWizardOpen] = useState(false)

  // Compute if redundancy settings have unsaved changes
  const isRedundancyDirty =
    primaryPath !== savedRedundancy.primaryPath ||
    secondaryPath !== savedRedundancy.secondaryPath ||
    failoverEnabled !== savedRedundancy.failoverEnabled ||
    autoMirrorEnabled !== savedRedundancy.autoMirrorEnabled ||
    warnThreshold !== savedRedundancy.warnThreshold

  const fetchStorageData = async () => {
    setCheckingStorage(true)
    try {
      const [statusRes, drivesRes, redundancyRes] = await Promise.all([
        apiClient.get('/admin/storage/status').catch(() => null),
        apiClient.get('/admin/storage/drives').catch(() => null),
        apiClient.get('/admin/storage/redundancy').catch(() => null),
      ])

      if (statusRes?.data?.data) {
        setStorageStatus(statusRes.data.data)
        if (statusRes.data.data.mountPath) {
          setPrimaryPath(statusRes.data.data.mountPath)
        }
      }

      if (drivesRes?.data?.data) {
        setAvailableDrives(drivesRes.data.data)
      }

      if (redundancyRes?.data?.data) {
        const r = redundancyRes.data.data
        const pPath = r.primaryPath || 'D:\\istrac_storage'
        const sPath = r.secondaryPath || ''
        const fEnabled = r.failoverEnabled ?? true
        const aMirror = r.autoMirrorEnabled ?? true
        const wThresh = r.warnThresholdPercent ?? 85

        setPrimaryPath(pPath)
        setSecondaryPath(sPath)
        setFailoverEnabled(fEnabled)
        setAutoMirrorEnabled(aMirror)
        setWarnThreshold(wThresh)

        setSavedRedundancy({
          primaryPath: pPath,
          secondaryPath: sPath,
          failoverEnabled: fEnabled,
          autoMirrorEnabled: aMirror,
          warnThreshold: wThresh,
        })
      }
    } finally {
      setCheckingStorage(false)
    }
  }

  useEffect(() => {
    fetchStorageData()
  }, [])

  // Trigger Migration Modal when switching Primary Drive
  const handleInitiatePrimarySwitch = (targetDrive: DriveItem) => {
    const newPath = targetDrive.mountPoint.endsWith('\\')
      ? `${targetDrive.mountPoint}istrac_storage`
      : `${targetDrive.mountPoint}/istrac_storage`

    if (newPath === primaryPath) {
      addToast({ title: 'Already Active', message: `${newPath} is already the primary storage mount.`, variant: 'info' })
      return
    }

    setPendingNewPrimary(newPath)
    setIsMigrationModalOpen(true)
  }

  // Execute Storage Migration
  const handleExecuteMigration = async () => {
    setMigrating(true)
    try {
      const res = await apiClient.post('/admin/storage/migrate', {
        newPrimaryPath: pendingNewPrimary,
        oldPrimaryPath: primaryPath,
        newSecondaryPath: secondaryPath === pendingNewPrimary ? primaryPath : secondaryPath,
        copyFiles: copyExistingData,
      })

      const data = res.data?.data || res.data
      setPrimaryPath(pendingNewPrimary)
      if (secondaryPath === pendingNewPrimary) {
        setSecondaryPath(primaryPath)
      }

      addToast({
        title: 'Storage Array Migrated Successfully',
        message: `Primary mount switched to ${pendingNewPrimary}. ${
          copyExistingData ? `${data.filesCopied || 0} files transferred.` : 'No files copied.'
        }`,
        variant: 'success',
      })

      setIsMigrationModalOpen(false)
      fetchStorageData()
    } catch (err: any) {
      addToast({
        title: 'Migration Failed',
        message: err.response?.data?.error?.message || 'Could not migrate storage mount.',
        variant: 'error',
      })
    } finally {
      setMigrating(false)
    }
  }

  // Set as Secondary Drive directly
  const handleSetSecondary = (targetDrive: DriveItem) => {
    const newPath = targetDrive.mountPoint.endsWith('\\')
      ? `${targetDrive.mountPoint}istrac_backup_storage`
      : `${targetDrive.mountPoint}/istrac_backup_storage`

    if (newPath === primaryPath) {
      addToast({ title: 'Conflict', message: 'A drive cannot be both Primary and Secondary.', variant: 'warning' })
      return
    }

    setSecondaryPath(newPath)
    addToast({ title: 'Secondary Backup Set', message: `Redundant backup assigned to ${newPath}`, variant: 'info' })
  }

  // Remove / Unlink Secondary Backup Drive
  const handleRemoveSecondary = async () => {
    setSecondaryPath('')
    setFailoverEnabled(false)
    setAutoMirrorEnabled(false)
    try {
      await apiClient.put('/admin/storage/redundancy', {
        primaryPath: primaryPath.trim(),
        secondaryPath: '',
        failoverEnabled: false,
        autoMirrorEnabled: false,
        warnThresholdPercent: Number(warnThreshold),
      })
      addToast({
        title: 'Secondary Backup Removed',
        message: 'Secondary backup volume unlinked. System is running on single primary storage array.',
        variant: 'info',
      })
      fetchStorageData()
    } catch (err: any) {
      addToast({
        title: 'Error',
        message: err.response?.data?.error?.message || 'Could not remove backup',
        variant: 'error',
      })
    }
  }

  // Sync & Verify Directories (Re-mount)
  const handleSyncDirectories = async () => {
    setMountingStorage(true)
    try {
      const res = await apiClient.post('/admin/storage/initialize-mount', {
        customPath: primaryPath.trim(),
      })
      const data = res.data?.data || res.data
      setStorageStatus({
        mounted: true,
        mountPath: data.path || primaryPath,
        writable: data.writable ?? true,
        status: 'ONLINE',
      })
      addToast({
        title: 'Storage Synchronized & Verified',
        message: `Validated disk write probe and 7 standard departmental folders at ${data.path || primaryPath}`,
        variant: 'success',
      })
      fetchStorageData()
    } catch (err: any) {
      addToast({
        title: 'Verification Failed',
        message: err.response?.data?.error?.message || 'Could not verify storage path permissions',
        variant: 'error',
      })
    } finally {
      setMountingStorage(false)
    }
  }

  // Save Redundancy Configuration
  const handleSaveRedundancy = async () => {
    setSavingRedundancy(true)
    try {
      await apiClient.put('/admin/storage/redundancy', {
        primaryPath: primaryPath.trim(),
        secondaryPath: secondaryPath.trim(),
        failoverEnabled,
        autoMirrorEnabled,
        warnThresholdPercent: Number(warnThreshold),
      })

      setSavedRedundancy({
        primaryPath,
        secondaryPath,
        failoverEnabled,
        autoMirrorEnabled,
        warnThreshold,
      })

      addToast({
        title: 'Redundancy Settings Saved',
        message: 'Primary/Secondary failover and mirror policies saved to database.',
        variant: 'success',
      })
    } catch (err: any) {
      addToast({
        title: 'Save Failed',
        message: err.response?.data?.error?.message || 'Could not update redundancy settings',
        variant: 'error',
      })
    } finally {
      setSavingRedundancy(false)
    }
  }

  if (isLoading || !config) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        <PageHeader
          eyebrow="Mission Administration"
          title="System & Storage Settings"
          description="Physical storage mount parameters, ISRO naming conventions, upload quotas, and security caps."
        />
        <div className="h-64 rounded-xl border border-border-subtle bg-card p-10 flex items-center justify-center">
          <RefreshCw size={24} className="animate-spin text-accent-light" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-subtle pb-5">
        <PageHeader
          eyebrow="Mission Administration"
          title="System & Storage Configuration"
          description="Manage physical HDD/SSD mount points, failover redundancy, ISRO SPOA naming policies, and security limits."
        />

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => setIsWizardOpen(true)}
            className="shadow-sm"
          >
            <span>⚡ Launch Setup Wizard</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={checkingStorage}
            onClick={() => {
              refetch()
              fetchStorageData()
            }}
          >
            <RefreshCw size={14} className={checkingStorage ? 'animate-spin' : ''} />
            <span>Refresh Settings</span>
          </Button>
        </div>
      </div>

      {/* SECTION 1: DETECTED HOST VOLUMES & PHYSICAL DISKS */}
      <div className="rounded-xl border border-border-default bg-card p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-border-subtle/80 pb-3">
          <div className="flex items-center gap-2.5">
            <HardDrive size={18} className="text-text-primary" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Detected Host Physical Volumes ({availableDrives.length})
            </h3>
          </div>
          <span className="text-[11px] text-text-dim">Assign Primary or Secondary Backup with 1-click</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {availableDrives.map((d) => {
            const isPrimary = primaryPath.startsWith(d.mountPoint)
            const isSecondary = secondaryPath.startsWith(d.mountPoint)
            return (
              <div
                key={d.mountPoint}
                className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                  isPrimary
                    ? 'border-accent/60 bg-accent/[0.07] shadow-sm'
                    : isSecondary
                      ? 'border-purple-400/40 bg-purple-400/[0.05]'
                      : 'border-border-subtle bg-[#060c18]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardDrive
                        size={16}
                        className={isPrimary ? 'text-accent-light' : isSecondary ? 'text-purple-300' : 'text-text-dim'}
                      />
                      <span className="num text-xs font-bold text-white">{d.mountPoint}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {isPrimary && (
                        <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold text-accent-light border border-accent/30">
                          PRIMARY
                        </span>
                      )}
                      {isSecondary && (
                        <span className="rounded bg-purple-400/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-300 border border-purple-400/30">
                          BACKUP
                        </span>
                      )}
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                          d.status === 'HEALTHY'
                            ? 'bg-nominal/15 text-nominal'
                            : d.status === 'WARNING'
                              ? 'bg-warning/15 text-warning'
                              : 'bg-critical/15 text-critical'
                        }`}
                      >
                        {d.usedPercent}%
                      </span>
                    </div>
                  </div>

                  {/* Capacity Bar */}
                  <div className="mt-3 space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-border-subtle overflow-hidden">
                      <div
                        className={`h-full ${
                          d.status === 'HEALTHY'
                            ? 'bg-nominal'
                            : d.status === 'WARNING'
                              ? 'bg-warning'
                              : 'bg-critical'
                        }`}
                        style={{ width: `${d.usedPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-text-dim num">
                      <span>Free: {formatFileSize(d.freeBytes)}</span>
                      <span>Total: {formatFileSize(d.totalBytes)}</span>
                    </div>
                  </div>
                </div>

                {/* Drive Allocation Action Buttons (Clean Grey Neutral Style) */}
                <div className="mt-3 pt-2.5 border-t border-border-subtle/60 flex items-center gap-2">
                  {!isPrimary && (
                    <button
                      type="button"
                      onClick={() => handleInitiatePrimarySwitch(d)}
                      className="flex-1 py-1.5 px-2 rounded-lg border border-border-default bg-[#0c1424] text-xs font-semibold text-text-primary hover:border-accent hover:text-white hover:bg-card-hover transition-all text-center"
                    >
                      ★ Set as Primary
                    </button>
                  )}
                  {!isSecondary && !isPrimary && (
                    <button
                      type="button"
                      onClick={() => handleSetSecondary(d)}
                      className="flex-1 py-1.5 px-2 rounded-lg border border-border-default bg-[#0c1424] text-xs font-semibold text-text-secondary hover:border-purple-400 hover:text-purple-300 hover:bg-card-hover transition-all text-center"
                    >
                      🛡️ Set Secondary
                    </button>
                  )}
                  {isSecondary && (
                    <button
                      type="button"
                      onClick={handleRemoveSecondary}
                      className="flex-1 py-1.5 px-2 rounded-lg border border-border-default bg-[#0c1424] text-xs font-semibold text-text-muted hover:border-critical/50 hover:text-critical hover:bg-critical/10 transition-all flex items-center justify-center gap-1.5"
                      title="Remove this drive from backup redundancy"
                    >
                      <Trash2 size={12} />
                      <span>Remove Backup</span>
                    </button>
                  )}
                  {isPrimary && (
                    <span className="text-[11px] font-bold text-nominal flex items-center gap-1.5 py-1">
                      <Check size={13} /> Active Primary Ingest Target
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* SECTION 2: PRIMARY MOUNT & REDUNDANCY FAILOVER CONFIG */}
      <div className="rounded-xl border border-border-default bg-card p-5 space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border-subtle/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-text-primary border border-border-default">
              <Layers size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Storage Mount & Redundancy Failover Architecture</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    storageStatus?.mounted
                      ? 'bg-nominal/15 text-nominal border border-nominal/30'
                      : 'bg-critical/15 text-critical border border-critical/30'
                  }`}
                >
                  {storageStatus?.mounted ? (
                    <>
                      <CheckCircle2 size={11} />
                      <span>Online & Mounted</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={11} />
                      <span>Requires Mount</span>
                    </>
                  )}
                </span>
              </h3>
              <p className="text-xs text-text-secondary">
                Configures primary RAID volume, secondary mirror backup, and automatic failover thresholds.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sync & Verify Directories (Clearer name for Re-mount) */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={mountingStorage || !primaryPath.trim()}
              onClick={handleSyncDirectories}
              title="Verifies disk write access and ensures all 7 departmental folders exist"
            >
              <Zap size={13} />
              <span>{mountingStorage ? 'Verifying Folders…' : 'Sync & Verify Directories'}</span>
            </Button>

            {/* Save Redundancy Config (Dynamic Highlight on Change) */}
            <Button
              type="button"
              variant={isRedundancyDirty ? 'primary' : 'outline'}
              size="sm"
              disabled={!isRedundancyDirty || savingRedundancy}
              onClick={handleSaveRedundancy}
              className={isRedundancyDirty ? 'shadow-md shadow-accent/25' : 'opacity-70'}
            >
              <Save size={13} />
              <span>{savingRedundancy ? 'Saving…' : isRedundancyDirty ? '● Save Changes' : 'Saved'}</span>
            </Button>
          </div>
        </div>

        {/* Informative explanation banner about Directory Sync & Mount */}
        <div className="flex items-start gap-2.5 rounded-lg border border-border-subtle bg-[#060c18] p-3 text-xs text-text-secondary">
          <Info size={16} className="text-accent-light shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-white">What is Directory Sync & Verification?</strong> This operation verifies physical disk write permissions and ensures all 7 standard ISRO departmental subdirectories (<code className="num text-accent-light">/TTC</code>, <code className="num text-accent-light">/FDD</code>, <code className="num text-accent-light">/MOX</code>, <code className="num text-accent-light">/NETRA</code>, <code className="num text-accent-light">/GSO</code>, <code className="num text-accent-light">/.chunks</code>, <code className="num text-accent-light">/.trash</code>) exist on disk without modifying or overwriting existing datasets.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1.5">
              Primary Storage Mount Root Path *
            </label>
            <input
              type="text"
              value={primaryPath}
              onChange={(e) => setPrimaryPath(e.target.value)}
              placeholder="e.g. D:\istrac_storage"
              className="num w-full rounded-lg border border-border-default bg-[#09101f] px-3 py-2 text-xs text-accent-light outline-none focus:border-accent"
            />
            <p className="mt-1 text-[11px] text-text-dim">
              Main physical target directory where active telemetry and daily reports are permanently stored.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-text-primary">
                Secondary / Backup Storage Mount Path (Optional)
              </label>
              {secondaryPath && (
                <button
                  type="button"
                  onClick={handleRemoveSecondary}
                  className="text-[11px] font-bold text-text-muted hover:text-critical transition-colors flex items-center gap-1"
                >
                  <X size={12} />
                  <span>Unlink Backup</span>
                </button>
              )}
            </div>
            <input
              type="text"
              value={secondaryPath}
              onChange={(e) => setSecondaryPath(e.target.value)}
              placeholder="e.g. C:\istrac_backup_storage"
              className="num w-full rounded-lg border border-border-default bg-[#09101f] px-3 py-2 text-xs text-purple-300 outline-none focus:border-accent"
            />
            <p className="mt-1 text-[11px] text-text-dim">
              {secondaryPath
                ? 'Redundant array volume used for mirroring and failover when primary is full.'
                : 'No backup assigned. Ingest operates on single primary storage array.'}
            </p>
          </div>
        </div>

        {/* Failover & Mirroring Policies */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border-subtle">
          <label className="flex flex-col justify-between p-3 rounded-lg border border-border-subtle bg-[#060c18] cursor-pointer select-none">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
              <input
                type="checkbox"
                checked={failoverEnabled}
                onChange={(e) => setFailoverEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-border-default bg-card text-accent focus:ring-accent"
              />
              <span>Auto-Failover to Secondary</span>
            </div>
            <p className="text-[10px] text-text-dim mt-2 leading-relaxed">
              When primary volume reaches high watermark, new file ingests automatically route to secondary backup.
            </p>
          </label>

          <label className="flex flex-col justify-between p-3 rounded-lg border border-border-subtle bg-[#060c18] cursor-pointer select-none">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
              <input
                type="checkbox"
                checked={autoMirrorEnabled}
                onChange={(e) => setAutoMirrorEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-border-default bg-card text-accent focus:ring-accent"
              />
              <span>Simultaneous Mirroring (RAID-1)</span>
            </div>
            <p className="text-[10px] text-text-dim mt-2 leading-relaxed">
              Ingested files are written concurrently to both primary and backup storage for instant disaster recovery.
            </p>
          </label>

          <div className="flex flex-col justify-between p-3 rounded-lg border border-border-subtle bg-[#060c18]">
            <div>
              <label className="block text-[11px] font-bold text-text-dim uppercase tracking-wider mb-1">
                Capacity Alert Threshold (%)
              </label>
              <input
                type="number"
                value={warnThreshold}
                onChange={(e) => setWarnThreshold(Number(e.target.value))}
                className="num w-full rounded-lg border border-border-default bg-card px-2.5 py-1 text-xs text-white outline-none focus:border-accent"
              />
            </div>
            <p className="text-[10px] text-text-dim mt-1">
              Triggers visual high-watermark warning telemetry when primary drive exceeds this percentage.
            </p>
          </div>
        </div>

        {/* Directory Hierarchy Breakdown */}
        <div className="rounded-xl border border-border-subtle bg-[#060c18] p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-text-dim uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <FolderTree size={14} className="text-text-primary" />
              <span>Department Storage Hierarchy</span>
            </span>
            <span className="num text-nominal text-[10px]">7 Managed Directories</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
            <div className="flex items-center justify-between p-2 rounded bg-card border border-border-subtle">
              <code className="num text-accent-light font-bold">/TTC</code>
              <span className="text-[10px] text-text-dim">Telemetry</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-card border border-border-subtle">
              <code className="num text-accent-light font-bold">/FDD</code>
              <span className="text-[10px] text-text-dim">Flight Dyn</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-card border border-border-subtle">
              <code className="num text-accent-light font-bold">/MOX</code>
              <span className="text-[10px] text-text-dim">Operations</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-card border border-border-subtle">
              <code className="num text-accent-light font-bold">/NETRA</code>
              <span className="text-[10px] text-text-dim">SSA/SSA</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-card border border-border-subtle">
              <code className="num text-accent-light font-bold">/GSO</code>
              <span className="text-[10px] text-text-dim">GEO Ops</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-card border border-border-subtle">
              <code className="num text-accent-light font-bold">/.chunks</code>
              <span className="text-[10px] text-text-dim">&gt;10MB Chunk</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-card border border-border-subtle">
              <code className="num text-accent-light font-bold">/.trash</code>
              <span className="text-[10px] text-text-dim">Staging</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: GROUND STATION & FACILITY NODE */}
      <div className="rounded-xl border border-border-default bg-card p-5 space-y-4 shadow-sm">
        <div className="flex items-center gap-3 border-b border-border-subtle/80 pb-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-text-primary border border-border-default">
            <Building2 size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              Ground Station Hub & Facility Coordinates
            </h3>
            <p className="text-xs text-text-secondary">
              Telemetry tracking station metadata and operational center identifier.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-text-primary">
                Station Facility Complex
              </label>
              <span className="text-[10px] text-text-dim">Headquarters Master Node</span>
            </div>
            <input
              type="text"
              disabled
              value="ISTRAC Bengaluru Headquarters & MOX Complex"
              className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-text-primary font-semibold cursor-not-allowed"
            />
            <p className="mt-1 text-[11px] text-text-dim">
              Designated command hub coordinating telemetry passes across ISRO deep-space and LEO ground networks.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-text-primary">
                Ground Coordinates
              </label>
              <span className="text-[10px] text-text-dim">Antenna Site</span>
            </div>
            <input
              type="text"
              disabled
              value="13.03° N, 77.51° E"
              className="num w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-accent-light font-bold cursor-not-allowed"
            />
            <p className="mt-1 text-[11px] text-text-dim">
              Calibrated coordinates for antenna azimuth/elevation look angles.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 4: UPLOAD LIMITS & SECURITY POLICIES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Panel A: Upload & Ingest Limits */}
        <div className="rounded-xl border border-border-default bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-border-subtle/80 pb-3">
            <div className="flex items-center gap-2.5">
              <FileCode size={16} className="text-text-primary" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Upload & Ingest Quotas
              </h3>
            </div>
            <span className="text-[10px] text-text-dim">Gateway Validation</span>
          </div>

          {/* Info Callout */}
          <div className="rounded-lg border border-border-subtle bg-[#060c18] p-2.5 text-[11px] text-text-dim leading-relaxed flex items-start gap-2">
            <Info size={14} className="text-text-secondary shrink-0 mt-0.5" />
            <span>
              All incoming telemetry files are validated against the extension whitelist and size caps before RAID disk ingestion.
            </span>
          </div>

          <div className="space-y-4">
            <ConfigField
              settingKey="maxUploadSizeBytes"
              label="Single File Upload Limit (Bytes)"
              type="number"
              value={String(config.maxUploadSizeBytes || 524288000)}
              helpText="Default: 524,288,000 bytes (500 MB). Large datasets (>10MB) stream in resilient chunks automatically."
            />

            <ConfigField
              settingKey="allowedExtensions"
              label="Allowed Ingest File Extensions"
              value={config.allowedExtensions ? config.allowedExtensions.join(',') : 'pdf,docx,xlsx,csv,txt,dat,json'}
              helpText="Comma-separated format extensions permitted by the parser (disallowed files are blocked)."
            />
          </div>
        </div>

        {/* Panel B: Security & Multi-RBAC Caps */}
        <div className="rounded-xl border border-border-default bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-border-subtle/80 pb-3">
            <div className="flex items-center gap-2.5">
              <Shield size={16} className="text-text-primary" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Security & Rate Limits
              </h3>
            </div>
            <span className="text-[10px] text-text-dim">Level 4 Protection</span>
          </div>

          {/* Info Callout */}
          <div className="rounded-lg border border-border-subtle bg-[#060c18] p-2.5 text-[11px] text-text-dim leading-relaxed flex items-start gap-2">
            <Info size={14} className="text-text-secondary shrink-0 mt-0.5" />
            <span>
              Configures automated ClamAV payload inspection and defends ground station bandwidth against bulk automated scraping.
            </span>
          </div>

          <div className="space-y-4">
            <ConfigToggle
              settingKey="virusScanEnabled"
              label="ClamAV Virus & Payload Scan on Ingest"
              checked={config.virusScanEnabled}
              helpText="Performs automatic payload inspection prior to RAID storage commitment."
            />

            <ConfigField
              settingKey="downloadRateLimitPerHour"
              label="Download Rate Limit (Per User / Hour)"
              type="number"
              value={String(config.downloadRateLimitPerHour || 1000)}
              helpText="Rate threshold preventing automated bulk downloads of mission archives (default: 1,000 req/hr)."
            />

            <ConfigField
              settingKey="guestAccessExpiryDays"
              label="Guest Shared Link Expiry (Days)"
              type="number"
              value={String(config.guestAccessExpiryDays || 7)}
              helpText="Maximum duration in days before temporary guest shared read tokens expire automatically."
            />
          </div>
        </div>
      </div>

      {/* MODAL: PRIMARY STORAGE MIGRATION WARNING & COPY CONFIRMATION */}
      <Modal
        isOpen={isMigrationModalOpen}
        onClose={() => setIsMigrationModalOpen(false)}
        title="Switch Primary Storage Volume & Data Migration"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-warning/40 bg-gradient-to-r from-warning/15 via-[#1c1409] to-warning/10 p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/20 text-warning">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Primary Storage Target Modification Warning
                </h4>
                <p className="text-xs text-text-secondary">
                  You are changing the primary physical storage array. Future mission uploads will be committed to the new target.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border-subtle bg-[#060c18] p-3 text-xs">
            <div className="flex justify-between py-1 border-b border-border-subtle/50">
              <span className="text-text-dim">Current Primary Volume:</span>
              <code className="num font-bold text-text-primary">{primaryPath}</code>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-text-dim">New Primary Target:</span>
              <code className="num font-bold text-accent-light">{pendingNewPrimary}</code>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none rounded-xl border border-accent/40 bg-accent/10 p-3.5 text-xs text-white">
            <input
              type="checkbox"
              checked={copyExistingData}
              onChange={(e) => setCopyExistingData(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border-default bg-card text-accent focus:ring-accent"
            />
            <div>
              <span className="font-bold flex items-center gap-1.5 text-accent-light">
                <Copy size={13} />
                <span>Automatically copy existing telemetry files and folders to new volume (Recommended)</span>
              </span>
              <p className="text-[11px] text-text-dim mt-0.5">
                Recursively copies all departmental directories (/TTC, /FDD, /MOX, /NETRA, /GSO) and syncs database pointers.
              </p>
            </div>
          </label>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsMigrationModalOpen(false)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={migrating}
              onClick={handleExecuteMigration}
              className="shadow-lg shadow-accent/25"
            >
              <ArrowRightLeft size={14} />
              <span>{migrating ? 'Migrating Data…' : 'Confirm & Switch Primary Storage'}</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* Setup & Storage Mount Wizard Modal */}
      <SetupWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onComplete={() => {
          refetch()
          fetchStorageData()
        }}
      />
    </div>
  )
}
