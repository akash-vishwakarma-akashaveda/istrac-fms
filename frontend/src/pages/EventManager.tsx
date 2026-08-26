import { useState, useEffect } from 'react'
import {
  Calendar,
  Plus,
  Search,
  Clock,
  Radio,
  Building2,
  Flame,
  AlertTriangle,
  Trash2,
  Edit2,
  Sparkles,
  MapPin,
} from 'lucide-react'
import { eventsApi, type MissionEventItem } from '../api/events.api'
import { satellitesApi, type Satellite } from '../api/satellites.api'
import { useDepartments } from '../hooks/useDepartments'
import { useToastStore } from '../store/toastStore'
import { PageHeader, Button, Modal, Textarea } from '../components'

const EVENT_TYPES = [
  { id: 'MISSION_PASS', label: 'Spacecraft Tracking Pass', icon: Radio, color: 'text-accent-light bg-accent/10 border-accent/30' },
  { id: 'LAUNCH', label: 'Rocket Launch Window', icon: Flame, color: 'text-[#FF6B00] bg-[#FF6B00]/10 border-[#FF6B00]/30' },
  { id: 'ORBIT_MANEUVER', label: 'Orbit Correction Maneuver', icon: Sparkles, color: 'text-purple-400 bg-purple-400/10 border-purple-400/30' },
  { id: 'MAINTENANCE', label: 'Ground Station / RAID Maintenance', icon: AlertTriangle, color: 'text-warning bg-warning/10 border-warning/30' },
  { id: 'SEMINAR', label: 'Operational Review / Seminar', icon: Building2, color: 'text-nominal bg-nominal/10 border-nominal/30' },
  { id: 'ANOMALY', label: 'Spacecraft Anomaly Investigation', icon: Flame, color: 'text-critical bg-critical/10 border-critical/30' },
]

