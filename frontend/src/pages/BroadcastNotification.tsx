import { useState, useEffect } from 'react'
import { copyText } from '../lib/browserCompat'
import {
  Send,
  Megaphone,
  Radio,
  AlertTriangle,
  Flame,
  Sparkles,
  History,
  Copy,
  RotateCcw,
  Users,
  ShieldAlert,
  Clock,
  Ban,
  Plus,
  X,
} from 'lucide-react'
import { useBroadcast, useBroadcastCategories, useRevokeBroadcast } from '../hooks/useBroadcast'
import { useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '../api/notifications.api'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToastStore } from '../store/toastStore'
import { apiClient, getErrorMessage } from '../api/client'
import { Button, PageHeader, Textarea } from '../components'
import { DeptMultiSelect } from '../components/DeptMultiSelect'

const URGENCY_LEVELS = [
  {
    id: 'STANDARD',
    label: 'Operational Notice',
    icon: Megaphone,
    color: 'border-accent text-accent-light bg-accent/10',
    prefix: '[NOTICE]',
    type: 'NOTICE',
  },
  {
    id: 'TRACKING',
    label: 'Tracking Pass Telemetry',
    icon: Radio,
    color: 'border-[#0284C7] text-[#38BDF8] bg-[#0284C7]/10',
    prefix: '[TELEMETRY]',
    type: 'TELEMETRY',
  },
  {
    id: 'MAINTENANCE',
    label: 'Ground Station Alert',
    icon: AlertTriangle,
    color: 'border-[#FF6B00] text-[#FF8533] bg-[#FF6B00]/10',
    prefix: '[STATION ALERT]',
    type: 'MAINTENANCE',
  },
  {
    id: 'CRITICAL',
    label: 'Critical Spacecraft Anomaly',
    icon: Flame,
    color: 'border-critical text-critical bg-critical/10',
    prefix: '[CRITICAL ANOMALY]',
    type: 'CRITICAL',
  },
]

const QUICK_TEMPLATES = [
  'Aditya-L1 ground tracking pass and telemetry ingest scheduled tonight from 18:30 to 20:00 IST.',
  'Ground Station SAS RAID array maintenance window scheduled between 23:00 - 01:00 IST.',
  'Flight Dynamics Division (FDD) has released new orbit determination ephemeris for Chandrayaan-3.',
  'All operations personnel: Please ensure daily mission reports are uploaded prior to shift handover.',
]

const TARGETS: {
  id: 'all' | 'all_departments' | 'departments'
  label: string
  detail: string
}[] = [
  { id: 'all', label: 'All ISRO Personnel', detail: 'Broadcast to all authenticated ground station accounts' },
  { id: 'all_departments', label: 'All Divisions', detail: 'Broadcast across personnel assigned to all operational divisions' },
  { id: 'departments', label: 'Specific Operational Divisions', detail: 'Target selected departments (TTC, FDD, MOX, NETRA)' },
]

interface BroadcastRecord {
  id: string
  type: string
  category: string
  message: string
  label?: string | null
  senderName: string
  actorId?: string
  createdAt: string
}

