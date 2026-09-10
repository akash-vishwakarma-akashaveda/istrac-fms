import { useEffect, useRef } from 'react'

export interface SpaceBackgroundConfig {
  mode?: 'space_canvas' | 'custom_image' | 'deep_space_hybrid'
  customImageUrl?: string
  overlayOpacity?: number // 0 to 100
  enableParallax?: boolean
  parallaxSpeed?: number // 0.1 to 1.0
  starDensity?: 'low' | 'medium' | 'high'
  showConstellations?: boolean
  showOrbitalRings?: boolean
}

interface SpaceParallaxBackgroundProps {
  config?: SpaceBackgroundConfig
}

export function SpaceParallaxBackground({ config }: SpaceParallaxBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const mode = config?.mode || 'deep_space_hybrid'
  const customImageUrl = config?.customImageUrl
  const overlayOpacity = typeof config?.overlayOpacity === 'number' ? config?.overlayOpacity : 40
  const enableParallax = config?.enableParallax !== false
  const parallaxSpeed = config?.parallaxSpeed ?? 0.35
  const starDensity = config?.starDensity || 'medium'
  const showConstellations = config?.showConstellations !== false
  const showOrbitalRings = config?.showOrbitalRings !== false

  // Canvas-based twinkling stars, parallax, and constellations
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    let scrollY = window.scrollY || window.pageYOffset || 0
    let targetScrollY = scrollY

    const handleScroll = () => {
      targetScrollY = window.scrollY || window.pageYOffset || 0
    }

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
      initStars()
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleResize)

    // Star data structure
    interface Star {
      x: number
      y: number
      baseY: number
      size: number
      color: string
      alpha: number
      twinkleSpeed: number
      depth: number // 0.1 (distant, slow) to 0.8 (close, faster)
    }

    let stars: Star[] = []

    const starCount =
      starDensity === 'low'
        ? Math.floor((width * height) / 9000)
        : starDensity === 'high'
        ? Math.floor((width * height) / 3200)
        : Math.floor((width * height) / 5200)

    const colors = [
      '#ffffff', // White
      '#93c5fd', // Light Cyan/Blue (ISRO Mission Blue tint)
      '#60a5fa', // Accent Light
      '#c4b5fd', // Soft Violet (Deep Nebula)
      '#fde68a', // Warm Stellar
    ]

    function initStars() {
      stars = []
      for (let i = 0; i < starCount; i++) {
        const depth = Math.random() * 0.7 + 0.1
        const y = Math.random() * height
        stars.push({
          x: Math.random() * width,
          y,
          baseY: y,
          size: Math.random() < 0.85 ? Math.random() * 1.4 + 0.6 : Math.random() * 2.2 + 1.2,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: Math.random() * 0.6 + 0.3,
          twinkleSpeed: Math.random() * 0.02 + 0.005,
          depth,
        })
      }
    }

    initStars()

    let frameCount = 0

    const render = () => {
      frameCount++
      // Smooth scroll lerp
      if (enableParallax) {
        scrollY += (targetScrollY - scrollY) * 0.1
      } else {
        scrollY = 0
      }

      ctx.clearRect(0, 0, width, height)

      // Draw faint constellation links between nearby medium/large stars
      if (showConstellations && stars.length > 0) {
        ctx.lineWidth = 0.5
        const maxDist = 90
        const maxDistSq = maxDist * maxDist

        for (let i = 0; i < Math.min(stars.length, 120); i += 2) {
          const s1 = stars[i]
          const y1 = (s1.baseY - (enableParallax ? scrollY * s1.depth * parallaxSpeed : 0)) % height
          const pos1Y = y1 < 0 ? y1 + height : y1

          for (let j = i + 1; j < Math.min(stars.length, 120); j += 3) {
            const s2 = stars[j]
            const y2 = (s2.baseY - (enableParallax ? scrollY * s2.depth * parallaxSpeed : 0)) % height
            const pos2Y = y2 < 0 ? y2 + height : y2

            const dx = s1.x - s2.x
            const dy = pos1Y - pos2Y
            const distSq = dx * dx + dy * dy

            if (distSq < maxDistSq) {
              const alpha = (1 - Math.sqrt(distSq) / maxDist) * 0.12
              ctx.strokeStyle = `rgba(96, 165, 250, ${alpha})`
              ctx.beginPath()
              ctx.moveTo(s1.x, pos1Y)
              ctx.lineTo(s2.x, pos2Y)
              ctx.stroke()
            }
          }
        }
      }

      // Draw Stars with parallax scroll displacement and twinkling
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i]
        s.alpha += Math.sin(frameCount * s.twinkleSpeed) * 0.015
        const currentAlpha = Math.max(0.15, Math.min(0.95, s.alpha))

        // Parallax vertical movement
        const effectiveParallax = enableParallax ? scrollY * s.depth * parallaxSpeed : 0
        let currentY = (s.baseY - effectiveParallax) % height
        if (currentY < 0) currentY += height

        ctx.fillStyle = s.color
        ctx.globalAlpha = currentAlpha

        ctx.beginPath()
        ctx.arc(s.x, currentY, s.size, 0, Math.PI * 2)
        ctx.fill()

        // Occasional stellar sparkle cross for large stars
        if (s.size > 2.0 && currentAlpha > 0.6) {
          ctx.strokeStyle = s.color
          ctx.lineWidth = 0.6
          ctx.globalAlpha = (currentAlpha - 0.5) * 0.5
          ctx.beginPath()
          ctx.moveTo(s.x - 4, currentY)
          ctx.lineTo(s.x + 4, currentY)
          ctx.moveTo(s.x, currentY - 4)
          ctx.lineTo(s.x, currentY + 4)
          ctx.stroke()
        }
      }

      ctx.globalAlpha = 1.0
      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
    }
  }, [enableParallax, parallaxSpeed, starDensity, showConstellations])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none bg-[#030712]"
    >
      {/* 1. Optional Custom Background Image with Parallax or Fixed Cinema Mode */}
      {customImageUrl && (mode === 'custom_image' || mode === 'deep_space_hybrid') && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700"
          style={{
            backgroundImage: `url("${customImageUrl}")`,
            transform: enableParallax ? 'translate3d(0, 0, 0)' : undefined,
          }}
        />
      )}

      {/* 2. Deep Cosmic Nebula Glows & Radial Dust Fields */}
      <div className="absolute inset-0">
        {/* Deep ISRO Mission Blue Nebula (Top Left / Hero Area) */}
        <div className="absolute -top-32 -left-32 h-[750px] w-[750px] rounded-full bg-blue-600/[0.12] blur-[140px]" />

        {/* Aditya-L1 Halo Golden-Solar Glow (Upper Right) */}
        <div className="absolute top-1/4 -right-48 h-[650px] w-[650px] rounded-full bg-amber-500/[0.07] blur-[160px]" />

        {/* Deep Space Indigo-Violet Core (Center / Division showcase) */}
        <div className="absolute top-1/2 left-1/3 h-[900px] w-[900px] -translate-x-1/2 rounded-full bg-indigo-600/[0.08] blur-[180px]" />

        {/* Cyan Downlink Beacon Glow (Bottom Right) */}
        <div className="absolute bottom-10 -right-20 h-[600px] w-[600px] rounded-full bg-cyan-500/[0.09] blur-[150px]" />
      </div>

      {/* 3. Orbital Telemetry Curves & Planetary Horizon Reticle */}
      {showOrbitalRings && (
        <svg
          className="absolute inset-0 h-full w-full opacity-20 [mask-image:radial-gradient(ellipse_at_center,white,transparent_80%)]"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Main Geostationary Orbital Ellipse */}
          <ellipse
            cx="65%"
            cy="40%"
            rx="600"
            ry="240"
            fill="none"
            stroke="url(#orbitGradient)"
            strokeWidth="1.2"
            strokeDasharray="6 8"
            className="animate-spin-slow origin-[65%_40%]"
            style={{ animationDuration: '90s' }}
          />

          {/* Deep Space Trajectory Arc */}
          <ellipse
            cx="25%"
            cy="70%"
            rx="850"
            ry="380"
            fill="none"
            stroke="rgba(96, 165, 250, 0.25)"
            strokeWidth="1"
            strokeDasharray="4 12"
          />

          {/* Precision Flight Grid Vector Crosshairs */}
          <g stroke="rgba(148, 163, 184, 0.2)" strokeWidth="0.8">
            <line x1="10%" y1="20%" x2="10%" y2="24%" />
            <line x1="8%" y1="22%" x2="12%" y2="22%" />

            <line x1="88%" y1="35%" x2="88%" y2="39%" />
            <line x1="86%" y1="37%" x2="90%" y2="37%" />

            <line x1="30%" y1="85%" x2="30%" y2="89%" />
            <line x1="28%" y1="87%" x2="32%" y2="87%" />
          </g>

          <defs>
            <linearGradient id="orbitGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1d72fe" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#60a5fa" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.6" />
            </linearGradient>
          </defs>
        </svg>
      )}

      {/* 4. Procedural Canvas Starfield */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* 5. Aerospace Radar Coordinates Grid Overlay */}
      <div className="graticule absolute inset-0 opacity-[0.14] [mask-image:radial-gradient(ellipse_at_50%_40%,black_30%,transparent_90%)]" />

      {/* 6. Dynamic Vignette & Dimming Shroud for WCAG High Contrast Readability */}
      <div
        className="absolute inset-0 bg-[#04070e] transition-opacity duration-300"
        style={{
          opacity: overlayOpacity / 100,
          backgroundImage:
            'radial-gradient(circle at 50% 30%, transparent 10%, rgba(4, 7, 14, 0.75) 75%, rgba(4, 7, 14, 0.95) 100%)',
        }}
      />
    </div>
  )
}
