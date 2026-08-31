import { useState, useEffect } from "react"
import {
  HardDrive,
  CheckCircle,
  Database,
  RefreshCw,
  Layers,
  ArrowRight,
  Shield,
  HelpCircle,
  Zap,
} from "lucide-react"
import { apiClient } from "../api/client"
import { PageHeader, Button } from "../components"
import { useToastStore } from "../store/toastStore"
import { formatFileSize } from "../lib/formatFileSize"

interface StorageStatus {
  mounted: boolean
  mountPath: string
  writable: boolean
  status: "ONLINE" | "DEGRADED" | "OFFLINE"
}

interface DriveItem {
  mountPoint: string
  name: string
  totalBytes: number
  freeBytes: number
  usedBytes: number
  usedPercent: number
  fsType: string
  status: "HEALTHY" | "WARNING" | "CRITICAL"
}

export function SystemConfigPanel() {
  const addToast = useToastStore((s) => s.addToast)

  // Physical Mount State
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null)
  const [checkingStorage, setCheckingStorage] = useState(false)
  const [syncingMount, setSyncingMount] = useState(false)
  const [primaryPath, setPrimaryPath] = useState("/mnt/istrac_storage")
  const [secondaryPath, setSecondaryPath] = useState("")

  const [savedRedundancy, setSavedRedundancy] = useState({
    primaryPath: "/mnt/istrac_storage",
    secondaryPath: "",
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
  const [pendingNewPrimary, setPendingNewPrimary] = useState("")
  const [copyExistingData, setCopyExistingData] = useState(true)
  const [migrating, setMigrating] = useState(false)

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
        apiClient.get("/admin/storage/status").catch(() => null),
        apiClient.get("/admin/storage/drives").catch(() => null),
        apiClient.get("/admin/storage/redundancy").catch(() => null),
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
        const pPath = r.primaryPath || "/mnt/istrac_storage"
        const sPath = r.secondaryPath || ""
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

  const handleSyncMount = async () => {
    setSyncingMount(true)
    try {
      const res = await apiClient.post("/admin/storage/initialize-mount", {
        customPath: primaryPath.trim() || undefined,
      })
      if (res.data?.data?.writable) {
        addToast({
          message: `Storage mount verified & synced at: ${res.data.data.path}`,
          variant: "success",
        })
      } else {
        addToast({
          message: "Warning: Directory created but write probe failed.",
          variant: "warning",
        })
      }
      fetchStorageData()
    } catch (err: any) {
      addToast({
        message:
          err.response?.data?.message ||
          "Failed to verify/initialize storage mount. Check server directory permissions.",
        variant: "error",
      })
    } finally {
      setSyncingMount(false)
    }
  }

  const handleSaveRedundancy = async () => {
    setSavingRedundancy(true)
    try {
      await apiClient.put("/admin/storage/redundancy", {
        primaryPath,
        secondaryPath: secondaryPath.trim() || null,
        failoverEnabled,
        autoMirrorEnabled,
        warnThresholdPercent: Number(warnThreshold),
      })
      setSavedRedundancy({
        primaryPath,
        secondaryPath,
        failoverEnabled,
        autoMirrorEnabled,
        warnThreshold: Number(warnThreshold),
      })
      addToast({
        message: "Storage redundancy & failover architecture updated",
        variant: "success",
      })
      fetchStorageData()
    } catch (err: any) {
      addToast({
        message: err.response?.data?.message || "Failed to update storage redundancy",
        variant: "error",
      })
    } finally {
      setSavingRedundancy(false)
    }
  }

  const handleInitiatePrimarySwitch = (drive: DriveItem) => {
    const candidatePath = drive.mountPoint === "/" ? "/istrac_storage" : `${drive.mountPoint}/istrac_storage`
    setPendingNewPrimary(candidatePath)
    setIsMigrationModalOpen(true)
  }

  const handleSetSecondaryDrive = (drive: DriveItem) => {
    const targetPath = drive.mountPoint === "/" ? "/istrac_backup_storage" : `${drive.mountPoint}/istrac_backup_storage`
    setSecondaryPath(targetPath)
    addToast({
      message: `Assigned secondary backup mount target: ${targetPath}. Click "Save Architecture" below to apply.`,
      variant: "info",
    })
  }

  const handleExecuteMigration = async () => {
    setMigrating(true)
    try {
      const res = await apiClient.post("/admin/storage/migrate", {
        newPrimaryPath: pendingNewPrimary,
        oldPrimaryPath: primaryPath,
        copyFiles: copyExistingData,
      })
      addToast({
        message: `Primary storage successfully migrated to: ${res.data.data.newPrimaryPath}`,
        variant: "success",
      })
      setIsMigrationModalOpen(false)
      fetchStorageData()
    } catch (err: any) {
      addToast({
        message: err.response?.data?.message || "Failed to migrate primary storage drive",
        variant: "error",
      })
    } finally {
      setMigrating(false)
    }
  }

  // Find exact primary drive by longest prefix match so root '/' doesn't falsely match '/mnt'
  const matchingPrimaryDrive = availableDrives
    .filter((d) => primaryPath === d.mountPoint || primaryPath.startsWith(d.mountPoint === "/" ? "/" : `${d.mountPoint}/`))
    .sort((a, b) => b.mountPoint.length - a.mountPoint.length)[0]

  const matchingSecondaryDrive = secondaryPath
    ? availableDrives
        .filter((d) => secondaryPath === d.mountPoint || secondaryPath.startsWith(d.mountPoint === "/" ? "/" : `${d.mountPoint}/`))
        .sort((a, b) => b.mountPoint.length - a.mountPoint.length)[0]
    : null

  return (
    <div className="w-full space-y-6 pb-16">
      <PageHeader
        eyebrow="SYSTEM CONFIGURATION"
        title="Physical Storage Mount & RAID Redundancy"
        description="Monitor physical drive mounts, manage primary ingest targets, configure RAID-1 mirroring, and set automated failover thresholds."
        meta={
          <div className="flex items-center gap-2 pt-1">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                storageStatus?.mounted && storageStatus.writable
                  ? "bg-nominal/15 text-nominal border border-nominal/30"
                  : "bg-critical/15 text-critical border border-critical/30"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  storageStatus?.mounted && storageStatus.writable ? "bg-nominal" : "bg-critical"
                }`}
              />
              <span>
                {storageStatus?.mounted && storageStatus.writable
                  ? "Physical Ingest Mount Online"
                  : "Storage Mount Warning"}
              </span>
            </span>
            <span className="num text-xs text-text-dim">
              · {availableDrives.length} Host Volumes Detected
            </span>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchStorageData}
              disabled={checkingStorage}
              className="gap-1.5"
            >
              <RefreshCw size={13} className={checkingStorage ? "animate-spin" : ""} />
              <span>Refresh Drives</span>
            </Button>
          </div>
        }
      />

      {/* SECTION 1: DETECTED HOST VOLUMES & PHYSICAL DISKS */}
      <div className="rounded-xl border border-border-default bg-card p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-border-subtle/80 pb-3">
          <div className="flex items-center gap-2.5">
            <HardDrive size={18} className="text-text-primary" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Detected Host Physical Volumes ({availableDrives.length})
            </h3>
          </div>
          <span className="text-[11px] text-text-dim">Assign Primary Ingest or Secondary Mirror Backup with 1-click</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {availableDrives.map((d) => {
            const isPrimary = matchingPrimaryDrive?.mountPoint === d.mountPoint
            const isSecondary = matchingSecondaryDrive?.mountPoint === d.mountPoint

            return (
              <div
                key={d.mountPoint}
                className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                  isPrimary
                    ? "border-accent/60 bg-accent/[0.07] shadow-sm ring-1 ring-accent/30"
                    : isSecondary
                      ? "border-purple-400/40 bg-purple-400/[0.05] ring-1 ring-purple-400/30"
                      : "border-border-subtle bg-[#060c18]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardDrive
                        size={16}
                        className={isPrimary ? "text-accent-light" : isSecondary ? "text-purple-300" : "text-text-dim"}
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
                          d.status === "HEALTHY"
                            ? "bg-nominal/15 text-nominal"
                            : d.status === "WARNING"
                              ? "bg-warning/15 text-warning"
                              : "bg-critical/15 text-critical"
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
                          d.status === "HEALTHY"
                            ? "bg-nominal"
                            : d.status === "WARNING"
                              ? "bg-warning"
                              : "bg-critical"
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

                {/* Drive Allocation Action Buttons */}
                <div className="mt-3 pt-2.5 border-t border-border-subtle/60 flex items-center gap-2">
                  {!isPrimary && (
                    <button
                      type="button"
                      onClick={() => handleInitiatePrimarySwitch(d)}
                      className="flex-1 py-1.5 px-2 rounded-lg border border-border-default bg-[#0c1424] text-xs font-semibold text-text-primary hover:border-accent hover:text-white hover:bg-card-hover transition-all text-center cursor-pointer"
                    >
                      ★ Set as Primary
                    </button>
                  )}
                  {!isSecondary && !isPrimary && (
                    <button
                      type="button"
                      onClick={() => handleSetSecondaryDrive(d)}
                      className="flex-1 py-1.5 px-2 rounded-lg border border-border-default bg-[#0c1424] text-xs font-semibold text-purple-300 hover:border-purple-400 hover:text-white hover:bg-card-hover transition-all text-center cursor-pointer"
                    >
                      🛡 Set Secondary
                    </button>
                  )}
                  {isPrimary && (
                    <span className="flex-1 text-[11px] text-accent-light font-semibold py-1 text-center flex items-center justify-center gap-1">
                      <CheckCircle size={12} /> Active Primary Ingest Target
                    </span>
                  )}
                  {isSecondary && (
                    <span className="flex-1 text-[11px] text-purple-300 font-semibold py-1 text-center flex items-center justify-center gap-1">
                      <Shield size={12} /> Active Mirror Backup Target
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* SECTION 2: STORAGE REDUNDANCY & FAILOVER ARCHITECTURE */}
      <div className="rounded-xl border border-border-default bg-card p-5 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border-subtle/80 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Layers size={18} className="text-accent-light" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Storage Mount & Redundancy Failover Architecture
              </h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  storageStatus?.mounted && storageStatus.writable
                    ? "bg-nominal/15 text-nominal border border-nominal/30"
                    : "bg-warning/15 text-warning border border-warning/30"
                }`}
              >
                {storageStatus?.mounted && storageStatus.writable ? "ONLINE & MOUNTED" : "UNMOUNTED / PENDING"}
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              Configures primary RAID volume, secondary mirror backup, and automatic failover thresholds.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSyncMount}
              disabled={syncingMount}
              className="gap-1.5"
            >
              <Zap size={13} className={syncingMount ? "animate-spin text-accent-light" : "text-accent-light"} />
              <span>{syncingMount ? "Syncing Directories..." : "SYNC & VERIFY DIRECTORIES"}</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveRedundancy}
              disabled={savingRedundancy || !isRedundancyDirty}
              className="gap-1.5"
            >
              <span>{savingRedundancy ? "Saving..." : isRedundancyDirty ? "SAVE ARCHITECTURE" : "SAVED"}</span>
            </Button>
          </div>
        </div>

        {/* Explain directory sync */}
        <div className="p-3.5 rounded-lg border border-accent/20 bg-accent/[0.04] flex items-start gap-3">
          <HelpCircle size={16} className="text-accent-light shrink-0 mt-0.5" />
          <div className="text-xs text-text-secondary leading-relaxed">
            <span className="font-bold text-text-primary">What is Directory Sync & Verification?</span> This operation verifies physical disk write permissions and ensures all 7 standard ISRO departmental subdirectories (<code className="text-accent-light font-mono text-[11px]">/TTC</code>, <code className="text-accent-light font-mono text-[11px]">/FDD</code>, <code className="text-accent-light font-mono text-[11px]">/MOX</code>, <code className="text-accent-light font-mono text-[11px]">/NETRA</code>, <code className="text-accent-light font-mono text-[11px]">/GSO</code>, <code className="text-accent-light font-mono text-[11px]">/.chunks</code>, <code className="text-accent-light font-mono text-[11px]">/.trash</code>) exist on disk without modifying or overwriting existing datasets.
          </div>
        </div>

        {/* Form Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Primary Storage Mount Path */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-primary flex items-center justify-between">
              <span>Primary Storage Mount Root Path *</span>
              <span className="num text-[10px] text-accent-light font-normal">Active Ingest Drive</span>
            </label>
            <input
              type="text"
              value={primaryPath}
              onChange={(e) => setPrimaryPath(e.target.value)}
              placeholder="/mnt/istrac_storage"
              className="w-full rounded-lg border border-border-default bg-[#070c18] px-3 py-2 text-xs font-mono text-white placeholder:text-text-dim focus:border-accent focus:outline-none"
            />
            <p className="text-[11px] text-text-dim">
              Main physical target directory where active telemetry and daily reports are permanently stored.
            </p>
          </div>

          {/* Secondary Backup Mount Path */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-primary flex items-center justify-between">
              <span>Secondary / Backup Storage Mount Path (Optional)</span>
              <span className="num text-[10px] text-purple-300 font-normal">Disaster Recovery Target</span>
            </label>
            <input
              type="text"
              value={secondaryPath}
              onChange={(e) => setSecondaryPath(e.target.value)}
              placeholder="e.g. /media/istrac_backup_storage"
              className="w-full rounded-lg border border-border-default bg-[#070c18] px-3 py-2 text-xs font-mono text-white placeholder:text-text-dim focus:border-purple-400 focus:outline-none"
            />
            <p className="text-[11px] text-text-dim">
              {secondaryPath
                ? "Concurrent RAID-1 mirror or automatic failover destination."
                : "No backup assigned. Ingest operates on single primary storage array."}
            </p>
          </div>
        </div>

        {/* Toggles & Watermark Setting */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <label className="flex items-start gap-3 p-3 rounded-lg border border-border-subtle bg-[#070c18] cursor-pointer hover:border-border-default transition-all">
            <input
              type="checkbox"
              checked={failoverEnabled}
              onChange={(e) => setFailoverEnabled(e.target.checked)}
              className="mt-0.5 rounded border-border-default text-accent focus:ring-accent"
            />
            <div className="space-y-1">
              <span className="text-xs font-bold text-white block">Auto-Failover to Secondary</span>
              <span className="text-[10px] text-text-dim block leading-relaxed">
                When primary volume reaches high watermark, new file ingests automatically route to secondary backup.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-lg border border-border-subtle bg-[#070c18] cursor-pointer hover:border-border-default transition-all">
            <input
              type="checkbox"
              checked={autoMirrorEnabled}
              onChange={(e) => setAutoMirrorEnabled(e.target.checked)}
              className="mt-0.5 rounded border-border-default text-purple-400 focus:ring-purple-400"
            />
            <div className="space-y-1">
              <span className="text-xs font-bold text-white block">Simultaneous Mirroring (RAID-1)</span>
              <span className="text-[10px] text-text-dim block leading-relaxed">
                Ingested files are written concurrently to both primary and backup storage for instant disaster recovery.
              </span>
            </div>
          </label>

          <div className="p-3 rounded-lg border border-border-subtle bg-[#070c18] space-y-1.5">
            <label className="text-xs font-bold text-white block">
              Capacity Alert Threshold (%)
            </label>
            <input
              type="number"
              min={50}
              max={98}
              value={warnThreshold}
              onChange={(e) => setWarnThreshold(Number(e.target.value))}
              className="w-full rounded border border-border-default bg-[#0b1220] px-2.5 py-1 text-xs font-mono text-white focus:border-accent focus:outline-none"
            />
            <span className="text-[10px] text-text-dim block leading-relaxed">
              Triggers visual high-watermark warning telemetry when primary drive exceeds this percentage.
            </span>
          </div>
        </div>
      </div>

      {/* MIGRATION MODAL */}
      {isMigrationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-page/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-border-default bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent-light border border-accent/30">
                <Database size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Migrate Primary Storage Mount</h3>
                <p className="text-xs text-text-dim">Switch default active ingest destination drive</p>
              </div>
            </div>

            <div className="space-y-3 p-3.5 rounded-xl border border-border-subtle bg-[#060c18] text-xs">
              <div className="flex justify-between items-center py-1 border-b border-border-subtle/60">
                <span className="text-text-dim">Current Primary Mount:</span>
                <span className="font-mono text-white font-bold">{primaryPath}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-accent-light font-bold">New Target Mount:</span>
                <span className="font-mono text-accent-light font-bold">{pendingNewPrimary}</span>
              </div>
            </div>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-border-subtle bg-surface/50 cursor-pointer">
              <input
                type="checkbox"
                checked={copyExistingData}
                onChange={(e) => setCopyExistingData(e.target.checked)}
                className="mt-0.5 rounded border-border-default text-accent focus:ring-accent"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white block">Copy Existing Files & Telemetry Datasets</span>
                <span className="text-[11px] text-text-dim block">
                  Automatically clones all existing telemetry folders, mission reports, and chunk directories to the new volume.
                </span>
              </div>
            </label>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsMigrationModalOpen(false)}
                disabled={migrating}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleExecuteMigration}
                disabled={migrating}
                className="gap-1.5 shadow-lg shadow-accent/20"
              >
                <ArrowRight size={13} className={migrating ? "animate-pulse" : ""} />
                <span>{migrating ? "Migrating Data..." : "Confirm & Switch Primary Drive"}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
