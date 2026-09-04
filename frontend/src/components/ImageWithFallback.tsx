import { useState, useEffect, useRef } from 'react'
import { Satellite, Building, Radio } from 'lucide-react'

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackLabel?: string
  fallbackTitle?: string
  fallbackSubtitle?: string
  fallbackIcon?: 'satellite' | 'mox' | 'dish'
  aspectRatio?: 'video' | 'square' | 'wide' | '4/3' | 'auto'
}

export function ImageWithFallback({
  src,
  alt = 'Image',
  className = '',
  fallbackLabel = 'Telemetry Visual Placeholder',
  fallbackTitle,
  fallbackSubtitle,
  fallbackIcon = 'satellite',
  aspectRatio = 'auto',
  ...props
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const imgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!src) {
      setHasError(true)
      setIsLoading(false)
      return
    }

    setHasError(false)
    setIsLoading(true)

    // Check if the image is already in browser cache
    const testImg = new window.Image()
    testImg.src = src

    if (testImg.complete) {
      if (testImg.naturalWidth > 0) {
        setIsLoading(false)
      } else {
        setHasError(true)
        setIsLoading(false)
      }
      return
    }

    testImg.onload = () => {
      setIsLoading(false)
    }

    testImg.onerror = () => {
      setIsLoading(false)
      setHasError(true)
    }

    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 4000)

    return () => {
      clearTimeout(timer)
      testImg.onload = null
      testImg.onerror = null
    }
  }, [src])

  const aspectClass =
    aspectRatio === 'video'
      ? 'aspect-video'
      : aspectRatio === 'square'
      ? 'aspect-square'
      : aspectRatio === 'wide'
      ? 'aspect-[21/9]'
      : aspectRatio === '4/3'
      ? 'aspect-[4/3]'
      : ''

  const IconComponent =
    fallbackIcon === 'mox' ? Building : fallbackIcon === 'dish' ? Radio : Satellite

  if (!src || hasError) {
    return (
      <div
        className={`relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border-default bg-surface/80 p-6 text-center text-text-dim ${aspectClass} ${className}`}
        role="img"
        aria-label={alt}
      >
        <div className="graticule-fine pointer-events-none absolute inset-0 opacity-30" />
        <div className="relative z-10 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border-subtle bg-card text-accent-light shadow-inner">
            <IconComponent size={22} strokeWidth={1.7} />
          </div>
          <p className="text-xs font-semibold text-text-secondary">
            {fallbackTitle || fallbackLabel}
          </p>
          <span className="num text-[10px] text-text-dim">
            {fallbackSubtitle || (alt ? `[${alt}]` : 'No preview available · Managed via CMS')}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden ${aspectClass} ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-card animate-pulse">
          <Satellite size={20} className="text-text-dim animate-spin-slow" />
        </div>
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false)
          setHasError(true)
        }}
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        {...props}
      />
    </div>
  )
}
