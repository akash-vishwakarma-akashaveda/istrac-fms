import { useState, useEffect } from "react"
import {
  FileText,
  Eye,
  Download,
  FileCode,
  FileSpreadsheet,
  Star,
} from "lucide-react"
import { useAuthStore } from "../store/authStore"
import { useCms } from "../context/cmsContext"
import { apiClient } from "../api/client"
import { FilePreviewModal } from "./FilePreviewModal"
import { ConfirmFeatureModal } from "./ConfirmFeatureModal"
import type { FileNode } from "../types/file"
import { useFeaturedReports, type FeaturedReportItem } from "../hooks/useFeaturedReports"
import { SectionHeader } from "./SectionHeader"

export type { FeaturedReportItem }

const EXT_CONFIG: Record<string, { icon: typeof FileText }> = {
  BIN: { icon: FileCode },
  DAT: { icon: FileCode },
  PDF: { icon: FileText },
  CSV: { icon: FileSpreadsheet },
  DOCX: { icon: FileText },
  XLSX: { icon: FileSpreadsheet },
  ZIP: { icon: FileText },
  LOG: { icon: FileText },
}

function isViewableFormat(ext: string, mime?: string | null): boolean {
  const e = ext.toUpperCase()
  if (["PDF", "PNG", "JPG", "JPEG", "WEBP", "GIF", "SVG", "TXT", "LOG", "JSON", "CSV"].includes(e)) return true
  if (mime && (mime.startsWith("image/") || mime.startsWith("text/") || mime === "application/pdf")) return true
  return false
}

export interface FeaturedReportsProps {
  department?: string
  hideDepartmentFilter?: boolean
}

