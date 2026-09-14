import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react'
import { useToastStore, type ToastVariant } from '../store/toastStore'

interface ToastProps {
  id: string
  message: string
  title?: string
  variant: ToastVariant
  duration: number
  isPaused: boolean
}

const variantConfig: Record<
  ToastVariant,
  {
    icon: typeof CheckCircle2
    titleDefault: string
    badgeBg: string
    iconColor: string
    borderColor: string
    glowShadow: string
    barGradient: string
    accentStrip: string
  }
> = {
  success: {
    icon: CheckCircle2,
    titleDefault: 'Operation Successful',
    badgeBg: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-emerald-500/20',
    iconColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/70',
    glowShadow: 'shadow-[0_16px_40px_-8px_rgba(16,185,129,0.4),0_10px_20px_-6px_rgba(0,0,0,0.9)]',
    barGradient: 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300',
    accentStrip: 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]',
  },
  info: {
    icon: Info,
    titleDefault: 'Operations Notice',
    badgeBg: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 shadow-cyan-500/20',
    iconColor: 'text-cyan-400',
    borderColor: 'border-cyan-500/70',
    glowShadow: 'shadow-[0_16px_40px_-8px_rgba(6,182,212,0.4),0_10px_20px_-6px_rgba(0,0,0,0.9)]',
    barGradient: 'bg-gradient-to-r from-cyan-500 via-sky-400 to-blue-400',
    accentStrip: 'bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.8)]',
  },
  warning: {
    icon: AlertTriangle,
    titleDefault: 'Priority Advisory',
    badgeBg: 'bg-amber-500/20 text-amber-400 border border-amber-500/50 shadow-amber-500/20',
    iconColor: 'text-amber-400',
    borderColor: 'border-amber-500/70',
    glowShadow: 'shadow-[0_16px_40px_-8px_rgba(245,158,11,0.4),0_10px_20px_-6px_rgba(0,0,0,0.9)]',
    barGradient: 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300',
    accentStrip: 'bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.8)]',
  },
  error: {
    icon: XCircle,
    titleDefault: 'Critical Anomaly',
    badgeBg: 'bg-rose-500/25 text-rose-400 border border-rose-500/60 shadow-rose-500/30',
    iconColor: 'text-rose-400',
    borderColor: 'border-rose-500/80',
    glowShadow: 'shadow-[0_16px_45px_-8px_rgba(244,63,94,0.5),0_10px_20px_-6px_rgba(0,0,0,0.9)]',
    barGradient: 'bg-gradient-to-r from-rose-600 via-red-500 to-rose-400',
    accentStrip: 'bg-rose-500 shadow-[0_0_14px_rgba(244,63,94,0.9)]',
  },
}

export function Toast({ id, message, title, variant, duration, isPaused }: ToastProps) {
  const removeToast = useToastStore((s) => s.removeToast)
  const pauseToast = useToastStore((s) => s.pauseToast)
  const resumeToast = useToastStore((s) => s.resumeToast)
  const [progress, setProgress] = useState(100)
  const startRef = useRef(Date.now())
  const rafRef = useRef<number>(0)

  const {
    icon: Icon,
    titleDefault,
    badgeBg,
    iconColor,
    borderColor,
    glowShadow,
    barGradient,
    accentStrip,
  } = variantConfig[variant] || variantConfig.info

  useEffect(() => {
    if (isPaused) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }

    startRef.current = Date.now()
    function tick() {
      const elapsed = Date.now() - startRef.current
      const pct = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(pct)
      if (pct <= 0) {
        removeToast(id)
      } else {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isPaused, duration, id, removeToast])

  return (
    <div
      role="status"
      onMouseEnter={() => pauseToast(id)}
      onMouseLeave={() => resumeToast(id)}
      className={`animate-rise pointer-events-auto relative w-full sm:w-[410px] overflow-hidden rounded-xl border-2 ${borderColor} bg-[#0b1325]/95 backdrop-blur-2xl ${glowShadow} transition-all duration-150`}
    >
      {/* Left vivid indicator strip */}
      <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${accentStrip}`} />

      <div className="flex items-start gap-3 p-3.5 pl-4.5">
        {/* Illuminated Status Icon Pill */}
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${badgeBg} shadow-sm mt-0.5`}>
          <Icon size={18} strokeWidth={2.2} className={iconColor} />
        </div>

        {/* Text Details */}
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-xs font-bold uppercase tracking-wider text-white">
            {title || titleDefault}
          </p>
          <p className="text-xs leading-relaxed text-slate-100 font-medium break-words">
            {message}
          </p>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={() => removeToast(id)}
          aria-label="Dismiss"
          className="-m-1 shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      {/* Active Glowing Timer Bar */}
      <div className="h-[2.5px] w-full bg-white/10 overflow-hidden">
        <div
          className={`h-full ${barGradient} transition-all shadow-sm`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
