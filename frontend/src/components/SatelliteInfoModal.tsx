import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Radio,
  Calendar,
  Layers,
  Fuel,
  Weight,
  Compass,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import { Modal, Button } from '.'
import { satellitesApi, type Satellite } from '../api/satellites.api'

interface SatelliteInfoModalProps {
  isOpen: boolean
  onClose: () => void
  satellite?: Satellite | null
  satelliteId?: string | null
}

export function SatelliteInfoModal({
  isOpen,
  onClose,
  satellite: initialSatellite,
  satelliteId,
}: SatelliteInfoModalProps) {
  const [satellite, setSatellite] = useState<Satellite | null>(initialSatellite || null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    if (initialSatellite) {
      setSatellite(initialSatellite)
    }

    const idToFetch = satelliteId || initialSatellite?.id
    if (idToFetch) {
      setLoading(!initialSatellite)
      satellitesApi
        .getPublicSatellite(idToFetch)
        .then((data) => {
          setSatellite(data)
        })
        .catch((err) => {
          console.error('Failed to load satellite details:', err)
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [isOpen, initialSatellite, satelliteId])

  if (!isOpen) return null

  const payloadList = satellite?.payloads
    ? satellite.payloads
        .split(/[,;\n]+/)
        .map((p) => p.trim())
        .filter(Boolean)
    : []

  const isDecommissioned =
    satellite?.status?.toUpperCase() === 'DECOMMISSIONED' || !satellite?.isActive

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="ISRO Spacecraft & Telemetry Dossier"
    >
      {loading || !satellite ? (
        <div className="py-16 text-center space-y-3">
          <Radio size={32} className="mx-auto text-accent-light animate-pulse" />
          <p className="num text-xs text-text-muted">Ingesting satellite telemetry data…</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 p-4 rounded-xl border border-border-default bg-[#070d1a]">
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/20 border border-accent/35 text-accent-light">
                <Radio size={24} />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    {satellite.name}
                  </h3>
                  {satellite.satId && (
                    <span className="num text-[11px] font-bold text-accent-light bg-accent/15 px-2 py-0.5 rounded border border-accent/30 font-mono">
                      {satellite.satId}
                    </span>
                  )}
                  {satellite.code && (
                    <span className="num text-[11px] font-bold text-text-dim bg-surface px-2 py-0.5 rounded border border-border-subtle font-mono">
                      {satellite.code}
                    </span>
                  )}
                </div>

                <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                  {satellite.description || 'Dedicated Indian Space Research Organisation flight program.'}
                </p>
              </div>
            </div>

            <div className="shrink-0">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
                  isDecommissioned
                    ? 'bg-critical/15 text-critical border border-critical/30'
                    : 'bg-nominal/15 text-nominal border border-nominal/30'
                }`}
              >
                {isDecommissioned ? (
                  <>
                    <XCircle size={13} />
                    <span>{satellite.status || 'Inactive'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} className="animate-pulse" />
                    <span>{satellite.status || 'Active Flight'}</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Telemetry Flight Readouts Grid */}
          <div>
            <h4 className="text-[11px] uppercase font-bold tracking-widest text-text-dim mb-2.5">
              Orbital Parameters & Physical Specifications
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              {/* Launch Date */}
              <div className="p-3 rounded-xl border border-border-subtle bg-surface/70 space-y-1">
                <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-text-dim">
                  <Calendar size={12} className="text-accent-light" />
                  <span>Launch Date</span>
                </span>
                <strong className="text-white block font-mono text-xs truncate">
                  {satellite.launchDate
                    ? new Date(satellite.launchDate).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—'}
                </strong>
              </div>

              {/* Orbit Regime */}
              <div className="p-3 rounded-xl border border-border-subtle bg-surface/70 space-y-1">
                <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-text-dim">
                  <Compass size={12} className="text-accent-light" />
                  <span>Orbit Regime</span>
                </span>
                <strong className="text-white block text-xs truncate" title={satellite.orbitType || '—'}>
                  {satellite.orbitType || 'Standard Flight'}
                </strong>
              </div>

              {/* Launch Mass */}
              <div className="p-3 rounded-xl border border-border-subtle bg-surface/70 space-y-1">
                <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-text-dim">
                  <Weight size={12} className="text-accent-light" />
                  <span>Launch Mass</span>
                </span>
                <strong className="text-white block font-mono text-xs truncate">
                  {satellite.launchMass || '—'}
                </strong>
              </div>

              {/* Fuel Balance */}
              <div className="p-3 rounded-xl border border-border-subtle bg-surface/70 space-y-1">
                <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-text-dim">
                  <Fuel size={12} className="text-accent-light" />
                  <span>Propellant / Fuel</span>
                </span>
                <strong className="text-nominal block font-mono text-xs truncate">
                  {satellite.fuelBalance || 'Nominal'}
                </strong>
              </div>
            </div>
          </div>

          {/* Payloads & Instrumentation */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-[11px] uppercase font-bold tracking-widest text-text-dim flex items-center gap-1.5">
                <Sparkles size={12} className="text-accent-light" />
                <span>Payloads & Scientific Instrumentation</span>
              </h4>
              <span className="num text-[10px] text-text-dim font-mono">
                {payloadList.length} Sensors
              </span>
            </div>

            {payloadList.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {payloadList.map((payload, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-accent/25 bg-[#091224] px-2.5 py-1 text-xs font-semibold text-text-primary"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-accent-light" />
                    <span>{payload}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-dim italic">
                No specific scientific payload records logged.
              </p>
            )}
          </div>

          {/* Assigned Ground Operations Divisions */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-[11px] uppercase font-bold tracking-widest text-text-dim flex items-center gap-1.5">
                <Layers size={12} className="text-accent-light" />
                <span>Assigned Ground Operations Divisions</span>
              </h4>
              <span className="num text-[10px] text-text-dim font-mono">
                {satellite.departments?.length || 0} Directorates
              </span>
            </div>

            {satellite.departments && satellite.departments.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {satellite.departments.map((dept) => (
                  <Link
                    key={dept.id}
                    to={`/departments/${dept.id}`}
                    onClick={onClose}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-border-default bg-surface/50 hover:bg-card-hover hover:border-accent/40 transition-all group"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        {dept.code && (
                          <span className="num text-[10px] font-bold text-accent-light bg-[#0b1426] px-1.5 py-0.5 rounded border border-border-subtle">
                            {dept.code}
                          </span>
                        )}
                        <span className="text-xs font-bold text-white truncate group-hover:text-accent-light transition-colors">
                          {dept.name}
                        </span>
                      </div>
                      {dept.pageLeadOfficer && (
                        <span className="text-[11px] text-text-dim block truncate mt-0.5">
                          Lead: {dept.pageLeadOfficer}
                        </span>
                      )}
                    </div>
                    <ExternalLink size={13} className="text-text-dim group-hover:text-accent-light shrink-0" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-xl border border-border-subtle bg-surface/40 text-xs text-text-dim text-center">
                No ground operations divisions currently linked to this mission.
              </div>
            )}
          </div>

          {/* Recent Mission Events Strip if available */}
          {satellite.recentEvents && satellite.recentEvents.length > 0 && (
            <div>
              <h4 className="text-[11px] uppercase font-bold tracking-widest text-text-dim mb-2.5 flex items-center gap-1.5">
                <Clock size={12} className="text-accent-light" />
                <span>Associated Mission Passes & Events</span>
              </h4>

              <div className="space-y-1.5">
                {satellite.recentEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="flex items-center justify-between p-2 rounded-lg border border-border-subtle bg-surface/30 text-xs"
                  >
                    <span className="font-semibold text-white truncate">{evt.title}</span>
                    <span className="num text-[10px] text-text-dim shrink-0 font-mono ml-2">
                      {new Date(evt.eventDate).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border-subtle">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close Dossier
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
