import { useState, useRef, useEffect } from "react"
import {
  FileText,
  Eye,
  Download,
  FileCode,
  FileSpreadsheet,
  Filter,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Star,
  Sparkles,
} from "lucide-react"
import { useAuthStore } from "../store/authStore"
import { useCms } from "../context/cmsContext"
import { apiClient } from "../api/client"
import { formatFileSize } from "../lib/formatFileSize"
import { FilePreviewModal } from "./FilePreviewModal"
import { ConfirmFeatureModal } from "./ConfirmFeatureModal"
import type { FileNode } from "../types/file"

export interface FeaturedReportItem {
  id: string
  title: string
  filename: string
  department: string
  departmentName?: string
  departmentCode?: string
  departmentId?: string
  satellite: string
  fileSize: string
  extension: string
  mimeType?: string | null
  date: string
  classification?: string
  description?: string
  isFeatured?: boolean
  versionCount?: number
  versionLabel?: string
}

const EXT_CONFIG: Record<
  string,
  { label: string; badge: string; icon: typeof FileText }
> = {
  BIN: { label: "BIN", badge: "bg-accent/15 text-accent-light border-accent/30", icon: FileCode },
  DAT: { label: "DAT", badge: "bg-nominal/15 text-nominal border-nominal/30", icon: FileCode },
  PDF: { label: "PDF", badge: "bg-critical/15 text-critical border-critical/30", icon: FileText },
  CSV: { label: "CSV", badge: "bg-warning/15 text-warning border-warning/30", icon: FileSpreadsheet },
  DOCX: { label: "DOCX", badge: "bg-blue-400/15 text-blue-400 border-blue-400/30", icon: FileText },
  XLSX: { label: "XLSX", badge: "bg-emerald-400/15 text-emerald-400 border-emerald-400/30", icon: FileSpreadsheet },
  ZIP: { label: "ZIP", badge: "bg-amber-400/15 text-amber-400 border-amber-400/30", icon: FileText },
  LOG: { label: "LOG", badge: "bg-purple-400/15 text-purple-400 border-purple-400/30", icon: FileText },
}

function isViewableFormat(ext: string, mime?: string | null): boolean {
  const e = ext.toUpperCase()
  if (["PDF", "PNG", "JPG", "JPEG", "WEBP", "GIF", "SVG", "TXT", "LOG", "JSON", "CSV"].includes(e)) return true
  if (mime && (mime.startsWith("image/") || mime.startsWith("text/") || mime === "application/pdf")) return true
  return false
}

