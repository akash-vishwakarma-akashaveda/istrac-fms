import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useCms } from '../../context/cmsContext'
import { usePreviewRefresh } from '../../context/PreviewRefreshContext'
import { useUpdateCmsBlock } from '../../hooks/useUpdateCmsBlock'
import { useToastStore } from '../../store/toastStore'
import { Button, Input, Panel, Textarea } from '..'
import { SaveBar } from './SaveBar'

interface FeatureItem {
  icon: string
  title: string
  description: string
  visible: boolean
}

interface FeatureStripContent {
  items?: FeatureItem[]
}

const AVAILABLE_ICONS = ['Radio', 'Satellite', 'Cpu', 'Shield', 'Globe', 'Clock', 'Search', 'Database', 'Lock']

export function CapabilitiesTab() {
  const { cmsBlocks } = useCms()
  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  const existing = cmsBlocks['feature_strip'] as FeatureStripContent | undefined
  const [items, setItems] = useState<FeatureItem[]>([])

  useEffect(() => {
    setItems(existing?.items ?? [])
  }, [existing])

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        icon: 'Radio',
        title: '',
        description: '',
        visible: true,
      },
    ])
  }

  function updateItem(index: number, patch: Partial<FeatureItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSave() {
    updateBlock.mutate(
      {
        blockKey: 'feature_strip',
        content: { items },
      },
      {
        onSuccess: () => {
          addToast({ message: 'ISTRAC Capabilities updated', variant: 'success' })
          triggerRefresh()
        },
        onError: () => {
          addToast({ message: 'Failed to save', variant: 'error' })
        },
      },
    )
  }

  return (
    <Panel
      title="ISTRAC Core Capabilities"
      meta={`${items.length} capability item${items.length === 1 ? '' : 's'}`}
      flush
    >
      <div className="divide-y divide-border-subtle">
        {items.map((item, index) => (
          <div key={index} className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="num text-xs font-bold text-accent-light">
                Capability 0{index + 1}
              </span>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={item.visible}
                    onChange={(e) => updateItem(index, { visible: e.target.checked })}
                    className="h-3.5 w-3.5 rounded accent-accent"
                  />
                  <span>Active</span>
                </label>

                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  aria-label={`Remove capability ${index + 1}`}
                  className="rounded p-1 text-text-dim transition-colors hover:bg-critical-bg hover:text-critical"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Input
                  id={`cap-title-${index}`}
                  label="Title"
                  value={item.title}
                  onChange={(e) => updateItem(index, { title: e.target.value })}
                  placeholder="e.g. Telemetry, Tracking & Command"
                />
              </div>

              <div>
                <label htmlFor={`cap-icon-${index}`} className="col-label block mb-1.5">
                  Icon
                </label>
                <select
                  id={`cap-icon-${index}`}
                  value={item.icon}
                  onChange={(e) => updateItem(index, { icon: e.target.value })}
                  className="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-xs text-text-primary focus:border-accent"
                >
                  {AVAILABLE_ICONS.map((ic) => (
                    <option key={ic} value={ic}>
                      {ic}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Textarea
              id={`cap-desc-${index}`}
              label="Description"
              rows={2}
              value={item.description}
              onChange={(e) => updateItem(index, { description: e.target.value })}
              placeholder="Enter ISTRAC mission capability details..."
            />
          </div>
        ))}

        {items.length === 0 && (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-text-secondary">No capabilities configured yet.</p>
            <p className="num mt-1 text-xs text-text-dim">Add an item to display in the core capabilities grid.</p>
          </div>
        )}
      </div>

      <div className="space-y-4 border-t border-border-subtle p-4">
        <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full">
          <Plus size={13} strokeWidth={2.2} />
          Add ISTRAC Capability
        </Button>

        <SaveBar onSave={handleSave} isPending={updateBlock.isPending} />
      </div>
    </Panel>
  )
}
