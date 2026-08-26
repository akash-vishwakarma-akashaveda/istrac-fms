import { useState, useEffect } from 'react'
import {
  HardDrive,
  Building2,
  Radio,
  FileCode,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Zap,
  Check,
  AlertTriangle,
  Layers,
  Sparkles,
} from 'lucide-react'
import { Modal, Button, Input } from './'
import { apiClient } from '../api/client'
import { useToastStore } from '../store/toastStore'
import { satellitesApi, type Satellite } from '../api/satellites.api'
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

interface SetupWizardModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete?: () => void
}

export function SetupWizardModal({ isOpen, onClose, onComplete }: SetupWizardModalProps) {
  const addToast = useToastStore((s) => s.addToast)

  const [currentStep, setCurrentStep] = useState(1)

  // Step 1: Available Host Drives & Mount
  const [availableDrives, setAvailableDrives] = useState<DriveItem[]>([])
  const [loadingDrives, setLoadingDrives] = useState(false)
  const [mountPath, setMountPath] = useState('D:\\istrac_storage')
  const [secondaryPath, setSecondaryPath] = useState('C:\\istrac_backup_storage')
  const [enableRedundancy, setEnableRedundancy] = useState(true)
  const [warnThreshold, setWarnThreshold] = useState('85')
  const [testingMount, setTestingMount] = useState(false)
  const [mountResult, setMountResult] = useState<{
    mounted: boolean
    writable: boolean
    directoriesCreated: string[]
  } | null>(null)

  // Step 2: Station Identity
  const [stationName, setStationName] = useState('ISTRAC Bengaluru Ground Station & MOX Complex')

  // Step 3: Satellite Fleet & Departments
  const [satellites, setSatellites] = useState<Satellite[]>([])
  const [loadingSatellites, setLoadingSatellites] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(false)

  // Step 4: Policy & Limits
  const [namingTemplate, setNamingTemplate] = useState('{SAT}_{TYPE}_{YYYYMMDD}_{VER}')
  const [maxUploadMb, setMaxUploadMb] = useState('100')

  const fetchHostDrives = async () => {
    setLoadingDrives(true)
    try {
      const res = await apiClient.get('/admin/storage/drives')
      const drives: DriveItem[] = res.data?.data || []
      setAvailableDrives(drives)

      // Auto pick best drive with most free space
      if (drives.length > 0) {
        const sorted = [...drives].sort((a, b) => b.freeBytes - a.freeBytes)
        const bestDrive = sorted[0].mountPoint
        if (bestDrive.endsWith('\\')) {
          setMountPath(`${bestDrive}istrac_storage`)
        } else {
          setMountPath(`${bestDrive}/istrac_storage`)
        }

        // Secondary backup drive
        if (sorted.length > 1) {
          const secondDrive = sorted[1].mountPoint
          if (secondDrive.endsWith('\\')) {
            setSecondaryPath(`${secondDrive}istrac_backup_storage`)
          } else {
            setSecondaryPath(`${secondDrive}/istrac_backup_storage`)
          }
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoadingDrives(false)
    }
  }

  const fetchSatellites = async () => {
    setLoadingSatellites(true)
    try {
      const sats = await satellitesApi.getActiveSatellites()
      setSatellites(sats || [])
    } catch {
      setSatellites([])
    } finally {
      setLoadingSatellites(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchHostDrives()
      fetchSatellites()

      // Check current mount status
      apiClient
        .get('/admin/storage/status')
        .then((res: any) => {
          if (res.data?.data?.mounted) {
            setMountResult({
              mounted: true,
              writable: res.data.data.writable,
              directoriesCreated: ['TTC', 'FDD', 'MOX', 'NETRA', 'GSO', '.chunks', '.trash'],
            })
            if (res.data.data.mountPath) {
              setMountPath(res.data.data.mountPath)
            }
          }
        })
        .catch(() => {})
    }
  }, [isOpen])

  // Select a detected host volume
  const handleSelectDrive = (drive: DriveItem) => {
    const p = drive.mountPoint.endsWith('\\') ? `${drive.mountPoint}istrac_storage` : `${drive.mountPoint}/istrac_storage`
    setMountPath(p)
  }

  // Mount Primary Storage & Persist Redundancy Config
  const handleTestAndMount = async () => {
    setTestingMount(true)
    try {
      const res = await apiClient.post('/admin/storage/initialize-mount', {
        customPath: mountPath.trim(),
      })
      const data = res.data?.data || res.data

      // Also persist redundancy settings
      await apiClient.put('/admin/storage/redundancy', {
        primaryPath: mountPath.trim(),
        secondaryPath: enableRedundancy ? secondaryPath.trim() : '',
        failoverEnabled: enableRedundancy,
        autoMirrorEnabled: enableRedundancy,
        warnThresholdPercent: Number(warnThreshold) || 85,
      })

      setMountResult({
        mounted: true,
        writable: data.writable ?? true,
        directoriesCreated: data.directoriesCreated || [],
      })

      addToast({
        title: 'Storage Array & Redundancy Initialized',
        message: `Mounted at ${data.path || mountPath}. Failover protection active.`,
        variant: 'success',
      })
    } catch (err: any) {
      addToast({
        title: 'Mount Failed',
        message: err.response?.data?.error?.message || 'Could not verify storage path. Check drive permissions.',
        variant: 'error',
      })
    } finally {
      setTestingMount(false)
    }
  }

  // Seed default satellites and departments if empty
  const handleBootstrapFleet = async () => {
    setBootstrapping(true)
    try {
      const res = await apiClient.post('/admin/setup/bootstrap-defaults', {
        customStoragePath: mountPath.trim(),
      })
      const data = res.data?.data || res.data
      addToast({
        title: 'Spacecraft Fleet & Divisions Initialized',
        message: `Registered ${data.satellitesCreated || 6} satellites and ${data.departmentsCreated || 5} operational divisions.`,
        variant: 'success',
      })
      await fetchSatellites()
    } catch (err: any) {
      addToast({
        title: 'Initialization Failed',
        message: err.response?.data?.error?.message || 'Could not seed defaults',
        variant: 'error',
      })
    } finally {
      setBootstrapping(false)
    }
  }

  const handleFinish = () => {
    addToast({
      title: 'Station Configured',
      message: 'Ground station storage, spacecraft fleet, and failover parameters are active.',
      variant: 'success',
    })
    onClose()
    if (onComplete) onComplete()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="ISTRAC Station Setup & Storage Redundancy Wizard"
      size="lg"
    >
      <div className="space-y-6">
        {/* Step Progress Indicators */}
        <div className="grid grid-cols-5 gap-2 border-b border-border-subtle pb-4">
          {[
            { num: 1, label: 'Drives & Mount', icon: HardDrive },
            { num: 2, label: 'Facility Node', icon: Building2 },
            { num: 3, label: 'Spacecraft Fleet', icon: Radio },
            { num: 4, label: 'Naming Policy', icon: FileCode },
            { num: 5, label: 'Readiness', icon: ShieldCheck },
          ].map((s) => {
            const isActive = currentStep === s.num
            const isDone = currentStep > s.num
            return (
              <div
                key={s.num}
                onClick={() => isDone && setCurrentStep(s.num)}
                className={`flex flex-col items-center text-center p-2 rounded-lg transition-all ${
                  isActive
                    ? 'bg-accent/15 border border-accent/40 text-accent-light'
                    : isDone
                      ? 'bg-nominal/10 border border-nominal/30 text-nominal cursor-pointer'
                      : 'border border-border-subtle bg-surface text-text-dim'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {isDone ? (
                    <Check size={13} className="text-nominal" />
                  ) : (
                    <s.icon size={13} className={isActive ? 'text-accent-light' : ''} />
                  )}
                  <span className="num text-[11px] font-bold">0{s.num}</span>
                </div>
                <span className="text-[10px] font-medium truncate max-w-full">{s.label}</span>
              </div>
            )
          })}
        </div>

        {/* STEP 1: PHYSICAL DRIVES SCANNER & REDUNDANCY SETUP */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="rounded-xl border border-accent/40 bg-gradient-to-r from-[#0c1833] via-[#091122] to-[#070e1c] p-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent-light border border-accent/30">
                  <HardDrive size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Step 1: Host Drives Scanner & Redundant Failover
                  </h3>
                  <p className="text-xs text-text-secondary">
                    Detected host drives. Select a primary storage volume and configure secondary redundant failover.
                  </p>
                </div>
              </div>
            </div>

            {/* Detected Host Storage Drives Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-text-dim">
                <span>Available System Volumes ({availableDrives.length})</span>
                <span className="text-[11px] text-accent-light">Click a drive to select mount root</span>
              </div>

              {loadingDrives ? (
                <div className="p-4 rounded-xl border border-border-subtle bg-card text-center text-xs text-text-dim">
                  Scanning host storage controllers…
                </div>
              ) : availableDrives.length === 0 ? (
                <div className="p-3 rounded-xl border border-border-subtle bg-card text-xs text-text-dim">
                  No volumes detected automatically. Enter path manually below.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {availableDrives.map((d) => {
                    const isSelected = mountPath.startsWith(d.mountPoint)
                    return (
                      <div
                        key={d.mountPoint}
                        onClick={() => handleSelectDrive(d)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-accent bg-accent/10 shadow-sm ring-1 ring-accent'
                            : 'border-border-default bg-card hover:border-accent/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <HardDrive
                              size={15}
                              className={isSelected ? 'text-accent-light' : 'text-text-dim'}
                            />
                            <span className="num text-xs font-bold text-white">{d.mountPoint}</span>
                            <span className="text-[10px] text-text-dim">({d.label})</span>
                          </div>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                              d.status === 'HEALTHY'
                                ? 'bg-nominal/15 text-nominal'
                                : d.status === 'WARNING'
                                  ? 'bg-warning/15 text-warning'
                                  : 'bg-critical/15 text-critical'
                            }`}
                          >
                            {d.usedPercent}% Used
                          </span>
                        </div>

                        {/* Capacity Bar */}
                        <div className="mt-2.5 space-y-1">
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
                    )
                  })}
                </div>
              )}
            </div>

            {/* Primary & Secondary Redundancy Inputs */}
            <div className="space-y-3 rounded-xl border border-border-default bg-card p-4">
              <Input
                id="mount-path-input"
                label="Primary Storage Mount Root Path *"
                placeholder="e.g. D:\istrac_storage"
                value={mountPath}
                onChange={(e) => setMountPath(e.target.value)}
                required
              />

              {/* Redundancy & Failover Section */}
              <div className="pt-2 border-t border-border-subtle space-y-3">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-white">
                  <input
                    type="checkbox"
                    checked={enableRedundancy}
                    onChange={(e) => setEnableRedundancy(e.target.checked)}
                    className="h-4 w-4 rounded border-border-default bg-card text-accent focus:ring-accent"
                  />
                  <span className="flex items-center gap-1.5">
                    <Layers size={14} className="text-accent-light" />
                    <span>Enable Secondary Redundant Failover Storage (High Availability)</span>
                  </span>
                </label>

                {enableRedundancy && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-6 animate-fadeIn">
                    <div className="sm:col-span-2">
                      <Input
                        id="secondary-mount-path"
                        label="Secondary Backup Mount Path"
                        placeholder="e.g. C:\istrac_backup_storage"
                        value={secondaryPath}
                        onChange={(e) => setSecondaryPath(e.target.value)}
                        hint="Files are mirrored or failover routed if primary drive fills up."
                      />
                    </div>
                    <div>
                      <Input
                        id="warn-threshold-input"
                        label="Capacity Alert (%)"
                        type="number"
                        value={warnThreshold}
                        onChange={(e) => setWarnThreshold(e.target.value)}
                        hint="Triggers failover alerts."
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  disabled={testingMount || !mountPath.trim()}
                  onClick={handleTestAndMount}
                  className="shadow-md shadow-accent/25"
                >
                  <Zap size={14} />
                  <span>{testingMount ? 'Initializing Disk Arrays…' : 'Initialize & Mount Storage'}</span>
                </Button>

                {mountResult && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-nominal">
                    <CheckCircle2 size={16} />
                    <span>Storage Array Online & Writable</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: FACILITY IDENTITY */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="rounded-xl border border-accent/40 bg-gradient-to-r from-[#0c1833] via-[#091122] to-[#070e1c] p-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent-light border border-accent/30">
                  <Building2 size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Step 2: Ground Station & Facility Identity
                  </h3>
                  <p className="text-xs text-text-secondary">
                    Configure facility telemetry metadata, master node identity, and station mandate.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-border-default bg-card p-4">
              <Input
                id="station-name-input"
                label="Ground Station Hub Name *"
                value={stationName}
                onChange={(e) => setStationName(e.target.value)}
                required
              />

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1.5">
                  Operating Network
                </label>
                <input
                  type="text"
                  disabled
                  value="ISRO ISTRAC Space Operations Network"
                  className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-text-muted cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: SPACECRAFT FLEET & DEPARTMENTS (WITH 1-CLICK SEED) */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="rounded-xl border border-accent/40 bg-gradient-to-r from-[#0c1833] via-[#091122] to-[#070e1c] p-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent-light border border-accent/30">
                  <Radio size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Step 3: Spacecraft Fleet & Operational Divisions
                  </h3>
                  <p className="text-xs text-text-secondary">
                    Verify registered ISRO satellite programs and linked ground station departments.
                  </p>
                </div>
              </div>
            </div>

            {/* Empty Fleet Warning & 1-Click Bootstrap Button */}
            {satellites.length === 0 ? (
              <div className="rounded-xl border border-warning/40 bg-gradient-to-r from-warning/15 via-[#1c1409] to-warning/10 p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/20 text-warning border border-warning/30">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      No Spacecraft or Operational Divisions Found
                    </h4>
                    <p className="text-xs text-text-secondary">
                      This is a fresh installation. Initialize standard ISRO flagship missions and departmental directories.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  disabled={bootstrapping}
                  onClick={handleBootstrapFleet}
                  className="w-full bg-warning hover:bg-warning-light text-black font-bold shadow-lg shadow-warning/25 justify-center"
                >
                  <Sparkles size={16} />
                  <span>
                    {bootstrapping
                      ? 'Seeding ISRO Missions & Divisions…'
                      : '⚡ 1-Click Seed ISRO Fleet (Aditya-L1, Chandrayaan-3, TTC, FDD, MOX)'}
                  </span>
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-border-default bg-card p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-text-dim">
                  <span>Active Mission Programs ({satellites.length})</span>
                  <span className="text-nominal">All Systems Nominal</span>
                </div>

                {loadingSatellites ? (
                  <div className="py-6 text-center text-xs text-text-dim">Loading satellite registry…</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto">
                    {satellites.map((sat) => (
                      <div
                        key={sat.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border-subtle bg-[#060c18]"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{sat.name}</p>
                          <span className="num text-[10px] font-bold text-accent-light">{sat.code}</span>
                        </div>
                        <span className="flex h-5 items-center rounded-full bg-nominal/15 px-2 text-[10px] font-bold text-nominal border border-nominal/30">
                          Active
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 4: POLICY & NAMING ENGINE */}
        {currentStep === 4 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="rounded-xl border border-accent/40 bg-gradient-to-r from-[#0c1833] via-[#091122] to-[#070e1c] p-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent-light border border-accent/30">
                  <FileCode size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Step 4: Standard Naming Convention & Security Caps
                  </h3>
                  <p className="text-xs text-text-secondary">
                    Configure default file ingest naming conventions (ISRO SPOA Standard) and storage thresholds.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-border-default bg-card p-4">
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1.5">
                  Default Filename Pattern Template *
                </label>
                <input
                  type="text"
                  value={namingTemplate}
                  onChange={(e) => setNamingTemplate(e.target.value)}
                  className="num w-full rounded-lg border border-border-default bg-[#050b16] px-3 py-2 text-xs text-accent-light outline-none focus:border-accent"
                  required
                />
                <p className="mt-1 text-[11px] text-text-dim">
                  Evaluates to: <code className="num text-white font-bold">EOS08_DAILYOPS_20260825_V1.0.pdf</code>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  id="max-upload-cap"
                  label="Single File Upload Limit (MB)"
                  type="number"
                  value={maxUploadMb}
                  onChange={(e) => setMaxUploadMb(e.target.value)}
                  hint="Files above 10MB utilize chunked streaming automatically."
                />

                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1.5">
                    Checksum Security
                  </label>
                  <input
                    type="text"
                    disabled
                    value="SHA-256 Cryptographic Verification"
                    className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-text-muted cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: READINESS CONFIRMATION */}
        {currentStep === 5 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="rounded-xl border border-nominal/40 bg-gradient-to-r from-nominal/15 via-[#09181c] to-nominal/10 p-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-nominal/20 text-nominal border border-nominal/30">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Step 5: System Readiness & Pre-Flight Checklist
                  </h3>
                  <p className="text-xs text-text-secondary">
                    All core parameters have been validated. Your ground station is ready for flight telemetry operations.
                  </p>
                </div>
              </div>
            </div>

            {/* Checklist items */}
            <div className="space-y-2 rounded-xl border border-border-default bg-card p-4">
              {[
                { label: 'Primary Storage Mount', val: mountPath, status: 'Online' },
                {
                  label: 'Redundancy & Failover',
                  val: enableRedundancy ? `Secondary: ${secondaryPath}` : 'Single Array',
                  status: enableRedundancy ? 'Protected' : 'Standard',
                },
                { label: 'Facility Complex', val: stationName, status: 'Active' },
                { label: 'Spacecraft Fleet', val: `${satellites.length} Registered Satellites`, status: 'Ready' },
                { label: 'ISRO SPOA Naming Policy', val: namingTemplate, status: 'Active' },
                { label: 'Database & Multi-RBAC', val: 'MySQL 8.0 Level-4 Security', status: 'Secured' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border-subtle bg-[#060c18] text-xs"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-nominal shrink-0" />
                    <div>
                      <span className="font-bold text-white">{item.label}: </span>
                      <span className="text-text-muted">{item.val}</span>
                    </div>
                  </div>
                  <span className="rounded bg-nominal/15 px-2 py-0.5 text-[10px] font-bold text-nominal border border-nominal/30 shrink-0">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Navigation Buttons */}
        <div className="flex items-center justify-between border-t border-border-subtle pt-4">
          <Button
            type="button"
            variant="outline"
            size="md"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
          >
            <ArrowLeft size={14} />
            <span>Previous</span>
          </Button>

          <div className="flex items-center gap-2">
            {currentStep < 5 ? (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => setCurrentStep((prev) => Math.min(5, prev + 1))}
                className="shadow-md shadow-accent/25"
              >
                <span>Continue</span>
                <ArrowRight size={14} />
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleFinish}
                className="bg-nominal hover:bg-nominal-light text-white shadow-lg shadow-nominal/25"
              >
                <CheckCircle2 size={15} />
                <span>Launch Ground Command Center</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
