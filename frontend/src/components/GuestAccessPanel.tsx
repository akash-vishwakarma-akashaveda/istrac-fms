import { LockKeyhole, Layers, ArrowRight, ShieldCheck, Radio, Check, UserCheck, LogIn } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCms } from '../context/cmsContext'
import { Button } from '.'

export function GuestAccessPanel() {
  const user = useAuthStore((s) => s.user)
  const { cmsBlocks } = useCms()
  const accessData = cmsBlocks['access_panel'] as
    | {
        facilitiesTitle?: string
        facilitiesDesc?: string
        reportsTitle?: string
        reportsDesc?: string
      }
    | undefined

  const STATIONS = [
    { code: 'BLR', name: 'Bengaluru (MOX-1/2)', status: 'ACTIVE' },
    { code: 'SHAR', name: 'Sriharikota (SDSC)', status: 'ACTIVE' },
    { code: 'PBL', name: 'Port Blair Downrange', status: 'ACTIVE' },
    { code: 'MAU', name: 'Mauritius Station', status: 'ACTIVE' },
    { code: 'BIK', name: 'Biak (Indonesia)', status: 'ACTIVE' },
    { code: 'IDSN', name: 'Byalalu Deep Space', status: 'ACTIVE' },
  ]

  const BENEFITS = [
    'Department-segregated file archives (Multi-RBAC)',
    'Real-time orbital telemetry & anomaly reports',
    'Tamper-evident cryptographically signed audit logs',
  ]

  return (
    <section className="relative border-b border-border-subtle bg-page py-12" aria-label="Facility scoping and portal access">
      <div className="shell grid gap-8 lg:grid-cols-12 lg:items-stretch">
        {/* Left Column: Multi-Facility Scoping Card (6 cols) */}
        <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-border-default bg-card p-6 shadow-2xl transition-all duration-300 hover:border-accent/40 lg:col-span-6">
          <div>
            <div className="flex items-center justify-between border-b border-border-subtle pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent-light border border-accent/30">
                  <Layers size={18} strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">
                    {accessData?.facilitiesTitle || 'Multi-Facility Ground Network'}
                  </h3>
                  <p className="num text-[11px] text-text-dim">Synchronized Station Telemetry</p>
                </div>
              </div>

              <span className="num text-[10px] text-nominal font-bold tracking-wider">
                ● 6 NODES ONLINE
              </span>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-text-secondary">
              {accessData?.facilitiesDesc ||
                'ISTRAC telemetry feeds and command uplinks are distributed across primary centres and international downrange tracking stations.'}
            </p>

            {/* Ground Stations Grid */}
            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {STATIONS.map((st) => (
                <div
                  key={st.code}
                  className="rounded-lg border border-border-subtle bg-surface p-2.5 transition-colors hover:bg-surface/80"
                >
                  <div className="flex items-center justify-between">
                    <span className="num text-[11px] font-bold text-text-primary">{st.code}</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-nominal" />
                  </div>
                  <span className="mt-1 block truncate text-[10px] text-text-muted">{st.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-border-subtle pt-4">
            <div className="flex items-center gap-1.5 text-[11px] text-text-dim">
              <Radio size={13} className="text-accent-light" />
              <span>Carrier: 2.2 GHz S-Band / 8.4 GHz X-Band</span>
            </div>

            <a
              href="#gallery"
              className="group inline-flex items-center gap-1 text-xs font-semibold text-accent-light hover:text-text-primary"
            >
              <span>View Stations</span>
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>

        {/* Right Column: Restricted Reports & Authentication Gate (6 cols) */}
        <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-border-default bg-card shadow-2xl transition-all duration-300 hover:border-accent/40 lg:col-span-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border-subtle bg-surface px-6 py-3.5">
            <div className="flex items-center gap-2">
              <LockKeyhole size={15} className={user ? 'text-nominal' : 'text-warning'} strokeWidth={2} />
              <span className={`eyebrow font-bold ${user ? 'text-nominal' : 'text-warning'}`}>
                {user ? 'Authenticated Session' : 'Restricted Intranet Access'}
              </span>
            </div>

            <span className="num text-[10px] font-semibold text-text-dim uppercase tracking-wider">
              {user ? `ROLE: ${user.role}` : 'AUTH REQUIRED'}
            </span>
          </div>

          {/* Body */}
          <div className="p-6">
            <h3 className="text-base font-bold text-text-primary">
              {user
                ? `Welcome back, ${user.name}`
                : accessData?.reportsTitle || 'Department Repositories & Flight Reports'}
            </h3>

            <p className="mt-2 text-xs leading-relaxed text-text-secondary">
              {user
                ? 'Your account has active authorization for telemetry file ingestion, mission dataset retrieval, and audit inspection.'
                : accessData?.reportsDesc ||
                  'Log in with your ISTRAC credentials to access department-segregated mission logs, orbit ephemeris, and telemetry data files.'}
            </p>

            {/* Checklist */}
            <ul className="mt-4 space-y-2 border-t border-border-subtle pt-4">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-center gap-2.5 text-xs text-text-secondary">
                  <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-nominal/15 text-nominal">
                    <Check size={10} strokeWidth={3} />
                  </div>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>

            {/* Actions */}
            <div className="mt-6">
              {user ? (
                <Link to="/dashboard">
                  <Button variant="primary" size="md" className="w-full shadow-lg shadow-accent/25">
                    <UserCheck size={16} strokeWidth={2} />
                    <span>Go To Dashboard</span>
                  </Button>
                </Link>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link to="/login" className="flex-1">
                    <Button variant="primary" size="md" className="w-full shadow-lg shadow-accent/25">
                      <LogIn size={15} strokeWidth={2.2} />
                      <span>Log In</span>
                    </Button>
                  </Link>

                  <Link to="/register" className="flex-1">
                    <Button variant="outline" size="md" className="w-full">
                      Request Access
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Footer Note */}
          <div className="flex items-center justify-between border-t border-border-subtle bg-surface/50 px-6 py-2.5 text-[11px] text-text-dim">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-nominal" /> ISRO Air-Gapped Network
            </span>
            <span className="num">SIMS-SEC 2.4</span>
          </div>
        </div>
      </div>
    </section>
  )
}