export function FeaturedReports() {
  const user = useAuthStore((s) => s.user)
  const { cmsBlocks } = useCms()

  const [dbFiles, setDbFiles] = useState<FeaturedReportItem[]>([])
  const [selectedDept, setSelectedDept] = useState<string>("ALL")
  const [previewFile, setPreviewFile] = useState<FileNode | null>(null)
  const [featureConfirmFile, setFeatureConfirmFile] = useState<{ id: string; name: string; isFeatured?: boolean } | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const carouselRef = useRef<HTMLDivElement>(null)

  const fetchFeaturedFiles = () => {
    apiClient
      .get("/files/featured-list")
      .then((res) => {
        if (res.data?.data && res.data.data.length > 0) {
          const mapped: FeaturedReportItem[] = res.data.data.map((f: any) => ({
            id: f.id,
            title: f.title || f.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
            filename: f.filename || f.name,
            department: f.department || f.departmentCode || "TTC",
            departmentName: f.departmentName,
            departmentCode: f.departmentCode,
            departmentId: f.departmentId,
            satellite: f.satellite || "Primary Fleet",
            fileSize: formatFileSize(Number(f.sizeBytes) || 0),
            extension: (f.extension || "DAT").toUpperCase(),
            mimeType: f.mimeType || null,
            date: f.date || (f.createdAt ? f.createdAt.split("T")[0] : new Date().toISOString().split("T")[0]),
            classification: f.classification || "RESTRICTED",
            description: f.description || `Official telemetry archive and observation report for ${f.satellite || f.department}.`,
            isFeatured: Boolean(f.isFeatured),
          }))
          setDbFiles(mapped)
        } else {
          setDbFiles([])
        }
      })
      .catch(() => {
        setDbFiles([])
      })
  }

  useEffect(() => {
    fetchFeaturedFiles()

    const handleRefresh = () => {
      fetchFeaturedFiles()
    }

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "REFRESH_FEATURED" || e.data?.type === "CMS_SCROLL_TO") {
        fetchFeaturedFiles()
      }
    }

    window.addEventListener("istrac:featured-refresh", handleRefresh)
    window.addEventListener("message", handleMessage)
    return () => {
      window.removeEventListener("istrac:featured-refresh", handleRefresh)
      window.removeEventListener("message", handleMessage)
    }
  }, [cmsBlocks])

  const rawReports = dbFiles.filter((r) => r.isFeatured)
  const departments = ["ALL", ...Array.from(new Set(rawReports.map((r) => r.department)))]

  const filtered =
    selectedDept === "ALL"
      ? rawReports
      : rawReports.filter((r) => r.department.toUpperCase() === selectedDept.toUpperCase())

  const handleDownload = async (e: React.MouseEvent, item: FeaturedReportItem) => {
    e.stopPropagation()
    if (downloadingId === item.id) return
    setDownloadingId(item.id)
    try {
      const res = await apiClient.get(`/files/${item.id}/download`, { responseType: "blob" })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement("a")
      a.href = url
      a.download = item.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Direct download failed:", err)
    } finally {
      setDownloadingId(null)
    }
  }

  const handleOpenPreview = (item: FeaturedReportItem) => {
    const ext = (item.extension || "DAT").toUpperCase()
    if (isViewableFormat(ext, item.mimeType)) {
      setPreviewFile({
        id: item.id,
        name: item.filename,
        nodeType: "FILE",
        departmentId: item.departmentId || "",
        parentId: null,
        sizeBytes: null,
        mimeType: item.mimeType || null,
        status: "ACTIVE",
        createdAt: item.date,
        isFeatured: item.isFeatured,
      })
    } else {
      // If it cannot be viewed, directly download it as requested
      handleDownload({ stopPropagation: () => {} } as React.MouseEvent, item)
    }
  }

  const canUserManageFeature = (item: FeaturedReportItem) => {
    if (!user) return false
    if (user.role === "ADMIN") return true
    return Boolean(
      user.departmentAccess?.some((da: any) => {
        const matchesId = item.departmentId && (da.departmentId === item.departmentId || da.department?.id === item.departmentId)
        const matchesCode = da.department?.code && (da.department.code.toUpperCase() === item.department.toUpperCase() || da.department.code.toUpperCase() === item.departmentCode?.toUpperCase())
        const matchesName = da.department?.name && da.department.name.toUpperCase() === item.department.toUpperCase()
        return (matchesId || matchesCode || matchesName) && da.accessLevel === "READ_WRITE"
      })
    )
  }

  const scrollLeft = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: -360, behavior: "smooth" })
    }
  }

  const scrollRight = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: 360, behavior: "smooth" })
    }
  }

  return (
    <>
      <section
        id="featured-files"
        className="border-b border-border-subtle bg-[#080d19] py-14 sm:py-16"
        aria-labelledby="featured-files-title"
      >
        <div className="shell">
          {/* Header & Filter / Navigation Row */}
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-semibold text-accent-light shadow-sm mb-2">
                <Sparkles size={12} className="text-accent-light" />
                <span>Public Telemetry Showcase · Viewable Without Login</span>
              </div>

              <h2
                id="featured-files-title"
                className="display text-2xl font-bold text-text-primary sm:text-3xl"
              >
                {(cmsBlocks["featured_reports"] as any)?.title || "Featured Mission Reports & Datasets"}
              </h2>

              <p className="mt-2 max-w-xl text-xs leading-relaxed text-text-muted">
                {(cmsBlocks["featured_reports"] as any)?.subtitle || "Public mission telemetry archive and observation reports. Viewable directly in-browser without login; raw telemetry streams and datasets can be downloaded instantly."}
              </p>
            </div>

            {/* Right Controls: Department Filter Chips & Navigation Arrows */}
            {rawReports.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="eyebrow mr-1 text-text-dim flex items-center gap-1 text-[11px]">
                    <Filter size={11} /> Dept:
                  </span>
                  {departments.map((dept) => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => setSelectedDept(dept)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                        selectedDept === dept
                          ? "bg-accent text-white shadow-sm shadow-accent/30"
                          : "border border-border-subtle bg-surface text-text-muted hover:border-border-default hover:text-text-primary"
                      }`}
                    >
                      {dept}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 pl-2 border-l border-border-subtle">
                  <button
                    type="button"
                    onClick={scrollLeft}
                    aria-label="Previous reports"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-default bg-surface text-text-muted hover:border-accent hover:text-text-primary transition-colors shadow-sm"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={scrollRight}
                    aria-label="Next reports"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-default bg-surface text-text-muted hover:border-accent hover:text-text-primary transition-colors shadow-sm"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Carousel / List */}
          {filtered.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-border-subtle bg-[#0d1629]/50 p-12 text-center">
              <FolderOpen size={32} className="mx-auto text-text-dim mb-3" />
              <h3 className="text-sm font-semibold text-white">No Featured Mission Reports Available</h3>
              <p className="text-xs text-text-muted max-w-sm mx-auto mt-1">
                Operators with R/W permission can feature reports using the Star button in their department repository or during file upload.
              </p>
            </div>
          ) : (
            <div className="relative mt-8">
              <div
                ref={carouselRef}
                className="flex items-stretch gap-4 overflow-x-auto pb-4 scrollbar-none snap-x"
              >
                {filtered.map((item) => {
                  const ext = (item.extension || "DAT").toUpperCase()
                  const meta = EXT_CONFIG[ext] || EXT_CONFIG.DAT
                  const Icon = meta.icon
                  const viewable = isViewableFormat(ext, item.mimeType)
                  const canManage = canUserManageFeature(item)

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleOpenPreview(item)}
                      className="group relative flex w-[320px] sm:w-[350px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-2xl border border-border-default bg-[#0d1629] p-5 shadow-card transition-all duration-300 hover:border-accent/50 hover:bg-[#101c36] hover:shadow-2xl cursor-pointer"
                    >
                      <div>
                        {/* Top Row: Extension badge, Satellite tag, and Star action */}
                        <div className="flex items-center justify-between border-b border-border-subtle/70 pb-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.badge}`}
                            >
                              <Icon size={12} />
                              {meta.label}
                            </span>

                            <span className="rounded bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary border border-border-subtle">
                              {item.satellite?.includes('General') ? 'General' : item.satellite}
                            </span>

                            {item.versionLabel && (
                              <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-mono font-bold text-accent-light border border-border-subtle">
                                {item.versionLabel}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {/* Star Action Button for R/W users */}
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => setFeatureConfirmFile({ id: item.id, name: item.filename, isFeatured: true })}
                                className="p-1 rounded-md border border-amber-500/40 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors"
                                title="Manage Featured status (R/W clearance)"
                              >
                                <Star size={13} className="fill-amber-400" />
                              </button>
                            )}

                            <span className="num text-[11px] font-medium text-text-dim">
                              {item.date}
                            </span>
                          </div>
                        </div>

                        {/* Title & Filename */}
                        <div className="mt-4">
                          <h3 className="text-sm font-bold leading-snug text-white group-hover:text-accent-light transition-colors line-clamp-1">
                            {item.title}
                          </h3>

                          <p className="mt-1 font-mono text-[11px] text-text-dim truncate">
                            {item.filename}
                          </p>
                        </div>

                        {/* Description */}
                        {item.description && (
                          <p className="mt-3 text-xs leading-relaxed text-text-secondary line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Footer: Size, Dept, Action Buttons */}
                      <div className="mt-5 flex items-center justify-between border-t border-border-subtle/70 pt-3">
                        <div className="flex items-center gap-2">
                          <span className="num text-xs font-bold text-white">
                            {item.fileSize}
                          </span>
                          <span className="text-[10px] text-text-dim">·</span>
                          <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-accent-light">
                            {item.department}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {viewable ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenPreview(item)}
                                className="inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/15 px-2.5 py-1.5 text-xs font-semibold text-accent-light hover:bg-accent hover:text-white transition-all shadow-sm"
                                title="View in-browser without login"
                              >
                                <Eye size={12} />
                                <span>View</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDownload(e, item)}
                                disabled={downloadingId === item.id}
                                className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-border-default bg-surface text-text-muted hover:border-nominal hover:text-nominal transition-colors"
                                title="Download Report"
                              >
                                <Download size={12} />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => handleDownload(e, item)}
                              disabled={downloadingId === item.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface px-3 py-1.5 text-xs font-semibold text-text-primary hover:border-nominal hover:text-nominal transition-all shadow-sm"
                              title="Download Raw Dataset (No login required)"
                            >
                              <Download size={12} className="text-nominal" />
                              <span>{downloadingId === item.id ? "Streaming…" : "Download"}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* In-Browser Preview Modal (Works without login for featured files) */}
      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />

      {/* Confirmation Modal to Add / Remove Featured status */}
      <ConfirmFeatureModal
        isOpen={featureConfirmFile !== null}
        file={featureConfirmFile}
        onClose={() => setFeatureConfirmFile(null)}
        onSuccess={() => {
          fetchFeaturedFiles()
        }}
      />
    </>
  )
}
