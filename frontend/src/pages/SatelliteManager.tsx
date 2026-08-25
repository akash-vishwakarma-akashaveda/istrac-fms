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
} from 'lucide-react'
import { satellitesApi, type Satellite } from '../api/satellites.api'
import { useToastStore } from '../store/toastStore'
import { PageHeader, Button, Input, Modal, Textarea } from '../components'

export function SatelliteManager() {
  const addToast = useToastStore((s) => s.addToast)

  const [satellites, setSatellites] = useState<Satellite[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSat, setEditingSat] = useState<Satellite | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
  })
  const [submitting, setSubmitting] = useState(false)

  // Delete Confirm Modal State
  const [deletingSat, setDeletingSat] = useState<Satellite | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadSatellites = async () => {
    setLoading(true)
    try {
      const data = await satellitesApi.getAllAdminSatellites()
      setSatellites(data || [])
    } catch {
      addToast({
        title: 'Error',
        message: 'Failed to load satellite programs',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSatellites()
  }, [])

  const openCreateModal = () => {
    setEditingSat(null)
    setFormData({ name: '', code: '', description: '' })
    setIsModalOpen(true)
  }

  const openEditModal = (sat: Satellite) => {
    setEditingSat(sat)
    setFormData({
      name: sat.name,
      code: sat.code || '',
      description: sat.description || '',
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      addToast({ title: 'Validation', message: 'Satellite name is required', variant: 'warning' })
      return
    }

    setSubmitting(true)
    try {
      if (editingSat) {
        await satellitesApi.updateSatellite(editingSat.id, {
          name: formData.name.trim(),
          code: formData.code.trim() || undefined,
          description: formData.description.trim() || undefined,
        })
        addToast({
          title: 'Satellite Updated',
          message: `${formData.name} has been updated successfully.`,
          variant: 'success',
        })
      } else {
        await satellitesApi.createSatellite({
          name: formData.name.trim(),
          code: formData.code.trim() || undefined,
          description: formData.description.trim() || undefined,
        })
        addToast({
          title: 'Satellite Created',
          message: `${formData.name} added to mission registry.`,
          variant: 'success',
        })
      }
      setIsModalOpen(false)
      loadSatellites()
    } catch (err: any) {
      addToast({
        title: 'Operation Failed',
        message: err.response?.data?.error?.message || 'Could not save satellite',
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
      loadSatellites()
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
      (s.code && s.code.toLowerCase().includes(search.toLowerCase())) ||
      (s.description && s.description.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-subtle pb-5">
        <PageHeader
          eyebrow="Mission Fleet & Programs"
          title="Satellite & Mission Registry"
          description="Register spacecraft programs, orbital mission nodes, and assign organizational divisions."
        />

        <Button
          variant="primary"
          size="md"
          onClick={openCreateModal}
          className="shadow-lg shadow-accent/25 shrink-0"
        >
          <Plus size={16} />
          <span>Add Satellite / Mission</span>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search satellites by name, code (e.g. ADITYA-L1), or mission..."
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
            <div key={i} className="h-44 rounded-xl border border-border-subtle bg-card p-5 animate-pulse" />
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
            <Button variant="primary" size="sm" onClick={openCreateModal} className="mt-4">
              <Plus size={14} />
              <span>Add Your First Satellite</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSatellites.map((sat) => (
            <div
              key={sat.id}
              className="flex flex-col justify-between rounded-xl border border-border-default bg-card p-5 transition-all hover:border-accent/40 hover:bg-[#0c1527] shadow-sm group"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-light border border-accent/25">
                      <Radio size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white truncate group-hover:text-accent-light">
                        {sat.name}
                      </h3>
                      {sat.code && (
                        <span className="num text-[11px] font-bold text-accent-light">
                          {sat.code}
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      sat.isActive
                        ? 'bg-nominal/15 text-nominal border border-nominal/30'
                        : 'bg-critical/15 text-critical border border-critical/30'
                    }`}
                  >
                    {sat.isActive ? (
                      <>
                        <CheckCircle2 size={11} />
                        <span>Active</span>
                      </>
                    ) : (
                      <>
                        <XCircle size={11} />
                        <span>Inactive</span>
                      </>
                    )}
                  </span>
                </div>

                <p className="mt-3 text-xs text-text-secondary line-clamp-2 leading-relaxed">
                  {sat.description || 'Primary Indian Space Research Organisation mission program.'}
                </p>
              </div>

              <div className="mt-5 border-t border-border-subtle/80 pt-3.5">
                <div className="flex items-center justify-between text-xs text-text-dim mb-3">
                  <span className="flex items-center gap-1.5">
                    <Building2 size={13} className="text-accent-light" />
                    <span>{sat.departmentCount ?? 0} Departments</span>
                  </span>

                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    <span className="num">{new Date(sat.createdAt).toLocaleDateString()}</span>
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(sat)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-[#09101f] px-2.5 py-1 text-xs font-semibold text-text-muted hover:border-accent hover:text-white transition-all"
                  >
                    <Edit2 size={12} />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletingSat(sat)}
                    className="inline-flex items-center gap-1 rounded-lg border border-critical/20 bg-critical/5 px-2.5 py-1 text-xs font-semibold text-critical hover:bg-critical/20 transition-all"
                  >
                    <Trash2 size={12} />
                    <span>Deactivate</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Satellite Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSat ? `Edit Satellite: ${editingSat.name}` : 'Register New Satellite / Mission'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="sat-name"
            label="Satellite / Mission Name *"
            placeholder="e.g. Aditya-L1 Solar Observatory"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Input
            id="sat-code"
            label="Mission Code / Identifier (Unique)"
            placeholder="e.g. ADITYA-L1"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            hint="Uppercase alphanumeric code used for folder structuring and telemetry telemetry feeds."
          />

          <Textarea
            id="sat-desc"
            label="Mission Mandate & Description"
            rows={3}
            placeholder="Describe satellite payload, orbit type (LEO, GEO, Halo), or tracking station mandate…"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />

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
              {submitting ? 'Saving Satellite…' : editingSat ? 'Update Satellite' : 'Create Satellite'}
            </Button>
          </div>
        </form>
      </Modal>

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
