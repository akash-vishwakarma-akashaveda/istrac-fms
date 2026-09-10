/**
 * CmsImageInput
 * Reusable image field for CMS editor tabs.
 * Combines a URL text input with a local-file upload button.
 * On upload the file is sent to POST /cms/upload-asset and the
 * returned URL is written back to the parent via onChange.
 */
import { useRef, useState } from 'react'
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react'
import { cmsApi } from '../../api'
import { useToastStore } from '../../store/toastStore'

interface CmsImageInputProps {
  /** Current URL value (controlled) */
  value: string
  /** Called whenever the URL changes (typed or after successful upload) */
  onChange: (url: string) => void
  /** Label shown above the field */
  label?: string
  /** Small hint below the field */
  hint?: string
  /** Input placeholder */
  placeholder?: string
  /** Optional extra classname on the wrapper */
  className?: string
  /** Input id for accessibility */
  id?: string
}

function isSafeUrl(url: string) {
  return /^(https?:\/\/|\/)/i.test(url.trim())
}

export function CmsImageInput({
  value,
  onChange,
  label,
  hint,
  placeholder = 'https://... or /media/cms-assets/...',
  className = '',
  id,
}: CmsImageInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const addToast = useToastStore((s) => s.addToast)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset so the same file can be re-uploaded if needed
    e.target.value = ''

    setUploading(true)
    try {
      const data = await cmsApi.uploadAsset(file)
      const url = data?.url ?? ''
      if (!url) throw new Error('Server returned no URL')

      onChange(url)
      addToast({ message: 'Image uploaded successfully', variant: 'success' })
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Upload failed'
      addToast({ message: errorMsg, variant: 'error' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-[11px] font-medium text-text-dim"
        >
          {label}
        </label>
      )}

      {/* Input row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <input
            id={id}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-md border border-border-default bg-[#09101f] px-3 py-2 pr-8 text-[11px] text-white font-mono outline-none focus:border-accent transition-colors"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-dim hover:text-white transition-colors"
              title="Clear"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Upload button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Upload image from your computer"
          className="shrink-0 flex items-center gap-1.5 rounded-md border border-border-default bg-surface px-3 py-2 text-[11px] text-text-secondary hover:border-accent hover:text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Upload size={13} />
          )}
          {uploading ? 'Uploading…' : 'Browse'}
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {hint && <p className="text-[10px] text-text-dim">{hint}</p>}

      {/* Preview */}
      {value && isSafeUrl(value) && (
        <div className="relative mt-1 h-20 w-full overflow-hidden rounded-md border border-border-subtle">
          <img
            src={value}
            alt="Preview"
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
          <span className="absolute bottom-1 left-2 flex items-center gap-1 text-[9px] text-white/60 font-mono">
            <ImageIcon size={9} /> preview
          </span>
        </div>
      )}
    </div>
  )
}
