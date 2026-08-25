import { useState, useRef } from 'react'
import {
  FileText,
  Lock,
  Download,
  ShieldCheck,
  HardDrive,
  FileCode,
  FileSpreadsheet,
  LogIn,
  X,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCms } from '../context/cmsContext'
import { Button } from '.'

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
  BIN: { label: 'BIN', badge: 'bg-accent/15 text-accent-light border-accent/30', icon: FileCode },
  DAT: { label: 'DAT', badge: 'bg-nominal/15 text-nominal border-nominal/30', icon: FileCode },
  PDF: { label: 'PDF', badge: 'bg-critical/15 text-critical border-critical/30', icon: FileText },
  CSV: { label: 'CSV', badge: 'bg-warning/15 text-warning border-warning/30', icon: FileSpreadsheet },
  LOG: { label: 'LOG', badge: 'bg-purple-400/15 text-purple-400 border-purple-400/30', icon: FileText },
}

const DEFAULT_REPORTS: FeaturedReportItem[] = [
  {
    id: 'rep-1',
    title: 'Cartosat-3 S-Band Telemetry Ingestion Log',
    filename: 'CARTOSAT3_SBAND_PASS_20260825.bin',
    department: 'TTC',
    satellite: 'Cartosat-3',
    fileSize: '412.8 MB',
    extension: 'BIN',
    date: '2026-08-25',
    classification: 'RESTRICTED / OP-4',
    description: 'Raw high-rate telemetry downlink packets verified with frame sync lock and zero CRC dropouts.',
  },
  {
    id: 'rep-2',
    title: 'Aditya-L1 Halo Orbit Determination Ephemeris',
    filename: 'ADITYA_L1_HALO_ORBIT_EPHEMERIS_V4.dat',
    department: 'FDD',
    satellite: 'Aditya-L1',
    fileSize: '64.2 MB',
    extension: 'DAT',
    date: '2026-08-24',
    classification: 'RESTRICTED / FDD-1',
    description: 'Precision state vectors and Doppler ranging residuals computed via Byalalu 32m deep space tracking.',
  },
  {
    id: 'rep-3',
    title: 'NETRA Space Conjunction Screening Report',
    filename: 'IS4OM_CONJUNCTION_ASSESSMENT_Q3.pdf',
    department: 'NETRA',
    satellite: 'Multi-Mission',
    fileSize: '18.4 MB',
    extension: 'PDF',
    date: '2026-08-23',
    classification: 'RESTRICTED / SSA-2',
    description: '72-hour orbital debris proximity matrix and collision risk assessment for all active payloads.',
  },
  {
    id: 'rep-4',
    title: 'PSLV-C59 Stage-4 Telemetry & Separation Dump',
    filename: 'PSLV_C59_PS4_TELEMETRY_DUMP.csv',
    department: 'GSO',
    satellite: 'Launch Vehicle',
    fileSize: '128.5 MB',
    extension: 'CSV',
    date: '2026-08-21',
    classification: 'RESTRICTED / LV-TRACK',
    description: 'Downrange Port Blair and Mauritius telemetry relay packets for orbital injection stage.',
  },
  {
    id: 'rep-5',
    title: 'Gaganyaan TTC Readiness & Data Stream Report',
    filename: 'GAGANYAAN_TTC_SIM_REPORT_2026.pdf',
    department: 'MOX',
    satellite: 'Gaganyaan',
    fileSize: '45.8 MB',
    extension: 'PDF',
    date: '2026-08-20',
    classification: 'RESTRICTED / MOX-1',
    description: 'End-to-end telemetry pipeline dry run parameters across global ground stations.',
  },
]

