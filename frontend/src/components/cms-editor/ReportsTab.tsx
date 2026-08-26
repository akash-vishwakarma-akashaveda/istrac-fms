import { useEffect, useState } from 'react'
import {
  Plus,
  Trash2,
  Search,
  FileText,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react'
import { useCms } from '../../context/cmsContext'
import { usePreviewRefresh } from '../../context/PreviewRefreshContext'
import { useUpdateCmsBlock } from '../../hooks/useUpdateCmsBlock'
import { useToastStore } from '../../store/toastStore'
import { Button, Input, Panel, Textarea } from '..'
import { SaveBar } from './SaveBar'
import { apiClient } from '../../api/client'
import { formatFileSize } from '../../lib/formatFileSize'
import type { FeaturedReportItem } from '../FeaturedReports'

interface RepositoryFile {
  id: string
  name: string
  extension: string
  sizeBytes: string
  department: string
  departmentId: string
  satellite: string
  uploader: string
  createdAt: string
}

const EXTENSIONS = ['BIN', 'DAT', 'PDF', 'CSV', 'LOG', 'JSON', 'ZIP']

export function ReportsTab() {
  const { cmsBlocks } = useCms()
  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  const existing = cmsBlocks['featured_reports'] as
    | {
        title?: string
        subtitle?: string
        items?: FeaturedReportItem[]
      }
    | undefined

  const [items, setItems] = useState<FeaturedReportItem[]>([])

  // Repository files for 1-click feature selection
  const [repoFiles, setRepoFiles] = useState<RepositoryFile[]>([])
  const [repoLoading, setRepoLoading] = useState(false)
  const [fileSearch, setFileSearch] = useState('')

  useEffect(() => {
    setItems(existing?.items ?? [])
  }, [existing])

  // Load real files from the repository
  const fetchRepoFiles = async () => {
    setRepoLoading(true)
    try {
      const res = await apiClient.get('/admin/files/repository-list', {
        params: {
          search: fileSearch || undefined,
        },
      })
      if (res.data?.data) {
        setRepoFiles(res.data.data)
      }
    } catch {
      // fallback
    } finally {
      setRepoLoading(false)
    }
  }

  useEffect(() => {
    fetchRepoFiles()
  }, [fileSearch])

  // Toggle featuring a repository file with 1 click
  const toggleFeatureFile = (file: RepositoryFile) => {
    const isAlreadyFeatured = items.some((item) => item.id === file.id || item.filename === file.name)

    if (isAlreadyFeatured) {
      // Remove from featured
      setItems((prev) => prev.filter((item) => item.id !== file.id && item.filename !== file.name))
      addToast({ message: `Unfeatured "${file.name}"`, variant: 'info' })
    } else {
      // Add to featured with default metadata
      const newItem: FeaturedReportItem = {
        id: file.id,
        title: file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
        filename: file.name,
        department: file.department,
        satellite: file.satellite || 'Primary Fleet',
        fileSize: formatFileSize(Number(file.sizeBytes) || 0),
        extension: file.extension || 'DAT',
        date: file.createdAt.split('T')[0],
        classification: 'RESTRICTED',
        description: `Official telemetry archive and observation report for ${file.satellite}.`,
      }
      setItems((prev) => [newItem, ...prev])
      addToast({ message: `Added "${file.name}" to Featured Index`, variant: 'success' })
    }
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        id: `rep-${Date.now()}`,
        title: 'New Mission Telemetry Report',
        filename: 'MISSION_TELEMETRY_LOG.bin',
        department: 'TTC',
        satellite: 'Primary Satellite',
        fileSize: '256.0 MB',
        extension: 'BIN',
        date: new Date().toISOString().split('T')[0],
        classification: 'RESTRICTED',
        description: 'Telemetry archive dataset.',
      },
    ])
  }

  function updateItem(index: number, patch: Partial<FeaturedReportItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSave() {
    updateBlock.mutate(
      {
        blockKey: 'featured_reports',
        content: { items },
      },
      {
        onSuccess: () => {
          addToast({ message: 'Featured Reports & Files updated on public portal', variant: 'success' })
          triggerRefresh()
        },
        onError: () => {
          addToast({ message: 'Failed to save featured reports', variant: 'error' })
        },
      }
    )
  }

  return (
    <div className="space-y-5">
      {/* SECTION 1: 1-CLICK REPOSITORY FILE SELECTOR */}
      <div className="rounded-xl border border-border-default bg-card p-4 space-y-3 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#FF6B00]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              1-Click File Repository Ingest
            </h3>
          </div>
          <span className="text-[11px] text-text-dim">
            Tick mark any repository file to feature it on the public portal
          </span>
        </div>

        {/* Live Search & Filter Bar */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
          />
          <input
            type="text"
            placeholder="Search repository files by name, extension, satellite..."
            value={fileSearch}
            onChange={(e) => setFileSearch(e.target.value)}
            className="w-full rounded-lg border border-border-default bg-[#060c18] pl-9 pr-3 py-2 text-xs text-white placeholder:text-text-dim outline-none focus:border-accent"
          />
        </div>

        {/* Repository File List with Checkboxes */}
        <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 scrollbar-none">
          {repoLoading ? (
            <div className="py-6 text-center text-xs text-text-dim">Scanning repository files…</div>
          ) : repoFiles.length === 0 ? (
            <div className="py-6 text-center text-xs text-text-dim">No matching repository files found.</div>
          ) : (
            repoFiles.map((file) => {
              const isFeatured = items.some(
                (item) => item.id === file.id || item.filename === file.name
              )

              return (
                <div
                  key={file.id}
                  onClick={() => toggleFeatureFile(file)}
                  className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                    isFeatured
                      ? 'border-accent bg-accent/10 text-white'
                      : 'border-border-subtle bg-[#060c18] hover:border-border-default hover:bg-card-hover text-text-secondary'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isFeatured ? (
                      <CheckSquare size={16} className="text-accent-light shrink-0" />
                    ) : (
                      <Square size={16} className="text-text-dim shrink-0" />
                    )}

                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate text-white">{file.name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-text-dim num">
                        <span className="text-accent-light font-bold">/{file.department}</span>
                        <span>·</span>
                        <span>{file.satellite}</span>
                        <span>·</span>
                        <span>{formatFileSize(Number(file.sizeBytes) || 0)}</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase num ${
                      isFeatured ? 'bg-accent/20 text-accent-light' : 'bg-surface text-text-dim'
                    }`}
                  >
                    {isFeatured ? 'FEATURED' : file.extension}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* SECTION 2: EDIT FEATURED DATASETS LIST */}
      <Panel
        title="Featured Mission Reports & Files Index"
        meta={`${items.length} file${items.length === 1 ? '' : 's'} active on landing portal`}
        flush
      >
        <div className="p-4 space-y-4">
          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={item.id || index}
                className="rounded-xl border border-border-subtle bg-surface p-3.5 space-y-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="num text-xs font-bold text-accent-light flex items-center gap-1.5">
                    <FileText size={14} />
                    <span>Featured Item #{index + 1}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    aria-label={`Remove file ${index + 1}`}
                    className="p-1 text-text-dim hover:text-critical transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <Input
                      id={`rep-title-${index}`}
                      label="Public Title"
                      value={item.title}
                      onChange={(e) => updateItem(index, { title: e.target.value })}
                    />
                  </div>

                  <div>
                    <label htmlFor={`rep-ext-${index}`} className="col-label block mb-1.5">
                      Extension Tag
                    </label>
                    <select
                      id={`rep-ext-${index}`}
                      value={item.extension}
                      onChange={(e) => updateItem(index, { extension: e.target.value })}
                      className="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-xs text-text-primary focus:border-accent"
                    >
                      {EXTENSIONS.map((ext) => (
                        <option key={ext} value={ext}>
                          {ext}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    id={`rep-file-${index}`}
                    label="Filename (Physical Record)"
                    value={item.filename}
                    onChange={(e) => updateItem(index, { filename: e.target.value })}
                    className="num font-mono text-xs"
                  />

                  <Input
                    id={`rep-sat-${index}`}
                    label="Satellite / Spacecraft"
                    value={item.satellite}
                    onChange={(e) => updateItem(index, { satellite: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Input
                    id={`rep-dept-${index}`}
                    label="Department"
                    value={item.department}
                    onChange={(e) => updateItem(index, { department: e.target.value })}
                  />

                  <Input
                    id={`rep-size-${index}`}
                    label="File Size"
                    value={item.fileSize}
                    onChange={(e) => updateItem(index, { fileSize: e.target.value })}
                    className="num"
                  />

                  <Input
                    id={`rep-date-${index}`}
                    label="Date"
                    value={item.date}
                    onChange={(e) => updateItem(index, { date: e.target.value })}
                    className="num"
                  />
                </div>

                <Textarea
                  id={`rep-desc-${index}`}
                  label="Description & Telemetry Parameters"
                  rows={2}
                  value={item.description || ''}
                  onChange={(e) => updateItem(index, { description: e.target.value })}
                />
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full">
            <Plus size={13} strokeWidth={2.2} />
            <span>Add Custom External Entry</span>
          </Button>

          <SaveBar onSave={handleSave} isPending={updateBlock.isPending} />
        </div>
      </Panel>
    </div>
  )
}
