import { useState, useEffect, useRef } from 'react'
import {
  Upload,
  Radio,
  FileText,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  FolderUp,
  FileCode,
  Plus,
  Check,
  Star,
  X,
  Layers,
  Eye,
  EyeOff,
} from 'lucide-react'
import { satellitesApi, type Satellite } from '../api/satellites.api'
import { departmentsApi, type Department } from '../api/departments.api'
import { reportPresetsApi, type CategoryPreset, type NamingPreset } from '../api/reportPresets.api'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'
import { apiClient } from '../api/client'
import { useSystemConfig } from '../hooks/useSystemConfig'
import { Button, Input, Textarea, Select, Modal } from '.'
import { formatFileSize } from '../lib/formatFileSize'

const TOKEN_CHIPS = [
  { token: '{SAT}', label: 'Spacecraft Code' },
  { token: '{TYPE}', label: 'Report Type' },
  { token: '{DEPT}', label: 'Department' },
  { token: '{YYYYMMDD}', label: 'Date (YYYYMMDD)' },
  { token: '{YYYY-MM-DD}', label: 'Date (YYYY-MM-DD)' },
  { token: '{VER}', label: 'Version (V1.0)' },
  { token: '{TITLE}', label: 'Title' },
  { token: '{AUTHOR}', label: 'Author' },
]

export interface UploadModalTargetFile {
  id: string
  name: string
  departmentId?: string
  departmentName?: string
  spacecraft?: string | null
  category?: string | null
  title?: string | null
  description?: string | null
  versionCount?: number
  versionLabel?: string | null
  isFeatured?: boolean
}

interface UploadVersionModalProps {
  isOpen: boolean
  onClose: () => void
  file?: UploadModalTargetFile | null
  defaultDeptId?: string
  onSuccess?: () => void
}

function calculateNextVersion(currentLabel?: string | null, versionCount = 1): { minor: string; major: string } {
  if (!currentLabel) {
    const nextCount = versionCount + 1
    return {
      minor: `V1.${versionCount}`,
      major: `V${nextCount}.0`,
    }
  }

  const clean = currentLabel.trim().replace(/^[vV]/, '')
  const parts = clean.split('.')
  if (parts.length >= 2) {
    const majorNum = parseInt(parts[0], 10)
    const minorNum = parseInt(parts[1], 10)
    if (!isNaN(majorNum) && !isNaN(minorNum)) {
      return {
        minor: `V${majorNum}.${minorNum + 1}`,
        major: `V${majorNum + 1}.0`,
      }
    }
  } else if (parts.length === 1) {
    const majorNum = parseInt(parts[0], 10)
    if (!isNaN(majorNum)) {
      return {
        minor: `V${majorNum}.1`,
        major: `V${majorNum + 1}.0`,
      }
    }
  }

  return {
    minor: `V1.${versionCount}`,
    major: `V${versionCount + 1}.0`,
  }
}

