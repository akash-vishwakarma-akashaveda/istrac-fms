import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useCms } from '../../context/cmsContext'
import { usePreviewRefresh } from '../../context/PreviewRefreshContext'
import { useUpdateCmsBlock } from '../../hooks/useUpdateCmsBlock'
import { useToastStore } from '../../store/toastStore'
import { Button, Input, Panel, Textarea } from '..'
import { SaveBar } from './SaveBar'

interface AnnouncementItem {
  id: string
  title?: string
  message: string
  category?: string
  timestamp?: string
}

interface AnnouncementContent {
  visible?: boolean
  text?: string
  backgroundColor?: string
  items?: AnnouncementItem[]
}

const CATEGORIES = ['MISSION', 'PASS', 'MAINTENANCE', 'SECURITY', 'RELAY', 'GENERAL']

export function AnnouncementTab() {
  const { cmsBlocks } = useCms()
  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  const existing = cmsBlocks['announcements'] as AnnouncementContent | undefined

  const [visible, setVisible] = useState(true)
  const [text, setText] = useState('')
  const [items, setItems] = useState<AnnouncementItem[]>([])

  useEffect(() => {
    setVisible(existing?.visible ?? true)
    setText(existing?.text ?? '')
    setItems(existing?.items ?? [])
  }, [existing])

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        id: `ann-${Date.now()}`,
        title: 'New Mission Notice',
        message: 'Telemetry downlink status nominal.',
        category: 'MISSION',
        timestamp: 'Just Now',
      },
    ])
  }

  function updateItem(index: number, patch: Partial<AnnouncementItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSave() {
    updateBlock.mutate(
      {
        blockKey: 'announcements',
        content: {
          visible,
          text: items[0]?.message || text,
          items,
        },
      },
      {
        onSuccess: () => {
          addToast({ message: 'Operational Notices & Ticker updated', variant: 'success' })
          triggerRefresh()
        },
        onError: () => {
          addToast({ message: 'Failed to save', variant: 'error' })
        },
      }
    )
  }

  return (
    <Panel title="Operational Notices & Top Ticker" meta="block:announcements" flush>
      <div className="p-4 space-y-5">
        {/* Visibility */}
        <div
          className={`border-l-2 pl-3.5 transition-colors duration-150 ${
            visible ? 'border-l-nominal' : 'border-l-border-subtle'
          }`}
        >
          <label htmlFor="announcement-visible" className="col-label">
            Banner Visibility
          </label>
          <div className="mt-2 flex items-center gap-2.5">
            <input
              id="announcement-visible"
              type="checkbox"
              checked={visible}
              onChange={(e) => setVisible(e.target.checked)}
              className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-accent"
            />
            <span className="text-[13px] text-text-secondary">
              Display the multi-notice cycling banner below the navbar
            </span>
          </div>
        </div>

        {/* List of Recent 5 Notifications */}
        <div className="space-y-3 pt-3 border-t border-border-subtle">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-accent-light">
              Notice Ticker Feed ({items.length} items)
            </h4>
            <span className="num text-[10px] text-text-dim">Top 5 displayed in banner</span>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={item.id || index}
                className="rounded-xl border border-border-subtle bg-surface p-3 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="num text-xs font-bold text-accent-light">
                    Notice 0{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    aria-label={`Remove notice ${index + 1}`}
                    className="p-1 text-text-dim hover:text-critical"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <Input
                      id={`notif-title-${index}`}
                      label="Title / Headline"
                      value={item.title || ''}
                      onChange={(e) => updateItem(index, { title: e.target.value })}
                    />
                  </div>

                  <div>
                    <label htmlFor={`notif-cat-${index}`} className="col-label block mb-1.5">
                      Category
                    </label>
                    <select
                      id={`notif-cat-${index}`}
                      value={item.category || 'MISSION'}
                      onChange={(e) => updateItem(index, { category: e.target.value })}
                      className="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-xs text-text-primary focus:border-accent"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <Textarea
                  id={`notif-msg-${index}`}
                  label="Notice Message"
                  rows={2}
                  value={item.message}
                  onChange={(e) => updateItem(index, { message: e.target.value })}
                />

                <Input
                  id={`notif-time-${index}`}
                  label="Timestamp Label"
                  value={item.timestamp || ''}
                  onChange={(e) => updateItem(index, { timestamp: e.target.value })}
                  placeholder="e.g. 15 Mins Ago"
                  className="num"
                />
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full">
            <Plus size={13} strokeWidth={2.2} />
            Add Notice to Ticker
          </Button>
        </div>

        <SaveBar onSave={handleSave} isPending={updateBlock.isPending} />
      </div>
    </Panel>
  )
}
