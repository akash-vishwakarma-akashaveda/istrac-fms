import { useState } from 'react'
import {
  Send,
  Megaphone,
  Radio,
  AlertTriangle,
  Flame,
  Sparkles,
} from 'lucide-react'
import { useDepartments } from '../hooks/useDepartments'
import { useBroadcast } from '../hooks/useBroadcast'
import { useToastStore } from '../store/toastStore'
import { Button, PageHeader, Textarea } from '../components'
import { DeptMultiSelect } from '../components/DeptMultiSelect'
import { NotificationPreviewCard } from '../components/NotificationPreviewCard'

const URGENCY_LEVELS = [
  {
    id: 'STANDARD',
    label: 'Operational Notice',
    icon: Megaphone,
    color: 'border-accent text-accent-light bg-accent/10',
    prefix: '[NOTICE]',
  },
  {
    id: 'TRACKING',
    label: 'Tracking Pass Telemetry',
    icon: Radio,
    color: 'border-[#0284C7] text-[#38BDF8] bg-[#0284C7]/10',
    prefix: '[TELEMETRY]',
  },
  {
    id: 'MAINTENANCE',
    label: 'Ground Station Alert',
    icon: AlertTriangle,
    color: 'border-[#FF6B00] text-[#FF8533] bg-[#FF6B00]/10',
    prefix: '[STATION ALERT]',
  },
  {
    id: 'CRITICAL',
    label: 'Critical Spacecraft Anomaly',
    icon: Flame,
    color: 'border-critical text-critical bg-critical/10',
    prefix: '[CRITICAL ANOMALY]',
  },
]

const QUICK_TEMPLATES = [
  'Aditya-L1 ground tracking pass and telemetry ingest scheduled tonight from 18:30 to 20:00 UTC.',
  'Ground Station SAS RAID array maintenance window scheduled between 23:00 - 01:00 IST.',
  'Flight Dynamics Division (FDD) has released new orbit determination ephemeris for Chandrayaan-3.',
  'All operations personnel: Please ensure daily mission reports are uploaded prior to shift handover.',
]

const TARGETS: {
  id: 'all' | 'departments'
  label: string
  detail: string
}[] = [
  { id: 'all', label: 'All ISRO Personnel', detail: 'Broadcast to all authenticated ground station accounts' },
  { id: 'departments', label: 'Specific Operational Divisions', detail: 'Target selected departments (TTC, FDD, MOX, NETRA)' },
]