export function UploadVersionModal({
  isOpen,
  onClose,
  file,
  defaultDeptId,
  onSuccess,
}: UploadVersionModalProps) {
  const user = useAuthStore((s) => s.user)
  const addToast = useToastStore((s) => s.addToast)

  // Remote collections
  const [satellites, setSatellites] = useState<Satellite[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [categories, setCategories] = useState<CategoryPreset[]>([])
  const [namingPresets, setNamingPresets] = useState<NamingPreset[]>([])
  const [loadingInitial, setLoadingInitial] = useState(true)

  // Form State
  const [selectedSat, setSelectedSat] = useState<string>('')
  const [selectedDept, setSelectedDept] = useState<string>('')
  const [selectedCategoryCode, setSelectedCategoryCode] = useState<string>('DAILYOPS')
  const [reportTitle, setReportTitle] = useState<string>('')
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [version, setVersion] = useState<string>('V1.0')
  const [author, setAuthor] = useState<string>(user?.name || '')
  const [description, setDescription] = useState<string>('')
  const [changeLog, setChangeLog] = useState<string>('')
  const [enforceNaming, setEnforceNaming] = useState<boolean>(true)
  const [isFeatured, setIsFeatured] = useState<boolean>(false)
  const [isVisible, setIsVisible] = useState<boolean>(true)

  // Custom Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [customCatName, setCustomCatName] = useState('')
  const [customCatCode, setCustomCatCode] = useState('')
  const [customCatDesc, setCustomCatDesc] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)

  // Naming Convention Template State
  const [selectedPresetId, setSelectedPresetId] = useState<string>('default')
  const [activeTemplate, setActiveTemplate] = useState<string>('{SAT}_{TYPE}_{YYYYMMDD}_{VER}')
  const [isCustomTemplate, setIsCustomTemplate] = useState(false)
  const [isNamingModalOpen, setIsNamingModalOpen] = useState(false)
  const [customPresetName, setCustomPresetName] = useState('')
  const [savingPreset, setSavingPreset] = useState(false)

  // Selected file
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: systemConfig } = useSystemConfig()
  const maxUploadBytes = systemConfig?.maxUploadSizeBytes || 524288000

  // Load satellites, departments, categories, naming presets
  useEffect(() => {
    if (!isOpen) return

    const loadData = async () => {
      setLoadingInitial(true)
      try {
        const [sats, depts, cats, presets] = await Promise.all([
          satellitesApi.getActiveSatellites().catch(() => []),
          departmentsApi.getUserDepartments().catch(() => departmentsApi.getPublicDepartments().catch(() => [])),
          reportPresetsApi.getCategories().catch(() => []),
          reportPresetsApi.getNamingPresets().catch(() => []),
        ])

        const satList = sats || []
        const deptList = depts || []
        const catList = cats || []
        const presetList = presets || []

        setSatellites(satList)
        setDepartments(deptList)
        setCategories(catList)
        setNamingPresets(presetList)

        // Pre-fill / Synchronize with target file if provided
        if (file) {
          // Spacecraft matching
          const matchedSat = satList.find(
            (s) =>
              s.name.toLowerCase() === (file.spacecraft || '').toLowerCase() ||
              (s.code && s.code.toLowerCase() === (file.spacecraft || '').toLowerCase())
          )
          if (matchedSat) {
            setSelectedSat(matchedSat.id)
          } else {
            const generalSat = satList.find((s) => s.code === 'GENERAL')
            setSelectedSat(generalSat ? generalSat.id : satList[0]?.id || '')
          }

          // Department matching
          if (file.departmentId) {
            setSelectedDept(file.departmentId)
          } else if (defaultDeptId) {
            setSelectedDept(defaultDeptId)
          } else if (deptList[0]?.id) {
            setSelectedDept(deptList[0].id)
          }

          // Category matching
          if (file.category) {
            const matchedCat = catList.find(
              (c) => c.code.toUpperCase() === file.category?.toUpperCase() || c.name.toLowerCase() === file.category?.toLowerCase()
            )
            if (matchedCat) {
              setSelectedCategoryCode(matchedCat.code)
            } else {
              setSelectedCategoryCode(catList[0]?.code || 'DAILYOPS')
            }
          }

          // Title & Description
          setReportTitle(file.title || file.name.replace(/\.[^/.]+$/, ''))
          setDescription(file.description || '')
          setIsFeatured(Boolean(file.isFeatured))

          // Auto-calculate next revision label
          const { minor } = calculateNextVersion(file.versionLabel, file.versionCount ?? 1)
          setVersion(minor)
          setChangeLog('')
          setIsVisible(true)
        } else {
          // New file mode
          const generalSat = satList.find((s) => s.code === 'GENERAL')
          setSelectedSat(generalSat ? generalSat.id : satList[0]?.id || '')
          if (defaultDeptId) {
            setSelectedDept(defaultDeptId)
          } else if (deptList[0]?.id) {
            setSelectedDept(deptList[0].id)
          }
          setSelectedCategoryCode(catList[0]?.code || 'DAILYOPS')
          setReportTitle('')
          setVersion('V1.0')
          setDescription('')
          setChangeLog('')
          setIsFeatured(false)
          setIsVisible(true)
        }

        setAuthor(user?.name || '')
        setUploadedFile(null)
        setUploadProgress(0)
      } catch (err) {
        console.error('Failed to load metadata in upload modal:', err)
      } finally {
        setLoadingInitial(false)
      }
    }

    loadData()
  }, [isOpen, file, defaultDeptId, user])

  // Compute live ISRO standard filename
  const satObj = satellites.find((s) => s.id === selectedSat)
  const deptObj = departments.find((d) => d.id === selectedDept)
  const catObj = categories.find((c) => c.code === selectedCategoryCode)

  const satCode = satObj?.code || (satObj?.name ? satObj.name.substring(0, 4).toUpperCase() : 'ISRO')
  const deptCode = deptObj?.code || 'MOX'
  const catCode = catObj?.code || selectedCategoryCode || 'REPORT'
  const dateCompact = reportDate ? reportDate.replace(/-/g, '') : '20260903'
  const titleClean = (reportTitle || 'UNTITLED').replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()
  const authorClean = (author || 'OPERATOR').replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()

  const generateFileName = () => {
    let result = activeTemplate
    result = result.replace(/{SAT}/g, satCode)
    result = result.replace(/{TYPE}/g, catCode)
    result = result.replace(/{DEPT}/g, deptCode)
    result = result.replace(/{YYYYMMDD}/g, dateCompact)
    result = result.replace(/{YYYY-MM-DD}/g, reportDate)
    result = result.replace(/{VER}/g, version.trim().toUpperCase() || 'V1.0')
    result = result.replace(/{TITLE}/g, titleClean)
    result = result.replace(/{AUTHOR}/g, authorClean)

    const ext = uploadedFile?.name.split('.').pop() || file?.name.split('.').pop() || 'pdf'
    return `${result}.${ext}`
  }

  const isroStandardName = generateFileName()
  const effectiveFileName = enforceNaming ? isroStandardName : uploadedFile?.name || file?.name || isroStandardName

  // Suggested bumps for revision
  const { minor: suggestedMinor, major: suggestedMajor } = calculateNextVersion(
    file?.versionLabel,
    file?.versionCount ?? 1
  )

  const insertToken = (token: string) => {
    setActiveTemplate((prev) => `${prev}_${token}`)
    setIsCustomTemplate(true)
    setSelectedPresetId('custom')
  }

  const handlePresetSelect = (id: string) => {
    setSelectedPresetId(id)
    if (id === 'custom') {
      setIsCustomTemplate(true)
      return
    }
    const match = namingPresets.find((p) => p.id === id)
    if (match) {
      setActiveTemplate(match.template)
      setIsCustomTemplate(false)
    }
  }

  // Handle Saving Custom Category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customCatName.trim() || !customCatCode.trim()) {
      addToast({ title: 'Validation', message: 'Category Name and Code are required', variant: 'warning' })
      return
    }

    setSavingCategory(true)
    try {
      const created = await reportPresetsApi.createCategory({
        name: customCatName.trim(),
        code: customCatCode.trim().toUpperCase(),
        description: customCatDesc.trim() || undefined,
      })
      addToast({ title: 'Category Created', message: `${created.name} (${created.code}) is now active`, variant: 'success' })
      setCategories((prev) => [...prev, created])
      setSelectedCategoryCode(created.code)
      setIsCategoryModalOpen(false)
      setCustomCatName('')
      setCustomCatCode('')
      setCustomCatDesc('')
    } catch (err: any) {
      addToast({
        title: 'Error',
        message: err.response?.data?.error?.message || 'Could not save category',
        variant: 'error',
      })
    } finally {
      setSavingCategory(false)
    }
  }

  // Handle Saving Custom Naming Preset
  const handleSaveNamingPreset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customPresetName.trim() || !activeTemplate.trim()) {
      addToast({ title: 'Validation', message: 'Preset Name and Template are required', variant: 'warning' })
      return
    }

    setSavingPreset(true)
    try {
      const created = await reportPresetsApi.createNamingPreset({
        name: customPresetName.trim(),
        template: activeTemplate.trim(),
      })
      addToast({ title: 'Naming Preset Saved', message: `${created.name} added to template roster`, variant: 'success' })
      setNamingPresets((prev) => [...prev, created])
      setSelectedPresetId(created.id)
      setIsCustomTemplate(false)
      setCustomPresetName('')
    } catch (err: any) {
      addToast({
        title: 'Error',
        message: err.response?.data?.error?.message || 'Could not save naming preset',
        variant: 'error',
      })
    } finally {
      setSavingPreset(false)
      setIsNamingModalOpen(false)
    }
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0]
      if (dropped.size > maxUploadBytes) {
        addToast({
          title: 'File Exceeds Limit',
          message: `Selected file (${formatFileSize(dropped.size)}) exceeds system limit of ${formatFileSize(maxUploadBytes)}.`,
          variant: 'error',
        })
        return
      }
      setUploadedFile(dropped)
      if (!reportTitle) {
        setReportTitle(dropped.name.replace(/\.[^/.]+$/, ''))
      }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0]
      if (selected.size > maxUploadBytes) {
        addToast({
          title: 'File Exceeds Limit',
          message: `Selected file (${formatFileSize(selected.size)}) exceeds system limit of ${formatFileSize(maxUploadBytes)}.`,
          variant: 'error',
        })
        return
      }
      setUploadedFile(selected)
      if (!reportTitle) {
        setReportTitle(selected.name.replace(/\.[^/.]+$/, ''))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadedFile) {
      addToast({ title: 'Validation', message: 'Please select a file to upload', variant: 'warning' })
      return
    }
    if (!selectedDept) {
      addToast({ title: 'Validation', message: 'Please select a destination department', variant: 'warning' })
      return
    }

    setUploading(true)
    setUploadProgress(10)

    try {
      const finalFileName = enforceNaming ? isroStandardName : uploadedFile.name
      const renamedFile = new File([uploadedFile], finalFileName, { type: uploadedFile.type })

      const formData = new FormData()
      formData.append('file', renamedFile)
      formData.append('departmentId', selectedDept)
      formData.append('title', reportTitle || finalFileName)
      formData.append('description', description)
      formData.append('spacecraft', satObj?.code === 'GENERAL' ? 'General' : (satObj?.name || 'General'))
      formData.append('category', catObj?.name || selectedCategoryCode)
      formData.append('versionLabel', version.trim().toUpperCase() || 'V1.0')
      formData.append('reportNumber', `${satCode}-${catCode}-${dateCompact}`)
      formData.append('isFeatured', isFeatured ? 'true' : 'false')
      formData.append('isVisible', isVisible ? 'true' : 'false')
      if (changeLog.trim()) {
        formData.append('changeLog', changeLog.trim())
      }

      // If target file is provided, submit to dedicated revision upload route!
      if (file?.id) {
        await apiClient.post(`/files/${file.id}/version`, formData, {
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
              setUploadProgress(Math.max(10, percent))
            }
          },
        })
        addToast({
          title: 'Version Ingested',
          message: `Successfully published version ${version.toUpperCase()} for ${finalFileName}`,
          variant: 'success',
        })
      } else {
        // Standard new file upload
        await apiClient.post('/files/upload', formData, {
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
              setUploadProgress(Math.max(10, percent))
            }
          },
        })
        addToast({
          title: 'File Uploaded',
          message: `Successfully ingested ${finalFileName} into ${deptObj?.name || 'Department'}`,
          variant: 'success',
        })
      }

      onSuccess?.()
      onClose()
    } catch (err: any) {
      console.error('Upload failed:', err)
      addToast({
        title: 'Upload Failed',
        message: err.response?.data?.message || err.response?.data?.error?.message || 'Could not upload report to storage cluster',
        variant: 'error',
      })
    } finally {
      setUploading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-page/85 backdrop-blur-[2px]">
      <div
        className="relative w-full max-w-5xl rounded-2xl border border-border-default bg-card shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border-subtle bg-surface px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-accent/15 border border-accent/30 text-accent-light">
              {file ? <Layers size={22} /> : <Upload size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-accent-light">
                  {file ? 'SPOA Revision Pipeline' : 'SPOA Ingest Architecture'}
                </span>
                {file && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-accent/10 border border-accent/30 text-accent-light">
                    Updating: {file.name}
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                {file ? 'Upload New File Version' : 'Upload Mission Report / File'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="rounded-lg p-1.5 text-text-muted hover:bg-card-hover hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {loadingInitial ? (
            <div className="h-96 rounded-xl border border-border-subtle bg-card p-10 flex items-center justify-center">
              <RefreshCw size={24} className="animate-spin text-accent-light" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Main Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 Cols: Allocation, Metadata & Naming Preset Builder */}
                <div className="lg:col-span-2 space-y-5">
                  {/* Section 1: Spacecraft & Category Allocation */}
                  <div className="rounded-xl border border-border-default bg-[#060c18] p-5 space-y-4 shadow-sm">
                    <h3 className="text-xs font-bold text-accent-light uppercase tracking-wider flex items-center gap-2">
                      <Radio size={14} />
                      <span>1. Mission & Spacecraft Allocation</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-text-primary mb-1.5">
                          Spacecraft / Satellite *
                        </label>
                        <Select
                          id="modal-upload-sat"
                          value={selectedSat}
                          onChange={(e) => setSelectedSat(e.target.value)}
                          required
                        >
                          {satellites
                            .slice()
                            .sort((a, b) => (a.code === 'GENERAL' ? -1 : b.code === 'GENERAL' ? 1 : a.name.localeCompare(b.name)))
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.code === 'GENERAL' ? 'General' : `${s.name} (${s.code || 'ISRO'})`}
                              </option>
                            ))}
                        </Select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-text-primary mb-1.5">
                          Operational Division / Dept *
                        </label>
                        <Select
                          id="modal-upload-dept"
                          value={selectedDept}
                          onChange={(e) => setSelectedDept(e.target.value)}
                          required
                        >
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    {/* Report Category with Custom Option */}
                    <div className="pt-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-text-primary">
                          Report Category / Type *
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsCategoryModalOpen(true)}
                          className="text-[11px] font-bold text-accent-light hover:underline flex items-center gap-1"
                        >
                          <Plus size={12} />
                          <span>Add Custom Category</span>
                        </button>
                      </div>

                      <Select
                        id="modal-upload-type"
                        value={selectedCategoryCode}
                        onChange={(e) => {
                          if (e.target.value === '__add_custom__') {
                            setIsCategoryModalOpen(true)
                          } else {
                            setSelectedCategoryCode(e.target.value)
                          }
                        }}
                      >
                        {categories
                          .slice()
                          .sort((a, b) => (a.code === 'GENERAL' ? -1 : b.code === 'GENERAL' ? 1 : a.name.localeCompare(b.name)))
                          .map((c) => (
                            <option key={c.id} value={c.code}>
                              {c.code === 'GENERAL' ? 'General' : `${c.name} (${c.code})`}
                            </option>
                          ))}
                        <option value="__add_custom__">+ Create New Custom Category…</option>
                      </Select>
                    </div>
                  </div>

                  {/* Section 2: Report Metadata & Versioning */}
                  <div className="rounded-xl border border-border-default bg-[#060c18] p-5 space-y-4 shadow-sm">
                    <h3 className="text-xs font-bold text-accent-light uppercase tracking-wider flex items-center gap-2">
                      <FileText size={14} />
                      <span>2. Report Metadata & Version Details</span>
                    </h3>

                    <Input
                      id="modal-report-title"
                      label="Report Title *"
                      placeholder="e.g. Daily Orbital Tracking & Telemetry Summary"
                      value={reportTitle}
                      onChange={(e) => setReportTitle(e.target.value)}
                      required
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Input
                        id="modal-report-date"
                        label="Report Date *"
                        type="date"
                        value={reportDate}
                        onChange={(e) => setReportDate(e.target.value)}
                        required
                      />

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-semibold text-text-primary">
                            Version Label *
                          </label>
                          {file && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setVersion(suggestedMinor)}
                                className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-accent/10 text-accent-light border border-accent/30 hover:bg-accent/20 transition-colors cursor-pointer"
                                title="Minor version bump"
                              >
                                {suggestedMinor}
                              </button>
                              <button
                                type="button"
                                onClick={() => setVersion(suggestedMajor)}
                                className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-accent/10 text-accent-light border border-accent/30 hover:bg-accent/20 transition-colors cursor-pointer"
                                title="Major version bump"
                              >
                                {suggestedMajor}
                              </button>
                            </div>
                          )}
                        </div>
                        <Input
                          id="modal-report-ver"
                          placeholder="V1.0"
                          value={version}
                          onChange={(e) => setVersion(e.target.value.toUpperCase())}
                          required
                          className="font-mono font-bold text-accent-light"
                        />
                      </div>

                      <Input
                        id="modal-report-author"
                        label="Author / Officer *"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        required
                      />
                    </div>

                    {file && (
                      <Textarea
                        id="modal-version-changelog"
                        label="Version Release Notes / Changelog (Optional)"
                        rows={2}
                        placeholder="e.g. Recalibrated ephemeris parameters with revised solar flare sensor telemetry…"
                        value={changeLog}
                        onChange={(e) => setChangeLog(e.target.value)}
                      />
                    )}

                    <Textarea
                      id="modal-report-desc"
                      label="Executive Summary / Mission Notes"
                      rows={2}
                      placeholder="Summarize orbit parameters, telemetry anomalies, tracking passes, or payload health status…"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  {/* Section 3: Customizable Naming Conventions & Presets Builder */}
                  <div className="rounded-xl border border-accent/40 bg-gradient-to-br from-[#0c1833] via-[#091122] to-[#070e1c] p-4 sm:p-5 space-y-4 shadow-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-accent-light" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          Naming Convention & Preset Engine
                        </h4>
                      </div>
                      <span className="rounded-full bg-nominal/15 px-2 py-0.5 text-[10px] font-bold text-nominal border border-nominal/30">
                        CONFIGURABLE
                      </span>
                    </div>

                    {/* Preset Selector */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold text-text-dim uppercase tracking-wider mb-1">
                          Choose Naming Preset
                        </label>
                        <Select
                          id="modal-naming-preset-select"
                          value={selectedPresetId}
                          onChange={(e) => handlePresetSelect(e.target.value)}
                        >
                          {namingPresets.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.isDefault ? '(ISRO Standard)' : ''}
                            </option>
                          ))}
                          <option value="custom">⚡ Custom Template Builder…</option>
                        </Select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-text-dim uppercase tracking-wider mb-1">
                          Template Format String
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={activeTemplate}
                            onChange={(e) => {
                              setActiveTemplate(e.target.value)
                              setIsCustomTemplate(true)
                              setSelectedPresetId('custom')
                            }}
                            placeholder="{SAT}_{TYPE}_{YYYYMMDD}_{VER}"
                            className="num w-full rounded-lg border border-border-default bg-[#050b16] px-3 py-1.5 text-xs text-accent-light outline-none focus:border-accent font-mono"
                          />
                          {isCustomTemplate && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setIsNamingModalOpen(true)}
                              className="shrink-0"
                              title="Save this template as a preset"
                            >
                              Save
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Interactive Token Injection Chips */}
                    <div>
                      <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1.5">
                        Click to Insert Token Tags:
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {TOKEN_CHIPS.map((chip) => (
                          <button
                            key={chip.token}
                            type="button"
                            onClick={() => insertToken(chip.token)}
                            className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-card px-2 py-1 text-[11px] font-medium text-text-secondary hover:border-accent hover:text-white hover:bg-card-hover transition-all"
                          >
                            <code className="num text-accent-light font-bold">{chip.token}</code>
                            <span className="text-[10px] text-text-dim">({chip.label})</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Live Filename Preview Box */}
                    <div className="rounded-lg border border-accent/30 bg-[#050b16] p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-text-dim flex items-center gap-1.5">
                          <FileCode size={14} className="text-accent-light" />
                          <span>Live Ingest Filename:</span>
                        </span>
                        <span className="num font-bold text-nominal flex items-center gap-1">
                          <Check size={12} />
                          <span>Valid Format</span>
                        </span>
                      </div>
                      <p className="num text-xs font-bold text-white break-all">
                        {effectiveFileName}
                      </p>
                    </div>

                    <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs text-text-primary">
                      <input
                        type="checkbox"
                        checked={enforceNaming}
                        onChange={(e) => setEnforceNaming(e.target.checked)}
                        className="h-4 w-4 rounded border-border-default bg-card text-accent focus:ring-accent"
                      />
                      <span>Automatically enforce this naming pattern on storage array</span>
                    </label>
                  </div>
                </div>

                {/* Right Column: File Dropzone & Ingest CTA */}
                <div className="space-y-5">
                  <div className="rounded-xl border border-border-default bg-[#060c18] p-5 space-y-4 shadow-sm flex flex-col justify-between h-full">
                    <div>
                      <h3 className="text-xs font-bold text-accent-light uppercase tracking-wider flex items-center gap-2 mb-3">
                        <FolderUp size={14} />
                        <span>3. Attach Document</span>
                      </h3>

                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleFileDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                          uploadedFile
                            ? 'border-nominal/50 bg-nominal/[0.04]'
                            : 'border-border-default bg-[#070e1c] hover:border-accent/50 hover:bg-[#0a1326]'
                        }`}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          onChange={handleFileSelect}
                          accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.dat,.json"
                        />

                        {uploadedFile ? (
                          <div className="space-y-2">
                            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-nominal/20 text-nominal border border-nominal/30">
                              <CheckCircle2 size={24} />
                            </div>
                            <p className="text-xs font-bold text-white truncate max-w-xs mx-auto">
                              {uploadedFile.name}
                            </p>
                            <p className="num text-[11px] text-text-dim">
                              {formatFileSize(uploadedFile.size)}
                            </p>
                            <p className="text-[11px] text-accent-light underline">
                              Click or drag another file to replace
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-accent/15 text-accent-light border border-accent/25">
                              <Upload size={22} />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white">
                                Drag & Drop Report File Here
                              </p>
                              <p className="text-[11px] text-text-muted mt-0.5">
                                or click to browse your disk
                              </p>
                            </div>
                            <p className="text-[10px] text-text-dim border-t border-border-subtle pt-2">
                              Max allowed: {formatFileSize(maxUploadBytes)} (PDF, DOCX, CSV, BIN, DAT)
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Controls & Checkboxes */}
                    <div className="space-y-3 pt-3 border-t border-border-subtle">
                      {/* Admin Visibility Toggle */}
                      <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border-subtle bg-surface/50 cursor-pointer hover:border-accent/40 transition-colors">
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={(e) => setIsVisible(e.target.checked)}
                          className="h-4 w-4 rounded border-border-default bg-card text-accent focus:ring-accent accent-accent mt-0.5 cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                            {isVisible ? (
                              <Eye size={13} className="text-nominal" />
                            ) : (
                              <EyeOff size={13} className="text-warning" />
                            )}
                            <span>Visible to Division Members</span>
                          </div>
                          <p className="text-[10px] text-text-dim">
                            {isVisible
                              ? 'Members with access can view & download this version.'
                              : 'Draft: Visible only to System Administrators.'}
                          </p>
                        </div>
                      </label>

                      {/* Featured Report Checkbox */}
                      <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border-subtle bg-surface/50 cursor-pointer hover:border-accent/40 transition-colors">
                        <input
                          type="checkbox"
                          checked={isFeatured}
                          onChange={(e) => setIsFeatured(e.target.checked)}
                          className="h-4 w-4 rounded border-border-default bg-card text-amber-500 focus:ring-amber-500 accent-amber-500 mt-0.5 cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                            <Star size={13} className="fill-amber-400 text-amber-400" />
                            <span>Feature in Public Mission Reports</span>
                          </div>
                          <p className="text-[10px] text-text-dim">
                            Displayed on public landing page and division highlights showcase.
                          </p>
                        </div>
                      </label>

                      {/* Upload Progress Bar */}
                      {uploading && (
                        <div className="space-y-1.5 p-3 rounded-xl border border-accent/30 bg-accent/[0.05]">
                          <div className="flex justify-between text-xs text-text-secondary">
                            <span className="flex items-center gap-1.5">
                              <RefreshCw size={12} className="animate-spin text-accent-light" />
                              <span>Writing to physical HDD & calculating SHA-256...</span>
                            </span>
                            <span className="num font-bold text-accent-light">{uploadProgress}%</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-surface overflow-hidden">
                            <div
                              className="h-full bg-accent transition-all duration-200"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Submit Actions */}
                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={onClose}
                          disabled={uploading}
                          className="flex-1"
                        >
                          Cancel
                        </Button>

                        <Button
                          type="submit"
                          variant="primary"
                          disabled={uploading || !uploadedFile}
                          className="flex-1 gap-1.5 shadow-md shadow-accent/20 justify-center"
                        >
                          {uploading ? (
                            <>
                              <RefreshCw size={14} className="animate-spin" />
                              <span>Uploading…</span>
                            </>
                          ) : (
                            <>
                              <Upload size={14} />
                              <span>{file ? `Publish ${version}` : 'Upload File'}</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* MODAL: Add Custom Category */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Add Custom Report Category"
      >
        <form onSubmit={handleSaveCategory} className="space-y-4">
          <Input
            id="modal-custom-cat-name"
            label="Category Name *"
            placeholder="e.g. Flight Telemetry & Payload Log"
            value={customCatName}
            onChange={(e) => setCustomCatName(e.target.value)}
            required
          />
          <Input
            id="modal-custom-cat-code"
            label="Category Code (for Naming Tokens) *"
            placeholder="e.g. FLIGHTOPS"
            value={customCatCode}
            onChange={(e) => setCustomCatCode(e.target.value.toUpperCase())}
            required
          />
          <Textarea
            id="modal-custom-cat-desc"
            label="Category Description"
            rows={2}
            placeholder="Describe what kind of documents belong in this category…"
            value={customCatDesc}
            onChange={(e) => setCustomCatDesc(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCategoryModalOpen(false)}
              disabled={savingCategory}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={savingCategory}>
              {savingCategory ? 'Saving…' : 'Save Category'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Save Custom Naming Preset */}
      <Modal
        isOpen={isNamingModalOpen}
        onClose={() => setIsNamingModalOpen(false)}
        title="Save Naming Convention Preset"
      >
        <form onSubmit={handleSaveNamingPreset} className="space-y-4">
          <Input
            id="modal-preset-name"
            label="Preset Name *"
            placeholder="e.g. Deep Space Network Standard (DSN)"
            value={customPresetName}
            onChange={(e) => setCustomPresetName(e.target.value)}
            required
          />
          <div className="rounded-lg bg-surface p-3 border border-border-subtle space-y-1">
            <span className="text-[11px] font-bold text-text-dim uppercase">Current Template:</span>
            <code className="block num text-xs font-bold text-accent-light break-all">{activeTemplate}</code>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsNamingModalOpen(false)}
              disabled={savingPreset}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={savingPreset}>
              {savingPreset ? 'Saving…' : 'Save Preset'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
