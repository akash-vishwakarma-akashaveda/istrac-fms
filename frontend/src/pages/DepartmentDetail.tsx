import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Satellite,
  FileText,
  Edit2,
  Upload,
  HardDrive,
  Search,
  Eye,
  History,
  Download,
  FileCode,
  FileSpreadsheet,
  ChevronRight,
  ChevronLeft,
  LayoutGrid,
  List,
  Play,
  Pause,
  Image as ImageIcon,
  Plus,
  Trash2,
  Lock,
  Maximize2,
} from 'lucide-react'
import { departmentsApi, type Department } from '../api/departments.api'
import { satellitesApi, type Satellite as SatelliteType } from '../api/satellites.api'
import { useAuthStore } from '../store/authStore'
import { useAuthModalStore } from '../store/authModalStore'
import { useToastStore } from '../store/toastStore'
import { Navbar, Footer, Button, Modal, Textarea, ImageLightboxModal } from '../components'
import { VersionHistoryPanel } from '../components/VersionHistoryPanel'
import { FilePreviewModal } from '../components/FilePreviewModal'
import { ImageWithFallback } from '../components/ImageWithFallback'
import { formatFileSize } from '../lib/formatFileSize'
import type { FileNode } from '../types/file'
import { isSafeUrl } from '../lib/sanitize'

const EXT_CONFIG: Record<string, { label: string; badge: string; icon: typeof FileText }> = {
  BIN: { label: 'BIN', badge: 'bg-accent/15 text-accent-light border-accent/30', icon: FileCode },
  DAT: { label: 'DAT', badge: 'bg-nominal/15 text-nominal border-nominal/30', icon: FileCode },
  PDF: { label: 'PDF', badge: 'bg-critical/15 text-critical border-critical/30', icon: FileText },
  CSV: { label: 'CSV', badge: 'bg-warning/15 text-warning border-warning/30', icon: FileSpreadsheet },
  LOG: { label: 'LOG', badge: 'bg-purple-400/15 text-purple-400 border-purple-400/30', icon: FileText },
}

interface CarouselSlide {
  url: string
  caption: string
}

const DEFAULT_DEPT_SLIDES: Record<string, CarouselSlide[]> = {
  TTC: [
    {
      url: 'https://images.unsplash.com/photo-1517976487515-56839a85703f?auto=format&fit=crop&w=1200&q=80',
      caption: '32-Meter Deep Space Tracking Antenna Dish · S/X-Band Terminal',
    },
    {
      url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
      caption: 'Real-time Telemetry Acquisition & Downlink Pass Monitoring',
    },
  ],
  MOX: [
    {
      url: 'https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?auto=format&fit=crop&w=1200&q=80',
      caption: 'Main Operations Complex Flight Control Consoles',
    },
    {
      url: 'https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?auto=format&fit=crop&w=1200&q=80',
      caption: 'Mission Directors Gallery & Integrated Telemetry Display',
    },
  ],
  FDD: [
    {
      url: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?auto=format&fit=crop&w=1200&q=80',
      caption: 'Lagrange Point L1 / L2 Halo Orbit Ephemeris Simulation',
    },
    {
      url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80',
      caption: 'High-Precision Orbit Determination & State Vector Modeling',
    },
  ],
  NETRA: [
    {
      url: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1200&q=80',
      caption: 'IS4OM Space Situational Awareness & Debris Tracking Sensor',
    },
    {
      url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
      caption: 'Low-Earth Orbit Close Approach Conjunction Analysis',
    },
  ],
  GSO: [
    {
      url: 'https://images.unsplash.com/photo-1517976487515-56839a85703f?auto=format&fit=crop&w=1200&q=80',
      caption: 'Bengaluru Ground Station Ground Terminal & Dish Array',
    },
    {
      url: 'https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?auto=format&fit=crop&w=1200&q=80',
      caption: 'Antenna Control Unit (ACU) Automated Pass Steering',
    },
  ],
}

