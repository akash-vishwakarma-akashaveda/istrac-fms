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

  return (
    <div className="border-b border-border-subtle bg-[#060b17] py-6 relative overflow-hidden">
      <div className="shell">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-border-subtle/60">
          {/* Stat 1 */}
          <div className="flex items-center gap-3.5 pt-4 sm:pt-0 sm:px-4 first:pl-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 border border-accent/30 text-accent-light">
              <Icon1 size={20} />
            </div>
            <div>
              <span className="num text-xl sm:text-2xl font-black text-white block leading-tight">
                {stat1Val}
              </span>
              <span className="text-[11px] text-text-dim block uppercase font-bold tracking-wider">
                {stats?.stat1Label || 'Global Ground Network'}
              </span>
            </div>
          </div>

          {/* Stat 2 */}
          <div className="flex items-center gap-3.5 pt-4 sm:pt-0 sm:px-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-nominal/15 border border-nominal/30 text-nominal">
              <Icon2 size={20} className={stats?.stat2Icon ? undefined : 'animate-pulse'} />
            </div>
            <div>
              <span className="num text-xl sm:text-2xl font-black text-white block leading-tight">
                {stat2Val}
              </span>
              <span className="text-[11px] text-text-dim block uppercase font-bold tracking-wider">
                {stats?.stat2Label || 'Deep Space & LEO'}
              </span>
            </div>
          </div>

          {/* Stat 3 */}
          <div className="flex items-center gap-3.5 pt-4 sm:pt-0 sm:px-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
              <Icon3 size={20} />
            </div>
            <div>
              <span className="num text-xl sm:text-2xl font-black text-white block leading-tight">
                {stat3Val}
              </span>
              <span className="text-[11px] text-text-dim block uppercase font-bold tracking-wider">
                {stats?.stat3Label || 'Continuous Telemetry'}
              </span>
            </div>
          </div>

          {/* Stat 4 */}
          <div className="flex items-center gap-3.5 pt-4 sm:pt-0 sm:px-4 last:pr-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-yellow-500/15 border border-yellow-500/30 text-yellow-400">
              <Icon4 size={20} />
            </div>
            <div>
              <span className="num text-xl sm:text-2xl font-black text-white block leading-tight">
                {stat4Val}
              </span>
              <span className="text-[11px] text-text-dim block uppercase font-bold tracking-wider">
                {stats?.stat4Label || 'Cryptographic Integrity'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
