import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useCms } from '../../context/cmsContext'
import { usePreviewRefresh } from '../../context/PreviewRefreshContext'
import { useUpdateCmsBlock } from '../../hooks/useUpdateCmsBlock'
import { useToastStore } from '../../store/toastStore'
import { Button, Input, Panel, Textarea } from '..'
import { SaveBar } from './SaveBar'
import type { MissionEvent } from '../MissionCalendar'

const CALENDAR_CATEGORIES = [
  { value: 'PASS', label: 'Pass Window (Green Dot)' },
  { value: 'MANEUVER', label: 'Maneuver (Orange Dot)' },
  { value: 'MAINTENANCE', label: 'Maintenance Window (Blue Circle Badge)' },
  { value: 'SPECIAL', label: 'Special Activity (Purple Circle Badge)' },
  { value: 'OTHER', label: 'Other Event (Slate Dot)' },
]

export function EventsTab() {
  const { cmsBlocks } = useCms()
  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  const existing = cmsBlocks['calendar_events'] as
    | {
        events?: MissionEvent[]
      }
    | undefined

  const [events, setEvents] = useState<MissionEvent[]>([])

  useEffect(() => {
    setEvents(existing?.events ?? [])
  }, [existing])

  // Calendar Events management
  function addEvent() {
    setEvents((prev) => [
      ...prev,
      {
        id: `ev-${Date.now()}`,
        title: 'Cartosat-3 Pass Window',
        date: new Date().toISOString().split('T')[0],
        time: '10:15 AM IST',
        category: 'PASS',
        department: 'TTC',
        station: 'BLR-MOX',
        description: 'Nominal telemetry acquisition window.',
      },
    ])
  }

  function updateEvent(index: number, patch: Partial<MissionEvent>) {
    setEvents((prev) => prev.map((ev, i) => (i === index ? { ...ev, ...patch } : ev)))
  }

  function removeEvent(index: number) {
    setEvents((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSave() {
    updateBlock.mutate(
      {
        blockKey: 'calendar_events',
        content: { events },
      },
      {
        onSuccess: () => {
          addToast({ message: 'Calendar Events updated', variant: 'success' })
          triggerRefresh()
        },
        onError: () => {
          addToast({ message: 'Failed to save', variant: 'error' })
        },
      }
    )
  }

  return (
    <Panel
      title="Upcoming Mission Events & Calendar"
      meta={`${events.length} marked event${events.length === 1 ? '' : 's'}`}
      flush
    >
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-border-subtle pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-accent-light">
            Calendar Month Events & Passes
          </h3>
          <span className="num text-[11px] text-text-dim">{events.length} events</span>
        </div>

        <div className="space-y-3">
          {events.map((ev, index) => (
            <div
              key={ev.id || index}
              className="rounded-xl border border-border-subtle bg-surface p-3 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="num text-xs font-bold text-accent-light">Event 0{index + 1}</span>
                <button
                  type="button"
                  onClick={() => removeEvent(index)}
                  aria-label={`Remove event ${index + 1}`}
                  className="p-1 text-text-dim hover:text-critical"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <Input
                    id={`ev-title-${index}`}
                    label="Event Title"
                    value={ev.title}
                    onChange={(e) => updateEvent(index, { title: e.target.value })}
                  />
                </div>

                <div>
                  <label htmlFor={`ev-cat-${index}`} className="col-label block mb-1.5">
                    Category Marker
                  </label>
                  <select
                    id={`ev-cat-${index}`}
                    value={ev.category}
                    onChange={(e) => updateEvent(index, { category: e.target.value as any })}
                    className="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-xs text-text-primary focus:border-accent"
                  >
                    {CALENDAR_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Input
                  id={`ev-date-${index}`}
                  label="Date (YYYY-MM-DD)"
                  value={ev.date}
                  onChange={(e) => updateEvent(index, { date: e.target.value })}
                  className="num"
                />

                <Input
                  id={`ev-time-${index}`}
                  label="Time"
                  value={ev.time}
                  onChange={(e) => updateEvent(index, { time: e.target.value })}
                  className="num"
                />

                <Input
                  id={`ev-dept-${index}`}
                  label="Department"
                  value={ev.department || ''}
                  onChange={(e) => updateEvent(index, { department: e.target.value })}
                />

                <Input
                  id={`ev-stn-${index}`}
                  label="Ground Station"
                  value={ev.station || ''}
                  onChange={(e) => updateEvent(index, { station: e.target.value })}
                />
              </div>

              <Textarea
                id={`ev-desc-${index}`}
                label="Description / Modal Details"
                rows={2}
                value={ev.description || ''}
                onChange={(e) => updateEvent(index, { description: e.target.value })}
              />
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" size="sm" onClick={addEvent} className="w-full">
          <Plus size={13} strokeWidth={2.2} />
          Add Calendar Event / Pass
        </Button>

        <SaveBar onSave={handleSave} isPending={updateBlock.isPending} />
      </div>
    </Panel>
  )
}
