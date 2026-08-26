import { Radio, ShieldCheck, Globe, Activity } from 'lucide-react'

export function QuickStatsBanner() {
  return (
    <div className="border-b border-border-subtle bg-[#060b17] py-6 relative overflow-hidden">
      <div className="shell">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-border-subtle/60">
          {/* Stat 1: Ground Stations */}
          <div className="flex items-center gap-3.5 pt-4 sm:pt-0 sm:px-4 first:pl-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 border border-accent/30 text-accent-light">
              <Globe size={20} />
            </div>
            <div>
              <span className="num text-xl sm:text-2xl font-black text-white block leading-tight">
                5 Stations
              </span>
              <span className="text-[11px] text-text-dim block uppercase font-bold tracking-wider">
                Global Ground Network
              </span>
            </div>
          </div>

          {/* Stat 2: Active Spacecraft */}
          <div className="flex items-center gap-3.5 pt-4 sm:pt-0 sm:px-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-nominal/15 border border-nominal/30 text-nominal">
              <Radio size={20} className="animate-pulse" />
            </div>
            <div>
              <span className="num text-xl sm:text-2xl font-black text-white block leading-tight">
                10+ Missions
              </span>
              <span className="text-[11px] text-text-dim block uppercase font-bold tracking-wider">
                Deep Space & LEO
              </span>
            </div>
          </div>

          {/* Stat 3: 24/7 Telemetry */}
          <div className="flex items-center gap-3.5 pt-4 sm:pt-0 sm:px-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
              <Activity size={20} />
            </div>
            <div>
              <span className="num text-xl sm:text-2xl font-black text-white block leading-tight">
                24/7 MOX Ops
              </span>
              <span className="text-[11px] text-text-dim block uppercase font-bold tracking-wider">
                Continuous Telemetry
              </span>
            </div>
          </div>

          {/* Stat 4: Security & Integrity */}
          <div className="flex items-center gap-3.5 pt-4 sm:pt-0 sm:px-4 last:pr-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-yellow-500/15 border border-yellow-500/30 text-yellow-400">
              <ShieldCheck size={20} />
            </div>
            <div>
              <span className="num text-xl sm:text-2xl font-black text-white block leading-tight">
                SHA-256
              </span>
              <span className="text-[11px] text-text-dim block uppercase font-bold tracking-wider">
                Cryptographic Integrity
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
