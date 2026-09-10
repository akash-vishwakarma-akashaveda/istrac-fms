import { useEffect, useState } from 'react'
import { Sparkles, Image as ImageIcon, Orbit, Compass, RefreshCw } from 'lucide-react'
import { useCms } from '../../context/cmsContext'
import { usePreviewRefresh } from '../../context/PreviewRefreshContext'
import { useUpdateCmsBlock } from '../../hooks/useUpdateCmsBlock'
import { useToastStore } from '../../store/toastStore'
import { Panel } from '..'
import { SaveBar } from './SaveBar'
import { type SpaceBackgroundConfig } from '../SpaceParallaxBackground'
import { CmsImageInput } from './CmsImageInput'

const PRESET_WALLPAPERS = [
  {
    name: 'ISRO Deep Space Network Dish at Byalalu',
    url: 'https://images.unsplash.com/photo-1517976487515-56839a85703f?auto=format&fit=crop&w=1920&q=80',
    thumb: 'https://images.unsplash.com/photo-1517976487515-56839a85703f?auto=format&fit=crop&w=200&q=80',
  },
  {
    name: 'Earth Horizon & LEO Orbital Constellation',
    url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1920&q=80',
    thumb: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=200&q=80',
  },
  {
    name: 'Deep Cosmic Nebula & Stellar Nursery',
    url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1920&q=80',
    thumb: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=200&q=80',
  },
  {
    name: 'Milky Way Core Over Earth Observatory',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1920&q=80',
    thumb: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=200&q=80',
  },
]