export function EventManager() {
  const addToast = useToastStore((s) => s.addToast)
  const { data: departments } = useDepartments()

  const [events, setEvents] = useState<MissionEventItem[]>([])
  const [satellites, setSatellites] = useState<Satellite[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')

  // Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<MissionEventItem | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventType: 'MISSION_PASS' as any,
    satelliteId: '',
    departmentId: '',
    eventDate: '',
    endDate: '',
    location: 'ISTRAC MOX Bengaluru',
    urgency: 'NORMAL' as any,
    status: 'UPCOMING' as any,
    showOnBanner: true,
  })
  const [submitting, setSubmitting] = useState(false)

  // Delete Modal
  const [deletingEvent, setDeletingEvent] = useState<MissionEventItem | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [eventsData, satsData] = await Promise.all([
        eventsApi.getEvents(),
        satellitesApi.getAllAdminSatellites().catch(() => []),
      ])
      setEvents(eventsData || [])
      setSatellites(satsData || [])
    } catch {
      addToast({ title: 'Error', message: 'Failed to load mission events', variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const openCreateModal = () => {
    setEditingEvent(null)
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    const defaultDate = now.toISOString().slice(0, 16)

    setFormData({
      title: '',
      description: '',
      eventType: 'MISSION_PASS',
      satelliteId: satellites[0]?.id || '',
      departmentId: departments?.[0]?.id || '',
      eventDate: defaultDate,
      endDate: '',
      location: 'ISTRAC MOX Bengaluru',
      urgency: 'NORMAL',
      status: 'UPCOMING',
      showOnBanner: true,
    })
    setIsModalOpen(true)
  }

  const openEditModal = (ev: MissionEventItem) => {
    setEditingEvent(ev)
    setFormData({
      title: ev.title,
      description: ev.description || '',
      eventType: ev.eventType,
      satelliteId: ev.satelliteId || '',
      departmentId: ev.departmentId || '',
      eventDate: ev.eventDate ? new Date(ev.eventDate).toISOString().slice(0, 16) : '',
      endDate: ev.endDate ? new Date(ev.endDate).toISOString().slice(0, 16) : '',
      location: ev.location || 'ISTRAC MOX Bengaluru',
      urgency: ev.urgency,
      status: ev.status,
      showOnBanner: ev.showOnBanner,
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim() || !formData.eventDate) {
      addToast({ title: 'Validation Error', message: 'Title and Event Date are required', variant: 'warning' })
      return
    }

    setSubmitting(true)
    try {
      if (editingEvent) {
        await eventsApi.updateEvent(editingEvent.id, formData)
        addToast({ title: 'Event Updated', message: `Updated "${formData.title}"`, variant: 'success' })
      } else {
        await eventsApi.createEvent(formData)
        addToast({ title: 'Event Scheduled', message: `Scheduled "${formData.title}"`, variant: 'success' })
      }
      setIsModalOpen(false)
      loadData()
    } catch (err: any) {
      addToast({
        title: 'Save Failed',
        message: err.response?.data?.error?.message || 'Could not save event',
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingEvent) return
    try {
      await eventsApi.deleteEvent(deletingEvent.id)
      addToast({ title: 'Event Deleted', message: `Removed "${deletingEvent.title}"`, variant: 'info' })
      setDeletingEvent(null)
      loadData()
    } catch {
      addToast({ title: 'Error', message: 'Failed to delete event', variant: 'error' })
    }
  }

  // Filtered Events
  const filteredEvents = events.filter((ev) => {
    const matchesSearch =
      ev.title.toLowerCase().includes(search.toLowerCase()) ||
      ev.location?.toLowerCase().includes(search.toLowerCase()) ||
      ev.satellite?.name.toLowerCase().includes(search.toLowerCase()) ||
      ev.department?.name.toLowerCase().includes(search.toLowerCase())

    const matchesStatus = statusFilter === 'ALL' || ev.status === statusFilter
    const matchesType = typeFilter === 'ALL' || ev.eventType === typeFilter

    return matchesSearch && matchesStatus && matchesType
  })

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-subtle pb-5">
        <PageHeader
          eyebrow="Mission Command & Control"
          title="Mission Events & Operations Calendar"
          description="Schedule spacecraft telemetry passes, rocket launch windows, orbit determination maneuvers, and station maintenance windows."
        />

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={openCreateModal}
          className="shadow-md shadow-accent/25 shrink-0"
        >
          <Plus size={14} />
          <span>Schedule Mission Event</span>
        </Button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl border border-border-default bg-card shadow-sm">
        <div className="relative sm:col-span-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            placeholder="Search events, spacecraft, locations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border-default bg-[#060c18] pl-9 pr-3 py-2 text-xs text-white placeholder:text-text-dim outline-none focus:border-accent"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
          >
            <option value="ALL">All Event Statuses</option>
            <option value="UPCOMING">Upcoming Schedule</option>
            <option value="IN_PROGRESS">In Progress (Active Now)</option>
            <option value="COMPLETED">Completed Passes</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
          >
            <option value="ALL">All Event Categories</option>
            {EVENT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="h-64 rounded-xl border border-border-subtle bg-card p-10 flex items-center justify-center text-xs text-text-dim">
          Scanning operational calendar…
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-card p-12 text-center space-y-3">
          <Calendar size={32} className="mx-auto text-text-dim" />
          <p className="text-sm font-bold text-white">No Mission Events Found</p>
          <p className="text-xs text-text-secondary">
            Schedule a spacecraft pass or station maintenance window to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((ev) => {
            const typeObj = EVENT_TYPES.find((t) => t.id === ev.eventType) || EVENT_TYPES[0]
            const Icon = typeObj.icon
            const eventDateTime = new Date(ev.eventDate)
            const isNow =
              eventDateTime.getTime() <= Date.now() &&
              (!ev.endDate || new Date(ev.endDate).getTime() >= Date.now())

            return (
              <div
                key={ev.id}
                className={`rounded-xl border p-4.5 flex flex-col justify-between transition-all bg-card ${
                  isNow
                    ? 'border-nominal bg-nominal/[0.04] shadow-md ring-1 ring-nominal'
                    : 'border-border-default hover:border-border-bright hover:bg-card-hover'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold border ${typeObj.color}`}
                    >
                      <Icon size={12} />
                      <span>{typeObj.label}</span>
                    </span>

                    <div className="flex items-center gap-1">
                      {ev.showOnBanner && (
                        <span className="rounded bg-[#FF6B00]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#FF8533] border border-[#FF6B00]/30" title="Active on Dynamic Alert Banner">
                          BANNER
                        </span>
                      )}
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                          ev.status === 'UPCOMING'
                            ? 'bg-accent/15 text-accent-light'
                            : ev.status === 'IN_PROGRESS'
                              ? 'bg-nominal/15 text-nominal animate-pulse'
                              : 'bg-surface text-text-dim'
                        }`}
                      >
                        {ev.status}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-white line-clamp-1">{ev.title}</h3>
                    {ev.description && (
                      <p className="text-xs text-text-secondary line-clamp-2 mt-1 leading-relaxed">
                        {ev.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1 text-xs text-text-dim pt-2 border-t border-border-subtle">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Clock size={12} className="text-accent-light" />
                        <span>Date & UTC:</span>
                      </span>
                      <span className="num font-semibold text-text-primary">
                        {new Date(ev.eventDate).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZoneName: 'short',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <MapPin size={12} className="text-text-muted" />
                        <span>Site / Look:</span>
                      </span>
                      <span className="truncate max-w-[140px] text-text-primary font-medium">
                        {ev.location || 'ISTRAC MOX'}
                      </span>
                    </div>

                    {ev.satellite && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Radio size={12} className="text-[#FF6B00]" />
                          <span>Spacecraft:</span>
                        </span>
                        <span className="font-bold text-[#FF8533]">{ev.satellite.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border-subtle/80 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(ev)}
                    className="p-1.5 rounded-lg border border-border-default bg-[#0c1424] text-text-muted hover:border-accent hover:text-white transition-all"
                    title="Edit Event"
                  >
                    <Edit2 size={13} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletingEvent(ev)}
                    className="p-1.5 rounded-lg border border-border-default bg-[#0c1424] text-text-muted hover:border-critical hover:text-critical transition-all"
                    title="Delete Event"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* CREATE / EDIT EVENT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEvent ? 'Edit Mission Event' : 'Schedule Mission Event & Pass'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Event Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Aditya-L1 Scheduled Maneuver Pass"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Category
              </label>
              <select
                value={formData.eventType}
                onChange={(e) => setFormData({ ...formData, eventType: e.target.value as any })}
                className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Target Spacecraft (Optional)
              </label>
              <select
                value={formData.satelliteId}
                onChange={(e) => setFormData({ ...formData, satelliteId: e.target.value })}
                className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
              >
                <option value="">None / General Station</option>
                {satellites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code || 'ISRO'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Start Date & Time (UTC/IST) *
              </label>
              <input
                type="datetime-local"
                required
                value={formData.eventDate}
                onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                className="num w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                End Date & Time (Optional)
              </label>
              <input
                type="datetime-local"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="num w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Site / Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. ISTRAC MOX Bengaluru Channel 4"
                className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
              >
                <option value="UPCOMING">Upcoming</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          <Textarea
            id="event-desc"
            label="Mission Parameters & Description"
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Enter pass parameters, frequencies, and telemetry expectations..."
          />

          <label className="flex items-center gap-2 cursor-pointer select-none rounded-lg border border-border-subtle bg-[#060c18] p-3 text-xs text-white">
            <input
              type="checkbox"
              checked={formData.showOnBanner}
              onChange={(e) => setFormData({ ...formData, showOnBanner: e.target.checked })}
              className="h-4 w-4 rounded border-border-default bg-card text-accent focus:ring-accent"
            />
            <span>Broadcast on Dynamic Top Banner (Auto-displays during scheduled pass window)</span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={submitting}>
              {submitting ? 'Saving…' : editingEvent ? 'Update Event' : 'Schedule Event'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRM MODAL */}
      <Modal
        isOpen={deletingEvent !== null}
        onClose={() => setDeletingEvent(null)}
        title="Delete Scheduled Event"
      >
        <div className="space-y-4">
          <p className="text-xs text-text-secondary">
            Are you sure you want to remove <strong className="text-white">{deletingEvent?.title}</strong> from the mission calendar?
          </p>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
            <Button type="button" variant="outline" size="sm" onClick={() => setDeletingEvent(null)}>
              Cancel
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={handleDelete} className="bg-critical hover:bg-critical-hover">
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