export function FeaturedReports() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const { cmsBlocks } = useCms()

  const rawReports =
    (cmsBlocks['featured_reports']?.items as FeaturedReportItem[]) ??
    DEFAULT_REPORTS

  const [selectedDept, setSelectedDept] = useState<string>('ALL')
  const [restrictedModalItem, setRestrictedModalItem] = useState<FeaturedReportItem | null>(null)
  const carouselRef = useRef<HTMLDivElement>(null)

  const departments = ['ALL', ...Array.from(new Set(rawReports.map((r) => r.department)))]

  const filtered =
    selectedDept === 'ALL'
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
      carouselRef.current.scrollBy({ left: -360, behavior: 'smooth' })
    }
  }

  const scrollRight = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: 360, behavior: 'smooth' })
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
                Telemetry Repositories · Ingested Datasets
              </p>

              <h2
                id="featured-files-title"
                className="display mt-2 text-2xl font-bold text-text-primary sm:text-3xl"
              >
                Featured Mission Reports & Files.
              </h2>

              <p className="mt-2 max-w-xl text-xs leading-relaxed text-text-muted">
                Public catalog of recent telemetry passes, orbit determinations, and launch vehicle tracking logs. Direct file download is restricted to authorized operators.
              </p>
            </div>

            {/* Right Controls: Department Filter Chips & Navigation Arrows */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Department Filters */}
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
                        ? 'bg-accent text-white shadow-sm shadow-accent/30'
                        : 'border border-border-subtle bg-surface text-text-muted hover:border-border-default hover:text-text-primary'
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>

              {/* Navigation Arrows for Single Row Carousel */}
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
          </div>

          {/* Single Row Horizontal Scrolling Carousel */}
          <div className="relative mt-8">
            <div
              ref={carouselRef}
              className="flex items-stretch gap-4 overflow-x-auto pb-4 scrollbar-none snap-x"
            >
              {filtered.map((item) => {
                const ext = (item.extension || 'DAT').toUpperCase()
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

                        <span className="num text-[11px] text-text-dim">{item.date}</span>
                      </div>

                      {/* Title & Monospace Filename */}
                      <div className="mt-3.5">
                        <h3 className="text-sm font-bold text-text-primary group-hover:text-accent-light transition-colors line-clamp-1">
                          {item.title}
                        </h3>

                        <p className="num mt-1 truncate rounded bg-[#070c17] px-2.5 py-1 text-[11px] font-mono text-accent-light border border-border-subtle/60">
                          {item.filename}
                        </p>

                        {item.description && (
                          <p className="mt-2 text-xs leading-relaxed text-text-muted line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Footer Row: Department, Size & Action Button */}
                    <div className="mt-5 flex items-center justify-between border-t border-border-subtle/70 pt-3.5">
                      <div className="flex items-center gap-2.5 text-[11px] text-text-dim">
                        <span className="num font-bold text-text-primary">{item.fileSize}</span>
                        <span>·</span>
                        <span className="rounded bg-surface px-1.5 py-0.5 num font-semibold text-accent-light border border-border-subtle">
                          {item.department}
                        </span>
                      </div>

                      {/* Action Button */}
                      <button
                        type="button"
                        onClick={() => handleFileAction(item)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                          user
                            ? 'border-accent bg-accent/15 text-accent-light hover:bg-accent hover:text-white'
                            : 'border-border-default bg-surface text-text-secondary hover:border-warning/50 hover:bg-warning/10 hover:text-warning'
                        }`}
                      >
                        {user ? (
                          <>
                            <Download size={13} />
                            <span>Open File</span>
                          </>
                        ) : (
                          <>
                            <Lock size={12} className="text-warning" />
                            <span>Access File</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {filtered.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border-default bg-[#0d1629] p-12 text-center text-text-muted">
                <FileText size={32} className="mx-auto mb-2 opacity-30 text-accent-light" />
                <p className="text-xs font-semibold text-text-primary">No files available for {selectedDept}</p>
                <p className="num mt-1 text-[11px] text-text-dim">Additional datasets can be indexed in the Admin CMS.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Restricted File Access Modal for Unauthenticated Guests */}
      {restrictedModalItem && (
        <RestrictedFileModal
          file={restrictedModalItem}
          onClose={() => setRestrictedModalItem(null)}
        />
      )}
    </>
  )
}

function RestrictedFileModal({
  file,
  onClose,
}: {
  file: FeaturedReportItem
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-page/85 backdrop-blur-sm animate-rise">
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border-default bg-[#0b1220] shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle bg-[#101a2f] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/15 border border-warning/30 text-warning">
              <Lock size={18} />
            </div>
            <div>
              <span className="eyebrow text-warning block text-[10px]">
                RESTRICTED FILE ACCESS
              </span>
              <h3 className="text-sm font-bold text-text-primary leading-tight">
                Authentication Required
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-text-dim hover:bg-card hover:text-text-primary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Target File Card */}
          <div className="rounded-xl border border-border-subtle bg-[#070c17] p-4 text-xs">
            <p className="font-bold text-text-primary">{file.title}</p>
            <p className="num mt-1 font-mono text-[11px] text-accent-light break-all">
              {file.filename}
            </p>

            <div className="mt-3 flex items-center gap-4 text-[11px] text-text-muted border-t border-border-subtle/60 pt-2.5">
              <span>Size: <strong className="num text-text-primary">{file.fileSize}</strong></span>
              <span>·</span>
              <span>Division: <strong className="text-text-primary">{file.department}</strong></span>
              <span>·</span>
              <span>Satellite: <strong className="text-text-primary">{file.satellite}</strong></span>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-text-muted">
            Direct retrieval of raw telemetry dumps, flight trajectories, and mission logs is restricted to authorized ISTRAC operators. Please log in with your credentials to download this file.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
            <Link to="/login" onClick={onClose} className="w-full sm:w-auto flex-1">
              <Button variant="primary" size="md" className="w-full shadow-lg shadow-accent/25">
                <LogIn size={15} />
                <span>Log In to Download</span>
              </Button>
            </Link>

            <Link to="/register" onClick={onClose} className="w-full sm:w-auto flex-1">
              <Button variant="outline" size="md" className="w-full">
                Request Access
              </Button>
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border-subtle bg-[#101a2f] px-6 py-3 text-[11px] text-text-dim">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-nominal" />
            ISTRAC Multi-RBAC Security Gate
          </span>
          <span className="num">SEC LEVEL 4</span>
        </div>
      </div>
    </div>
  )
}
