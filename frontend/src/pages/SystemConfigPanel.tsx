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
  UploadCloud,
  FileCode,
  Sliders,
  Plus,
  X,
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

  // Double Check Confirmation Modal States
  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false)
  const [isConfirmSecondaryOpen, setIsConfirmSecondaryOpen] = useState(false)
  const [pendingSecondaryDrive, setPendingSecondaryDrive] = useState<DriveItem | null>(null)

  // Operational Ingest & Size Limits State
  const [maxUploadMB, setMaxUploadMB] = useState(500)
  const [allowedExtensions, setAllowedExtensions] = useState<string[]>([
    'pdf', 'docx', 'xlsx', 'pptx', 'csv', 'txt', 'png', 'jpg', 'zip', 'bin', 'dat', 'fits', 'h5',
  ])
  const [downloadRateLimit, setDownloadRateLimit] = useState(100)
  const [virusScanEnabled, setVirusScanEnabled] = useState(false)
  const [savingIngestSettings, setSavingIngestSettings] = useState(false)
  const [newExtInput, setNewExtInput] = useState('')

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
      const [statusRes, drivesRes, redundancyRes, settingsRes] = await Promise.all([
        apiClient.get("/admin/storage/status").catch(() => null),
        apiClient.get("/admin/storage/drives").catch(() => null),
        apiClient.get("/admin/storage/redundancy").catch(() => null),
        apiClient.get("/admin/settings").catch(() => null),
      ])

      if (settingsRes?.data?.data) {
        const s = settingsRes.data.data
        if (s.maxUploadSizeBytes) {
          setMaxUploadMB(Math.round(s.maxUploadSizeBytes / (1024 * 1024)))
        }
        if (Array.isArray(s.allowedExtensions) && s.allowedExtensions.length > 0) {
          setAllowedExtensions(s.allowedExtensions)
        }
        if (s.downloadRateLimitPerHour) {
          setDownloadRateLimit(s.downloadRateLimitPerHour)
        }
        if (s.virusScanEnabled !== undefined) {
          setVirusScanEnabled(Boolean(s.virusScanEnabled))
        }
      }

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

  const handleExecuteSaveRedundancy = async () => {
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
      setIsConfirmSaveOpen(false)
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

  const handleSaveIngestSettings = async () => {
    setSavingIngestSettings(true)
    try {
      const bytes = maxUploadMB * 1024 * 1024
      await Promise.all([
        apiClient.put("/admin/settings/maxUploadSizeBytes", { value: bytes }),
        apiClient.put("/admin/settings/allowedExtensions", { value: allowedExtensions }),
        apiClient.put("/admin/settings/downloadRateLimitPerHour", { value: Number(downloadRateLimit) }),
        apiClient.put("/admin/settings/virusScanEnabled", { value: virusScanEnabled }),
      ])
      addToast({
        title: "Ingest Policy Saved",
        message: `Max upload size updated to ${maxUploadMB} MB (${bytes.toLocaleString()} bytes). Enforced across all upload channels.`,
        variant: "success",
      })
    } catch (err: any) {
      addToast({
        title: "Save Failed",
        message: err.response?.data?.error?.message || "Could not save ingest settings",
        variant: "error",
      })
    } finally {
      setSavingIngestSettings(false)
    }
  }

  const handleAddExtension = () => {
    const clean = newExtInput.trim().replace(/^\./, "").toLowerCase()
    if (clean && !allowedExtensions.includes(clean)) {
      setAllowedExtensions((prev) => [...prev, clean])
      setNewExtInput("")
    }
  }

  const handleRemoveExtension = (ext: string) => {
    setAllowedExtensions((prev) => prev.filter((e) => e !== ext))
  }

  const handleInitiatePrimarySwitch = (drive: DriveItem) => {
    const candidatePath = drive.mountPoint === "/" ? "/istrac_storage" : `${drive.mountPoint}/istrac_storage`
    setPendingNewPrimary(candidatePath)
    setIsMigrationModalOpen(true)
  }

  const handleInitiateSecondary = (drive: DriveItem) => {
    setPendingSecondaryDrive(drive)
    setIsConfirmSecondaryOpen(true)
  }

  const handleConfirmSecondary = () => {
    if (!pendingSecondaryDrive) return
    const drive = pendingSecondaryDrive
    const targetPath = drive.mountPoint === "/" ? "/istrac_backup_storage" : `${drive.mountPoint}/istrac_backup_storage`
    setSecondaryPath(targetPath)
    setIsConfirmSecondaryOpen(false)
    setPendingSecondaryDrive(null)
    addToast({
      message: `Assigned secondary backup mount target: ${targetPath}. Click "SAVE ARCHITECTURE" to commit.`,
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

      {/* ============================================================ */}
      {/* SECTION: OPERATIONAL FILE INGEST & SIZE LIMITS */}
      {/* ============================================================ */}
      <div className="rounded-2xl border border-accent/40 bg-gradient-to-br from-[#091326] via-[#070e1c] to-[#050a14] p-6 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/20 text-accent-light border border-accent/40 shadow-inner">
              <UploadCloud size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Operational File Ingest & Size Limits
                </h3>
                <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-[10px] font-bold text-accent-light border border-accent/30 font-mono">
                  ACTIVE POLICY
                </span>
              </div>
              <p className="text-xs text-text-dim mt-0.5">
                Configure global upload file size ceilings, allowed telemetry extensions, and throughput limits. Changes take effect immediately without restarting servers.
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveIngestSettings}
            disabled={savingIngestSettings}
            className="gap-2 shadow-lg shadow-accent/25 self-start sm:self-auto cursor-pointer"
          >
            <CheckCircle size={14} className={savingIngestSettings ? "animate-spin" : ""} />
            <span>{savingIngestSettings ? "Saving Settings…" : "Save Ingest Policy"}</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Col 1: Max Upload File Size */}
          <div className="lg:col-span-2 space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders size={13} className="text-accent-light" />
                Maximum Upload File Size (Per Payload)
              </label>
              <span className="font-mono text-xs font-bold text-accent-light bg-accent/15 px-2.5 py-1 rounded-lg border border-accent/30">
                {maxUploadMB} MB ({(maxUploadMB * 1024 * 1024).toLocaleString()} bytes)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-44">
                <input
                  type="number"
                  min="1"
                  max="10240"
                  value={maxUploadMB}
                  onChange={(e) => setMaxUploadMB(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded-xl border border-border-default bg-[#070c18] px-4 py-2.5 text-sm font-mono font-bold text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <span className="absolute right-3.5 top-2.5 font-mono text-xs text-text-dim">MB</span>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[50, 100, 250, 500, 1024, 2048].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setMaxUploadMB(preset)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-mono font-semibold transition-all cursor-pointer ${
                      maxUploadMB === preset
                        ? "bg-accent text-white shadow-md shadow-accent/30 border border-accent"
                        : "bg-white/5 text-text-secondary hover:bg-white/10 hover:text-white border border-white/10"
                    }`}
                  >
                    {preset >= 1024 ? `${preset / 1024} GB` : `${preset} MB`}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-text-dim leading-relaxed">
              Enforced on single-shot multipart uploads and multi-chunk telemetry ingests. Files exceeding this ceiling are rejected with a clear operational error before entering RAID storage.
            </p>
          </div>

          {/* Col 2: Download Rate Limit & Virus Scanning */}
          <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 flex flex-col justify-between">
            <div>
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider block mb-2">
                Download Rate Limit
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="10"
                  max="5000"
                  value={downloadRateLimit}
                  onChange={(e) => setDownloadRateLimit(Number(e.target.value) || 100)}
                  className="w-full rounded-xl border border-border-default bg-[#070c18] px-4 py-2 text-sm font-mono font-bold text-white focus:border-accent focus:outline-none"
                />
                <span className="absolute right-3.5 top-2 font-mono text-xs text-text-dim">req / hr</span>
              </div>
              <p className="text-[10px] text-text-dim mt-1.5">
                Throttles excessive burst downloads to protect station bandwidth.
              </p>
            </div>

            <div className="pt-2 border-t border-white/10">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={virusScanEnabled}
                  onChange={(e) => setVirusScanEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-border-default bg-card text-accent focus:ring-accent"
                />
                <span className="text-xs font-semibold text-white">Cryptographic Virus Scanning</span>
              </label>
              <p className="text-[10px] text-text-dim mt-0.5 pl-6.5">
                Scans uploaded binary payloads with ClamAV daemon.
              </p>
            </div>
          </div>
        </div>

        {/* Allowed Telemetry File Formats */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <FileCode size={13} className="text-nominal" />
                Permitted File Extensions & Telemetry Formats
              </h4>
              <p className="text-[11px] text-text-dim">
                Only files matching these formats will be admitted through the ingest pipeline.
              </p>
            </div>

            {/* Add Extension Inline Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="e.g. hdf5"
                value={newExtInput}
                onChange={(e) => setNewExtInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAddExtension()
                  }
                }}
                className="w-28 rounded-lg border border-border-default bg-[#070c18] px-2.5 py-1 text-xs font-mono text-white focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddExtension}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium cursor-pointer transition-colors"
              >
                <Plus size={12} />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Active Chips */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {allowedExtensions.map((ext) => (
              <span
                key={ext}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-mono font-semibold text-slate-300"
              >
                <span>.{ext}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveExtension(ext)}
                  className="text-text-dim hover:text-critical transition-colors cursor-pointer"
                  title={`Remove .${ext}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
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
                      onClick={() => handleInitiateSecondary(d)}
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
              onClick={() => setIsConfirmSaveOpen(true)}
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

      {/* CONFIRMATION MODAL 1: SAVE ARCHITECTURE DOUBLE-CHECK */}
      {isConfirmSaveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-page/85 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-border-default bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent-light border border-accent/30">
                <Shield size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Confirm Storage Architecture</h3>
                <p className="text-xs text-text-dim">Verify primary and secondary ingest parameters</p>
              </div>
            </div>

            <div className="space-y-2 p-3.5 rounded-xl border border-border-subtle bg-[#060c18] text-xs">
              <div className="flex justify-between items-center py-1 border-b border-border-subtle/60">
                <span className="text-text-dim">Primary Ingest Mount:</span>
                <span className="font-mono text-white font-bold">{primaryPath}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border-subtle/60">
                <span className="text-text-dim">Secondary Mirror Mount:</span>
                <span className="font-mono text-purple-300 font-bold">{secondaryPath || "None (Single Array)"}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border-subtle/60">
                <span className="text-text-dim">Auto-Failover Mode:</span>
                <span className="font-bold text-white">{failoverEnabled ? "Enabled (Automatic)" : "Disabled"}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-text-dim">RAID-1 Dual Write:</span>
                <span className="font-bold text-white">{autoMirrorEnabled ? "Enabled" : "Disabled"}</span>
              </div>
            </div>

            <p className="text-[11px] text-text-secondary leading-relaxed">
              Applying these settings will update real-time file upload targets across the entire ground network. Are you sure you want to commit these changes?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsConfirmSaveOpen(false)}
                disabled={savingRedundancy}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleExecuteSaveRedundancy}
                disabled={savingRedundancy}
                className="gap-1.5 shadow-lg shadow-accent/20"
              >
                <CheckCircle size={13} />
                <span>{savingRedundancy ? "Applying..." : "Confirm & Save"}</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL 2: SECONDARY DRIVE ASSIGNMENT DOUBLE-CHECK */}
      {isConfirmSecondaryOpen && pendingSecondaryDrive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-page/85 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-border-default bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-400/15 text-purple-300 border border-purple-400/30">
                <Shield size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Assign Secondary Mirror Target</h3>
                <p className="text-xs text-text-dim">Designate disaster recovery backup volume</p>
              </div>
            </div>

            <div className="space-y-2 p-3.5 rounded-xl border border-border-subtle bg-[#060c18] text-xs">
              <div className="flex justify-between items-center py-1 border-b border-border-subtle/60">
                <span className="text-text-dim">Selected Volume:</span>
                <span className="font-mono text-white font-bold">{pendingSecondaryDrive.mountPoint}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-text-dim">Assigned Backup Path:</span>
                <span className="font-mono text-purple-300 font-bold">
                  {pendingSecondaryDrive.mountPoint === "/" ? "/istrac_backup_storage" : `${pendingSecondaryDrive.mountPoint}/istrac_backup_storage`}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-text-secondary leading-relaxed">
              When RAID-1 mirroring or failover is enabled, all mission telemetry files and daily reports will be redundantly written to this volume.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsConfirmSecondaryOpen(false)
                  setPendingSecondaryDrive(null)
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmSecondary}
                className="gap-1.5 shadow-lg shadow-accent/20"
              >
                <CheckCircle size={13} />
                <span>Confirm Assignment</span>
              </Button>
            </div>
          </div>
        </div>
      )}

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