export function SpaceBackgroundTab() {
  const { cmsBlocks } = useCms()
  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  const existing = (cmsBlocks['space_background'] as SpaceBackgroundConfig | undefined) || {}

  const [mode, setMode] = useState<'deep_space_hybrid' | 'space_canvas' | 'custom_image'>('deep_space_hybrid')
  const [customImageUrl, setCustomImageUrl] = useState('')
  const [overlayOpacity, setOverlayOpacity] = useState(45)
  const [enableParallax, setEnableParallax] = useState(true)
  const [parallaxSpeed, setParallaxSpeed] = useState(0.35)
  const [starDensity, setStarDensity] = useState<'low' | 'medium' | 'high'>('medium')
  const [showConstellations, setShowConstellations] = useState(true)
  const [showOrbitalRings, setShowOrbitalRings] = useState(true)

  useEffect(() => {
    setMode(existing.mode || 'deep_space_hybrid')
    setCustomImageUrl(existing.customImageUrl || '')
    setOverlayOpacity(existing.overlayOpacity ?? 45)
    setEnableParallax(existing.enableParallax !== false)
    setParallaxSpeed(existing.parallaxSpeed ?? 0.35)
    setStarDensity(existing.starDensity || 'medium')
    setShowConstellations(existing.showConstellations !== false)
    setShowOrbitalRings(existing.showOrbitalRings !== false)
  }, [existing])

  function handleSave() {
    updateBlock.mutate(
      {
        blockKey: 'space_background',
        content: {
          mode,
          customImageUrl,
          overlayOpacity: Number(overlayOpacity),
          enableParallax,
          parallaxSpeed: Number(parallaxSpeed),
          starDensity,
          showConstellations,
          showOrbitalRings,
        },
      },
      {
        onSuccess: () => {
          addToast({ message: 'Space background & parallax settings published', variant: 'success' })
          triggerRefresh()
        },
        onError: () => {
          addToast({ message: 'Failed to update background settings', variant: 'error' })
        },
      },
    )
  }

  function handleResetDefault() {
    setMode('deep_space_hybrid')
    setCustomImageUrl('')
    setOverlayOpacity(45)
    setEnableParallax(true)
    setParallaxSpeed(0.35)
    setStarDensity('medium')
    setShowConstellations(true)
    setShowOrbitalRings(true)
  }

  return (
    <Panel title="Space Theme & Parallax Canvas" meta="block:space_background">
      <div className="space-y-6">
        {/* Intro notice banner */}
        <div className="rounded-xl border border-accent/30 bg-accent/[0.06] p-4 flex items-start gap-3">
          <Sparkles size={18} className="text-accent-light shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-text-secondary leading-relaxed">
            <p className="font-bold text-white">Unified Parallax Aerospace Canvas</p>
            <p>
              Controls the persistent full-viewport space background that stays seamlessly fixed across all landing page sections as the user scrolls.
            </p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-text-dim">
            Background Rendering Mode
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: 'deep_space_hybrid',
                title: 'Deep Space Hybrid (Recommended)',
                desc: 'Procedural twinkling stars, colorful cosmic nebulae & optional wallpaper',
                icon: Orbit,
              },
              {
                id: 'space_canvas',
                title: 'Procedural Starfield',
                desc: 'Pure lightweight canvas with twinkling stars and orbital vector curves',
                icon: Compass,
              },
              {
                id: 'custom_image',
                title: 'Custom Wallpaper Cinema',
                desc: 'Full-bleed photographic background with parallax scroll motion',
                icon: ImageIcon,
              },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMode(opt.id as any)}
                className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                  mode === opt.id
                    ? 'border-accent bg-accent/15 shadow-lg shadow-accent/10 text-white'
                    : 'border-border-subtle bg-surface/60 text-text-secondary hover:border-border-default'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <opt.icon size={16} className={mode === opt.id ? 'text-accent-light' : 'text-text-muted'} />
                  <span className="text-xs font-bold">{opt.title}</span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-85">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Image URL / Presets (if hybrid or custom_image) */}
        {(mode === 'custom_image' || mode === 'deep_space_hybrid') && (
          <div className="space-y-3 p-4 rounded-xl border border-border-subtle bg-[#060b17]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <ImageIcon size={14} className="text-accent-light" />
                <span>Custom Wallpaper URL (Optional)</span>
              </label>
              {customImageUrl && (
                <button
                  type="button"
                  onClick={() => setCustomImageUrl('')}
                  className="text-[10px] text-accent-light hover:underline"
                >
                  Clear image
                </button>
              )}
            </div>

            <CmsImageInput
              id="custom-bg-url"
              label="Custom Wallpaper (URL or upload)"
              value={customImageUrl}
              onChange={setCustomImageUrl}
              placeholder="https://... or /media/cms-assets/..."
              hint="Leave blank to use the built-in procedural deep-space cosmos. Click Browse to upload from your computer."
            />

            {/* Quick Preset Wallpapers */}
            <div className="space-y-2 pt-2">
              <p className="text-[10px] uppercase font-bold text-text-dim tracking-wider">
                Select from Curated Space Presets:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESET_WALLPAPERS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setCustomImageUrl(preset.url)}
                    className={`relative rounded-lg overflow-hidden border p-1 text-left group transition-all cursor-pointer ${
                      customImageUrl === preset.url
                        ? 'border-accent ring-1 ring-accent bg-accent/10'
                        : 'border-border-subtle hover:border-accent/40 bg-surface'
                    }`}
                  >
                    <img
                      src={preset.thumb}
                      alt={preset.name}
                      className="w-full h-14 object-cover rounded"
                    />
                    <span className="block text-[9px] font-semibold text-text-primary mt-1 line-clamp-1">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Parallax & Dimming Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Dimming Shroud / Opacity */}
          <div className="p-4 rounded-xl border border-border-subtle bg-surface/50 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white">Vignette & Shroud Darkness</label>
              <span className="num text-xs font-bold text-accent-light">{overlayOpacity}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="90"
              step="5"
              value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(Number(e.target.value))}
              className="w-full accent-accent cursor-pointer"
            />
            <p className="text-[11px] text-text-dim leading-relaxed">
              Higher darkness ensures text, badges, and file cards maintain 100% WCAG contrast against bright nebula backgrounds.
            </p>
          </div>

          {/* Parallax Scroll Speed */}
          <div className="p-4 rounded-xl border border-border-subtle bg-surface/50 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white">Parallax Scroll Intensity</label>
              <span className="num text-xs font-bold text-accent-light">{Math.round(parallaxSpeed * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.8"
              step="0.05"
              value={parallaxSpeed}
              disabled={!enableParallax}
              onChange={(e) => setParallaxSpeed(Number(e.target.value))}
              className="w-full accent-accent cursor-pointer disabled:opacity-40"
            />
            <p className="text-[11px] text-text-dim leading-relaxed">
              Adjusts how deep the starry parallax effect shifts as users scroll down the landing page.
            </p>
          </div>
        </div>

        {/* Feature Checkboxes */}
        <div className="p-4 rounded-xl border border-border-subtle bg-surface/50 space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-text-dim">
            Space Elements & Motion
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="flex items-center gap-2.5 p-2 rounded-lg border border-border-subtle/70 bg-card hover:border-accent/40 transition-colors cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enableParallax}
                onChange={(e) => setEnableParallax(e.target.checked)}
                className="h-4 w-4 rounded border-border-default bg-surface text-accent focus:ring-accent"
              />
              <span className="text-text-primary font-medium">Enable Parallax Scroll Depth</span>
            </label>

            <label className="flex items-center gap-2.5 p-2 rounded-lg border border-border-subtle/70 bg-card hover:border-accent/40 transition-colors cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showOrbitalRings}
                onChange={(e) => setShowOrbitalRings(e.target.checked)}
                className="h-4 w-4 rounded border-border-default bg-surface text-accent focus:ring-accent"
              />
              <span className="text-text-primary font-medium">Show Orbital Trajectory Curves</span>
            </label>

            <label className="flex items-center gap-2.5 p-2 rounded-lg border border-border-subtle/70 bg-card hover:border-accent/40 transition-colors cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showConstellations}
                onChange={(e) => setShowConstellations(e.target.checked)}
                className="h-4 w-4 rounded border-border-default bg-surface text-accent focus:ring-accent"
              />
              <span className="text-text-primary font-medium">Show Telemetry Constellation Lines</span>
            </label>

            <div className="flex items-center justify-between p-2 rounded-lg border border-border-subtle/70 bg-card">
              <span className="text-text-primary font-medium">Star Density</span>
              <select
                value={starDensity}
                onChange={(e) => setStarDensity(e.target.value as any)}
                className="bg-surface border border-border-default rounded px-2 py-0.5 text-xs text-text-primary"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
        </div>

        {/* Reset button */}
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={handleResetDefault}
            className="inline-flex items-center gap-1.5 text-xs text-text-dim hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw size={12} />
            <span>Reset to Default Deep Space</span>
          </button>
        </div>

        <SaveBar onSave={handleSave} isPending={updateBlock.isPending} />
      </div>
    </Panel>
  )
}
