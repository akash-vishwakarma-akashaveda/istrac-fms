import { useEffect, useRef, useState } from 'react'
import { Satellite as SatelliteIcon, ShieldCheck } from 'lucide-react'

interface GroundStation {
  id: string
  name: string
  code: string
  lat: number
  lon: number
  status: 'TRACKING' | 'STANDBY' | 'ACQUISITION'
  azimuth: number
  elevation: number
  frequency: string
}

const STATIONS: GroundStation[] = [
  { id: 'blr', name: 'Bengaluru Ground Station', code: 'ISTRAC-BLR', lat: 13.03, lon: 77.51, status: 'TRACKING', azimuth: 142.4, elevation: 48.2, frequency: '2.24 GHz (S-Band)' },
  { id: 'shar', name: 'Sriharikota Range Station', code: 'ISTRAC-SHAR', lat: 13.72, lon: 80.23, status: 'TRACKING', azimuth: 98.1, elevation: 62.7, frequency: '8.45 GHz (X-Band)' },
  { id: 'pbl', name: 'Port Blair Downrange Station', code: 'ISTRAC-PBL', lat: 11.62, lon: 92.72, status: 'ACQUISITION', azimuth: 215.3, elevation: 28.5, frequency: '2.21 GHz (S-Band)' },
  { id: 'mau', name: 'Mauritius Tracking Station', code: 'ISTRAC-MAU', lat: -20.34, lon: 57.55, status: 'STANDBY', azimuth: 310.8, elevation: 12.0, frequency: '2.28 GHz (S-Band)' },
  { id: 'bik', name: 'Biak Station (Indonesia)', code: 'ISTRAC-BIK', lat: -1.18, lon: 136.08, status: 'STANDBY', azimuth: 75.0, elevation: 19.4, frequency: '8.42 GHz (X-Band)' },
]