export function FeaturedReports({ department, hideDepartmentFilter }: FeaturedReportsProps = {}) {
  const user = useAuthStore((s) => s.user)
  const { cmsBlocks } = useCms()

  const { data: dbFilesData, refetch: refetchFeatured } = useFeaturedReports()
  const dbFiles = dbFilesData || []
  const [selectedDept, setSelectedDept] = useState<string>("ALL")
  const [previewFile, setPreviewFile] = useState<FileNode | null>(null)
  const [featureConfirmFile, setFeatureConfirmFile] = useState<{ id: string; name: string; isFeatured?: boolean } | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    const handleRefresh = () => {
      refetchFeatured()
    }

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "REFRESH_FEATURED" || e.data?.type === "CMS_SCROLL_TO") {
        refetchFeatured()
      }
    }

    window.addEventListener("istrac:featured-refresh", handleRefresh)
    window.addEventListener("message", handleMessage)
    return () => {
      window.removeEventListener("istrac:featured-refresh", handleRefresh)
      window.removeEventListener("message", handleMessage)
    }
  }, [refetchFeatured])

  const rawReports = dbFiles.filter((r) => {
    if (!r.isFeatured) return false
    if (department) {
      const d = department.toUpperCase()
      return (
        r.department?.toUpperCase() === d ||
        r.departmentCode?.toUpperCase() === d ||
        r.departmentName?.toUpperCase() === d ||
        r.departmentId === department
      )
    }
    return true
  })

  // Completely hide section if no featured reports are available
  if (rawReports.length === 0) {
    return null
  }

  const departments = ["ALL", ...Array.from(new Set(rawReports.map((r) => r.department)))]

  const filtered =
    selectedDept === "ALL"
      ? rawReports
      : rawReports.filter((r) => r.department.toUpperCase() === selectedDept.toUpperCase())

  // If filtered results are empty, hide the section entirely
  if (filtered.length === 0) {
    return null
  }

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

  const featuredCms = cmsBlocks["featured_reports"] as { title?: string; subtitle?: string } | undefined
  const tonal =
    "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-saffron-soft px-4 text-sm font-semibold text-saffron-text transition-colors hover:bg-saffron-soft-hover disabled:opacity-50"

  return (
    <>
      <section
        id="featured-files"
        className="relative overflow-hidden bg-band-blue py-24"
        aria-labelledby="featured-files-title"
      >
        <div aria-hidden="true" className="section-grid" />
        <div className="shell relative space-y-10">
          <SectionHeader
            id="featured-files-title"
            eyebrow="Public reports · no sign-in needed"
            title={featuredCms?.title || "Featured Mission Reports & Datasets"}
            subtitle={featuredCms?.subtitle || "Public mission telemetry archive and observation reports. Viewable directly in-browser without login; raw telemetry streams and datasets can be downloaded instantly."}
          />

          {!hideDepartmentFilter && !department && departments.length > 2 && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by division">
              {departments.map((dept) => (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setSelectedDept(dept)}
                  aria-pressed={selectedDept === dept}
                  className={`min-h-9 cursor-pointer rounded-full px-4 text-sm font-semibold transition-colors ${
                    selectedDept === dept
                      ? "bg-text-primary text-page"
                      : "border border-border-default bg-card text-text-primary hover:border-text-muted"
                  }`}
                >
                  {dept === "ALL" ? "All" : dept}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-4">
            {filtered.map((item) => {
              const ext = (item.extension || "").toUpperCase()
              const Icon = (EXT_CONFIG[ext] || EXT_CONFIG.PDF).icon
              const viewable = isViewableFormat(ext, item.mimeType)
              const canManage = canUserManageFeature(item)

              return (
                <article
                  key={item.id}
                  className="flex flex-wrap items-center gap-6 rounded-2xl border border-border-subtle bg-card p-6 shadow-card transition-shadow hover:shadow-card-hover"
                >
                  <span className="flex h-[76px] w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-[10px] bg-blue-soft text-accent-light" aria-hidden="true">
                    <Icon size={24} strokeWidth={1.5} />
                    <span className="text-[11px] font-bold">{ext || "FILE"}</span>
                  </span>

                  <div className="min-w-0 flex-[1_1_360px] space-y-1.5">
                    <h3 className="text-lg font-bold leading-snug text-text-primary">{item.title}</h3>
                    <p className="truncate font-mono text-[13px] text-text-muted" title={item.filename}>{item.filename}</p>
                    {item.description && (
                      <p className="line-clamp-2 text-sm leading-relaxed text-text-secondary">{item.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 pt-1.5 text-xs text-text-secondary">
                      {item.satellite && !item.satellite.toUpperCase().includes("GENERAL") && (
                        <span className="inline-flex h-[26px] items-center rounded-full border border-border-subtle bg-card px-2.5">{item.satellite}</span>
                      )}
                      {item.department && (
                        <span className="inline-flex h-[26px] items-center rounded-full border border-border-subtle bg-card px-2.5 font-mono">{item.department}</span>
                      )}
                      {item.date && (
                        <span className="num inline-flex h-[26px] items-center rounded-full border border-border-subtle bg-card px-2.5">{item.date}</span>
                      )}
                      {item.fileSize && (
                        <span className="num inline-flex h-[26px] items-center rounded-full border border-border-subtle bg-card px-2.5">{item.fileSize}</span>
                      )}
                      {item.versionLabel && (
                        <span className="inline-flex h-[26px] items-center rounded-full border border-border-subtle bg-card px-2.5 font-mono">{item.versionLabel}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setFeatureConfirmFile({ id: item.id, name: item.filename, isFeatured: true })}
                        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] text-amber-500 transition-colors hover:bg-amber-500/10"
                        title="Manage featured status"
                        aria-label="Manage featured status"
                      >
                        <Star size={16} className="fill-amber-500" />
                      </button>
                    )}
                    {viewable && (
                      <button type="button" onClick={() => handleOpenPreview(item)} className={tonal}>
                        <Eye size={16} />
                        View
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDownload(e, item)}
                      disabled={downloadingId === item.id}
                      className={viewable ? `${tonal} w-10 px-0` : tonal}
                      aria-label={`Download ${item.title}`}
                      title="Download"
                    >
                      <Download size={16} />
                      {!viewable && <span>{downloadingId === item.id ? "Downloading…" : "Download"}</span>}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* In-browser preview (works without login for featured files) */}
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />

      <ConfirmFeatureModal
        isOpen={featureConfirmFile !== null}
        file={featureConfirmFile}
        onClose={() => setFeatureConfirmFile(null)}
        onSuccess={() => {
          refetchFeatured()
        }}
      />
    </>
  )
}
