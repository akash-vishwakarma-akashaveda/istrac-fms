import {
  UserPlus,
  Search,
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
  Maximize2,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useCms, DEFAULT_CMS_BLOCKS } from '../context/cmsContext'
import { useUpdateCmsBlock } from '../hooks/useUpdateCmsBlock'
import { usePreviewRefresh } from '../context/PreviewRefreshContext'
import { useAuthStore } from '../store/authStore'
import { useAuthModalStore } from '../store/authModalStore'
import { useToastStore } from '../store/toastStore'
import { type HeroContent, type HeroSlide } from '../types/cms'
import { Button, Modal, Input, Textarea } from '.'
import { SearchModal } from './SearchModal'
import { ImageLightboxModal } from './ImageLightboxModal'
import { isSafeUrl } from '../lib/sanitize'
import { CmsImageInput, getResolvedMediaUrl } from './cms-editor/CmsImageInput'
import { SpaceParallaxBackground, type SpaceBackgroundConfig } from './SpaceParallaxBackground'

interface ExtendedHeroContent extends HeroContent {
  badgeText?: string
  cardHeadline?: string
  imageUrl?: string
  imageAlt?: string
  slides?: HeroSlide[]
  showBadge?: boolean
  showLoginBtn?: boolean
  showRegisterBtn?: boolean
  showSearchBtn?: boolean
  showDashboardBtn?: boolean
  showFileRepoBtn?: boolean
  carouselAutoplay?: boolean
  carouselIntervalMs?: number
}

