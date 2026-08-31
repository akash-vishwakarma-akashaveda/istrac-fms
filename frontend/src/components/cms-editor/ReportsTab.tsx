import { useEffect, useState } from "react"
import {
  Trash2,
  Search,
  FileText,
  CheckSquare,
  Square,
  HardDrive,
  RefreshCw,
} from "lucide-react"
import { useCms } from "../../context/cmsContext"
import { usePreviewRefresh } from "../../context/PreviewRefreshContext"
import { useUpdateCmsBlock } from "../../hooks/useUpdateCmsBlock"
import { useToastStore } from "../../store/toastStore"
import { Panel } from ".."
import { SaveBar } from "./SaveBar"
import { apiClient } from "../../api/client"
import { formatFileSize } from "../../lib/formatFileSize"
import type { FeaturedReportItem } from "../FeaturedReports"

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

export function ReportsTab() {
  const { cmsBlocks } = useCms()
  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  const existing = cmsBlocks["featured_reports"] as
    | {
        title?: string
        subtitle?: string
        items?: FeaturedReportItem[]
      }
    | undefined

  const [items, setItems] = useState<FeaturedReportItem[]>([])
  const [repoFiles, setRepoFiles] = useState<RepositoryFile[]>([])
  const [repoLoading, setRepoLoading] = useState(false)
  const [fileSearch, setFileSearch] = useState("")

  useEffect(() => {
    setItems(existing?.items ?? [])
  }, [existing])

  // Load real files from the database repository
  const fetchRepoFiles = async () => {
    setRepoLoading(true)
    try {
      const res = await apiClient.get("/admin/files/repository-list", {
        params: {
          search: fileSearch || undefined,
        },
      })
      if (res.data?.data) {
        setRepoFiles(res.data.data)
      }
    } catch {
      // ignore
    } finally {
      setRepoLoading(false)
    }
  }

  useEffect(() => {
    fetchRepoFiles()
  }, [fileSearch])

  // Toggle selection of existing repository file
  const toggleFeatureFile = (file: RepositoryFile) => {
    const isAlreadyFeatured = items.some(
      (item) => item.id === file.id || item.filename === file.name
    )

    if (isAlreadyFeatured) {
      setItems((prev) => prev.filter((item) => item.id !== file.id && item.filename !== file.name))
      addToast({ message: `Unfeatured "${file.name}"`, variant: "info" })
    } else {
      const newItem: FeaturedReportItem = {
        id: file.id,
        title: file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
        filename: file.name,
        department: file.department,
        satellite: file.satellite || "Primary Fleet",
        fileSize: formatFileSize(Number(file.sizeBytes) || 0),
        extension: file.extension || "DAT",
        date: file.createdAt ? file.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
        classification: "RESTRICTED",
        description: `Official telemetry archive and observation report for ${file.satellite || file.department}.`,
      }
      setItems((prev) => [newItem, ...prev])
      addToast({ message: `Selected "${file.name}" as featured`, variant: "success" })
    }
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSave() {
    updateBlock.mutate(
      {
        blockKey: "featured_reports",
        content: { items },
      },
      {
        onSuccess: () => {
          addToast({ message: "Featured Datasets updated on public portal", variant: "success" })
          triggerRefresh()
        },
        onError: () => {
          addToast({ message: "Failed to save featured datasets", variant: "error" })
        },
      }
    )
  }

  return (
    <div className="space-y-5">
      {/* SECTION 1: REPOSITORY FILE SELECTION */}
      <Panel
        title="Featured Repository Files"
        meta={`${items.length} of ${repoFiles.length} selected`}
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border-subtle pb-3">
            <div className="flex items-center gap-2">
              <HardDrive size={16} className="text-accent-light" />
              <p className="text-xs text-text-secondary">
                Simply click on any uploaded file to feature or unfeature it on the landing page.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchRepoFiles}
              className="flex items-center gap-1.5 text-xs text-accent-light hover:underline shrink-0"
            >
              <RefreshCw size={12} className={repoLoading ? "animate-spin" : ""} />
              <span>Refresh repository</span>
            </button>
          </div>

          {/* Live Search */}
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
            />
            <input
              type="text"
              placeholder="Search files by name, extension, satellite, department..."
              value={fileSearch}
              onChange={(e) => setFileSearch(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-[#060c18] pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-text-dim outline-none focus:border-accent"
            />
          </div>

          {/* Repository File List */}
          <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1 scrollbar-none">
            {repoLoading ? (
              <div className="py-12 text-center text-xs text-text-dim flex flex-col items-center justify-center gap-2">
                <RefreshCw size={16} className="animate-spin text-accent-light" />
                <span>Loading files from storage repository…</span>
              </div>
            ) : repoFiles.length === 0 ? (
              <div className="py-10 text-center text-xs text-text-dim border border-dashed border-border-subtle rounded-lg">
                No files found in the storage repository matching "{fileSearch || "all"}". Upload files in the File Repositories section to feature them here.
              </div>
            ) : (
              repoFiles.map((file) => {
                const isFeatured = items.some(
                  (item) => item.id === file.id || item.filename === file.name
                )

                return (
                  <div
                    key={file.id}
                    onClick={() => toggleFeatureFile(file)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      isFeatured
                        ? "border-accent bg-accent/10 text-white shadow-sm"
                        : "border-border-subtle bg-[#060c18] hover:border-border-default hover:bg-card-hover text-text-secondary"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isFeatured ? (
                        <CheckSquare size={18} className="text-accent-light shrink-0" />
                      ) : (
                        <Square size={18} className="text-text-dim shrink-0" />
                      )}

                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate text-white">{file.name}</p>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-text-dim num mt-0.5">
                          <span className="text-accent-light font-bold">/{file.department}</span>
                          <span>·</span>
                          <span>{file.satellite}</span>
                          <span>·</span>
                          <span>{formatFileSize(Number(file.sizeBytes) || 0)}</span>
                          <span>·</span>
                          <span>Uploaded by {file.uploader}</span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`rounded px-2.5 py-1 text-[10px] font-bold uppercase num shrink-0 ${
                        isFeatured ? "bg-accent/25 text-accent-light border border-accent/40 font-extrabold" : "bg-surface text-text-dim"
                      }`}
                    >
                      {isFeatured ? "FEATURED" : file.extension}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </Panel>

      {/* SECTION 2: CURRENTLY FEATURED SUMMARY LIST */}
      <Panel
        title="Featured Files Preview List"
        meta={`${items.length} active on landing portal`}
      >
        <div className="space-y-4">
          {items.length === 0 ? (
            <div className="py-6 text-center text-xs text-text-dim border border-dashed border-border-subtle rounded-lg">
              No files selected. Click any file in the list above to feature it.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, index) => (
                <div
                  key={item.id || index}
                  className="flex items-center justify-between p-3 rounded-lg border border-border-subtle bg-[#060c18]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText size={15} className="text-accent-light shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">
                        {item.filename}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-text-dim num">
                        <span>{item.department}</span>
                        <span>·</span>
                        <span>{item.satellite}</span>
                        <span>·</span>
                        <span>{item.fileSize}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    aria-label={`Unfeature file ${index + 1}`}
                    className="p-1.5 text-text-dim hover:text-critical transition-colors rounded hover:bg-critical/10 shrink-0"
                    title="Remove from featured list"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <SaveBar onSave={handleSave} isPending={updateBlock.isPending} />
        </div>
      </Panel>
    </div>
  )
}
