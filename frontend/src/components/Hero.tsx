import {
  LogIn,
  UserPlus,
  Search,
  Compass,
  LayoutDashboard,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Edit2,
  Plus,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useCms, DEFAULT_CMS_BLOCKS } from '../context/cmsContext'
import { useUpdateCmsBlock } from '../hooks/useUpdateCmsBlock'
import { usePreviewRefresh } from '../context/PreviewRefreshContext'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'
import { type HeroContent, type HeroSlide } from '../types/cms'
import { Button, Modal, Input, Textarea } from '.'
import { SearchModal } from './SearchModal'
import { ImageWithFallback } from './ImageWithFallback'

interface ExtendedHeroContent extends HeroContent {
  badgeText?: string
  imageUrl?: string
  imageAlt?: string
  slides?: HeroSlide[]
}

const DEFAULT_LANDING_SLIDES: HeroSlide[] = [
  {
    url: 'https://images.unsplash.com/photo-1517976487515-56839a85703f?auto=format&fit=crop&w=1200&q=80',
    caption: 'Indian Deep Space Network (IDSN) 32-Meter Antenna Dish at Byalalu',
    alt: 'IDSN 32-Meter Antenna',
  },
  {
    url: 'https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?auto=format&fit=crop&w=1200&q=80',
    caption: 'Mission Operations Complex (MOX) Flight Dynamics & Control Consoles',
    alt: 'MOX Flight Control Consoles',
  },
  {
    url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    caption: 'Real-time Global Satellite Telemetry Downlink Stream & Constellation Tracking',
    alt: 'Satellite Constellation Network',
  },
  {
    url: 'https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?auto=format&fit=crop&w=1200&q=80',
    caption: 'ISTRAC Bengaluru Main Control Room Operations Gallery',
    alt: 'Control Room Gallery',
  },
]

