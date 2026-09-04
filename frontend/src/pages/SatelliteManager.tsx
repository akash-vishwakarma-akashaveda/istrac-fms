import { useState, useEffect } from 'react'
import {
  Radio,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Building2,
  Calendar,
  Fuel,
  Weight,
  Orbit,
  Eye,
  Activity,
} from 'lucide-react'
import { satellitesApi, type Satellite } from '../api/satellites.api'
import { departmentsApi, type Department } from '../api/departments.api'
import { useToastStore } from '../store/toastStore'
import { PageHeader, Button, Input, Modal, Textarea, SatelliteInfoModal } from '../components'

export function SatelliteManager() {
  const addToast = useToastStore((s) => s.addToast)

  const [satellites, setSatellites] = useState<Satellite[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSat, setEditingSat] = useState<Satellite | null>(null)
  const [formData, setFormData] = useState({
    satId: '',
    name: '',
    code: '',
    description: '',
    launchDate: '',
    payloads: '',
    fuelBalance: '',
    launchMass: '',
    orbitType: '',
    status: 'OPERATIONAL',
    departmentIds: [] as string[],
  })
  const [submitting, setSubmitting] = useState(false)

  // Item 29: Satellite Detailed Info Modal State
  const [viewingSatId, setViewingSatId] = useState<string | null>(null)

  // Delete Confirm Modal State
  const [deletingSat, setDeletingSat] = useState<Satellite | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadSatellitesAndDepts = async () => {
    setLoading(true)
    try {
      const [satsData, deptsData] = await Promise.all([
        satellitesApi.getAllAdminSatellites(),
        departmentsApi.getAllAdminDepartments().catch(() => []),
      ])
      setSatellites(satsData || [])
      setDepartments(deptsData || [])
    } catch {
      addToast({
        title: 'Error',
        message: 'Failed to load satellite programs or department registries',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSatellitesAndDepts()
  }, [])

  const openCreateModal = (prefilledValues?: Partial<typeof formData>) => {
    setEditingSat(null)
    setFormData({
      satId: prefilledValues?.satId || '',
      name: prefilledValues?.name || '',
      code: prefilledValues?.code || '',
      description: prefilledValues?.description || '',
      launchDate: prefilledValues?.launchDate || '',
      payloads: prefilledValues?.payloads || '',
      fuelBalance: prefilledValues?.fuelBalance || '',
      launchMass: prefilledValues?.launchMass || '',
      orbitType: prefilledValues?.orbitType || '',
      status: prefilledValues?.status || 'OPERATIONAL',
      departmentIds: prefilledValues?.departmentIds || [],
    })
    setIsModalOpen(true)
  }

  const openEditModal = (sat: Satellite) => {
    setEditingSat(sat)
    setFormData({
      satId: sat.satId || '',
      name: sat.name || '',
      code: sat.code || '',
      description: sat.description || '',
      launchDate: sat.launchDate ? sat.launchDate.split('T')[0] : '',
      payloads: sat.payloads || '',
      fuelBalance: sat.fuelBalance || '',
      launchMass: sat.launchMass || '',
      orbitType: sat.orbitType || '',
      status: sat.status || 'OPERATIONAL',
      departmentIds: sat.departments?.map((d) => d.id) || [],
    })
    setIsModalOpen(true)
  }

  const toggleDepartment = (deptId: string) => {
    setFormData((prev) => {
      const exists = prev.departmentIds.includes(deptId)
      return {
        ...prev,
        departmentIds: exists
          ? prev.departmentIds.filter((id) => id !== deptId)
          : [...prev.departmentIds, deptId],
      }
    })
  }

  const handleSelectAllDepartments = () => {
    setFormData((prev) => ({
      ...prev,
      departmentIds: departments.map((d) => d.id),
    }))
  }

  const handleClearAllDepartments = () => {
    setFormData((prev) => ({
      ...prev,
      departmentIds: [],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      addToast({ title: 'Validation', message: 'Satellite name is required', variant: 'warning' })
      return
    }

    setSubmitting(true)
    const payload = {
      satId: formData.satId.trim() || undefined,
      name: formData.name.trim(),
      code: formData.code.trim() || undefined,
      description: formData.description.trim() || undefined,
      launchDate: formData.launchDate ? new Date(formData.launchDate).toISOString() : null,
      payloads: formData.payloads.trim() || undefined,
      fuelBalance: formData.fuelBalance.trim() || undefined,
      launchMass: formData.launchMass.trim() || undefined,
      orbitType: formData.orbitType.trim() || undefined,
      status: formData.status.trim() || undefined,
      departmentIds: formData.departmentIds,
    }

    try {
      if (editingSat) {
        await satellitesApi.updateSatellite(editingSat.id, payload)
        addToast({
          title: 'Satellite Updated',
          message: `${formData.name} has been updated with full SQL attributes.`,
          variant: 'success',
        })
      } else {
        await satellitesApi.createSatellite(payload)
        addToast({
          title: 'Satellite Created',
          message: `${formData.name} added to mission registry.`,
          variant: 'success',
        })
      }
      setIsModalOpen(false)
      loadSatellitesAndDepts()
    } catch (err: any) {
      addToast({
        title: 'Operation Failed',
        message: err.response?.data?.error?.message || 'Could not save satellite configuration',
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingSat) return
    setDeleting(true)
    try {
      await satellitesApi.deleteSatellite(deletingSat.id)
      addToast({
        title: 'Satellite Deactivated',
        message: `${deletingSat.name} has been marked as inactive.`,
        variant: 'success',
      })
      setDeletingSat(null)
      loadSatellitesAndDepts()
    } catch (err: any) {
      addToast({
        title: 'Deactivation Failed',
        message: err.response?.data?.error?.message || 'Could not deactivate satellite',
        variant: 'error',
      })
    } finally {
      setDeleting(false)
    }
  }

  const filteredSatellites = satellites.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.satId && s.satId.toLowerCase().includes(search.toLowerCase())) ||
      (s.code && s.code.toLowerCase().includes(search.toLowerCase())) ||
      (s.description && s.description.toLowerCase().includes(search.toLowerCase())) ||
      (s.orbitType && s.orbitType.toLowerCase().includes(search.toLowerCase())) ||
      (s.payloads && s.payloads.toLowerCase().includes(search.toLowerCase()))
  )

  const getStatusBadge = (status?: string | null, isActive?: boolean) => {
    if (!isActive) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-critical/15 text-critical border border-critical/30">
          <XCircle size={11} />
          <span>Inactive</span>
        </span>
      )
    }
    switch (status) {
      case 'OPERATIONAL':
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-nominal/15 text-nominal border border-nominal/30">
            <CheckCircle2 size={11} />
            <span>Operational</span>
          </span>
        )
      case 'IN_ORBIT':
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-accent/15 text-accent-light border border-accent/30">
            <Orbit size={11} />
            <span>In Orbit</span>
          </span>
        )
      case 'DEVELOPMENT':
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-warning/15 text-warning border border-warning/30">
            <Activity size={11} />
            <span>Development</span>
          </span>
        )
      case 'DECOMMISSIONED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-surface text-text-dim border border-border-default">
            <span>Decommissioned</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-nominal/15 text-nominal border border-nominal/30">
            <CheckCircle2 size={11} />
            <span>Active</span>
          </span>
        )
    }
  }

  return (
    <div className="space-y-6 w-full pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-subtle pb-5">
        <PageHeader
          eyebrow="Mission Fleet & Programs"
          title="Satellite & Mission Registry"
          description="Configure spacecraft programs, SQL telemetry attributes (SAT_ID, Payloads, Fuel, Mass), and link operational divisions."
        />

        <Button
          variant="primary"
          size="md"
          onClick={() => openCreateModal()}
          className="shadow-lg shadow-accent/25 shrink-0"
        >
          <Plus size={16} />
          <span>Add Satellite / Mission</span>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by SAT_ID, name, payload, orbit type..."
            className="w-full rounded-lg border border-border-default bg-[#09101f] pl-10 pr-4 py-2 text-xs text-text-primary outline-none hover:border-border-bright focus:border-accent"
          />
        </div>

        <span className="text-xs text-text-dim">
          Showing {filteredSatellites.length} of {satellites.length} Satellites
        </span>
      </div>

      {/* Satellites Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-xl border border-border-subtle bg-card p-5 animate-pulse" />
          ))}
        </div>
      ) : filteredSatellites.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-card p-12 text-center">
          <Radio size={36} className="mx-auto text-text-dim opacity-50 mb-3" />
          <h3 className="text-sm font-bold text-white">No Satellites Found</h3>
          <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
            {search
              ? 'No satellite programs match your search filters.'
              : 'No satellites currently registered in the database.'}
          </p>
          {!search && (
            <Button variant="primary" size="sm" onClick={() => openCreateModal()} className="mt-4">
              <Plus size={14} />
              <span>Add Your First Satellite</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSatellites.map((sat) => (
            <div
              key={sat.id}
              className="flex flex-col justify-between rounded-xl border border-border-default bg-card p-5 transition-all hover:border-accent/50 hover:bg-[#0c1527] shadow-sm group hover:shadow-xl hover:shadow-accent/5"
            >
              <div className="space-y-3.5">
                {/* Header Row: SAT_ID Badge, Code, Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      onClick={() => setViewingSatId(sat.id)}
                      className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-accent/15 text-accent-light border border-accent/25 hover:scale-105 transition-transform"
                      title="View Satellite Details"
                    >
                      <Radio size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {sat.satId && (
                          <span className="num text-[10px] font-mono font-bold text-accent-light bg-accent/10 border border-accent/30 rounded px-1.5 py-0.2">
                            {sat.satId}
                          </span>
                        )}
                        {sat.code && !sat.satId && (
                          <span className="num text-[10px] font-mono font-bold text-accent-light bg-accent/10 border border-accent/30 rounded px-1.5 py-0.2">
                            {sat.code}
                          </span>
                        )}
                      </div>
                      <h3
                        onClick={() => setViewingSatId(sat.id)}
                        className="text-sm font-bold text-white truncate cursor-pointer group-hover:text-accent-light transition-colors mt-0.5"
                        title={sat.name}
                      >
                        {sat.name}
                      </h3>
                    </div>
                  </div>

                  {getStatusBadge(sat.status, sat.isActive)}
                </div>

                {/* Orbit & Mandate Description */}
                <div className="space-y-1.5">
                  {sat.orbitType && (
                    <div className="flex items-center gap-1.5 text-[11px] text-accent-light">
                      <Orbit size={12} className="shrink-0" />
                      <span className="truncate font-medium">{sat.orbitType}</span>
                    </div>
                  )}

                  <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                    {sat.description || 'Primary ISRO ISTRAC space mission node.'}
                  </p>
                </div>

                {/* Telemetry Metric Badges Grid */}
                <div className="grid grid-cols-3 gap-1.5 p-2 rounded-lg border border-border-subtle bg-[#070d1a] text-[10px]">
                  <div className="min-w-0">
                    <span className="text-text-dim block flex items-center gap-1">
                      <Fuel size={10} className="text-nominal" /> Fuel
                    </span>
                    <strong className="text-white font-mono truncate block mt-0.5">
                      {sat.fuelBalance || 'Nominal'}
                    </strong>
                  </div>

                  <div className="min-w-0">
                    <span className="text-text-dim block flex items-center gap-1">
                      <Weight size={10} className="text-accent-light" /> Mass
                    </span>
                    <strong className="text-white font-mono truncate block mt-0.5">
                      {sat.launchMass || 'Standard'}
                    </strong>
                  </div>

                  <div className="min-w-0">
                    <span className="text-text-dim block flex items-center gap-1">
                      <Calendar size={10} className="text-warning" /> Launch
                    </span>
                    <strong className="text-white font-mono truncate block mt-0.5">
                      {sat.launchDate
                        ? new Date(sat.launchDate).toLocaleDateString(undefined, {
                            month: 'short',
                            year: '2-digit',
                          })
                        : 'Active'}
                    </strong>
                  </div>
                </div>

                {/* Payloads Preview */}
                {sat.payloads && (
                  <div className="text-[11px] text-text-dim bg-surface/60 rounded-md px-2 py-1 border border-border-subtle/60 flex items-center gap-1.5">
                    <span className="font-semibold text-text-muted shrink-0">Payloads:</span>
                    <span className="truncate text-text-secondary font-mono text-[10px]">
                      {sat.payloads}
                    </span>
                  </div>
                )}
              </div>

              {/* Card Footer & Operational Actions */}
              <div className="mt-4 border-t border-border-subtle/80 pt-3.5 space-y-3">
                <div className="flex items-center justify-between text-xs text-text-dim">
                  <span className="flex items-center gap-1.5">
                    <Building2 size={13} className="text-accent-light" />
                    <span>
                      {sat.departments && sat.departments.length > 0
                        ? `${sat.departments.length} Depts (${sat.departments
                            .map((d) => d.code || d.name.slice(0, 4))
                            .join(', ')})`
                        : `${sat.departmentCount ?? 0} Departments`}
                    </span>
                  </span>
                </div>

                {/* Action Buttons: Item 28 "Add Satellite" action, Item 29 "View Info", Edit, Deactivate */}
                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  {/* Item 29: View Dossier Action */}
                  <button
                    type="button"
                    onClick={() => setViewingSatId(sat.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-xs font-semibold text-accent-light hover:bg-accent hover:text-white transition-all shadow-sm"
                    title="View detailed satellite telemetry dossier"
                  >
                    <Eye size={12} />
                    <span>View Dossier</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {/* Item 28: Add Satellite Action on Card */}
                    <button
                      type="button"
                      onClick={() =>
                        openCreateModal({
                          orbitType: sat.orbitType || '',
                          departmentIds: sat.departments?.map((d) => d.id) || [],
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-[#09101f] px-2 py-1.5 text-xs font-semibold text-text-muted hover:border-accent hover:text-white transition-all"
                      title="Add a new satellite program with shared orbital baseline"
                    >
                      <Plus size={12} />
                      <span>Add Sat</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(sat)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-[#09101f] px-2 py-1.5 text-xs font-semibold text-text-muted hover:border-accent hover:text-white transition-all"
                      title="Edit satellite configuration"
                    >
                      <Edit2 size={12} />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingSat(sat)}
                      className="inline-flex items-center p-1.5 rounded-lg border border-critical/20 bg-critical/5 text-critical hover:bg-critical/20 transition-all"
                      title="Deactivate satellite"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Item 28: Create / Edit Satellite Modal with Extended SQL Fields + Item 27 Department Checkbox Selector */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          editingSat
            ? `Edit Satellite Mission: ${editingSat.name}`
            : 'Register New Spacecraft / Mission'
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* Row 1: SAT_ID and Mission Code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="sat-satId"
              label="SAT_ID (Spacecraft Serial / ID) *"
              placeholder="e.g. ISRO-SAT-001"
              value={formData.satId}
              onChange={(e) => setFormData({ ...formData, satId: e.target.value.toUpperCase() })}
              hint="Primary SQL identifier registered with global tracking networks."
            />

            <Input
              id="sat-code"
              label="Mission Code (Unique Slug) *"
              placeholder="e.g. ADITYA-L1"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              hint="Folder slug and telemetry downlink namespace."
            />
          </div>

          {/* Row 2: SATELLITE_NAME */}
          <Input
            id="sat-name"
            label="Satellite / Mission Full Name *"
            placeholder="e.g. Aditya-L1 Solar Observatory"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          {/* Row 3: LAUNCH_DATE and ORBIT_TYPE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sat-launch-date" className="col-label">
                Launch Date
              </label>
              <input
                id="sat-launch-date"
                type="date"
                value={formData.launchDate}
                onChange={(e) => setFormData({ ...formData, launchDate: e.target.value })}
                className="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="sat-orbit-type" className="col-label">
                Orbit Regime / Type
              </label>
              <input
                id="sat-orbit-type"
                type="text"
                placeholder="e.g. Sun-Earth L1 Halo, Polar SSO, GEO"
                value={formData.orbitType}
                onChange={(e) => setFormData({ ...formData, orbitType: e.target.value })}
                className="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Row 4: FUEL_BALANCE and LAUNCH_MASS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="sat-fuel"
              label="Fuel Balance (Propellant Mass)"
              placeholder="e.g. 298.5 kg MON-3 / MMH"
              value={formData.fuelBalance}
              onChange={(e) => setFormData({ ...formData, fuelBalance: e.target.value })}
            />

            <Input
              id="sat-mass"
              label="Launch Mass"
              placeholder="e.g. 1475 kg"
              value={formData.launchMass}
              onChange={(e) => setFormData({ ...formData, launchMass: e.target.value })}
            />
          </div>

          {/* Row 5: STATUS */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sat-status" className="col-label">
              Mission Operational Status
            </label>
            <select
              id="sat-status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
            >
              <option value="OPERATIONAL">OPERATIONAL (Active 24/7 Telemetry)</option>
              <option value="IN_ORBIT">IN_ORBIT (Nominal Mission Trajectory)</option>
              <option value="DEVELOPMENT">DEVELOPMENT (Ground Integration / Pre-Launch)</option>
              <option value="DECOMMISSIONED">DECOMMISSIONED (Mission Completed / Graveyard)</option>
            </select>
          </div>

          {/* Row 6: PAYLOADS */}
          <Textarea
            id="sat-payloads"
            label="Scientific & Operational Payloads"
            rows={2}
            placeholder="e.g. VELC, SUIT, ASPEX, PAPA, SoLEXS, HEL1OS, MAG instruments"
            value={formData.payloads}
            onChange={(e) => setFormData({ ...formData, payloads: e.target.value })}
            hint="Comma-separated or formatted list of onboard instruments and subsystems."
          />

          {/* Row 7: Mandate / Description */}
          <Textarea
            id="sat-desc"
            label="Mission Mandate & Overview"
            rows={2}
            placeholder="Describe spacecraft mission parameters, orbital mandate, or ground station downlink protocols…"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />

          {/* Item 27: Department Field with Checkbox-Based Selector */}
          <div className="rounded-xl border border-border-default bg-[#070d1a] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Building2 size={14} className="text-accent-light" />
                <span>Associated Operational Departments (Checkbox Selector)</span>
              </label>

              <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-accent-light bg-accent/15 border border-accent/30 rounded-full px-2.5 py-0.5">
                {formData.departmentIds.length} Selected
              </span>
            </div>

            <p className="text-[11px] text-text-dim leading-relaxed">
              Select all ISTRAC and ISRO divisions responsible for tracking, orbit flight dynamics, ground terminal telemetry, and mission data management for this satellite.
            </p>

            <div className="flex items-center justify-between text-[11px] pt-1">
              <span className="text-text-secondary font-medium">Divisions Directory:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllDepartments}
                  className="text-accent-light hover:underline font-semibold"
                >
                  Select All
                </button>
                <span className="text-text-dim">·</span>
                <button
                  type="button"
                  onClick={handleClearAllDepartments}
                  className="text-text-dim hover:text-white"
                >
                  Clear All
                </button>
              </div>
            </div>

            {departments.length === 0 ? (
              <div className="py-3 text-center text-xs text-text-dim border border-border-subtle rounded-lg bg-surface">
                No active departments found to associate.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-1.5 rounded-lg border border-border-subtle bg-surface">
                {departments.map((dept) => {
                  const isChecked = formData.departmentIds.includes(dept.id)
                  return (
                    <label
                      key={dept.id}
                      className={`flex items-start gap-2.5 p-2 rounded-md border cursor-pointer transition-all ${
                        isChecked
                          ? 'border-accent/50 bg-accent/10 text-white'
                          : 'border-border-subtle/60 bg-card/40 text-text-secondary hover:border-border-bright hover:bg-card'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleDepartment(dept.id)}
                        className="mt-0.5 h-3.5 w-3.5 rounded border-border-default bg-card text-accent focus:ring-accent"
                      />
                      <div className="min-w-0 flex-1 text-xs">
                        <div className="font-semibold truncate">{dept.name}</div>
                        <div className="text-[10px] text-accent-light font-mono mt-0.5">
                          {dept.code || 'DIV'}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={submitting}
              className="shadow-lg shadow-accent/25"
            >
              {submitting
                ? 'Saving Satellite…'
                : editingSat
                ? 'Update Satellite Entry'
                : 'Create Satellite Entry'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Item 29: Satellite Detailed Info View Modal */}
      <SatelliteInfoModal
        satelliteId={viewingSatId}
        isOpen={Boolean(viewingSatId)}
        onClose={() => setViewingSatId(null)}
      />

      {/* Deactivate Confirm Modal */}
      <Modal
        isOpen={Boolean(deletingSat)}
        onClose={() => setDeletingSat(null)}
        title="Deactivate Satellite Program"
      >
        <div className="space-y-4">
          <p className="text-xs text-text-secondary leading-relaxed">
            Are you sure you want to deactivate{' '}
            <strong className="text-white">{deletingSat?.name}</strong>?
          </p>
          <p className="text-xs text-text-dim">
            Deactivating this satellite will hide it from new department creation dropdowns.
            Existing telemetry files and datasets will remain safely archived.
          </p>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setDeletingSat(null)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="danger"
              size="md"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? 'Deactivating…' : 'Confirm Deactivate'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