const DEFAULT_LANDING_SLIDES: HeroSlide[] = [
  {
    url: 'https://images.unsplash.com/photo-1517976487515-56839a85703f?auto=format&fit=crop&w=1200&q=80',
    caption: 'Indian Deep Space Network (IDSN) 32-Meter Antenna Dish at Byalalu',
    alt: 'IDSN 32-Meter Antenna',
    nodeHeadline: 'IDSN BYALALU DEEP SPACE NODE',
    stationText: 'STATION: ISTRAC BENGALURU MOX COMPLEX',
    carrierText: 'CARRIER: NOMINAL LOCK',
    fallbackTitle: 'ISTRAC Deep Space Node',
    fallbackSubtitle: 'Primary Ground Station Antenna Node',
  },
  {
    url: 'https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?auto=format&fit=crop&w=1200&q=80',
    caption: 'Mission Operations Complex (MOX) Flight Dynamics & Control Consoles',
    alt: 'MOX Flight Control Consoles',
    nodeHeadline: 'MOX-1 FLIGHT OPERATIONS COMPLEX',
    stationText: 'STATION: ISTRAC BENGALURU MOX COMPLEX',
    carrierText: 'CARRIER: NOMINAL LOCK',
    fallbackTitle: 'Mission Operations Complex',
    fallbackSubtitle: 'Flight Dynamics & Mission Control',
  },
  {
    url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    caption: 'Real-time Global Satellite Telemetry Downlink Stream & Constellation Tracking',
    alt: 'Satellite Constellation Network',
    nodeHeadline: 'GLOBAL GROUND NETWORK CONSTELLATION',
    stationText: 'STATION: MULTI-GROUND TRACKING NETWORK',
    carrierText: 'CARRIER: ACTIVE DOWNLINK',
    fallbackTitle: 'Global Satellite Network',
    fallbackSubtitle: 'Constellation Telemetry Stream',
  },
  {
    url: 'https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?auto=format&fit=crop&w=1200&q=80',
    caption: 'ISTRAC Bengaluru Main Control Room Operations Gallery',
    alt: 'Control Room Gallery',
    nodeHeadline: 'MAIN CONTROL ROOM OPERATIONS',
    stationText: 'STATION: ISTRAC BENGALURU MOX COMPLEX',
    carrierText: 'CARRIER: NOMINAL LOCK',
    fallbackTitle: 'Main Control Room',
    fallbackSubtitle: 'Real-time Mission Operations Center',
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
  const [failedPhotos, setFailedPhotos] = useState<string[]>([])
  const spaceConfig = cmsBlocks['space_background'] as SpaceBackgroundConfig | undefined
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const { openLogin, openRegister } = useAuthModalStore()

  // Carousel State
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const autoPlayTimerRef = useRef<any>(null)
  const isHoveredRef = useRef(false)


  // Inline CMS Edit State
  const [editForm, setEditForm] = useState({
    title: '',
    subtitle: '',
    ctaText: '',
    badgeText: '',
    cardHeadline: '',
    stationText: '',
    carrierText: '',
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
    const shouldPlay = isPlaying && slides.length > 1 && (hero?.carouselAutoplay ?? true)
    if (shouldPlay) {
      autoPlayTimerRef.current = setInterval(() => {
        // Skip advancing while the user is hovering over the carousel
        if (!isHoveredRef.current) {
          setCurrentSlideIndex((prev) => (prev + 1) % slides.length)
        }
      }, hero?.carouselIntervalMs ?? 4500)
    }
    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current)
    }
  }, [isPlaying, slides.length, hero?.carouselAutoplay, hero?.carouselIntervalMs])

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
      cardHeadline: hero?.cardHeadline || 'IDSN BYALALU DEEP SPACE NODE',
      stationText: hero?.stationText || 'STATION: ISTRAC BENGALURU MOX COMPLEX',
      carrierText: hero?.carrierText || 'CARRIER: NOMINAL LOCK',
      slides:
        slides.length > 0
          ? [...slides]
          : [
              {
                url: '',
                caption: '',
                alt: '',
                nodeHeadline: '',
                stationText: '',
                carrierText: '',
                fallbackTitle: '',
                fallbackSubtitle: '',
              },
            ],
    })
    setIsEditModalOpen(true)
  }

  const handleAddSlide = () => {
    setEditForm((prev) => ({
      ...prev,
      slides: [
        ...prev.slides,
        {
          url: '',
          caption: '',
          alt: '',
          nodeHeadline: '',
          stationText: '',
          carrierText: '',
          fallbackTitle: '',
          fallbackSubtitle: '',
        },
      ],
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

    const validSlides = editForm.slides.filter(
      (slide) => slide.url.trim().length > 0 && isSafeUrl(slide.url.trim())
    )
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
          cardHeadline: editForm.cardHeadline.trim() || 'IDSN BYALALU DEEP SPACE NODE',
          stationText: editForm.stationText.trim() || 'STATION: ISTRAC BENGALURU MOX COMPLEX',
          carrierText: editForm.carrierText.trim() || 'CARRIER: NOMINAL LOCK',
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
  const photoUrl = getResolvedMediaUrl(activeSlide?.url)

  return (
    <>
      <section
        id="hero"
        data-theme="dark"
        className="relative isolate overflow-hidden bg-brand-ink text-white"
        aria-labelledby="hero-title"
      >
        {/* Base layer: the CMS space theme, visible whenever a hero photo is missing or cannot load */}
        <SpaceParallaxBackground config={spaceConfig} contained />
        {photoUrl && !failedPhotos.includes(photoUrl) && (
          <img
            key={photoUrl}
            src={photoUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setFailedPhotos((prev) => [...prev, photoUrl])}
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: 'linear-gradient(90deg, rgba(5,12,20,0.9) 0%, rgba(5,12,20,0.72) 45%, rgba(5,12,20,0.22) 100%)' }}
        />

        <div className="shell relative pt-16 pb-36 sm:pt-28 sm:pb-44">
          <div className="flex max-w-[640px] flex-col gap-6">
            {(hero?.showBadge ?? true) && (
              <span className="inline-flex min-h-[30px] items-center gap-2 self-start rounded-2xl bg-white/10 px-3 py-1 text-[13px] font-bold text-white">
                <span className="h-2 w-2 rounded-full bg-[#6ee7a8]" />
                {hero?.badgeText ?? 'Telemetry & Tracking Network Active · 24/7 MOX Ops'}
              </span>
            )}

            <h1
              id="hero-title"
              className="display text-[38px] font-bold leading-[44px] tracking-tight text-white sm:text-[56px] sm:leading-[62px]"
            >
              {hero?.title ?? 'ISRO Telemetry, Tracking & Command Network'}
            </h1>

            <p className="text-lg leading-[30px] text-white/90 sm:text-[19px]">
              {hero?.subtitle ??
                'The nerve centre for spacecraft operations, deep space tracking, launch vehicle telemetry, and orbit determination across all Indian space missions.'}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {user ? (
                <>
                  {(hero?.showDashboardBtn ?? true) && (
                    <Link to={user.role === 'ADMIN' ? '/admin' : '/dashboard'}>
                      <Button variant="primary" size="lg">
                        <LayoutDashboard size={17} strokeWidth={2.2} />
                        <span>Go to dashboard</span>
                        <ArrowRight size={17} />
                      </Button>
                    </Link>
                  )}
                  {(hero?.showFileRepoBtn ?? true) && (
                    <Link
                      to="/dashboard/files"
                      className="inline-flex min-h-12 items-center rounded-[10px] border border-white/60 px-6 text-[15px] font-bold text-white transition-colors hover:border-white hover:bg-white/10"
                    >
                      File repositories
                    </Link>
                  )}
                </>
              ) : (
                <>
                  {(hero?.showLoginBtn ?? true) && (
                    <Button variant="primary" size="lg" onClick={openLogin}>
                      <span>{hero?.ctaText || 'Sign in to portal'}</span>
                      <ArrowRight size={17} />
                    </Button>
                  )}
                  {(hero?.showRegisterBtn ?? true) && (
                    <button
                      type="button"
                      onClick={openRegister}
                      className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-[10px] border border-white/60 px-6 text-[15px] font-bold text-white transition-colors hover:border-white hover:bg-white/10"
                    >
                      <UserPlus size={17} />
                      Request access
                    </button>
                  )}
                </>
              )}
              {(hero?.showSearchBtn ?? true) && (
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-[10px] px-4 text-[15px] font-semibold text-white/90 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Search size={17} />
                  Search files
                  <kbd className="hidden rounded border border-white/30 px-1.5 py-0.5 font-mono text-[11px] text-white/80 sm:inline">Ctrl K</kbd>
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleOpenEditModal}
                  className="inline-flex min-h-12 cursor-pointer items-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Edit2 size={14} />
                  Edit hero
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Photo caption and carousel controls */}
        <div
          className="shell absolute inset-x-0 bottom-20 flex items-center justify-end gap-4 sm:bottom-24"
          onMouseEnter={() => { isHoveredRef.current = true }}
          onMouseLeave={() => { isHoveredRef.current = false }}
        >
          <span className="hidden text-right text-sm text-white/90 md:block">
            {activeSlide?.caption || 'Indian Deep Space Network (IDSN) 32-Meter Antenna Dish at Byalalu'}
          </span>
          <div className="flex items-center gap-2">
            {slides.length > 1 && (
              <button
                type="button"
                onClick={handlePrevSlide}
                aria-label="Previous photo"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/50 text-white transition-colors hover:bg-white/10"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            {slides.length > 1 &&
              slides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentSlideIndex(idx)}
                  aria-label={`Show photo ${idx + 1}`}
                  aria-current={idx === currentSlideIndex}
                  className={`h-2 cursor-pointer rounded-full transition-all ${idx === currentSlideIndex ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'}`}
                />
              ))}
            {slides.length > 1 && (
              <button
                type="button"
                onClick={handleNextSlide}
                aria-label="Next photo"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/50 text-white transition-colors hover:bg-white/10"
              >
                <ChevronRight size={16} />
              </button>
            )}
            {slides.length > 1 && (
              <button
                type="button"
                onClick={() => setIsPlaying((p) => !p)}
                aria-label={isPlaying ? 'Pause photos' : 'Play photos'}
                title={isPlaying ? 'Pause photos' : 'Play photos'}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsLightboxOpen(true)}
              aria-label="Enlarge photo"
              title="Enlarge photo"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Maximize2 size={14} />
            </button>
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

          <div>
            <Input
              id="modal-hero-card-headline"
              label="Telemetry Card Headline (Top Bar)"
              value={editForm.cardHeadline}
              onChange={(e) => setEditForm((prev) => ({ ...prev, cardHeadline: e.target.value }))}
              placeholder="e.g. IDSN BYALALU DEEP SPACE NODE"
              hint="Upper headline displayed beside the compass icon in the carousel card"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Input
                id="modal-hero-station"
                label="Station Label (Bottom Left)"
                value={editForm.stationText}
                onChange={(e) => setEditForm((prev) => ({ ...prev, stationText: e.target.value }))}
                placeholder="e.g. STATION: ISTRAC BENGALURU MOX COMPLEX"
              />
            </div>
            <div>
              <Input
                id="modal-hero-carrier"
                label="Carrier Link Status (Bottom Right)"
                value={editForm.carrierText}
                onChange={(e) => setEditForm((prev) => ({ ...prev, carrierText: e.target.value }))}
                placeholder="e.g. CARRIER: NOMINAL LOCK"
              />
            </div>
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

            <div className="space-y-3 max-h-72 sm:max-h-80 overflow-y-auto p-2.5 rounded-xl border border-border-default bg-[#060c18]">
              {editForm.slides.map((slide, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-border-subtle bg-surface space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase num text-accent-light flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      Slide #{idx + 1}
                    </span>
                    {editForm.slides.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSlide(idx)}
                        className="text-critical hover:text-critical p-1 rounded hover:bg-critical/10 transition-colors"
                        title="Remove Slide"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  <CmsImageInput
                    id={`hero-slide-url-${idx}`}
                    label="Image URL *"
                    value={slide.url}
                    onChange={(url) => handleUpdateSlide(idx, 'url', url)}
                    placeholder="https://... or /media/cms-assets/..."
                    hint="Paste a URL or click Browse to upload from your computer."
                  />

                  <div>
                    <label className="block text-[11px] font-medium text-text-dim mb-1">Slide Caption (Bottom Heading)</label>
                    <input
                      type="text"
                      value={slide.caption || ''}
                      onChange={(e) => handleUpdateSlide(idx, 'caption', e.target.value)}
                      placeholder="Slide caption, e.g. IDSN 32-Meter Deep Space Antenna"
                      className="w-full rounded-md border border-border-default bg-[#060c18] px-2.5 py-1.5 text-xs text-white outline-none focus:border-accent"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-border-subtle/60">
                    <div>
                      <label className="block text-[10px] uppercase font-semibold text-text-dim mb-1">HUD Top Bar Title (Optional)</label>
                      <input
                        type="text"
                        value={slide.nodeHeadline || ''}
                        onChange={(e) => handleUpdateSlide(idx, 'nodeHeadline', e.target.value)}
                        placeholder={editForm.cardHeadline || 'IDSN BYALALU DEEP SPACE NODE'}
                        className="w-full rounded-md border border-border-default bg-[#060c18] px-2.5 py-1.5 text-xs text-white outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-semibold text-text-dim mb-1">Station Tag (Optional)</label>
                      <input
                        type="text"
                        value={slide.stationText || ''}
                        onChange={(e) => handleUpdateSlide(idx, 'stationText', e.target.value)}
                        placeholder={editForm.stationText || 'STATION: ISTRAC BENGALURU MOX COMPLEX'}
                        className="w-full rounded-md border border-border-default bg-[#060c18] px-2.5 py-1.5 text-xs text-white outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] uppercase font-semibold text-text-dim mb-1">Carrier Status (Optional)</label>
                      <input
                        type="text"
                        value={slide.carrierText || ''}
                        onChange={(e) => handleUpdateSlide(idx, 'carrierText', e.target.value)}
                        placeholder={editForm.carrierText || 'CARRIER: NOMINAL LOCK'}
                        className="w-full rounded-md border border-border-default bg-[#060c18] px-2.5 py-1.5 text-xs text-white outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-semibold text-text-dim mb-1">Fallback Card Subtitle</label>
                      <input
                        type="text"
                        value={slide.fallbackSubtitle || ''}
                        onChange={(e) => handleUpdateSlide(idx, 'fallbackSubtitle', e.target.value)}
                        placeholder="Primary Ground Station Antenna Node"
                        className="w-full rounded-md border border-border-default bg-[#060c18] px-2.5 py-1.5 text-xs text-white outline-none focus:border-accent"
                      />
                    </div>
                  </div>
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

      {/* Enlarged Image Preview Lightbox */}
      <ImageLightboxModal
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        images={slides.map((s, idx) => ({
          url: s.url,
          title: s.alt || `IDSN Deep Space Antenna Facility 0${idx + 1}`,
          caption: s.caption || s.alt || 'ISTRAC Telemetry Ground Complex',
          alt: s.alt || s.caption || 'Telemetry Facility',
          tag: `SLIDE 0${idx + 1} / 0${slides.length}`,
          station: 'ISTRAC BENGALURU MOX COMPLEX · IDSN BYALALU',
        }))}
        initialIndex={currentSlideIndex}
      />
    </>
  )
}
