import { useEffect, useState } from 'react'
import { Plus, Trash2, Image as ImageIcon } from 'lucide-react'
import { useCms } from '../../context/cmsContext'
import { usePreviewRefresh } from '../../context/PreviewRefreshContext'
import { useUpdateCmsBlock } from '../../hooks/useUpdateCmsBlock'
import { useToastStore } from '../../store/toastStore'
import { Input, Panel, Button } from '..'
import { SaveBar } from './SaveBar'
import { isSafeUrl } from '../../lib/sanitize'

interface HeroSlide {
  url: string
  caption?: string
  alt?: string
}

interface HeroContent {
  title?: string
  subtitle?: string
  ctaText?: string
  badgeText?: string
  imageUrl?: string
  imageAlt?: string
  slides?: HeroSlide[]
}

export function HeroTab() {
  const { cmsBlocks } = useCms()
  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  const existing = cmsBlocks['hero'] as HeroContent | undefined
  const safeImageUrl = isSafeUrl(existing?.imageUrl as string) 
  ? cmsBlocks.hero.imageUrl as string 
  : '/fallback-hero.jpg'

  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [ctaText, setCtaText] = useState('')
  const [badgeText, setBadgeText] = useState('')
  const [slides, setSlides] = useState<HeroSlide[]>([])

  useEffect(() => {
    setTitle(existing?.title ?? '')
    setSubtitle(existing?.subtitle ?? '')
    setCtaText(existing?.ctaText ?? '')
    setBadgeText(existing?.badgeText ?? '')

    if (existing?.slides && existing.slides.length > 0) {
      setSlides(existing.slides)
    } else if (safeImageUrl && existing) {
      setSlides([
        {
          url: safeImageUrl,
          caption: existing.imageAlt || 'Indian Deep Space Network (IDSN) 32-Meter Antenna Dish',
          alt: existing.imageAlt || 'IDSN Antenna',
        },
      ])
    } else {
      setSlides([
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
      ])
    }
  }, [existing])

  const handleAddSlide = () => {
    setSlides((prev) => [...prev, { url: '', caption: '', alt: '' }])
  }

  const handleRemoveSlide = (index: number) => {
    setSlides((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpdateSlide = (index: number, field: keyof HeroSlide, value: string) => {
    setSlides((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  function handleSave() {
    const validSlides = slides.filter((s) => s.url.trim().length > 0)
    const primaryImage = validSlides[0]?.url || 'https://images.unsplash.com/photo-1517976487515-56839a85703f?auto=format&fit=crop&w=1200&q=80'
    const primaryAlt = validSlides[0]?.caption || 'Indian Deep Space Network Antenna Dish'

    updateBlock.mutate(
      {
        blockKey: 'hero',
        content: {
          title,
          subtitle,
          ctaText,
          badgeText,
          imageUrl: primaryImage,
          imageAlt: primaryAlt,
          slides: validSlides,
        },
      },
      {
        onSuccess: () => {
          addToast({ message: 'Landing page hero & carousel updated', variant: 'success' })
          triggerRefresh()
        },
        onError: () => {
          addToast({ message: 'Failed to save hero CMS', variant: 'error' })
        },
      },
    )
  }

  return (
    <Panel title="Hero & Multi-Image Carousel" meta="block:hero">
      <div className="space-y-5">
        {/* Badge Text */}
        <Input
          id="hero-badge"
          label="Telemetry Status Badge"
          value={badgeText}
          onChange={(e) => setBadgeText(e.target.value)}
          placeholder="e.g. Telemetry & Tracking Network Active"
        />

        {/* Hero title */}
        <Input
          id="hero-title"
          label="Main Headline Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter hero title..."
        />

        {/* Hero subtitle */}
        <Input
          id="hero-subtitle"
          label="Hero Subtitle & Description"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="Enter hero subtitle..."
        />

        {/* CTA */}
        <Input
          id="hero-cta"
          label="Primary CTA Button Text"
          value={ctaText}
          onChange={(e) => setCtaText(e.target.value)}
          placeholder="e.g. Enter Mission Portal"
        />

        {/* Multi-Image Carousel Slides Manager */}
        <div className="space-y-3 pt-3 border-t border-border-subtle">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                <ImageIcon size={14} className="text-accent-light" />
                <span>Landing Hero Carousel Slides & Images</span>
              </h4>
              <p className="text-[11px] text-text-dim mt-0.5">
                Add one or more images. The hero will auto-cycle through them with telemetry HUD transitions.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddSlide}
              className="text-xs flex items-center gap-1"
            >
              <Plus size={13} />
              <span>Add Slide</span>
            </Button>
          </div>

          <div className="space-y-3">
            {slides.map((slide, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-border-default bg-[#060c18] space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase text-accent-light bg-accent/10 border border-accent/30 px-2 py-0.5 rounded">
                    Slide #{idx + 1}
                  </span>

                  {slides.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSlide(idx)}
                      className="text-critical hover:text-critical-hover p-1 rounded hover:bg-critical/10 transition-colors"
                      title="Delete this slide"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] text-text-dim mb-1">Image URL *</label>
                  <input
                    type="url"
                    value={slide.url}
                    onChange={(e) => handleUpdateSlide(idx, 'url', e.target.value)}
                    placeholder="https://images.unsplash.com/... or /assets/..."
                    className="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-text-dim mb-1">Slide Telemetry Caption</label>
                  <input
                    type="text"
                    value={slide.caption || ''}
                    onChange={(e) => handleUpdateSlide(idx, 'caption', e.target.value)}
                    placeholder="e.g. Indian Deep Space Network 32-Meter Antenna Dish at Byalalu"
                    className="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Save */}
        <SaveBar
          onSave={handleSave}
          isPending={updateBlock.isPending}
        />
      </div>
    </Panel>
  )
}
