import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useCms } from '../../context/cmsContext'
import { usePreviewRefresh } from '../../context/PreviewRefreshContext'
import { useUpdateCmsBlock } from '../../hooks/useUpdateCmsBlock'
import { useToastStore } from '../../store/toastStore'
import { Button, Input, Panel } from '..'
import { SaveBar } from './SaveBar'
import { CmsImageInput } from './CmsImageInput'

interface GalleryItem {
  url: string
  label: string
  caption: string
}

interface GalleryContent {
  items?: GalleryItem[]
}

export function GalleryTab() {
  const { cmsBlocks } = useCms()
  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  const existing = cmsBlocks['gallery'] as GalleryContent | undefined

  const [items, setItems] = useState<GalleryItem[]>([])

  useEffect(() => {
    setItems(existing?.items ?? [])
  }, [existing])

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        url: '',
        label: '',
        caption: '',
      },
    ])
  }

  function updateItem(index: number, patch: Partial<GalleryItem>) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    )
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSave() {
    updateBlock.mutate(
      {
        blockKey: 'gallery',
        content: { items },
      },
      {
        onSuccess: () => {
          addToast({ message: 'Gallery updated', variant: 'success' })
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
      title="Gallery"
      meta={`${items.length} image${items.length === 1 ? '' : 's'}`}
      flush
    >
      {/* Gallery items */}
      <div className="divide-y divide-border-subtle">
        {items.map((item, index) => (
          <div key={index} className="flex items-start gap-3 p-4">
            <span className="num mt-2 shrink-0 text-[11px] text-text-dim">
              {String(index + 1).padStart(2, '0')}
            </span>

            {/* Fields */}
            <div className="min-w-0 flex-1 space-y-3">
              <CmsImageInput
                id={`gallery-url-${index}`}
                label="Image URL"
                value={item.url}
                onChange={(url) => updateItem(index, { url })}
                placeholder="https://... or /media/cms-assets/..."
                hint="Paste a URL or click Browse to upload from your computer."
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  id={`gallery-label-${index}`}
                  label="Label"
                  value={item.label}
                  onChange={(e) =>
                    updateItem(index, { label: e.target.value })
                  }
                  placeholder="Image label"
                />

                <Input
                  id={`gallery-caption-${index}`}
                  label="Caption"
                  value={item.caption}
                  onChange={(e) =>
                    updateItem(index, { caption: e.target.value })
                  }
                  placeholder="Image caption"
                />
              </div>
            </div>

            {/* Remove */}
            <button
              type="button"
              onClick={() => removeItem(index)}
              aria-label={`Remove image ${index + 1}`}
              className="mt-1 shrink-0 rounded-md border border-transparent p-1.5 text-text-dim transition-colors duration-150 hover:border-critical/30 hover:bg-critical-bg hover:text-critical"
            >
              <Trash2 size={14} strokeWidth={1.8} />
            </button>
          </div>
        ))}

        {/* Empty state */}
        {items.length === 0 && (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-text-secondary">
              No gallery images yet.
            </p>

            <p className="mt-1.5 text-[12px] text-text-dim">
              Add an image to start building the landing page gallery.
            </p>
          </div>
        )}
      </div>

      {/* Add + save */}
      <div className="space-y-4 border-t border-border-subtle p-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          className="w-full"
        >
          <Plus size={13} strokeWidth={2.2} />
          Add image
        </Button>

        <SaveBar
          onSave={handleSave}
          isPending={updateBlock.isPending}
        />
      </div>
    </Panel>
  )
}