export function BroadcastNotification() {
  const [urgency, setUrgency] = useState('STANDARD')
  const [message, setMessage] = useState('')
  const [target, setTarget] = useState<'all' | 'all_departments' | 'departments'>('all')
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([])
  
  // History state
  const [history, setHistory] = useState<BroadcastRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const broadcast = useBroadcast()
  const revoke = useRevokeBroadcast()
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  // Custom broadcast categories (BUG-12)
  const { data: categories = [] } = useBroadcastCategories()
  const [categoryLabel, setCategoryLabel] = useState('General')
  const [newCategory, setNewCategory] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)
  const [historyFilter, setHistoryFilter] = useState('ALL')
  const [revokeTarget, setRevokeTarget] = useState<BroadcastRecord | null>(null)

  const handleAddCategory = async () => {
    const label = newCategory.trim()
    if (!label) return
    setSavingCategory(true)
    try {
      const list = await notificationsApi.createBroadcastCategory(label)
      queryClient.setQueryData(['broadcast-categories'], list)
      setCategoryLabel(label)
      setNewCategory('')
      addToast({ title: 'Category added', message: `"${label}" is now available for broadcasts.`, variant: 'success' })
    } catch (err) {
      addToast({ title: 'Could not add category', message: getErrorMessage(err), variant: 'error' })
    } finally {
      setSavingCategory(false)
    }
  }

  const handleDeleteCategory = async (id: string, label: string) => {
    try {
      const list = await notificationsApi.deleteBroadcastCategory(id)
      queryClient.setQueryData(['broadcast-categories'], list)
      if (categoryLabel === label) setCategoryLabel('General')
      addToast({ title: 'Category removed', message: `"${label}" was removed. Past broadcasts keep their label.`, variant: 'success' })
    } catch (err) {
      addToast({ title: 'Could not remove category', message: getErrorMessage(err), variant: 'error' })
    }
  }

  const handleConfirmRevoke = () => {
    if (!revokeTarget) return
    const target = revokeTarget
    revoke.mutate(target.id, {
      onSuccess: (res) => {
        // Update the list immediately; the refetch confirms it.
        setHistory((prev) => prev.filter((h) => h.id !== target.id))
        addToast({ title: 'Broadcast revoked', message: res.message, variant: 'success' })
        setRevokeTarget(null)
        fetchHistory()
      },
      onError: (err) => {
        // Leave the history untouched so the admin sees nothing changed.
        addToast({ title: 'Could not revoke broadcast', message: getErrorMessage(err), variant: 'error' })
        setRevokeTarget(null)
      },
    })
  }

  const historyLabels = Array.from(new Set(history.map((h) => h.label || 'General'))).sort()
  const visibleHistory = historyFilter === 'ALL' ? history : history.filter((h) => (h.label || 'General') === historyFilter)

  const fetchHistory = () => {
    setLoadingHistory(true)
    apiClient
      .get('/admin/notifications/broadcasts')
      .then((res: any) => {
        if (res.data?.data) {
          setHistory(res.data.data)
        }
      })
      .catch((err: unknown) =>
        addToast({ title: 'Could not load broadcast history', message: getErrorMessage(err), variant: 'error' })
      )
      .finally(() => setLoadingHistory(false))
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  const canSend =
    message.trim().length > 0 &&
    (target === 'all' || target === 'all_departments' || selectedDeptIds.length > 0)

  const activeUrgencyObj = URGENCY_LEVELS.find((u) => u.id === urgency) || URGENCY_LEVELS[0]

  function handleSend() {
    const finalFormattedMessage = `${activeUrgencyObj.prefix} ${message.trim()}`

    broadcast.mutate(
      {
        message: finalFormattedMessage,
        type: activeUrgencyObj.type,
        label: categoryLabel,
        target,
        departmentIds: target === 'departments' ? selectedDeptIds : undefined,
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
          fetchHistory()
        },
        onError: (err) =>
          addToast({
            title: 'Broadcast not sent',
            message: getErrorMessage(err, 'Could not send the broadcast. Please try again.'),
            variant: 'error',
          }),
      },
    )
  }

  const handleRebroadcast = (record: BroadcastRecord) => {
    // Strip prefix if any
    let cleaned = record.message
    for (const lvl of URGENCY_LEVELS) {
      if (cleaned.startsWith(lvl.prefix)) {
        cleaned = cleaned.slice(lvl.prefix.length).trim()
        setUrgency(lvl.id)
        break
      }
    }
    setMessage(cleaned)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    addToast({ message: 'Loaded previous broadcast into composer', variant: 'success' })
  }

  const handleCopyMessage = (text: string) => {
    void copyText(text)
    addToast({ message: 'Broadcast copied to clipboard', variant: 'success' })
  }

  return (
    <div className="w-full space-y-6 pb-16">
      {/* Header */}
      <PageHeader
        eyebrow="Mission Command & Telemetry"
        title="Operations Broadcast & Alert Center"
        description="Publish real-time operational bulletins, pass telemetry alerts, and critical advisories to connected ground terminals."
      />

      {/* ============================================================ */}
      {/* 1. EXECUTIVE SUMMARY STAT CARDS */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-border-default bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-dim block">
              Total Broadcasts
            </span>
            <strong className="text-2xl font-bold text-white num block mt-0.5">
              {history.length}
            </strong>
            <span className="text-[10px] text-text-dim block">Station bulletins dispatched</span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface border border-border-subtle text-accent-light">
            <Megaphone size={18} />
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-dim block">
              Audience Reach
            </span>
            <strong className="text-2xl font-bold text-nominal num block mt-0.5">
              All Terminals
            </strong>
            <span className="text-[10px] text-text-dim block">Active WebSocket broadcast</span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface border border-border-subtle text-nominal">
            <Users size={18} />
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-dim block">
              Critical Alerts
            </span>
            <strong className="text-2xl font-bold text-critical num block mt-0.5">
              {history.filter((h) => h.message.includes('CRITICAL') || h.type === 'CRITICAL').length}
            </strong>
            <span className="text-[10px] text-text-dim block">Spacecraft anomalies logged</span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface border border-border-subtle text-critical">
            <ShieldAlert size={18} />
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-dim block">
              Tracking Passes
            </span>
            <strong className="text-2xl font-bold text-cyan-300 num block mt-0.5">
              {history.filter((h) => h.message.includes('TELEMETRY') || h.type === 'TELEMETRY').length}
            </strong>
            <span className="text-[10px] text-text-dim block">Pass schedule notifications</span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface border border-border-subtle text-cyan-400">
            <Radio size={18} />
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. MAIN 2-COLUMN LAYOUT: COMPOSER & BROADCAST HISTORY */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Compose Broadcast (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Section 1: Urgency & Priority */}
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

            <div className="pt-3 border-t border-border-subtle space-y-2">
              <label htmlFor="broadcast-category" className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                Category
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  id="broadcast-category"
                  value={categoryLabel}
                  onChange={(e) => setCategoryLabel(e.target.value)}
                  className="flex-1 rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.label}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <div className="flex flex-1 gap-2">
                  <input
                    type="text"
                    value={newCategory}
                    maxLength={40}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddCategory()
                      }
                    }}
                    placeholder="New category name"
                    aria-label="New broadcast category name"
                    className="flex-1 min-w-0 rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-text-primary placeholder:text-text-dim outline-none focus:border-accent"
                  />
                  <Button type="button" variant="outline" size="sm" disabled={!newCategory.trim() || savingCategory} onClick={handleAddCategory}>
                    <Plus size={13} />
                    <span>{savingCategory ? 'Adding…' : 'Add'}</span>
                  </Button>
                </div>
              </div>
              {categories.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {categories
                    .filter((c) => c.id !== 'GENERAL')
                    .map((c) => (
                      <span key={c.id} className="inline-flex items-center gap-1 rounded-full border border-border-default px-2 py-0.5 text-[10px] text-text-secondary">
                        {c.label}
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(c.id, c.label)}
                          aria-label={`Remove category ${c.label}`}
                          title={`Remove category ${c.label}`}
                          className="rounded-full p-0.5 hover:text-critical"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                </div>
              )}
              <p className="text-[10px] text-text-dim">
                Users can filter their Broadcasts feed by this category. Priority (above) controls how urgent it looks.
              </p>
            </div>
          </div>

          {/* Section 2: Notice Content & Quick Templates */}
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
              placeholder="e.g. Aditya-L1 scheduled maneuver tracking pass commences at 18:30 IST. Telemetry stream active on TTC channel 4."
              hint="Keep statements concise and actionable for shift controllers."
            />

            {/* Quick Templates */}
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

            {/* Section 3: Target Audience */}
            <div className="border-t border-border-subtle pt-4 space-y-3">
              <label className="block text-xs font-bold text-text-primary uppercase tracking-wider">
                3. Target Audience
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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

              {/* Specific Departments Select */}
              {target === 'departments' && (
                <div className="mt-3 animate-fadeIn">
                  <DeptMultiSelect
                    selected={selectedDeptIds}
                    onChange={setSelectedDeptIds}
                  />
                </div>
              )}
            </div>

            {/* Dispatch Action Button */}
            <div className="pt-3 border-t border-border-subtle flex items-center justify-between">
              <p className="text-[11px] text-text-dim">
                Will be broadcast live to active station terminals.
              </p>

              <Button
                variant="primary"
                size="md"
                disabled={!canSend || broadcast.isPending}
                onClick={handleSend}
                className="bg-accent hover:bg-accent-hover shadow-lg shadow-accent/25 px-5 font-bold"
              >
                <Send size={14} className={broadcast.isPending ? 'animate-spin' : ''} />
                <span>{broadcast.isPending ? 'Transmitting…' : 'Dispatch Broadcast'}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Broadcast History Feed (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-border-default bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <History size={16} className="text-accent-light" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Broadcast History & Archive
                </h3>
              </div>

              <span className="num text-[10px] text-text-dim font-bold">
                {history.length} Transmissions
              </span>
            </div>

            {historyLabels.length > 1 && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter history by category">
                {['ALL', ...historyLabels].map((label) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={historyFilter === label}
                    onClick={() => setHistoryFilter(label)}
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${
                      historyFilter === label
                        ? 'border-accent bg-accent/15 text-accent-light'
                        : 'border-border-default text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {label === 'ALL' ? 'All' : label}
                  </button>
                ))}
              </div>
            )}

            {loadingHistory ? (
              <div className="p-8 text-center text-xs text-text-dim">
                Loading broadcast archives…
              </div>
            ) : history.length === 0 ? (
              <div className="p-8 text-center space-y-1">
                <p className="text-xs font-bold text-white">No Previous Broadcasts</p>
                <p className="text-[10px] text-text-dim">Past mission transmissions will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {visibleHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-border-subtle bg-[#060c18] space-y-2 hover:border-border-bright transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-accent-light uppercase num flex items-center gap-1">
                        <Clock size={11} />
                        <span>{new Date(item.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(item.message)}
                          className="p-1 rounded text-text-dim hover:text-white hover:bg-surface transition-colors"
                          title="Copy broadcast text"
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRebroadcast(item)}
                          className="p-1 rounded text-accent-light hover:text-white hover:bg-accent/20 transition-colors"
                          title="Load into composer"
                        >
                          <RotateCcw size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRevokeTarget(item)}
                          className="p-1 rounded text-text-dim hover:text-critical hover:bg-critical/10 transition-colors"
                          title="Revoke this broadcast"
                          aria-label="Revoke this broadcast"
                        >
                          <Ban size={12} />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-text-primary leading-relaxed font-mono text-[11px] bg-black/30 p-2 rounded border border-white/5">
                      {item.message}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-text-dim pt-1 border-t border-white/5">
                      <span>Sender: <strong className="text-text-secondary">{item.senderName}</strong></span>
                      <span className="rounded border border-border-default px-1.5 py-0.5 font-semibold text-text-secondary">{item.label || 'General'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleConfirmRevoke}
        title="Revoke this broadcast?"
        message={`The broadcast will be removed from every recipient's notifications and from the public banner. This cannot be undone. Message: "${(revokeTarget?.message || '').slice(0, 140)}"`}
        confirmLabel="Revoke broadcast"
        variant="danger"
        isSubmitting={revoke.isPending}
      />
    </div>
  )
}
