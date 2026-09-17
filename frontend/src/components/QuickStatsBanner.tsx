import { useState, useEffect } from 'react'
import { Radio, ShieldCheck, Globe, Activity, CheckCircle2, Check, Satellite, Database, Clock, Lock } from 'lucide-react'
import { useCms } from '../context/cmsContext'
import { apiClient } from '../api/client'

interface QuickStatsBlock {
  stat1Value?: string
  stat1Label?: string
  stat1Icon?: string
  stat2Value?: string
  stat2Label?: string
  stat2Icon?: string
  stat3Value?: string
  stat3Label?: string
  stat3Icon?: string
  stat4Value?: string
  stat4Label?: string
  stat4Icon?: string
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  globe: Globe,
  radio: Radio,
  activity: Activity,
  shield: ShieldCheck,
  check: CheckCircle2,
  tick: Check,
  satellite: Satellite,
  database: Database,
  clock: Clock,
  lock: Lock,
}

function getStatIcon(iconName: string | undefined, fallback: React.ComponentType<{ size?: number; className?: string }>) {
  if (iconName && ICON_MAP[iconName.toLowerCase()]) {
    return ICON_MAP[iconName.toLowerCase()]
  }
  return fallback
}

/**
 * Automatically minimizes font size based on character count so that
 * metric values (titles) never wrap into multiple lines or get truncated with dots,
 * and card size remains perfectly consistent.
 */
function getMetricTextSize(value: string): string {
  const len = value.trim().length
  if (len > 18) {
    return 'text-sm sm:text-base font-extrabold tracking-tight'
  }
  if (len > 12) {
    return 'text-base sm:text-lg lg:text-xl font-black tracking-tight'
  }
  return 'text-lg sm:text-xl lg:text-2xl font-black'
}

/**
 * Automatically scales description label font size and line height so it cleanly
 * fits up to 2 lines without dots while keeping card height strictly fixed.
 */
function getDescriptionClass(label: string): string {
  const len = label.trim().length
  if (len > 35) {
    return 'text-[9.5px] sm:text-[10px] leading-[13px] tracking-normal sm:tracking-wide font-semibold'
  }
  return 'text-[10.5px] sm:text-[11px] leading-[14px] sm:leading-[15px] tracking-wider font-bold'
}

export function QuickStatsBanner() {
  const { cmsBlocks } = useCms()
  const stats = cmsBlocks['quick_stats'] as QuickStatsBlock | undefined

  const [dbStats, setDbStats] = useState<{
    satellitesCount: number
    departmentsCount: number
    filesCount: number
    passesCount: number
    stationsCount: number
  } | null>(null)

  useEffect(() => {
    apiClient
      .get('/public/stats')
      .then((res) => {
        if (res.data?.data) {
          setDbStats(res.data.data)
        }
      })
      .catch(() => {})
  }, [])

  const stat1Val = stats?.stat1Value || `${dbStats?.stationsCount ?? 5} Stations`
  const stat2Val = stats?.stat2Value || `${dbStats?.satellitesCount ? `${dbStats.satellitesCount}+ Missions` : '10+ Missions'}`
  const stat3Val = stats?.stat3Value || `${dbStats?.departmentsCount ? `${dbStats.departmentsCount} Operational Divisions` : '24/7 MOX Ops'}`
  const stat4Val = stats?.stat4Value || `${dbStats?.filesCount ? `${dbStats.filesCount}+ Telemetry Files` : 'SHA-256'}`

  const Icon1 = getStatIcon(stats?.stat1Icon, Globe)
  const Icon2 = getStatIcon(stats?.stat2Icon, Radio)
  const Icon3 = getStatIcon(stats?.stat3Icon, Activity)
  const Icon4 = getStatIcon(stats?.stat4Icon, ShieldCheck)

  const cards = [
    {
      id: 'stat1',
      val: stat1Val,
      label: stats?.stat1Label || 'Global Ground Network',
      Icon: Icon1,
      hoverBorder: 'hover:border-accent/40',
      iconBox: 'bg-accent/15 border-accent/30 text-accent-light',
      iconClass: undefined,
    },
    {
      id: 'stat2',
      val: stat2Val,
      label: stats?.stat2Label || 'Deep Space & LEO',
      Icon: Icon2,
      hoverBorder: 'hover:border-nominal/40',
      iconBox: 'bg-nominal/15 border-nominal/30 text-nominal',
      iconClass: stats?.stat2Icon ? undefined : 'animate-pulse',
    },
    {
      id: 'stat3',
      val: stat3Val,
      label: stats?.stat3Label || 'Continuous Telemetry',
      Icon: Icon3,
      hoverBorder: 'hover:border-purple-500/40',
      iconBox: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
      iconClass: undefined,
    },
    {
      id: 'stat4',
      val: stat4Val,
      label: stats?.stat4Label || 'Cryptographic Integrity',
      Icon: Icon4,
      hoverBorder: 'hover:border-yellow-500/40',
      iconBox: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400',
      iconClass: undefined,
    },
  ]

  return (
    <div className="border-b border-border-subtle/80 bg-[#060b17]/70 py-6 relative overflow-hidden">
      <div className="shell">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 lg:gap-5">
          {cards.map((card) => (
            <div
              key={card.id}
              className={`h-[88px] sm:h-[92px] w-full flex items-center gap-3.5 rounded-xl border border-border-subtle/40 bg-[#070e1c]/50 p-3 sm:p-3.5 ${card.hoverBorder} transition-colors overflow-hidden`}
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${card.iconBox}`}
              >
                <card.Icon size={20} className={card.iconClass} />
              </div>
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <span
                  className={`num text-white block leading-tight break-words ${getMetricTextSize(card.val)}`}
                >
                  {card.val}
                </span>
                <span
                  className={`block uppercase text-text-dim line-clamp-2 break-words mt-0.5 ${getDescriptionClass(card.label)}`}
                >
                  {card.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
