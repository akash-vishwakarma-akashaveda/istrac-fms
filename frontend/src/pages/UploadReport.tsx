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
  Trash2,
  Check,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { satellitesApi, type Satellite } from '../api/satellites.api'
import { departmentsApi, type Department } from '../api/departments.api'
import { reportPresetsApi, type CategoryPreset, type NamingPreset } from '../api/reportPresets.api'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'
import { apiClient } from '../api/client'
import { useSystemConfig } from '../hooks/useSystemConfig'
import { PageHeader, Button, Input, Textarea, Select, Modal } from '../components'
import { formatFileSize } from '../lib/formatFileSize'

const CLASSIFICATION_LEVELS = [
  { id: 'ISRO_LEVEL', label: 'ISRO Level — All Authenticated SPOA Personnel' },
  { id: 'MISSION_TEAM', label: 'Mission Team — Dedicated Spacecraft Ops Team' },
  { id: 'DIRECTORATE', label: 'Directorate — OD / SOM Mission Directors' },
  { id: 'RESTRICTED', label: 'Restricted — High-Security Air-Gapped Key' },
]

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

export function UploadReport() {
  const navigate = useNavigate()
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
  const [classification, setClassification] = useState<string>('ISRO_LEVEL')
  const [reportTitle, setReportTitle] = useState<string>('')
  const [reportDate, setReportDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  )
  const [version, setVersion] = useState<string>('V1.0')
  const [author, setAuthor] = useState<string>(user?.name || '')
  const [description, setDescription] = useState<string>('')
  const [enforceNaming, setEnforceNaming] = useState<boolean>(true)

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
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: systemConfig } = useSystemConfig()
  const maxUploadBytes = systemConfig?.maxUploadSizeBytes || 524288000

  const loadData = async () => {
    try {
      const [sats, depts, cats, presets] = await Promise.all([
        satellitesApi.getActiveSatellites().catch(() => []),
        departmentsApi.getUserDepartments().catch(() => departmentsApi.getPublicDepartments().catch(() => [])),
        reportPresetsApi.getCategories().catch(() => []),
        reportPresetsApi.getNamingPresets().catch(() => []),
      ])

      setSatellites(sats || [])
      setDepartments(depts || [])
      setCategories(cats || [])
      setNamingPresets(presets || [])

      if (sats && sats.length > 0) setSelectedSat(sats[0].id)
      if (depts && depts.length > 0) setSelectedDept(depts[0].id)
      if (cats && cats.length > 0) setSelectedCategoryCode(cats[0].code)

      const defPreset = presets?.find((p) => p.isDefault) || presets?.[0]
      if (defPreset) {
        setSelectedPresetId(defPreset.id)
        setActiveTemplate(defPreset.template)
      }
    } finally {
      setLoadingInitial(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Derive tokens for naming template replacement
  const activeSatObj = satellites.find((s) => s.id === selectedSat)
  const cleanSat = activeSatObj?.code
    ? activeSatObj.code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    : activeSatObj?.name
      ? activeSatObj.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()
      : 'EOS08'

  const activeDeptObj = departments.find((d) => d.id === selectedDept)
  const cleanDept = activeDeptObj?.code
    ? activeDeptObj.code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    : activeDeptObj?.name
      ? activeDeptObj.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()
      : 'MOX'

  const cleanType = selectedCategoryCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  const dateCompact = reportDate.replace(/-/g, '')
  const dateHyphen = reportDate
  const cleanVer = version.replace(/[^a-zA-Z0-9.]/g, '').toUpperCase() || 'V1.0'
  const cleanTitle = reportTitle.replace(/[^a-zA-Z0-9]/g, '') || 'Report'
  const cleanAuthor = author.replace(/[^a-zA-Z0-9]/g, '') || 'ISRO'
  const fileExt = file ? file.name.split('.').pop() || 'pdf' : 'pdf'

  // Dynamic template evaluator
  const evaluateTemplate = (templateStr: string) => {
    return templateStr
      .replace(/{SAT}/g, cleanSat)
      .replace(/{TYPE}/g, cleanType)
      .replace(/{DEPT}/g, cleanDept)
      .replace(/{YYYYMMDD}/g, dateCompact)
      .replace(/{YYYY-MM-DD}/g, dateHyphen)
      .replace(/{VER}/g, cleanVer)
      .replace(/{TITLE}/g, cleanTitle)
      .replace(/{AUTHOR}/g, cleanAuthor)
  }

  const generatedBaseName = evaluateTemplate(activeTemplate)
  const isroStandardName = `${generatedBaseName}.${fileExt}`
  const effectiveFileName = enforceNaming && file ? isroStandardName : file?.name || isroStandardName

  // Handle Preset selection change
  const handlePresetSelect = (presetId: string) => {
    setSelectedPresetId(presetId)
    if (presetId === 'custom') {
      setIsCustomTemplate(true)
    } else {
      setIsCustomTemplate(false)
      const found = namingPresets.find((p) => p.id === presetId)
      if (found) {
        setActiveTemplate(found.template)
      }
    }
  }

  // Insert token chip into active template
  const insertToken = (token: string) => {
    setActiveTemplate((prev) => (prev ? `${prev}_${token}` : token))
    setIsCustomTemplate(true)
    setSelectedPresetId('custom')
  }

  // Handle Creating Custom Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customCatName.trim() || !customCatCode.trim()) {
      addToast({ title: 'Validation', message: 'Name and Code are required', variant: 'warning' })
      return
    }

    setSavingCategory(true)
    try {
      const created = await reportPresetsApi.createCategory({
        name: customCatName.trim(),
        code: customCatCode.trim(),
        description: customCatDesc.trim() || undefined,
      })
      addToast({ title: 'Category Saved', message: `${created.name} added to presets`, variant: 'success' })
      setCategories((prev) => [...prev, created])
      setSelectedCategoryCode(created.code)
      setIsCategoryModalOpen(false)
      setCustomCatName('')
      setCustomCatCode('')
      setCustomCatDesc('')
    } catch (err: any) {
      addToast({
        title: 'Error',
        message: err.response?.data?.error?.message || 'Could not save category preset',
        variant: 'error',
      })
    } finally {
      setSavingCategory(false)
    }
  }

  // Handle Deleting Custom Category
  const handleDeleteCategory = async (id: string, name: string) => {
    try {
      await reportPresetsApi.deleteCategory(id)
      addToast({ title: 'Category Removed', message: `${name} deleted`, variant: 'info' })
      setCategories((prev) => prev.filter((c) => c.id !== id))
      if (categories.length > 0) {
        setSelectedCategoryCode(categories[0].code)
      }
    } catch (err: any) {
      addToast({
        title: 'Delete Failed',
        message: err.response?.data?.error?.message || 'Cannot delete category',
        variant: 'error',
      })
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
      setIsNamingModalOpen(false)
      setCustomPresetName('')
    } catch (err: any) {
      addToast({
        title: 'Error',
        message: err.response?.data?.error?.message || 'Could not save naming preset',
        variant: 'error',
      })
    } finally {
      setSavingPreset(false)
    }
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0]
      if (dropped.size > maxUploadBytes) {
        addToast({
          title: 'File Exceeds Limit',
          message: `Selected file (${formatFileSize(dropped.size)}) exceeds the maximum configured limit of ${formatFileSize(maxUploadBytes)}. Adjust this limit in System Settings if required.`,
          variant: 'error',
        })
        return
      }
      setFile(dropped)
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
          message: `Selected file (${formatFileSize(selected.size)}) exceeds the maximum configured limit of ${formatFileSize(maxUploadBytes)}. Adjust this limit in System Settings if required.`,
          variant: 'error',
        })
        return
      }
      setFile(selected)
      if (!reportTitle) {
        setReportTitle(selected.name.replace(/\.[^/.]+$/, ''))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
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
      const finalFileName = enforceNaming ? isroStandardName : file.name
      const renamedFile = new File([file], finalFileName, { type: file.type })

      const formData = new FormData()
      formData.append('file', renamedFile)
      formData.append('departmentId', selectedDept)
      formData.append('title', reportTitle || finalFileName)
      formData.append('description', description || '')
      formData.append('spacecraft', activeSatObj?.name || cleanSat)
      formData.append('category', selectedCategoryCode)
      formData.append('classificationLevel', classification)
      formData.append('versionLabel', version)

      setUploadProgress(40)

      await apiClient.post('/files/upload', formData, {
        onUploadProgress: (progressEvent: any) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            setUploadProgress(Math.max(40, Math.min(95, percent)))
          }
        },
      })

      setUploadProgress(100)
      addToast({
        title: 'Report Uploaded Successfully',
        message: `${finalFileName} ingested to ${activeSatObj?.name || 'Department Repository'}`,
        variant: 'success',
      })

      setTimeout(() => {
        navigate('/dashboard/files')
      }, 700)
    } catch (err: any) {
      addToast({
        title: 'Upload Failed',
        message: err.response?.data?.error?.message || 'Could not upload report to storage cluster',
        variant: 'error',
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="w-full space-y-6 pb-12">
      <div className="border-b border-border-subtle pb-5">
        <PageHeader
          eyebrow="SPOA Repository Architecture"
          title="Upload Mission Report"
          description="Standardized ingest pipeline adhering to custom report categories, configurable naming presets, and RBAC classifications."
        />
      </div>

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
              <div className="rounded-xl border border-border-default bg-card p-5 space-y-4 shadow-sm">
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
                      id="upload-sat"
                      value={selectedSat}
                      onChange={(e) => setSelectedSat(e.target.value)}
                      required
                    >
                      {satellites.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code || 'ISRO'})
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1.5">
                      Operational Division / Dept *
                    </label>
                    <Select
                      id="upload-dept"
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
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
                      id="upload-type"
                      value={selectedCategoryCode}
                      onChange={(e) => {
                        if (e.target.value === '__add_custom__') {
                          setIsCategoryModalOpen(true)
                        } else {
                          setSelectedCategoryCode(e.target.value)
                        }
                      }}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.code}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                      <option value="__add_custom__">+ Create New Custom Category…</option>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1.5">
                      Classification Level *
                    </label>
                    <Select
                      id="upload-class"
                      value={classification}
                      onChange={(e) => setClassification(e.target.value)}
                    >
                      {CLASSIFICATION_LEVELS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              {/* Section 2: Report Metadata & Versioning */}
              <div className="rounded-xl border border-border-default bg-card p-5 space-y-4 shadow-sm">
                <h3 className="text-xs font-bold text-accent-light uppercase tracking-wider flex items-center gap-2">
                  <FileText size={14} />
                  <span>2. Report Metadata & Version Details</span>
                </h3>

                <Input
                  id="report-title"
                  label="Report Title *"
                  placeholder="e.g. Daily Orbital Tracking & Telemetry Summary"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    id="report-date"
                    label="Report Date *"
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    required
                  />

                  <Input
                    id="report-ver"
                    label="Version Label *"
                    placeholder="V1.0"
                    value={version}
                    onChange={(e) => setVersion(e.target.value.toUpperCase())}
                    required
                  />

                  <Input
                    id="report-author"
                    label="Author / Officer *"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    required
                  />
                </div>

                <Textarea
                  id="report-desc"
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
                      id="naming-preset-select"
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
                        className="num w-full rounded-lg border border-border-default bg-[#050b16] px-3 py-1.5 text-xs text-accent-light outline-none focus:border-accent"
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
              <div className="rounded-xl border border-border-default bg-card p-5 space-y-4 shadow-sm flex flex-col justify-between h-full">
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
                      file
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

                    {file ? (
                      <div className="space-y-2">
                        <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-nominal/20 text-nominal border border-nominal/30">
                          <CheckCircle2 size={24} />
                        </div>
                        <p className="text-xs font-bold text-white truncate max-w-xs mx-auto">
                          {file.name}
                        </p>
                        <p className="num text-[11px] text-text-dim">
                          {formatFileSize(file.size)}
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
                        <p className="text-[10px] text-text-dim">
                          Supported formats: PDF, DOCX, XLSX, CSV, TXT, DAT (Up to {formatFileSize(maxUploadBytes)})
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Upload Progress & Ingest Action */}
                <div className="space-y-3 pt-4 border-t border-border-subtle">
                  {uploading && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-text-muted">Ingesting to RAID array…</span>
                        <span className="num font-bold text-accent-light">{uploadProgress}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-border-subtle overflow-hidden">
                        <div
                          className="h-full bg-accent transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={uploading || !file}
                    className="w-full shadow-lg shadow-accent/25 justify-center"
                  >
                    <Upload size={16} />
                    <span>{uploading ? 'Ingesting File…' : 'Ingest & Publish Report'}</span>
                  </Button>

                  <p className="text-[10px] text-text-dim text-center leading-relaxed">
                    Uploaded telemetry reports are cryptographically hashed (SHA-256) and tracked in immutable audit trails.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Modal 1: Create Custom Report Category */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Create & Save Custom Report Category"
      >
        <form onSubmit={handleCreateCategory} className="space-y-4">
          <Input
            id="custom-cat-name"
            label="Category Name *"
            placeholder="e.g. Thermal Subsystem Telemetry"
            value={customCatName}
            onChange={(e) => {
              setCustomCatName(e.target.value)
              if (!customCatCode) {
                setCustomCatCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase())
              }
            }}
            required
          />

          <Input
            id="custom-cat-code"
            label="Short Category Code (Used in Filenames) *"
            placeholder="e.g. THERMAL"
            value={customCatCode}
            onChange={(e) => setCustomCatCode(e.target.value.toUpperCase())}
            hint="Uppercase alphanumeric short code inserted into {TYPE} token."
            required
          />

          <Textarea
            id="custom-cat-desc"
            label="Description (Optional)"
            rows={2}
            placeholder="Describe when this report category is utilized…"
            value={customCatDesc}
            onChange={(e) => setCustomCatDesc(e.target.value)}
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsCategoryModalOpen(false)}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={savingCategory}
              className="shadow-lg shadow-accent/25"
            >
              {savingCategory ? 'Saving Category…' : 'Save Category Preset'}
            </Button>
          </div>
        </form>

        {/* Existing Custom Categories List */}
        {categories.filter((c) => !c.isSystem).length > 0 && (
          <div className="mt-5 pt-4 border-t border-border-subtle space-y-2">
            <h4 className="text-[11px] font-bold text-text-dim uppercase tracking-wider">
              Saved Custom Categories
            </h4>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {categories
                .filter((c) => !c.isSystem)
                .map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between rounded-lg border border-border-subtle bg-[#060c18] px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="font-bold text-white">{cat.name}</span>{' '}
                      <code className="num text-accent-light text-[11px]">({cat.code})</code>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat.id, cat.name)}
                      className="p-1 rounded text-text-dim hover:text-critical hover:bg-critical/10 transition-colors"
                      title="Delete category preset"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal 2: Save Custom Naming Preset */}
      <Modal
        isOpen={isNamingModalOpen}
        onClose={() => setIsNamingModalOpen(false)}
        title="Save Custom Naming Convention Preset"
      >
        <form onSubmit={handleSaveNamingPreset} className="space-y-4">
          <Input
            id="custom-preset-name"
            label="Preset Name *"
            placeholder="e.g. Flight Dynamics High-Precision Format"
            value={customPresetName}
            onChange={(e) => setCustomPresetName(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1.5">
              Template Pattern String
            </label>
            <input
              type="text"
              value={activeTemplate}
              onChange={(e) => setActiveTemplate(e.target.value)}
              className="num w-full rounded-lg border border-border-default bg-[#09101f] px-3 py-2 text-xs text-accent-light outline-none focus:border-accent"
              required
            />
          </div>

          <div className="rounded-lg border border-border-subtle bg-[#060c18] p-3">
            <p className="text-[11px] text-text-dim">Preview of this template:</p>
            <p className="num text-xs font-bold text-white mt-1 break-all">
              {effectiveFileName}
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsNamingModalOpen(false)}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={savingPreset}
              className="shadow-lg shadow-accent/25"
            >
              {savingPreset ? 'Saving Preset…' : 'Save Naming Preset'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
