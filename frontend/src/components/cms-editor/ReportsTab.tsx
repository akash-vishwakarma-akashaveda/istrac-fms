import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useCms } from '../../context/cmsContext'
import { usePreviewRefresh } from '../../context/PreviewRefreshContext'
import { useUpdateCmsBlock } from '../../hooks/useUpdateCmsBlock'
import { useToastStore } from '../../store/toastStore'
import { Button, Input, Panel, Textarea } from '..'
import { SaveBar } from './SaveBar'
import type { FeaturedReportItem } from '../FeaturedReports'

const EXTENSIONS = ['BIN', 'DAT', 'PDF', 'CSV', 'LOG']

export function ReportsTab() {
  const { cmsBlocks } = useCms()
  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  const existing = cmsBlocks['featured_reports'] as
    | {
        title?: string
        subtitle?: string
        items?: FeaturedReportItem[]
      }
    | undefined

  const [items, setItems] = useState<FeaturedReportItem[]>([])

  useEffect(() => {
    setItems(existing?.items ?? [])
  }, [existing])

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        id: `rep-${Date.now()}`,
        title: 'New Mission Telemetry Report',
        filename: 'MISSION_TELEMETRY_LOG.bin',
        department: 'TTC',
        satellite: 'Primary Satellite',
        fileSize: '256.0 MB',
        extension: 'BIN',
        date: new Date().toISOString().split('T')[0],
        classification: 'RESTRICTED',
        description: 'Telemetry archive dataset.',
      },
    ])
  }

  function updateItem(index: number, patch: Partial<FeaturedReportItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSave() {
    updateBlock.mutate(
      {
        blockKey: 'featured_reports',
        content: { items },
      },
      {
        onSuccess: () => {
          addToast({ message: 'Featured Reports & Files updated', variant: 'success' })
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
      title="Featured Mission Reports & Files"
      meta={`${items.length} featured file${items.length === 1 ? '' : 's'}`}
      flush
    >
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-border-subtle pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-accent-light">
            Public File Index
          </h3>
          <span className="num text-[11px] text-text-dim">{items.length} files listed</span>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={item.id || index}
              className="rounded-xl border border-border-subtle bg-surface p-3 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="num text-xs font-bold text-accent-light">File 0{index + 1}</span>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  aria-label={`Remove file ${index + 1}`}
                  className="p-1 text-text-dim hover:text-critical"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <Input
                    id={`rep-title-${index}`}
                    label="File Title"
                    value={item.title}
                    onChange={(e) => updateItem(index, { title: e.target.value })}
                  />
                </div>

                <div>
                  <label htmlFor={`rep-ext-${index}`} className="col-label block mb-1.5">
                    File Extension
                  </label>
                  <select
                    id={`rep-ext-${index}`}
                    value={item.extension}
                    onChange={(e) => updateItem(index, { extension: e.target.value })}
                    className="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-xs text-text-primary focus:border-accent"
                  >
                    {EXTENSIONS.map((ext) => (
                      <option key={ext} value={ext}>
                        {ext}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  id={`rep-file-${index}`}
                  label="Filename (Monospace)"
                  value={item.filename}
                  onChange={(e) => updateItem(index, { filename: e.target.value })}
                  className="num font-mono text-xs"
                />

                <Input
                  id={`rep-sat-${index}`}
                  label="Satellite / Mission"
                  value={item.satellite}
                  onChange={(e) => updateItem(index, { satellite: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Input
                  id={`rep-dept-${index}`}
                  label="Department"
                  value={item.department}
                  onChange={(e) => updateItem(index, { department: e.target.value })}
                />

                <Input
                  id={`rep-size-${index}`}
                  label="File Size"
                  value={item.fileSize}
                  onChange={(e) => updateItem(index, { fileSize: e.target.value })}
                  className="num"
                />

                <Input
                  id={`rep-date-${index}`}
                  label="Release Date"
                  value={item.date}
                  onChange={(e) => updateItem(index, { date: e.target.value })}
                  className="num"
                />
              </div>

              <Textarea
                id={`rep-desc-${index}`}
                label="Description & Telemetry Parameters"
                rows={2}
                value={item.description || ''}
                onChange={(e) => updateItem(index, { description: e.target.value })}
              />
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full">
          <Plus size={13} strokeWidth={2.2} />
          Add Featured File to Index
        </Button>

        <SaveBar onSave={handleSave} isPending={updateBlock.isPending} />
      </div>
    </Panel>
  )
}
