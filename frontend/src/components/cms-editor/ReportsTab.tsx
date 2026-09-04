import { useEffect, useState } from "react"
import {
  Trash2,
  Search,
  RefreshCw,
  Star,
  Sparkles,
} from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useCms } from "../../context/cmsContext"
import { usePreviewRefresh } from "../../context/PreviewRefreshContext"
import { useUpdateCmsBlock } from "../../hooks/useUpdateCmsBlock"
import { useToastStore } from "../../store/toastStore"
import { Panel, Input, Textarea } from ".."
import { SaveBar } from "./SaveBar"
import { apiClient } from "../../api/client"
import { formatFileSize } from "../../lib/formatFileSize"
import { ConfirmFeatureModal } from "../ConfirmFeatureModal"

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
  isFeatured?: boolean
}

export function ReportsTab() {
  const queryClient = useQueryClient()
  const { cmsBlocks } = useCms()
  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  const existing = cmsBlocks["featured_reports"] as
    | {
        title?: string
        subtitle?: string
      }
    | undefined

  const [title, setTitle] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [repoFiles, setRepoFiles] = useState<RepositoryFile[]>([])
  const [repoLoading, setRepoLoading] = useState(false)
  const [fileSearch, setFileSearch] = useState("")
  const [filterFeaturedOnly, setFilterFeaturedOnly] = useState(false)
  const [featureConfirmFile, setFeatureConfirmFile] = useState<{
    id: string
    name: string
    isFeatured?: boolean
  } | null>(null)

  useEffect(() => {
    setTitle(existing?.title ?? "Featured Mission Reports & Datasets")
    setSubtitle(
      existing?.subtitle ??
        "Public mission telemetry archive and observation reports. Viewable directly in-browser without login; raw telemetry streams and datasets can be downloaded instantly."
    )
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
      addToast({ message: "Failed to load repository files", variant: "error" })
    } finally {
      setRepoLoading(false)
    }
  }

  useEffect(() => {
    fetchRepoFiles()
  }, [fileSearch])

  // Save Header CMS Block
  function handleSaveHeader() {
    updateBlock.mutate(
      {
        blockKey: "featured_reports",
        content: { title, subtitle },
      },
      {
        onSuccess: () => {
          addToast({ message: "Featured Section headers updated on public portal", variant: "success" })
          triggerRefresh()
        },
        onError: () => {
          addToast({ message: "Failed to save section headers", variant: "error" })
        },
      }
    )
  }

  // Handle when modal confirms feature toggle
  const handleFeatureSuccess = (updated: { id: string; isFeatured: boolean }) => {
    setRepoFiles((prev) =>
      prev.map((f) => (f.id === updated.id ? { ...f, isFeatured: updated.isFeatured } : f))
    )
    queryClient.invalidateQueries({ queryKey: ["dept-files"] })
    queryClient.invalidateQueries({ queryKey: ["admin-files"] })
    triggerRefresh()
    window.dispatchEvent(new CustomEvent("istrac:featured-refresh"))
    try {
      const iframes = document.querySelectorAll("iframe")
      iframes.forEach((ifr) => {
        ifr.contentWindow?.postMessage({ type: "REFRESH_FEATURED" }, "*")
      })
    } catch {}
  }

  const currentlyFeatured = repoFiles.filter((f) => f.isFeatured)
  const displayedRepoFiles = filterFeaturedOnly
    ? repoFiles.filter((f) => f.isFeatured)
    : repoFiles

  return (
    <div className="space-y-6">
      {/* UNIFIED SYNC NOTICE BANNER */}
      <div className="flex items-start gap-3.5 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
          <Sparkles size={18} />
        </div>
        <div className="space-y-1 text-xs">
          <h4 className="font-bold text-white flex items-center gap-2">
            <span>Unified Featured Showcase</span>
            <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono font-bold">
              {currentlyFeatured.length} Publicly Showcased
            </span>
          </h4>
          <p className="text-text-secondary leading-relaxed">
            Featured files here and starred files in the <strong>File Repository</strong> are directly synchronized in the database.
            Featuring a file enables visitors to view and download it from the public landing page without signing in.
          </p>
        </div>
      </div>

      {/* SECTION 1: SECTION HEADINGS CMS CUSTOMIZATION */}
      <Panel title="Section Heading & Intro" meta="block:featured_reports">
        <div className="space-y-4">
          <Input
            id="featured-section-title"
            label="Section Display Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Featured Mission Reports & Datasets"
          />

          <Textarea
            id="featured-section-subtitle"
            label="Section Descriptive Subtitle"
            rows={2}
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Public mission telemetry archive and observation reports..."
          />

          <SaveBar onSave={handleSaveHeader} isPending={updateBlock.isPending} />
        </div>
      </Panel>

      {/* SECTION 2: CURRENTLY FEATURED REPORTS LIST */}
      <Panel
        title="Active Featured Mission Reports"
        meta={`${currentlyFeatured.length} Live on Landing Page`}
      >
        <div className="space-y-4">
          {currentlyFeatured.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-dim border border-dashed border-border-subtle rounded-xl space-y-2">
              <Star size={20} className="mx-auto text-amber-400/50" />
              <p className="font-bold text-white">No Mission Reports Currently Featured</p>
              <p className="max-w-md mx-auto text-text-muted">
                Star files from the repository catalog below or from the <strong>File Repository</strong> page to feature them here.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {currentlyFeatured.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-amber-500/30 bg-[#060c18] hover:border-amber-500/50 transition-all shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() =>
                        setFeatureConfirmFile({ id: item.id, name: item.name, isFeatured: true })
                      }
                      className="p-1.5 rounded-lg border border-amber-500/50 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-all cursor-pointer shrink-0"
                      title="Click to unfeature this report"
                    >
                      <Star size={15} className="fill-amber-400 text-amber-400" />
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white truncate">{item.name}</span>
                        <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 text-[9px] font-bold text-amber-300 uppercase">
                          Featured
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-text-dim num mt-0.5">
                        <span className="text-accent-light font-bold">{item.department}</span>
                        <span>·</span>
                        <span>{item.satellite}</span>
                        <span>·</span>
                        <span>{formatFileSize(Number(item.sizeBytes) || 0)}</span>
                        <span>·</span>
                        <span className="uppercase font-bold">{item.extension}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setFeatureConfirmFile({ id: item.id, name: item.name, isFeatured: true })
                      }
                      className="px-2.5 py-1 rounded-lg border border-border-default bg-surface text-text-dim hover:border-critical hover:text-critical transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      title="Remove from public showcase"
                    >
                      <Trash2 size={12} />
                      <span className="hidden sm:inline">Unfeature</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>

      {/* SECTION 3: REPOSITORY BROWSER & STAR SELECTOR */}
      <Panel
        title="File Repository Explorer"
        meta={`${displayedRepoFiles.length} files available`}
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3">
            <p className="text-xs text-text-secondary">
              Click the <strong>Star</strong> in front of any repository file to toggle its featured showcase status.
            </p>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setFilterFeaturedOnly(!filterFeaturedOnly)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                  filterFeaturedOnly
                    ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                    : "bg-[#060c18] border-border-default text-text-dim hover:text-amber-400 hover:border-amber-500/40"
                }`}
              >
                <Star size={12} className={filterFeaturedOnly ? "fill-white" : "fill-amber-400 text-amber-400"} />
                <span>{filterFeaturedOnly ? "Show All Files" : "Filter Featured Only"}</span>
              </button>

              <button
                type="button"
                onClick={fetchRepoFiles}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border-default bg-[#060c18] text-accent-light hover:underline"
              >
                <RefreshCw size={12} className={repoLoading ? "animate-spin" : ""} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Live Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
            <input
              type="text"
              placeholder="Search repository by name, extension, satellite, division..."
              value={fileSearch}
              onChange={(e) => setFileSearch(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-[#060c18] pl-9 pr-3 py-2 text-xs text-white placeholder:text-text-dim outline-none focus:border-accent"
            />
          </div>

          {/* Repository Files List */}
          <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
            {repoLoading ? (
              <div className="py-12 text-center text-xs text-text-dim flex flex-col items-center justify-center gap-2">
                <RefreshCw size={18} className="animate-spin text-accent-light" />
                <span>Loading files from storage repository…</span>
              </div>
            ) : displayedRepoFiles.length === 0 ? (
              <div className="py-10 text-center text-xs text-text-dim border border-dashed border-border-subtle rounded-xl">
                No files found matching "{fileSearch || "all"}".
              </div>
            ) : (
              displayedRepoFiles.map((file) => (
                <div
                  key={file.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    file.isFeatured
                      ? "border-amber-500/40 bg-amber-500/[0.07] text-white shadow-sm"
                      : "border-border-subtle bg-[#060c18] hover:border-border-default text-text-secondary"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Star in front */}
                    <button
                      type="button"
                      onClick={() =>
                        setFeatureConfirmFile({
                          id: file.id,
                          name: file.name,
                          isFeatured: file.isFeatured,
                        })
                      }
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
                        file.isFeatured
                          ? "border-amber-500/50 bg-amber-500/20 text-amber-400"
                          : "border-border-subtle bg-surface text-text-dim hover:text-amber-400 hover:border-amber-500/40"
                      }`}
                      title={
                        file.isFeatured
                          ? "⭐ Featured in Public Mission Reports (Click to unfeature)"
                          : "Click to feature in Public Mission Reports"
                      }
                    >
                      <Star size={15} className={file.isFeatured ? "fill-amber-400 text-amber-400" : ""} />
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold truncate text-white">{file.name}</p>
                        {file.isFeatured && (
                          <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 text-[9px] font-bold text-amber-300 uppercase">
                            Featured
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-text-dim num mt-0.5">
                        <span className="text-accent-light font-bold">{file.department}</span>
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
                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase num shrink-0 ${
                      file.isFeatured
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-extrabold"
                        : "bg-surface text-text-dim border border-border-subtle"
                    }`}
                  >
                    {file.extension}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </Panel>

      {/* CONFIRM FEATURE / UNFEATURE MODAL */}
      <ConfirmFeatureModal
        isOpen={featureConfirmFile !== null}
        file={featureConfirmFile}
        onClose={() => setFeatureConfirmFile(null)}
        onSuccess={handleFeatureSuccess}
      />
    </div>
  )
}