export function BroadcastNotification() {
  const [urgency, setUrgency] = useState('STANDARD')
  const [message, setMessage] = useState('')
  const [target, setTarget] = useState<'all' | 'departments'>('all')
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([])

  const { data: departments } = useDepartments()
  const broadcast = useBroadcast()
  const addToast = useToastStore((s) => s.addToast)

  const departmentNames =
    departments
      ?.filter((d) => selectedDeptIds.includes(d.id))
      .map((d) => d.name) ?? []

  const canSend =
    message.trim().length > 0 &&
    (target === 'all' || selectedDeptIds.length > 0)

  const activeUrgencyObj = URGENCY_LEVELS.find((u) => u.id === urgency) || URGENCY_LEVELS[0]

  function handleSend() {
    const finalFormattedMessage = `${activeUrgencyObj.prefix} ${message.trim()}`

    broadcast.mutate(
      {
        message: finalFormattedMessage,
        target,
        departmentIds:
          target === 'departments'
            ? selectedDeptIds
            : undefined,
      },
      {
        onSuccess: () => {
          addToast({
            title: 'Broadcast Dispatched',
            message: 'Operational notice published to all targeted terminals and notification feeds.',
            variant: 'success',
          })
          setMessage('')
          setSelectedDeptIds([])
        },
        onError: () =>
          addToast({
            title: 'Broadcast Failed',
            message: 'Could not dispatch message. Please retry.',
            variant: 'error',
          }),
      },
    )
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-12">
      <div className="border-b border-border-subtle pb-5">
        <PageHeader
          eyebrow="Mission Command & Control"
          title="Station Operations Broadcast Center"
          description="Publish high-priority operational notices, satellite tracking passes, and maintenance alerts across ISRO ground control."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Compose Form */}
        <div className="lg:col-span-2 space-y-5">
          {/* Section 1: Notice Category & Urgency */}
          <div className="rounded-xl border border-border-default bg-card p-5 space-y-3 shadow-sm">
            <label className="block text-xs font-bold text-text-primary uppercase tracking-wider">
              1. Broadcast Priority & Category
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {URGENCY_LEVELS.map((lvl) => {
                const isSelected = urgency === lvl.id
                const Icon = lvl.icon
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setUrgency(lvl.id)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? `${lvl.color} shadow-sm ring-1 ring-accent`
                        : 'border-border-subtle bg-[#060c18] text-text-secondary hover:border-border-default hover:text-white'
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        isSelected ? 'bg-white/10' : 'bg-surface'
                      }`}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{lvl.label}</p>
                      <span className="num text-[10px] text-text-dim">{lvl.prefix}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Section 2: Notice Message */}
          <div className="rounded-xl border border-border-default bg-card p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-text-primary uppercase tracking-wider">
                2. Operational Notice Content
              </label>
              <span className="num text-[10px] text-text-dim">
                {message.length} characters
              </span>
            </div>

            <Textarea
              id="notification-message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Aditya-L1 scheduled maneuver tracking pass commences at 18:30 UTC. Telemetry stream active on TTC channel 4."
              hint="Keep statements concise and actionable for shift controllers."
            />

            {/* Quick ISRO Preset Templates */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={12} className="text-[#FF6B00]" />
                <span>Quick Mission Templates (Click to fill):</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setMessage(tmpl)}
                    className="text-left text-[11px] px-2.5 py-1 rounded-md border border-border-subtle bg-[#060c18] text-text-muted hover:border-accent hover:text-white hover:bg-card-hover transition-all truncate max-w-full"
                  >
                    "{tmpl.slice(0, 55)}…"
                  </button>
                ))}
              </div>
            </div>

            {/* Section 3: Target Recipients */}
            <div className="border-t border-border-subtle pt-4 space-y-3">
              <label className="block text-xs font-bold text-text-primary uppercase tracking-wider">
                3. Target Audience
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {TARGETS.map((option) => (
                  <label
                    key={option.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all ${
                      target === option.id
                        ? 'border-accent bg-accent/10 shadow-sm'
                        : 'border-border-subtle bg-[#060c18] hover:border-border-default'
                    }`}
                  >
                    <input
                      type="radio"
                      name="notification-target"
                      checked={target === option.id}
                      onChange={() => setTarget(option.id)}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-accent"
                    />

                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-text-primary">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-text-dim">
                        {option.detail}
                      </span>
                    </div>
                  </label>
                ))}
              </div>

              {/* Department selection */}
              {target === 'departments' && (
                <div className="mt-3 animate-fadeIn">
                  <DeptMultiSelect
                    selected={selectedDeptIds}
                    onChange={setSelectedDeptIds}
                  />
                </div>
              )}
            </div>

            {/* Dispatch Action */}
            <div className="flex items-center justify-between border-t border-border-subtle pt-4">
              <p className="text-[11px] text-text-dim">
                Dispatches live web push, banner alerts, and terminal notifications.
              </p>

              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleSend}
                disabled={!canSend || broadcast.isPending}
                className="shadow-lg shadow-accent/25 px-5"
              >
                <Send size={14} />
                <span>{broadcast.isPending ? 'Dispatching…' : 'Publish Broadcast Notice'}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Dispatch Preview */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border-default bg-card p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border-subtle/80 pb-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Radio size={14} className="text-[#FF6B00] animate-pulse" />
                <span>Live Feed Preview</span>
              </h3>
              <span className="rounded bg-nominal/15 px-2 py-0.5 text-[9px] font-bold text-nominal border border-nominal/30">
                REAL-TIME
              </span>
            </div>

            <NotificationPreviewCard
              message={message ? `${activeUrgencyObj.prefix} ${message}` : `${activeUrgencyObj.prefix} Scheduled maintenance tonight from 23:00 to 01:00 IST.`}
              target={target}
              departmentNames={departmentNames}
            />

            <div className="rounded-lg border border-border-subtle bg-[#060c18] p-3 text-[11px] text-text-dim space-y-1.5">
              <div className="flex justify-between">
                <span>Origin:</span>
                <span className="font-bold text-text-primary">ISTRAC Bengaluru MOX</span>
              </div>
              <div className="flex justify-between">
                <span>Priority:</span>
                <span className="font-bold text-accent-light">{activeUrgencyObj.label}</span>
              </div>
              <div className="flex justify-between">
                <span>Target Count:</span>
                <span className="font-bold text-nominal">
                  {target === 'all' ? 'All Active Accounts' : `${selectedDeptIds.length} Divisions`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
