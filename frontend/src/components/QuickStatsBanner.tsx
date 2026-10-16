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
    return 'text-[15px] sm:text-base'
  }
  return 'text-[17px]'
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
    },
    {
      id: 'stat2',
      val: stat2Val,
      label: stats?.stat2Label || 'Deep Space & LEO',
      Icon: Icon2,
    },
    {
      id: 'stat3',
      val: stat3Val,
      label: stats?.stat3Label || 'Continuous Telemetry',
      Icon: Icon3,
    },
    {
      id: 'stat4',
      val: stat4Val,
      label: stats?.stat4Label || 'Cryptographic Integrity',
      Icon: Icon4,
    },
  ]

  return (
    <div className="relative z-10 -mt-14">
      <div className="shell">
        <ul className="grid grid-cols-2 overflow-hidden rounded-2xl border border-border-subtle bg-card shadow-[0_12px_32px_-12px_rgba(24,24,27,0.18)] lg:grid-cols-4">
          {cards.map((card, i) => (
            <li
              key={card.id}
              className={[
                'flex flex-col items-start gap-3 border-border-subtle p-4 sm:flex-row sm:items-center sm:gap-3.5 sm:p-6',
                i >= 2 ? 'border-t' : '', // 2 columns: rule above the second row
                i % 2 === 1 ? 'border-l' : '',
                'lg:border-t-0', // 4 columns: vertical rules only
                i > 0 ? 'lg:border-l' : 'lg:border-l-0',
              ].join(' ')}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-blue-soft text-accent-light" aria-hidden="true">
                <card.Icon size={20} />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className={`block leading-tight font-bold text-text-primary break-words ${getMetricTextSize(card.val)}`}>{card.val}</span>
                <span className="block text-sm text-text-muted line-clamp-2 break-words">{card.label}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