export function DepartmentDetail() {
  const { deptId } = useParams<{ deptId: string }>()
  const user = useAuthStore((s) => s.user)
  const addToast = useToastStore((s) => s.addToast)

  const [dept, setDept] = useState<Department | null>(null)
  const [satellites, setSatellites] = useState<SatelliteType[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // View Mode: 'card' (Grid) vs 'table' (List)
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card')

  // Department Files State
  const [deptFiles, setDeptFiles] = useState<any[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [fileSearch, setFileSearch] = useState('')
  const [fileSpacecraft, setFileSpacecraft] = useState('ALL')
  const [fileExt, setFileExt] = useState('ALL')

  // Hero Carousel State
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const autoPlayTimerRef = useRef<any>(null)

  // Modals & Preview
  const [previewFile, setPreviewFile] = useState<FileNode | null>(null)
  const [versionPanelFile, setVersionPanelFile] = useState<{ id: string; name: string } | null>(null)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const openLogin = useAuthModalStore((s) => s.openLogin)

  // Department CMS Edit Modal State
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    code: '',
    description: '',
    pageTitle: '',
    pageAbout: '',
    pageLeadOfficer: '',
    pageLeadRole: '',
    pageContact: '',
    slides: [{ url: '', caption: '' }],
    allowUserFolderCreation: false,
    maxFolderDepth: 5,
  })
  const [savingEdit, setSavingEdit] = useState(false)

  const isAdmin = user?.role === 'ADMIN'

  // Parse slides for carousel from dept.pageBannerUrl
  const getCarouselSlides = (): CarouselSlide[] => {
    if (dept?.pageBannerUrl) {
      try {
        const parsed = JSON.parse(dept.pageBannerUrl)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      } catch {
        if (dept.pageBannerUrl.startsWith('http')) {
          return [{ url: dept.pageBannerUrl, caption: `${dept.name} Operations` }]
        }
      }
    }
    const deptCode = dept?.code?.toUpperCase() || 'TTC'
    return DEFAULT_DEPT_SLIDES[deptCode] || DEFAULT_DEPT_SLIDES['TTC']
  }

  const slides = getCarouselSlides()

  // Carousel Auto-play logic
  useEffect(() => {
    if (isPlaying && slides.length > 1) {
      autoPlayTimerRef.current = setInterval(() => {
        setCurrentSlideIndex((prev) => (prev + 1) % slides.length)
      }, 4500)
    }
    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current)
    }
  }, [isPlaying, slides.length])

  const handleNextSlide = () => {
    setCurrentSlideIndex((prev) => (prev + 1) % slides.length)
  }

  const handlePrevSlide = () => {
    setCurrentSlideIndex((prev) => (prev - 1 + slides.length) % slides.length)
  }

  const loadDeptData = async () => {
    if (!deptId) return
    setIsLoading(true)
    try {
      const [deptData, sats] = await Promise.all([
        departmentsApi.getPublicDepartment(deptId).catch(() =>
          departmentsApi.getPublicDepartments().then((list) => {
            const found = list.find((d) => d.id === deptId || d.code?.toLowerCase() === deptId.toLowerCase())
            if (found) return found
            throw new Error('Department not found')
          })
        ),
        satellitesApi.getAllAdminSatellites().catch(() => []),
      ])

      setDept(deptData)
      setSatellites(sats || [])
    } catch {
      setDept(null)
    } finally {
      setIsLoading(false)
    }
  }

  const loadDeptFiles = async () => {
    if (!dept?.id && !deptId) return
    setLoadingFiles(true)
    try {
      const files = await departmentsApi.getDepartmentFiles(dept?.id || deptId!, {
        search: fileSearch || undefined,
        spacecraft: fileSpacecraft !== 'ALL' ? fileSpacecraft : undefined,
        extension: fileExt !== 'ALL' ? fileExt : undefined,
      })
      setDeptFiles(files)
    } catch {
      addToast({ title: 'Error', message: 'Failed to load department files', variant: 'error' })
    } finally {
      setLoadingFiles(false)
    }
  }

  useEffect(() => {
    loadDeptData()
  }, [deptId])

  useEffect(() => {
    if (dept) {
      loadDeptFiles()
    }
  }, [dept, fileSearch, fileSpacecraft, fileExt])

  // Open Edit Modal with Current Data
  const handleOpenEditModal = () => {
    if (!dept) return
    const currentSlides = getCarouselSlides()

    setEditForm({
      name: dept.name,
      code: dept.code || '',
      description: dept.description || '',
      pageTitle: dept.pageTitle || dept.name,
      pageAbout: dept.pageAbout || dept.description || '',
      pageLeadOfficer: dept.pageLeadOfficer || 'Division In-Charge, ISTRAC',
      pageLeadRole: dept.pageLeadRole || 'Head of Operational Subsystem',
      pageContact: dept.pageContact || 'Building MOX-2, 2nd Floor, ISTRAC Bengaluru',
      slides: currentSlides.length > 0 ? currentSlides : [{ url: '', caption: '' }],
      allowUserFolderCreation: dept.allowUserFolderCreation || false,
      maxFolderDepth: dept.maxFolderDepth || 5,
    })
    setIsEditModalOpen(true)
  }

  const handleAddSlide = () => {
    setEditForm((prev) => ({
      ...prev,
      slides: [...prev.slides, { url: '', caption: '' }],
    }))
  }

  const handleRemoveSlide = (index: number) => {
    setEditForm((prev) => ({
      ...prev,
      slides: prev.slides.filter((_, i) => i !== index),
    }))
  }

  const handleUpdateSlide = (index: number, field: 'url' | 'caption', val: string) => {
    setEditForm((prev) => {
      const nextSlides = [...prev.slides]
      nextSlides[index] = { ...nextSlides[index], [field]: val }
      return { ...prev, slides: nextSlides }
    })
  }

  // Save Department CMS & Details
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dept) return

    setSavingEdit(true)
   const validSlides = editForm.slides.filter(
  (s) => s.url.trim().length > 0 && isSafeUrl(s.url.trim())
)
    const bannerUrlPayload = validSlides.length > 0 ? JSON.stringify(validSlides) : undefined

    try {
      const updated = await departmentsApi.updateDepartment(dept.id, {
        name: editForm.name.trim(),
        code: editForm.code.trim() || undefined,
        description: editForm.description.trim() || undefined,
        pageTitle: editForm.pageTitle.trim() || undefined,
        pageAbout: editForm.pageAbout.trim() || undefined,
        pageLeadOfficer: editForm.pageLeadOfficer.trim() || undefined,
        pageLeadRole: editForm.pageLeadRole.trim() || undefined,
        pageContact: editForm.pageContact.trim() || undefined,
        pageBannerUrl: bannerUrlPayload,
        allowUserFolderCreation: editForm.allowUserFolderCreation,
        maxFolderDepth: Number(editForm.maxFolderDepth) || 5,
      })

      setDept(updated)
      setIsEditModalOpen(false)
      addToast({
        title: 'Department CMS Updated',
        message: `Successfully saved hero images and profile for ${updated.name}.`,
        variant: 'success',
      })
    } catch (err: any) {
      addToast({
        title: 'Update Failed',
        message: err.response?.data?.error?.message || 'Could not update department CMS',
        variant: 'error',
      })
    } finally {
      setSavingEdit(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-page text-text-primary">
        <Navbar />
        <div className="shell py-24 text-center">
          <Satellite size={32} className="mx-auto text-accent-light animate-spin-slow mb-4" />
          <p className="num text-sm text-text-secondary">Loading division profile & telemetry feeds...</p>
        </div>
        <Footer />
      </div>
    )
  }

  if (!dept) {
    return (
      <div className="min-h-screen bg-page text-text-primary">
        <Navbar />
        <div className="shell py-24 text-center">
          <h2 className="text-2xl font-bold text-text-primary">Division Not Found</h2>
          <p className="mt-2 text-sm text-text-muted">The requested ISTRAC operational division does not exist.</p>
          <Link to="/departments" className="mt-6 inline-block">
            <Button variant="primary">Return to Departments Directory</Button>
          </Link>
        </div>
        <Footer />
      </div>
    )
  }

  const activeSlide = slides[currentSlideIndex] || slides[0]
  const safeImageUrl =
  activeSlide?.url && isSafeUrl(activeSlide.url)
    ? activeSlide.url
    : '/fallback-hero.jpg'

  return (
    <div className="min-h-screen bg-page text-text-primary antialiased">
      <Navbar />

      <main className="pb-24">
        {/* ============================================================ */}
        {/* 1. INTERACTIVE HERO SECTION (SIMILAR TO LANDING PAGE) */}
        {/* ============================================================ */}
        <section className="relative isolate overflow-hidden border-b border-border-subtle bg-page py-12 sm:py-16">
          {/* Graticule Background & Ambient Glow */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="graticule absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_50%_30%,black,transparent_80%)]" />
            <div className="absolute top-1/3 left-1/4 h-[400px] w-[550px] rounded-full bg-accent/10 blur-3xl" />
            <div className="absolute top-1/4 right-1/4 h-72 w-72 rounded-full bg-nominal/8 blur-3xl" />
          </div>

          <div className="shell grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
            {/* Left Column: Department Hero Headline & Controls (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Status Pill */}
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1 text-xs font-semibold text-accent-light shadow-sm shadow-accent/20">
                <span className="h-2 w-2 animate-pulse rounded-full bg-nominal" />
                <span className="font-mono">/{dept.code || 'DIVISION'}</span>
                <span>·</span>
                <span>Operational Ground Division · Active 24/7 MOX Ops</span>
              </div>

              {/* Main Headline */}
              <h1 className="display text-3xl font-bold tracking-tight text-text-primary sm:text-4xl lg:text-5xl leading-[1.15]">
                {dept.pageTitle || dept.name}
              </h1>

              {/* Subtitle / Mandate summary */}
              <p className="max-w-xl text-sm sm:text-base leading-relaxed text-text-secondary">
                {dept.pageAbout ||
                  dept.description ||
                  'The operational division for telemetry reception, spacecraft commanding, deep space tracking, and mission data archives.'}
              </p>

              {/* Quick Facility Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 text-xs">
                <div className="p-2.5 rounded-xl border border-border-default/60 bg-card/60">
                  <span className="text-[10px] uppercase font-bold text-text-dim block">Division Lead</span>
                  <strong className="text-white text-xs truncate block mt-0.5">
                    {dept.pageLeadOfficer || 'Division In-Charge'}
                  </strong>
                </div>

                <div className="p-2.5 rounded-xl border border-border-default/60 bg-card/60">
                  <span className="text-[10px] uppercase font-bold text-text-dim block">Operations Lab</span>
                  <strong className="text-white text-xs truncate block mt-0.5">
                    {dept.pageContact || 'Building MOX-2, BLR'}
                  </strong>
                </div>

                <div className="p-2.5 rounded-xl border border-border-default/60 bg-card/60 col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-bold text-text-dim block">Active Datasets</span>
                  <strong className="text-nominal text-xs num block mt-0.5">
                    {deptFiles.length || dept.fileCount || 0} Ingested Records
                  </strong>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex flex-wrap items-center gap-3">
                {isAdmin && (
                  <Link to="/admin/upload">
                    <Button variant="primary" size="md" className="shadow-lg shadow-accent/25 px-5 flex items-center gap-2">
                      <Upload size={14} />
                      <span>Upload to /{dept.code || 'Dept'}</span>
                    </Button>
                  </Link>
                )}

                {isAdmin && (
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={handleOpenEditModal}
                    className="border-accent/40 text-accent-light hover:bg-accent/10 px-4 flex items-center gap-2"
                  >
                    <Edit2 size={13} />
                    <span>Edit Page & Carousel CMS</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Right Column: Multi-Image Telemetry Carousel (5 cols) */}
            <div className="lg:col-span-5">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border-default bg-[#070c17] shadow-2xl transition-all duration-300 hover:border-accent/40 group">
                {/* Telemetry HUD Header */}
                <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between border-b border-white/10 bg-[#060b16]/80 px-3.5 py-2 backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-nominal opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-nominal" />
                    </span>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-text-muted">
                      /{dept.code || 'OPS'} // TELEMETRY FEED
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-accent-light">
                    <span className="rounded bg-accent/20 px-1.5 py-0.5">SLIDE {currentSlideIndex + 1}/{slides.length}</span>
                    <button
                      type="button"
                      onClick={() => setIsPlaying((p) => !p)}
                      className="p-1 rounded text-text-dim hover:text-white transition-colors"
                      title={isPlaying ? 'Pause auto-play' : 'Start auto-play'}
                    >
                      {isPlaying ? <Pause size={10} /> : <Play size={10} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsLightboxOpen(true)}
                      className="p-1 rounded text-text-dim hover:text-white hover:bg-white/10 transition-colors"
                      title="Enlarge telemetry image"
                      aria-label="Enlarge image in fullscreen preview"
                    >
                      <Maximize2 size={11} />
                    </button>
                  </div>
                </div>

                {/* Active Slide Image (Clickable to Enlarge) */}
                <div
                  className="relative h-full w-full cursor-pointer group/img"
                  onClick={() => setIsLightboxOpen(true)}
                  role="button"
                  tabIndex={0}
                  aria-label="Click to enlarge image"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setIsLightboxOpen(true)
                    }
                  }}
                >
                  <ImageWithFallback
                    src={safeImageUrl}
                    alt={activeSlide?.caption || `${dept.name} facility`}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#060b16] via-[#060b16]/30 to-transparent" />

                  {/* Hover Click to Enlarge Icon */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 bg-black/25 pointer-events-none">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/80 border border-white/25 text-white shadow-2xl backdrop-blur-md">
                      <Maximize2 size={18} className="text-accent-light" />
                    </div>
                  </div>
                </div>

                {/* Slide Navigation Arrows */}
                {slides.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrevSlide}
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full bg-card/80 border border-border-default text-text-muted hover:text-white hover:bg-accent flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                      aria-label="Previous slide"
                    >
                      <ChevronLeft size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={handleNextSlide}
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full bg-card/80 border border-border-default text-text-muted hover:text-white hover:bg-accent flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                      aria-label="Next slide"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </>
                )}

                {/* Bottom Caption & Indicators */}
                <div className="absolute bottom-0 inset-x-0 z-20 p-3.5 bg-gradient-to-t from-[#060b16] via-[#060b16]/90 to-transparent space-y-2">
                  <p className="text-xs font-medium text-white truncate drop-shadow-sm">
                    {activeSlide?.caption || `${dept.name} Operations Lab`}
                  </p>

                  {/* Indicator Dots */}
                  {slides.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      {slides.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setCurrentSlideIndex(idx)}
                          className={`h-1 rounded-full transition-all ${
                            idx === currentSlideIndex
                              ? 'w-6 bg-accent-light'
                              : 'w-2 bg-white/30 hover:bg-white/60'
                          }`}
                          aria-label={`Jump to slide ${idx + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 2. DEDICATED DEPARTMENT FILES EXPLORER (CARD & TABLE VIEW) */}
        {/* ============================================================ */}
        <section className="shell mt-10 space-y-6">
          {/* Header & Controls Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-default pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <HardDrive size={18} className="text-accent-light" />
                <span>/{dept.code || dept.name} Repository Datasets</span>
                <span className="rounded-full bg-accent/20 border border-accent/40 text-accent-light px-2 py-0.5 text-xs font-mono num font-bold">
                  {deptFiles.length} files
                </span>
              </h2>
              <p className="text-xs text-text-dim mt-0.5">
                Browse and download all telemetry passes, state vectors, and flight reports.
              </p>
            </div>

            {/* View Mode Switcher (Card Grid vs Table List) */}
            <div className="flex items-center gap-1.5 p-1 rounded-lg border border-border-default bg-[#060c18] shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setViewMode('card')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  viewMode === 'card'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-text-dim hover:text-white'
                }`}
                title="Card Grid View"
              >
                <LayoutGrid size={13} />
                <span>Cards</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  viewMode === 'table'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-text-dim hover:text-white'
                }`}
                title="Table List View"
              >
                <List size={13} />
                <span>Table</span>
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-xl border border-border-default bg-card shadow-sm">
            <div className="relative sm:col-span-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
              <input
                type="text"
                placeholder={`Search within /${dept.code || 'department'} datasets, reports, checksums…`}
                value={fileSearch}
                onChange={(e) => setFileSearch(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-[#060c18] pl-9 pr-3 py-2 text-xs text-white placeholder:text-text-dim outline-none focus:border-accent"
              />
            </div>

            <div>
              <select
                value={fileSpacecraft}
                onChange={(e) => setFileSpacecraft(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
              >
                <option value="ALL">All Spacecraft & Satellites</option>
                {satellites.map((s) => (
                  <option key={s.id} value={s.code || s.name}>
                    {s.name} ({s.code || 'ISRO'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={fileExt}
                onChange={(e) => setFileExt(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
              >
                <option value="ALL">All File Formats</option>
                <option value="BIN">BIN (Raw Telemetry)</option>
                <option value="DAT">DAT (Orbit Ephemeris)</option>
                <option value="PDF">PDF (Reports)</option>
                <option value="CSV">CSV (Telemetry Tables)</option>
              </select>
            </div>
          </div>

          {/* Files Display: Loading, Empty, Card View, or Table View */}
          {loadingFiles ? (
            <div className="h-64 rounded-xl border border-border-subtle bg-card flex items-center justify-center text-xs text-text-dim">
              Scanning /{dept.code || 'dept'} storage partition…
            </div>
          ) : deptFiles.length === 0 ? (
            <div className="rounded-xl border border-border-subtle bg-card p-12 text-center space-y-3">
              <HardDrive size={32} className="mx-auto text-text-dim" />
              <p className="text-sm font-bold text-white">No Datasets Found in /{dept.code || 'Dept'}</p>
              <p className="text-xs text-text-secondary">
                No telemetry files match your filter criteria or none have been ingested yet.
              </p>
              {isAdmin && (
                <Link to="/admin/upload" className="inline-block pt-2">
                  <Button variant="primary" size="sm">
                    <Upload size={13} />
                    <span>Upload Telemetry to /{dept.code || 'Dept'}</span>
                  </Button>
                </Link>
              )}
            </div>
          ) : viewMode === 'card' ? (
            /* ============================================================ */
            /* CARD GRID VIEW */
            /* ============================================================ */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {deptFiles.map((file) => {
                const extConf = EXT_CONFIG[file.extension] || EXT_CONFIG.BIN
                const Icon = extConf.icon

                return (
                  <div
                    key={file.id}
                    className="rounded-xl border border-border-default bg-card p-5 hover:border-accent/40 transition-all shadow-sm space-y-3.5 flex flex-col justify-between group"
                  >
                    <div className="space-y-3">
                      {/* Top Header Row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#060c18] border border-border-subtle text-accent-light">
                            <Icon size={18} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold uppercase num text-accent-light block">
                              /{dept.code || 'OPS'}
                            </span>
                            <h3
                              onClick={() => {
                                if (!user) setLoginModalOpen(true)
                                else setPreviewFile(file as unknown as FileNode)
                              }}
                              className="font-bold text-white text-sm hover:text-accent-light cursor-pointer truncate transition-colors"
                              title={file.name}
                            >
                              {file.name}
                            </h3>
                          </div>
                        </div>

                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase num border shrink-0 ${extConf.badge}`}>
                          {extConf.label}
                        </span>
                      </div>

                      {/* Spacecraft Target Tag */}
                      <div className="rounded-lg border border-border-subtle bg-[#060c18] p-2.5 text-xs space-y-1">
                        <span className="text-[10px] text-text-dim uppercase font-bold block">Spacecraft Target</span>
                        <strong className="text-white text-xs truncate block">
                          {file.report?.spacecraft || 'Primary Fleet Constellation'}
                        </strong>
                      </div>

                      {/* File Metadata Info */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] num">
                        <div className="p-2 rounded bg-surface border border-border-subtle/50">
                          <span className="text-[9px] text-text-dim block uppercase font-bold">Size</span>
                          <span className="text-text-secondary font-semibold">
                            {formatFileSize(Number(file.sizeBytes) || 0)}
                          </span>
                        </div>

                        <div className="p-2 rounded bg-surface border border-border-subtle/50">
                          <span className="text-[9px] text-text-dim block uppercase font-bold">Revisions</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (!user) openLogin()
                              else setVersionPanelFile({ id: file.id, name: file.name })
                            }}
                            className="text-purple-300 font-bold hover:underline cursor-pointer"
                          >
                            v{file.versionCount || 1} Version History
                          </button>
                        </div>
                      </div>

                      {/* Checksum Hash */}
                      <div className="text-[10px] font-mono text-text-dim truncate">
                        <span className="text-text-dim">SHA-256: </span>
                        <span className="text-text-secondary">{file.sha256 ? `${file.sha256.substring(0, 20)}…` : 'Verified Checksum'}</span>
                      </div>
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="pt-3 border-t border-border-subtle">
                      {!user ? (
                        <button
                          type="button"
                          onClick={openLogin}
                          className="w-full py-2 px-3 rounded-lg border border-accent/40 bg-accent/15 text-accent-light hover:bg-accent hover:text-white transition-all text-xs font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                        >
                          <Lock size={13} />
                          <span>Sign In to Access File</span>
                        </button>
                      ) : (
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setPreviewFile(file as unknown as FileNode)}
                            className="px-3 py-1.5 rounded-lg border border-border-default bg-[#0c1424] text-text-muted hover:border-accent hover:text-white transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye size={13} className="text-accent-light" />
                            <span>Preview</span>
                          </button>

                          <a
                            href={`/api/files/${file.id}/download`}
                            download={file.name}
                            className="px-3 py-1.5 rounded-lg border border-border-default bg-[#0c1424] text-text-muted hover:border-nominal hover:text-nominal transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Download size={13} />
                            <span>Download</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* ============================================================ */
            /* TABLE LIST VIEW */
            /* ============================================================ */
            <div className="rounded-xl border border-border-default bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[850px]">
                  <thead>
                    <tr className="border-b border-border-default bg-surface text-[11px] font-bold text-text-dim uppercase tracking-wider">
                      <th className="px-4 py-3.5">Dataset / Filename</th>
                      <th className="px-4 py-3.5">Spacecraft Target</th>
                      <th className="px-4 py-3.5">Size</th>
                      <th className="px-4 py-3.5">Version Count</th>
                      <th className="px-4 py-3.5">SHA-256 Checksum</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle text-xs">
                    {deptFiles.map((file) => {
                      const extConf = EXT_CONFIG[file.extension] || EXT_CONFIG.BIN
                      const Icon = extConf.icon

                      return (
                        <tr key={file.id} className="hover:bg-card-hover transition-colors">
                          {/* File Name & Format */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface border border-border-subtle text-accent-light">
                                <Icon size={16} />
                              </div>
                              <div className="min-w-0">
                                <p
                                  onClick={() => {
                                    if (!user) openLogin()
                                    else setPreviewFile(file as unknown as FileNode)
                                  }}
                                  className="font-bold text-white hover:text-accent-light cursor-pointer truncate max-w-xs transition-colors"
                                  title="Preview File"
                                >
                                  {file.name}
                                </p>
                                <p className="text-[10px] text-text-dim truncate max-w-xs">
                                  {file.report?.category || file.extension || 'TELEMETRY'}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Spacecraft */}
                          <td className="px-4 py-3.5">
                            <span className="font-semibold text-text-primary text-xs">
                              {file.report?.spacecraft || 'Primary Mission Fleet'}
                            </span>
                          </td>

                          {/* Size */}
                          <td className="px-4 py-3.5 num text-text-secondary">
                            {formatFileSize(Number(file.sizeBytes) || 0)}
                          </td>

                          {/* Version History Drawer Trigger */}
                          <td className="px-4 py-3.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (!user) setLoginModalOpen(true)
                                else setVersionPanelFile({ id: file.id, name: file.name })
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-purple-400/40 bg-purple-400/10 text-purple-300 hover:bg-purple-400/20 text-[10px] font-bold num transition-colors cursor-pointer"
                              title="Open Revision History Drawer"
                            >
                              <History size={11} />
                              <span>v{file.versionCount || 1} Revisions</span>
                            </button>
                          </td>

                          {/* Checksum */}
                          <td className="px-4 py-3.5 font-mono text-[10px] text-text-dim">
                            {file.sha256 ? `${file.sha256.substring(0, 16)}…` : 'SHA-256 Verified'}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3.5 text-right">
                            {!user ? (
                              <button
                                type="button"
                                onClick={() => setLoginModalOpen(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-accent/40 bg-accent/10 text-accent-light hover:bg-accent hover:text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
                              >
                                <Lock size={12} />
                                <span>Sign In to Access</span>
                              </button>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setPreviewFile(file as unknown as FileNode)}
                                  className="p-1.5 rounded-md border border-border-default bg-[#0c1424] text-text-muted hover:border-accent hover:text-white transition-all cursor-pointer"
                                  title="Preview File"
                                >
                                  <Eye size={13} />
                                </button>

                                <a
                                  href={`/api/files/${file.id}/download`}
                                  download={file.name}
                                  className="p-1.5 rounded-md border border-border-default bg-[#0c1424] text-text-muted hover:border-nominal hover:text-nominal transition-all cursor-pointer"
                                  title="Download Dataset"
                                >
                                  <Download size={13} />
                                </a>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* ============================================================ */}
      {/* 3. INLINE DEPARTMENT CMS & MULTI-IMAGE CAROUSEL MODAL */}
      {/* ============================================================ */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Department CMS & Hero Images: /${dept.code || dept.name}`}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Department Display Name *
              </label>
              <input
                type="text"
                required
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Division Code (Short Tag) *
              </label>
              <input
                type="text"
                required
                value={editForm.code}
                onChange={(e) => setEditForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. TTC, MOX, FDD"
                className="num font-mono w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Page Hero Headline (CMS Title)
            </label>
            <input
              type="text"
              value={editForm.pageTitle}
              onChange={(e) => setEditForm((prev) => ({ ...prev, pageTitle: e.target.value }))}
              placeholder="e.g. Telemetry, Tracking & Command (TTC) Complex"
              className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              About & Division Mandate (CMS Subtitle)
            </label>
            <Textarea
              id="dept-about-text"
              rows={2}
              value={editForm.pageAbout}
              onChange={(e) => setEditForm((prev) => ({ ...prev, pageAbout: e.target.value }))}
              placeholder="Describe the operational mandate, flight capabilities, and mission scopes..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Lead Operations Officer
              </label>
              <input
                type="text"
                value={editForm.pageLeadOfficer}
                onChange={(e) => setEditForm((prev) => ({ ...prev, pageLeadOfficer: e.target.value }))}
                placeholder="e.g. Dr. Vikram Sharma"
                className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Lab Location & Contact
              </label>
              <input
                type="text"
                value={editForm.pageContact}
                onChange={(e) => setEditForm((prev) => ({ ...prev, pageContact: e.target.value }))}
                placeholder="e.g. Building MOX-2, ISTRAC Bengaluru"
                className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* ============================================================ */}
          {/* HERO CAROUSEL IMAGES MANAGER */}
          {/* ============================================================ */}
          <div className="space-y-2.5 pt-2 border-t border-border-subtle">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <ImageIcon size={14} className="text-accent-light" />
                <span>Hero Carousel Images & Feeds:</span>
              </label>

              <button
                type="button"
                onClick={handleAddSlide}
                className="text-xs text-accent-light hover:underline font-semibold flex items-center gap-1"
              >
                <Plus size={12} />
                <span>Add Image</span>
              </button>
            </div>

            <div className="space-y-2.5 max-h-48 overflow-y-auto p-2.5 rounded-xl border border-border-default bg-[#060c18]">
              {editForm.slides.map((slide, idx) => (
                <div key={idx} className="p-2.5 rounded-lg border border-border-subtle bg-surface space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase num text-accent-light">
                      Image Slide #{idx + 1}
                    </span>
                    {editForm.slides.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSlide(idx)}
                        className="text-critical hover:text-critical-hover p-0.5"
                        title="Remove Slide"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  <input
                    type="url"
                    value={slide.url}
                    onChange={(e) => handleUpdateSlide(idx, 'url', e.target.value)}
                    placeholder="https://images.unsplash.com/... or image URL"
                    className="w-full rounded-md border border-border-default bg-[#060c18] px-2.5 py-1.5 text-xs text-white outline-none focus:border-accent font-mono text-[11px]"
                  />

                  <input
                    type="text"
                    value={slide.caption}
                    onChange={(e) => handleUpdateSlide(idx, 'caption', e.target.value)}
                    placeholder="Slide caption, e.g. 32-Meter Deep Space Antenna Dish"
                    className="w-full rounded-md border border-border-default bg-[#060c18] px-2.5 py-1.5 text-xs text-white outline-none focus:border-accent text-[11px]"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={savingEdit}
              className="bg-accent hover:bg-accent-hover shadow-md shadow-accent/25"
            >
              {savingEdit ? 'Saving CMS…' : 'Save Department Modifications'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* VERSION HISTORY DRAWER */}
      {versionPanelFile && (
        <VersionHistoryPanel
          fileId={versionPanelFile.id}
          fileName={versionPanelFile.name}
          onClose={() => setVersionPanelFile(null)}
        />
      )}

      {/* FILE PREVIEW MODAL */}
      {previewFile && (
        <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}

      {/* LOGIN PROMPT MODAL FOR UNAUTHENTICATED USERS */}
      <Modal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        title="Authentication Required"
      >
        <div className="space-y-4 py-1">
          <div className="flex items-start gap-3.5 p-4 rounded-xl border border-accent/30 bg-accent/10">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-accent-light border border-accent/30">
              <Lock size={20} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">Restricted Operational Telemetry</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Access to live mission datasets, binary streams, and revision histories is restricted to authenticated ISTRAC-SIMS operators and personnel.
              </p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <Button variant="outline" size="sm" onClick={() => setLoginModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setLoginModalOpen(false)
                openLogin()
              }}
              className="shadow-md shadow-accent/25 cursor-pointer"
            >
              <span>Sign In to Continue</span>
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </Modal>

      {/* Enlarged Image Preview Lightbox */}
      <ImageLightboxModal
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        images={slides.map((s, idx) => ({
          url: s.url,
          title: dept?.name || 'ISTRAC Division Operations',
          caption: s.caption || `${dept?.name} Telemetry Node Slide 0${idx + 1}`,
          alt: s.caption || `${dept?.name} Facility`,
          tag: `/${dept?.code || 'OPS'} · SLIDE 0${idx + 1}`,
          station: `${dept?.name} (${dept?.code || 'OPS'}) · Global Ground Station Network`,
        }))}
        initialIndex={currentSlideIndex}
      />

      <Footer />
    </div>
  )
}