export function Space3DVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [selectedStation, setSelectedStation] = useState<GroundStation>(STATIONS[0])
  const [autoRotate, setAutoRotate] = useState(true)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const rotationRef = useRef({ yaw: 0.8, pitch: 0.3 })
  const isDraggingRef = useRef(false)
  const lastMouseRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let time = 0

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    const stars = Array.from({ length: 90 }, () => ({
      x: (Math.random() - 0.5) * 600,
      y: (Math.random() - 0.5) * 600,
      z: Math.random() * 400 + 50,
      size: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.7 + 0.3,
    }))

    const render = () => {
      time += 0.015
      if (autoRotate) {
        rotationRef.current.yaw += 0.004
      }

      const width = canvas.clientWidth
      const height = canvas.clientHeight
      const centerX = width / 2
      const centerY = height / 2
      const radius = Math.min(width, height) * 0.32

      ctx.clearRect(0, 0, width, height)

      stars.forEach((star) => {
        const starX = centerX + star.x + mousePos.x * 15
        const starY = centerY + star.y + mousePos.y * 15
        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha * 0.5})`
        ctx.beginPath()
        ctx.arc(starX, starY, star.size, 0, Math.PI * 2)
        ctx.fill()
      })

      const glowGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        radius * 0.6,
        centerX,
        centerY,
        radius * 1.45
      )
      glowGrad.addColorStop(0, 'rgba(37, 99, 235, 0.22)')
      glowGrad.addColorStop(0.5, 'rgba(16, 185, 129, 0.08)')
      glowGrad.addColorStop(1, 'rgba(11, 15, 23, 0)')
      ctx.fillStyle = glowGrad
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius * 1.45, 0, Math.PI * 2)
      ctx.fill()

      const sphereGrad = ctx.createRadialGradient(
        centerX - radius * 0.35,
        centerY - radius * 0.35,
        radius * 0.1,
        centerX,
        centerY,
        radius
      )
      sphereGrad.addColorStop(0, '#131e33')
      sphereGrad.addColorStop(0.7, '#0d1524')
      sphereGrad.addColorStop(1, '#080d17')
      ctx.fillStyle = sphereGrad
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)'
      ctx.lineWidth = 1.2
      ctx.stroke()

      const project3D = (lat: number, lon: number, alt: number = 0) => {
        const radLat = (lat * Math.PI) / 180
        const radLon = (lon * Math.PI) / 180 + rotationRef.current.yaw
        const r = radius * (1 + alt)

        const x3d = r * Math.cos(radLat) * Math.sin(radLon)
        const y3d = -r * Math.sin(radLat)
        const z3d = r * Math.cos(radLat) * Math.cos(radLon)

        const pitch = rotationRef.current.pitch + mousePos.y * 0.2
        const yRot = y3d * Math.cos(pitch) - z3d * Math.sin(pitch)
        const zRot = y3d * Math.sin(pitch) + z3d * Math.cos(pitch)

        return {
          x: centerX + x3d,
          y: centerY + yRot,
          z: zRot,
          visible: zRot > -radius * 0.15,
        }
      }

      ctx.strokeStyle = 'rgba(59, 130, 246, 0.14)'
      ctx.lineWidth = 0.75

      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath()
        let first = true
        for (let lon = 0; lon <= 360; lon += 10) {
          const pt = project3D(lat, lon)
          if (pt.visible) {
            if (first) {
              ctx.moveTo(pt.x, pt.y)
              first = false
            } else {
              ctx.lineTo(pt.x, pt.y)
            }
          } else {
            first = true
          }
        }
        ctx.stroke()
      }

      for (let lon = 0; lon < 360; lon += 45) {
        ctx.beginPath()
        let first = true
        for (let lat = -80; lat <= 80; lat += 10) {
          const pt = project3D(lat, lon)
          if (pt.visible) {
            if (first) {
              ctx.moveTo(pt.x, pt.y)
              first = false
            } else {
              ctx.lineTo(pt.x, pt.y)
            }
          } else {
            first = true
          }
        }
        ctx.stroke()
      }

      ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)'
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      for (let i = 0; i <= 360; i += 5) {
        const orbitAngle = (i * Math.PI) / 180
        const orbitRadius = radius * 1.28
        const ox = orbitRadius * Math.sin(orbitAngle)
        const oy = -orbitRadius * Math.cos(orbitAngle) * Math.cos(0.9)
        const oz = orbitRadius * Math.cos(orbitAngle) * Math.sin(0.9)

        const pitch = rotationRef.current.pitch + mousePos.y * 0.2
        const yRot = oy * Math.cos(pitch) - oz * Math.sin(pitch)

        const px = centerX + ox
        const py = centerY + yRot
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
      ctx.setLineDash([])

      ctx.strokeStyle = 'rgba(59, 130, 246, 0.35)'
      ctx.beginPath()
      for (let i = 0; i <= 360; i += 5) {
        const orbitAngle = (i * Math.PI) / 180
        const orbitRadius = radius * 1.52
        const ox = orbitRadius * Math.cos(orbitAngle)
        const oy = orbitRadius * Math.sin(orbitAngle) * Math.sin(0.45)
        const oz = orbitRadius * Math.sin(orbitAngle) * Math.cos(0.45)

        const pitch = rotationRef.current.pitch + mousePos.y * 0.2
        const yRot = oy * Math.cos(pitch) - oz * Math.sin(pitch)

        const px = centerX + ox
        const py = centerY + yRot
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()

      const satAngle1 = time * 0.8
      const satRadius1 = radius * 1.28
      const sx1 = satRadius1 * Math.sin(satAngle1)
      const sy1 = -satRadius1 * Math.cos(satAngle1) * Math.cos(0.9)
      const sz1 = satRadius1 * Math.cos(satAngle1) * Math.sin(0.9)
      const pitch1 = rotationRef.current.pitch + mousePos.y * 0.2
      const satY1 = centerY + (sy1 * Math.cos(pitch1) - sz1 * Math.sin(pitch1))
      const satX1 = centerX + sx1

      ctx.fillStyle = '#10b981'
      ctx.beginPath()
      ctx.arc(satX1, satY1, 4.5, 0, Math.PI * 2)
      ctx.fill()

      const pulseSize = (Math.sin(time * 6) + 1) * 6 + 4
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)'
      ctx.beginPath()
      ctx.arc(satX1, satY1, pulseSize, 0, Math.PI * 2)
      ctx.stroke()

      ctx.fillStyle = '#94a3b8'
      ctx.font = '10px monospace'
      ctx.fillText('ISRO-SAT [AOS]', satX1 + 8, satY1 - 6)

      STATIONS.forEach((st) => {
        const pt = project3D(st.lat, st.lon, 0.02)
        if (!pt.visible) return

        const isSelected = selectedStation.id === st.id

        if (st.status === 'TRACKING') {
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(pt.x, pt.y)
          ctx.lineTo(satX1, satY1)
          ctx.stroke()
        }

        ctx.fillStyle = isSelected ? '#38bdf8' : st.status === 'TRACKING' ? '#10b981' : '#f59e0b'
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, isSelected ? 5.5 : 3.5, 0, Math.PI * 2)
        ctx.fill()

        if (isSelected) {
          ctx.strokeStyle = '#38bdf8'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, 9, 0, Math.PI * 2)
          ctx.stroke()
        }

        ctx.fillStyle = isSelected ? '#38bdf8' : '#cbd5e1'
        ctx.font = '9px monospace'
        ctx.fillText(st.code, pt.x + 8, pt.y + 3)
      })

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [autoRotate, mousePos, selectedStation])

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true
    lastMouseRef.current = { x: e.clientX, y: e.clientY }
    setAutoRotate(false)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width - 0.5
    const ny = (e.clientY - rect.top) / rect.height - 0.5
    setMousePos({ x: nx, y: ny })

    if (!isDraggingRef.current) return
    const dx = e.clientX - lastMouseRef.current.x
    const dy = e.clientY - lastMouseRef.current.y
    rotationRef.current.yaw += dx * 0.008
    rotationRef.current.pitch = Math.max(-0.8, Math.min(0.8, rotationRef.current.pitch + dy * 0.008))
    lastMouseRef.current = { x: e.clientX, y: e.clientY }
  }

  const handleMouseUp = () => {
    isDraggingRef.current = false
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-card/80 p-5 shadow-2xl backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent-light">
            <SatelliteIcon size={16} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              Global Ground Station Network
            </h3>
            <p className="num text-[10px] text-text-dim">Telemetry Orbit & Station Tracker</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoRotate((prev) => !prev)}
            className={`rounded px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase transition-colors ${
              autoRotate
                ? 'bg-accent/20 text-accent-light border border-accent/40'
                : 'bg-surface text-text-dim hover:text-text-primary'
            }`}
          >
            {autoRotate ? 'Auto-Rotate ON' : 'Rotate Paused'}
          </button>
        </div>
      </div>

      <div
        className="relative my-3 h-[320px] w-full cursor-grab active:cursor-grabbing sm:h-[360px]"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas ref={canvasRef} className="h-full w-full" />

        <div className="pointer-events-none absolute top-3 left-3 rounded-lg border border-border-subtle bg-surface/90 px-3 py-2 text-[11px] backdrop-blur-sm">
          <div className="flex items-center gap-1.5 text-nominal">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-nominal" />
            <span className="font-semibold uppercase tracking-wider">AOS TELEMETRY LOCK</span>
          </div>
          <div className="num mt-1 text-[10px] text-text-dim">
            DOWNLINK: 240 Mbps · SHA-256 VERIFIED
          </div>
        </div>

        <div className="pointer-events-none absolute right-3 bottom-3 text-[10px] text-text-dim">
          Drag to rotate view
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-5">
        {STATIONS.map((st) => {
          const isSelected = selectedStation.id === st.id
          return (
            <button
              key={st.id}
              type="button"
              onClick={() => setSelectedStation(st)}
              className={`flex flex-col rounded-lg border p-2 text-left transition-all ${
                isSelected
                  ? 'border-accent bg-accent/10 shadow-sm shadow-accent/20'
                  : 'border-border-subtle bg-surface/50 hover:bg-card-hover'
              }`}
            >
              <span className="num text-[10px] font-bold text-text-primary">{st.code}</span>
              <span className="truncate text-[9px] text-text-dim">{st.name.split(' ')[0]}</span>
              <span
                className={`num mt-1 text-[8px] font-semibold uppercase ${
                  st.status === 'TRACKING'
                    ? 'text-nominal'
                    : st.status === 'ACQUISITION'
                    ? 'text-accent-light'
                    : 'text-warning'
                }`}
              >
                ● {st.status}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-border-subtle bg-surface/60 p-3 sm:grid-cols-4">
        <div>
          <span className="eyebrow block text-[9px] text-text-dim">Station Coordinates</span>
          <span className="num mt-0.5 block text-xs text-text-primary">
            {selectedStation.lat.toFixed(2)}°N {selectedStation.lon.toFixed(2)}°E
          </span>
        </div>

        <div>
          <span className="eyebrow block text-[9px] text-text-dim">Antenna Angles</span>
          <span className="num mt-0.5 block text-xs text-text-primary">
            AZ: {selectedStation.azimuth}° · EL: {selectedStation.elevation}°
          </span>
        </div>

        <div>
          <span className="eyebrow block text-[9px] text-text-dim">RF Carrier</span>
          <span className="num mt-0.5 block text-xs text-text-secondary">
            {selectedStation.frequency}
          </span>
        </div>

        <div>
          <span className="eyebrow block text-[9px] text-text-dim">Data Ingestion</span>
          <span className="num mt-0.5 flex items-center gap-1 text-xs text-nominal">
            <ShieldCheck size={12} /> Military RBAC
          </span>
        </div>
      </div>
    </div>
  )
}
