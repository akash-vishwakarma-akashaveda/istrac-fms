import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Radio,
  Sparkles,
  ArrowRight,
  Layers,
} from 'lucide-react'
import { departmentsApi, type Department } from '../api/departments.api'

const DEFAULT_DIVISIONS = [
  {
    id: 'mox',
    name: 'Mission Operations Complex',
    code: 'MOX',
    description: 'Central nerve center managing real-time spacecraft command uplink, continuous health telemetry monitoring, and multi-mission console coordination.',
    leadOfficer: 'Director, MOX',
    leadRole: 'Head of Mission Operations',
    fileCount: 4,
  },
  {
    id: 'fdd',
    name: 'Flight Dynamics Division',
    code: 'FDD',
    description: 'Precision spacecraft trajectory design, halo/lunar orbit determination, stationkeeping maneuvers, and attitude dynamics calculations.',
    leadOfficer: 'Head, Flight Dynamics',
    leadRole: 'Lead Astrodynamics Specialist',
    fileCount: 3,
  },
  {
    id: 'netra',
    name: 'Network for Space Objects Tracking and Analysis',
    code: 'NETRA',
    description: 'Space Situational Awareness (SSA), low Earth orbit conjunction assessment, collision avoidance maneuver planning, and space debris tracking.',
    leadOfficer: 'Project Director, IS4OM',
    leadRole: 'Space Situational Awareness Lead',
    fileCount: 2,
  },
  {
    id: 'ttc',
    name: 'Telemetry, Tracking & Command Ground Stations',
    code: 'TTC',
    description: 'Global ground antenna network providing high-rate S/X-Band telemetry downlinks, Doppler range measurements, and baseband signal demodulation.',
    leadOfficer: 'General Manager, Ground Network',
    leadRole: 'Lead RF Engineer',
    fileCount: 2,
  },
  {
    id: 'gso',
    name: 'Ground Support & Launch Vehicle Operations',
    code: 'GSO',
    description: 'Downrange mobile and fixed station telemetry tracking for PSLV/GSLV launches, stage separation telemetry, and orbital injection verification.',
    leadOfficer: 'Head, Launch Support',
    leadRole: 'Operations Controller',
    fileCount: 2,
  },
]

export function OperationalDivisions() {
  const [departments, setDepartments] = useState<Department[]>([])

  useEffect(() => {
    departmentsApi
      .getPublicDepartments()
      .then((data) => {
        if (data && data.length > 0) {
          setDepartments(data)
        }
      })
      .catch(() => {})
  }, [])

  const displayDepts = departments.length > 0 ? departments : (DEFAULT_DIVISIONS as unknown as Department[])

  return (
    <section id="departments-showcase" className="border-b border-border-subtle bg-page-soft py-16 sm:py-20" aria-labelledby="divisions-title">
      <div className="shell space-y-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-border-subtle/70 pb-6">
          <div className="space-y-2 max-w-2xl">
            <p className="eyebrow flex items-center gap-2 text-accent-light">
              <Sparkles size={13} />
              <span>ISRO ISTRAC COMMAND SECTORS</span>
            </p>
            <h2 id="divisions-title" className="display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white">
              Operational Divisions & Facilities
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              Specialized engineering directorates processing satellite downlinks, mission trajectory maneuvers, space situational awareness, and global antenna telemetry.
            </p>
          </div>

          <Link
            to="/departments"
            className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-card px-4 py-2.5 text-xs font-bold text-accent-light hover:border-accent hover:text-white transition-all shadow-sm shrink-0 group"
          >
            <Layers size={14} className="group-hover:scale-110 transition-transform" />
            <span>Explore All Divisions ({displayDepts.length})</span>
            <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Grid of 5 Key Divisions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayDepts.map((dept) => (
            <div
              key={dept.id}
              className="rounded-2xl border border-border-default bg-[#0b1220]/90 p-6 shadow-xl backdrop-blur-sm hover:border-accent/50 transition-all flex flex-col justify-between space-y-4 group hover:shadow-2xl hover:shadow-accent/10"
            >
              <div className="space-y-3.5">
                {/* Header Badge Row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 border border-accent/30 text-accent-light group-hover:scale-105 transition-transform">
                      <Radio size={18} />
                    </div>
                    <span className="num rounded-md bg-surface border border-border-subtle px-2 py-0.5 text-xs font-bold text-accent-light">
                      /{dept.code || 'DIV'}
                    </span>
                  </div>

                  <span className="num text-[11px] font-bold text-text-dim rounded-full bg-surface px-2.5 py-0.5 border border-border-subtle">
                    {dept.fileCount ?? 2} Active Files
                  </span>
                </div>

                {/* Division Title */}
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-accent-light transition-colors line-clamp-1">
                    {dept.name}
                  </h3>
                  <p className="text-xs text-text-secondary mt-1 line-clamp-3 leading-relaxed">
                    {dept.description || 'Ground telemetry downlink processing, orbit determination, and operational monitoring.'}
                  </p>
                </div>
              </div>

              {/* Footer Officer & Direct Link */}
              <div className="pt-3.5 border-t border-border-subtle/80 flex items-center justify-between text-xs">
                <div className="min-w-0 pr-2">
                  <span className="text-[10px] text-text-dim uppercase font-bold block">Officer in Charge</span>
                  <span className="text-xs font-bold text-text-primary truncate block">
                    {dept.pageLeadOfficer || (dept as any).leadOfficer || 'Division Director'}
                  </span>
                </div>

                <Link
                  to={`/departments/${dept.id}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-accent-light hover:text-white group-hover:underline shrink-0"
                >
                  <span>View Details</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