export function Hero() {
  const user = useAuthStore((s) => s.user)
  const addToast = useToastStore((s) => s.addToast)
  const updateBlock = useUpdateCmsBlock()
  const { triggerRefresh } = usePreviewRefresh()
  const { cmsBlocks, isLoading } = useCms()

  const hero =
    (cmsBlocks['hero'] as unknown as ExtendedHeroContent | undefined) ??
    (DEFAULT_CMS_BLOCKS['hero'] as unknown as ExtendedHeroContent)

  const [searchOpen, setSearchOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  // Carousel State
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const autoPlayTimerRef = useRef<any>(null)

  // Inline CMS Edit State
  const [editForm, setEditForm] = useState({
    title: '',
    subtitle: '',
    ctaText: '',
    badgeText: '',
    slides: [] as HeroSlide[],
  })
  const [savingCms, setSavingCms] = useState(false)

  const isAdmin = user?.role === 'ADMIN'

  // Resolve slides from CMS or default
  const slides: HeroSlide[] =
    hero?.slides && hero.slides.length > 0
      ? hero.slides
      : hero?.imageUrl
        ? [
            {
              url: hero.imageUrl,
              caption: hero.imageAlt || 'Indian Deep Space Network Antenna Dish',
              alt: hero.imageAlt || 'Deep Space Antenna',
            },
          ]
        : DEFAULT_LANDING_SLIDES

  // Auto-play rotation timer
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

  // Open Edit Modal
  const handleOpenEditModal = () => {
    setEditForm({
      title: hero?.title || 'ISRO Telemetry, Tracking & Command Network',
      subtitle:
        hero?.subtitle ||
        'The nerve centre for spacecraft operations, deep space tracking, launch vehicle telemetry, and orbit determination across all Indian space missions.',
      ctaText: hero?.ctaText || 'Enter Mission Portal',
      badgeText: hero?.badgeText || 'ISTRAC Ground Network Active · 24/7 Mission Operations',
      slides: slides.length > 0 ? [...slides] : [{ url: '', caption: '', alt: '' }],
    })
    setIsEditModalOpen(true)
  }

  const handleAddSlide = () => {
    setEditForm((prev) => ({
      ...prev,
      slides: [...prev.slides, { url: '', caption: '', alt: '' }],
    }))
  }

  const handleRemoveSlide = (index: number) => {
    setEditForm((prev) => ({
      ...prev,
      slides: prev.slides.filter((_, i) => i !== index),
    }))
  }

  const handleUpdateSlide = (index: number, field: keyof HeroSlide, val: string) => {
    setEditForm((prev) => {
      const next = [...prev.slides]
      next[index] = { ...next[index], [field]: val }
      return { ...prev, slides: next }
    })
  }

  const handleSaveCms = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingCms(true)

    const validSlides = editForm.slides.filter((s) => s.url.trim().length > 0)
    const primaryImg = validSlides[0]?.url || DEFAULT_LANDING_SLIDES[0].url
    const primaryAlt = validSlides[0]?.caption || DEFAULT_LANDING_SLIDES[0].caption

    updateBlock.mutate(
      {
        blockKey: 'hero',
        content: {
          title: editForm.title.trim(),
          subtitle: editForm.subtitle.trim(),
          ctaText: editForm.ctaText.trim(),
          badgeText: editForm.badgeText.trim(),
          imageUrl: primaryImg,
          imageAlt: primaryAlt,
          slides: validSlides,
        },
      },
      {
        onSuccess: () => {
          setIsEditModalOpen(false)
          addToast({ message: 'Landing hero & carousel CMS updated', variant: 'success' })
          triggerRefresh()
        },
        onError: () => {
          addToast({ message: 'Failed to update hero CMS', variant: 'error' })
        },
        onSettled: () => {
          setSavingCms(false)
        },
      }
    )
  }

  if (isLoading) {
    return (
      <section aria-label="Loading" className="border-b border-border-subtle bg-page py-20">
        <div className="shell grid gap-8 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="h-5 w-48 rounded-md bg-card-hover" />
            <div className="h-16 w-full max-w-xl rounded-md bg-card-hover" />
            <div className="h-20 w-3/4 max-w-lg rounded-md bg-card-hover" />
            <div className="h-10 w-60 rounded-md bg-card" />
          </div>
          <div className="lg:col-span-5">
            <div className="aspect-[4/3] rounded-2xl bg-card-hover animate-pulse" />
          </div>
        </div>
      </section>
    )
  }

  const activeSlide = slides[currentSlideIndex] || slides[0]

  return (
    <>
      <section
        id="hero"
        className="relative isolate overflow-hidden border-b border-border-subtle bg-page py-14 sm:py-20"
        aria-labelledby="hero-title"
      >
        {/* Graticule Background & Ambient Glow */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="graticule absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_50%_30%,black,transparent_80%)]" />
          <div className="absolute top-1/3 left-1/4 h-[450px] w-[600px] rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute top-1/4 right-1/4 h-72 w-72 rounded-full bg-nominal/8 blur-3xl" />
        </div>

        <div className="shell grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
          {/* Left Column: Mission Control Content (7 cols) */}
          <div className="lg:col-span-7">
            {/* Status Pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1 text-xs font-semibold text-accent-light shadow-sm shadow-accent/20">
              <span className="h-2 w-2 animate-pulse rounded-full bg-nominal" />
              <span>{hero?.badgeText ?? 'Telemetry & Tracking Network Active · 24/7 MOX Ops'}</span>
            </div>

            {/* Main Headline */}
            <h1
              id="hero-title"
              className="display mt-5 text-3xl font-bold tracking-tight text-text-primary sm:text-5xl lg:text-[3.25rem] leading-[1.15]"
            >
              {hero?.title ?? 'ISRO Telemetry, Tracking & Command Network'}
            </h1>

            {/* Subtitle */}
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-text-secondary sm:text-base">
              {hero?.subtitle ??
                'The nerve centre for spacecraft operations, deep space tracking, launch vehicle telemetry, and orbit determination across all Indian space missions.'}
            </p>

            {/* Direct Action Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {user ? (
                <>
                  <Link to={user.role === 'ADMIN' ? '/admin' : '/dashboard'}>
                    <Button variant="primary" size="md" className="shadow-lg shadow-accent/25 px-5 flex items-center gap-2">
                      <LayoutDashboard size={15} strokeWidth={2.2} />
                      <span>Go To Dashboard</span>
                      <ArrowRight size={14} />
                    </Button>
                  </Link>

                  <Link to="/dashboard/files">
                    <Button variant="outline" size="md" className="px-5">
                      <span>File Repositories</span>
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="primary" size="md" className="shadow-lg shadow-accent/25 px-5">
                      <LogIn size={15} strokeWidth={2.2} />
                      <span>Log In</span>
                    </Button>
                  </Link>

                  <Link to="/register">
                    <Button variant="outline" size="md" className="px-5">
                      <UserPlus size={15} strokeWidth={1.8} />
                      <span>Request Access</span>
                    </Button>
                  </Link>
                </>
              )}

              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface/80 px-4 py-2.5 text-xs font-semibold text-text-muted hover:border-border-bright hover:text-text-primary transition-colors shadow-sm"
              >
                <Search size={14} className="text-accent-light" />
                <span>Search Files</span>
                <kbd className="num ml-1 rounded bg-card px-1.5 py-0.5 text-[10px] text-text-dim border border-border-subtle">
                  Ctrl K
                </kbd>
              </button>

              {isAdmin && (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={handleOpenEditModal}
                  className="border-accent/40 text-accent-light hover:bg-accent/10 px-4 flex items-center gap-1.5 shadow-sm"
                >
                  <Edit2 size={13} />
                  <span>Edit Hero CMS</span>
                </Button>
              )}
            </div>
          </div>

          {/* Right Column: Interactive Multi-Image Telemetry Carousel (5 cols) */}
          <div className="lg:col-span-5">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border-default bg-[#070c17] shadow-2xl transition-all duration-300 hover:border-accent/40 group">
              {/* Telemetry HUD Top Header */}
              <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between border-b border-border-subtle/80 bg-[#0b1220]/80 px-4 py-2.5 backdrop-blur-md text-[11px]">
                <span className="eyebrow flex items-center gap-1.5 text-text-secondary">
                  <Compass size={13} className="text-accent-light" />
                  IDSN BYALALU DEEP SPACE NODE
                </span>

                <div className="flex items-center gap-2 text-[10px] font-mono text-accent-light">
                  <span className="rounded bg-accent/20 px-1.5 py-0.5 font-bold">
                    SLIDE {currentSlideIndex + 1}/{slides.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsPlaying((p) => !p)}
                    className="p-1 rounded text-text-dim hover:text-white transition-colors"
                    title={isPlaying ? 'Pause auto-rotation' : 'Start auto-rotation'}
                  >
                    {isPlaying ? <Pause size={11} /> : <Play size={11} />}
                  </button>
                  <span className="h-2 w-2 rounded-full bg-nominal animate-pulse ml-1" />
                </div>
              </div>

              {/* Main Carousel Image with Fallback */}
              <div className="relative h-full w-full">
                <ImageWithFallback
                  src={activeSlide?.url}
                  alt={activeSlide?.caption || 'Indian Deep Space Network'}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  aspectRatio="4/3"
                  fallbackIcon="satellite"
                  fallbackTitle={activeSlide?.caption || 'ISTRAC Deep Space Node'}
                  fallbackSubtitle="Primary Ground Station Antenna Node"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#060b16] via-transparent to-transparent" />
              </div>

              {/* Slide Navigation Arrows (Revealed on Hover) */}
              {slides.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrevSlide}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-card/85 border border-border-default text-text-muted hover:text-white hover:bg-accent flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-lg"
                    aria-label="Previous slide"
                  >
                    <ChevronLeft size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={handleNextSlide}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-card/85 border border-border-default text-text-muted hover:text-white hover:bg-accent flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-lg"
                    aria-label="Next slide"
                  >
                    <ChevronRight size={15} />
                  </button>
                </>
              )}

              {/* Telemetry Station Caption & Progress Dots at Bottom */}
              <div className="absolute bottom-0 inset-x-0 z-20 p-3.5 bg-gradient-to-t from-[#0b1220] via-[#0b1220]/90 to-transparent space-y-2">
                <div className="flex items-center justify-between text-[10px] text-text-dim border-b border-white/10 pb-1.5">
                  <span className="num font-semibold text-text-primary">STATION: ISTRAC BENGALURU MOX COMPLEX</span>
                  <span className="num text-accent-light font-semibold">CARRIER: NOMINAL LOCK</span>
                </div>

                <p className="text-xs font-semibold text-white truncate drop-shadow-sm">
                  {activeSlide?.caption || 'Indian Deep Space Network (IDSN) 32-Meter Antenna Dish at Byalalu'}
                </p>

                {/* Indicator Dots */}
                {slides.length > 1 && (
                  <div className="flex items-center gap-1.5 pt-0.5">
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
      {/* INLINE CMS EDITOR MODAL FOR LANDING HERO */}
      {/* ============================================================ */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Landing Page Hero & Multi-Image Carousel"
      >
        <form onSubmit={handleSaveCms} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div>
            <Input
              id="modal-hero-badge"
              label="Telemetry Status Badge"
              value={editForm.badgeText}
              onChange={(e) => setEditForm((prev) => ({ ...prev, badgeText: e.target.value }))}
              placeholder="e.g. Telemetry & Tracking Network Active · 24/7 MOX Ops"
            />
          </div>

          <div>
            <Input
              id="modal-hero-title"
              label="Main Headline Title *"
              required
              value={editForm.title}
              onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. ISRO Telemetry, Tracking & Command Network"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Hero Subtitle & Description
            </label>
            <Textarea
              id="modal-hero-subtitle"
              rows={3}
              value={editForm.subtitle}
              onChange={(e) => setEditForm((prev) => ({ ...prev, subtitle: e.target.value }))}
              placeholder="Describe mission operations scope, tracking network, and flight telemetry..."
            />
          </div>

          <div>
            <Input
              id="modal-hero-cta"
              label="Primary CTA Button Text"
              value={editForm.ctaText}
              onChange={(e) => setEditForm((prev) => ({ ...prev, ctaText: e.target.value }))}
              placeholder="e.g. Enter Mission Portal"
            />
          </div>

          {/* Carousel Images Manager */}
          <div className="space-y-2.5 pt-2 border-t border-border-subtle">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <ImageIcon size={14} className="text-accent-light" />
                <span>Landing Hero Carousel Slides & Images:</span>
              </label>

              <button
                type="button"
                onClick={handleAddSlide}
                className="text-xs text-accent-light hover:underline font-semibold flex items-center gap-1"
              >
                <Plus size={12} />
                <span>Add Slide</span>
              </button>
            </div>

            <div className="space-y-2.5 max-h-48 overflow-y-auto p-2.5 rounded-xl border border-border-default bg-[#060c18]">
              {editForm.slides.map((slide, idx) => (
                <div key={idx} className="p-2.5 rounded-lg border border-border-subtle bg-surface space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase num text-accent-light">
                      Slide #{idx + 1}
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
                    value={slide.caption || ''}
                    onChange={(e) => handleUpdateSlide(idx, 'caption', e.target.value)}
                    placeholder="Slide caption, e.g. IDSN 32-Meter Deep Space Antenna"
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
              disabled={savingCms}
              className="bg-accent hover:bg-accent-hover shadow-md shadow-accent/25"
            >
              {savingCms ? 'Saving CMS…' : 'Save Landing Hero CMS'}
            </Button>
          </div>
        </form>
      </Modal>

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
