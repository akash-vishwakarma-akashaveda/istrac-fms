import { useEffect, useState } from 'react'
import { useCms } from '../../context/cmsContext'
import { usePreviewRefresh } from '../../context/PreviewRefreshContext'
import { useUpdateCmsBlock } from '../../hooks/useUpdateCmsBlock'
import { useToastStore } from '../../store/toastStore'
import { Input, Panel } from '..'
import { SaveBar } from './SaveBar'

interface HeroContent {
  title?: string
  subtitle?: string
  ctaText?: string
  badgeText?: string
  imageUrl?: string
  imageAlt?: string
}

export function HeroTab() {
  const { cmsBlocks } = useCms()
  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  const existing = cmsBlocks['hero'] as HeroContent | undefined

  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [ctaText, setCtaText] = useState('')
  const [badgeText, setBadgeText] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageAlt, setImageAlt] = useState('')

  useEffect(() => {
    setTitle(existing?.title ?? '')
    setSubtitle(existing?.subtitle ?? '')
    setCtaText(existing?.ctaText ?? '')
    setBadgeText(existing?.badgeText ?? '')
    setImageUrl(existing?.imageUrl ?? '')
    setImageAlt(existing?.imageAlt ?? '')
  }, [existing])

  function handleSave() {
    updateBlock.mutate(
      {
        blockKey: 'hero',
        content: {
          title,
          subtitle,
          ctaText,
          badgeText,
          imageUrl,
          imageAlt,
        },
      },
      {
        onSuccess: () => {
          addToast({ message: 'Hero updated', variant: 'success' })
          triggerRefresh()
        },
        onError: () => {
          addToast({ message: 'Failed to save', variant: 'error' })
        },
      },
    )
  }

  return (
    <Panel title="Hero" meta="block:hero">
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
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter hero title..."
        />

        {/* Hero subtitle */}
        <Input
          id="hero-subtitle"
          label="Subtitle"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="Enter hero subtitle..."
        />

        {/* CTA */}
        <Input
          id="hero-cta"
          label="CTA button text"
          value={ctaText}
          onChange={(e) => setCtaText(e.target.value)}
          placeholder="e.g. Get started"
        />

        {/* Image URL */}
        <Input
          id="hero-image-url"
          label="Hero Image URL"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://example.com/ground-station.jpg"
          className="num"
          hint="If empty or broken, an automatic mission control placeholder will be rendered."
        />

        {/* Image Alt */}
        <Input
          id="hero-image-alt"
          label="Hero Image Alt Text"
          value={imageAlt}
          onChange={(e) => setImageAlt(e.target.value)}
          placeholder="e.g. ISTRAC Bengaluru Ground Station Antenna"
        />

        {/* Save */}
        <SaveBar
          onSave={handleSave}
          isPending={updateBlock.isPending}
        />
      </div>
    </Panel>
  )
}
