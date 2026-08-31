import { useState, useRef, useEffect } from "react"
import {
  FileText,
  Lock,
  ShieldCheck,
  HardDrive,
  FileCode,
  FileSpreadsheet,
  LogIn,
  X,
  Filter,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
} from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { useAuthStore } from "../store/authStore"
import { useCms } from "../context/cmsContext"
import { Button } from "."
import { apiClient } from "../api/client"
import { formatFileSize } from "../lib/formatFileSize"

export interface FeaturedReportItem {
  id: string
  title: string
  filename: string
  department: string
  satellite: string
  fileSize: string
  extension: string
  date: string
  classification?: string
  description?: string
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

export function FeaturedReports() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const { cmsBlocks } = useCms()

  const [dbFiles, setDbFiles] = useState<FeaturedReportItem[]>([])
  const [selectedDept, setSelectedDept] = useState<string>("ALL")
  const [restrictedModalItem, setRestrictedModalItem] = useState<FeaturedReportItem | null>(null)
  const carouselRef = useRef<HTMLDivElement>(null)

  // Fetch real uploaded files if CMS has not explicitly set any featured files yet
  useEffect(() => {
    const cmsItems = cmsBlocks["featured_reports"]?.items as FeaturedReportItem[] | undefined
    if (cmsItems && cmsItems.length > 0) {
      setDbFiles(cmsItems)
    } else {
      // Fetch latest real files directly from backend repository
      apiClient
        .get("/admin/files/repository-list")
        .then((res) => {
          if (res.data?.data && res.data.data.length > 0) {
            const mapped: FeaturedReportItem[] = res.data.data.slice(0, 10).map((f: any) => ({
              id: f.id,
              title: f.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
              filename: f.name,
              department: f.department || "TTC",
              satellite: f.satellite || "Primary Fleet",
              fileSize: formatFileSize(Number(f.sizeBytes) || 0),
              extension: (f.extension || "DAT").toUpperCase(),
              date: f.createdAt ? f.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
              classification: "RESTRICTED",
              description: `Official telemetry archive and observation report for ${f.satellite || f.department}.`,
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
  }, [cmsBlocks])

  const rawReports = (cmsBlocks["featured_reports"]?.items as FeaturedReportItem[]) || dbFiles

  const departments = ["ALL", ...Array.from(new Set(rawReports.map((r) => r.department)))]

  const filtered =
    selectedDept === "ALL"
      ? rawReports
      : rawReports.filter((r) => r.department.toUpperCase() === selectedDept.toUpperCase())

  const handleFileAction = (item: FeaturedReportItem) => {
    if (!user) {
      setRestrictedModalItem(item)
    } else {
      navigate(`/dashboard/files`)
    }
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
              <p className="eyebrow flex items-center gap-2 text-accent-light">
                <HardDrive size={14} />
                Telemetry Repositories · Files
              </p>

              <h2
                id="featured-files-title"
                className="display mt-2 text-2xl font-bold text-text-primary sm:text-3xl"
              >
                Featured Mission Reports & Files.
              </h2>

              <p className="mt-2 max-w-xl text-xs leading-relaxed text-text-muted">
                Public catalog of recent telemetry passes, orbit determinations, and launch vehicle tracking logs. Direct file download is restricted to authorized users.
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
              <h3 className="text-sm font-semibold text-white">No Featured Files Available</h3>
              <p className="text-xs text-text-muted max-w-sm mx-auto mt-1">
                Upload files in the File Repository or select files from the Portal CMS to feature them here.
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

                  return (
                    <div
                      key={item.id}
                      className="group relative flex w-[320px] sm:w-[350px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-2xl border border-border-default bg-[#0d1629] p-5 shadow-card transition-all duration-300 hover:border-accent/40 hover:bg-[#101c36] hover:shadow-2xl"
                    >
                      <div>
                        {/* Top Row: Extension badge, Satellite tag, Date */}
                        <div className="flex items-center justify-between border-b border-border-subtle/70 pb-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.badge}`}
                            >
                              <Icon size={12} />
                              {meta.label}
                            </span>

                            <span className="rounded bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary border border-border-subtle">
                              {item.satellite}
                            </span>
                          </div>

                          <span className="num text-[11px] font-medium text-text-dim">
                            {item.date}
                          </span>
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

                      {/* Footer: Size, Dept, Action Button */}
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

                        <button
                          type="button"
                          onClick={() => handleFileAction(item)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface px-3 py-1.5 text-xs font-semibold text-text-primary hover:border-accent hover:text-white transition-all shadow-sm group-hover:border-accent/60"
                        >
                          <Lock size={12} className="text-accent-light" />
                          <span>Access File</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Restricted Access Modal */}
      {restrictedModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md rounded-2xl border border-border-default bg-[#0c1426] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2 text-accent-light">
                <ShieldCheck size={18} />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Restricted Mission Archive
                </span>
              </div>
              <button
                type="button"
                onClick={() => setRestrictedModalItem(null)}
                className="p-1 rounded-md text-text-dim hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2">
              <h4 className="text-base font-bold text-white">
                {restrictedModalItem.title}
              </h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Direct access to telemetry records and engineering dumps requires an authenticated ISRO account with authorized department clearances.
              </p>
            </div>

            <div className="rounded-xl border border-border-subtle bg-[#060c18] p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-text-dim">Filename:</span>
                <span className="font-mono text-white text-[11px] truncate max-w-[240px]">
                  {restrictedModalItem.filename}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-dim">Department:</span>
                <span className="font-bold text-accent-light">
                  {restrictedModalItem.department}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-dim">Security Tier:</span>
                <span className="font-bold text-warning">
                  {restrictedModalItem.classification || "RESTRICTED"}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Link to="/login" className="flex-1">
                <Button variant="primary" size="sm" className="w-full justify-center gap-1.5">
                  <LogIn size={13} />
                  <span>Log In to Access</span>
                </Button>
              </Link>
              <Link to="/register" className="flex-1">
                <Button variant="outline" size="sm" className="w-full justify-center">
                  Request Access
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
