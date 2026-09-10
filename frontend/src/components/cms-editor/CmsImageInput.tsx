import { useEffect, useRef, useState } from 'react'
import { Upload, X, ImageIcon, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
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
  const trimmed = url.trim()
  return /^(https?:\/\/|\/|blob:)/i.test(trimmed)
}

function getResolvedMediaUrl(url: string): string {
  if (!url) return ''
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (/^(https?:\/\/|blob:)/i.test(trimmed)) return trimmed

  // If URL is a relative path like /media/... or /cms-assets/...
  if (trimmed.startsWith('/media/') || trimmed.startsWith('/cms-assets/')) {
    const apiUrl = import.meta.env.VITE_API_URL
    if (apiUrl && /^https?:\/\//i.test(apiUrl)) {
      try {
        const origin = new URL(apiUrl).origin
        return `${origin}${trimmed}`
      } catch {
        // Fall back to trimmed relative URL
      }
    }
  }
  return trimmed
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
  const [loadError, setLoadError] = useState(false)
  const [blobPreview, setBlobPreview] = useState<string | null>(null)
  const addToast = useToastStore((s) => s.addToast)

  // Reset load error when value changes
  useEffect(() => {
    setLoadError(false)
  }, [value])

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobPreview) {
        URL.revokeObjectURL(blobPreview)
      }
    }
  }, [blobPreview])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    // Immediate instant local preview before upload finishes
    const localUrl = URL.createObjectURL(file)
    setBlobPreview(localUrl)
    setLoadError(false)

    setUploading(true)
    try {
      const data = await cmsApi.uploadAsset(file)
      const url = (data?.url ?? '').trim()
      if (!url) throw new Error('Server returned no valid media URL')

      onChange(url)
      addToast({ message: `Image uploaded successfully (${data.filename})`, variant: 'success' })
    } catch (err: any) {
      let errorMsg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Upload failed'

      if (
        typeof errorMsg === 'string' &&
        (errorMsg.includes('<!doctype') ||
          errorMsg.includes('<!DOCTYPE') ||
          errorMsg.includes('Unexpected token') ||
          errorMsg.includes('returned HTML'))
      ) {
        errorMsg =
          'Backend upload service unreachable. Please ensure the backend server is running and reverse proxy is configured.'
      }

      addToast({ message: errorMsg, variant: 'error' })
    } finally {
      setUploading(false)
    }
  }

  const previewSrc = blobPreview || getResolvedMediaUrl(value)

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
            onChange={(e) => {
              // Strip carriage returns and leading spaces
              onChange(e.target.value.replace(/[\r\n\t]/g, '').trimStart())
            }}
            onBlur={() => {
              // Fully trim on blur
              if (value !== value.trim()) {
                onChange(value.trim())
              }
            }}
            placeholder={placeholder}
            className="w-full rounded-md border border-border-default bg-[#09101f] px-3 py-2 pr-8 text-[11px] text-white font-mono outline-none focus:border-accent transition-colors"
          />
          {value && (
            <button
              type="button"
              onClick={() => {
                setBlobPreview(null)
                onChange('')
              }}
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
          className="shrink-0 flex items-center gap-1.5 rounded-md border border-border-default bg-surface px-3 py-2 text-[11px] text-text-secondary hover:border-accent hover:text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {uploading ? (
            <Loader2 size={13} className="animate-spin text-accent" />
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

      {/* Image Preview Box */}
      {previewSrc && isSafeUrl(previewSrc) && (
        <div className="relative mt-1 h-24 w-full overflow-hidden rounded-lg border border-border-subtle bg-[#050914]">
          {loadError ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-surface/40 p-3 text-center text-text-dim">
              <AlertCircle size={16} className="text-warning/80" />
              <span className="text-[10px] text-text-muted">Preview could not be rendered</span>
              <span className="font-mono text-[9px] text-text-dim max-w-[85%] truncate">{value}</span>
            </div>
          ) : (
            <>
              <img
                src={previewSrc}
                alt="Preview"
                className="h-full w-full object-cover transition-opacity duration-200"
                onLoad={() => setLoadError(false)}
                onError={() => setLoadError(true)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-1.5 left-2.5 right-2.5 flex items-center justify-between text-[9px] text-white/80 font-mono">
                <span className="flex items-center gap-1">
                  <ImageIcon size={10} className="text-accent-light" />
                  <span>preview</span>
                </span>
                {blobPreview && (
                  <span className="flex items-center gap-1 text-nominal bg-black/50 px-1.5 py-0.5 rounded border border-nominal/30">
                    <CheckCircle2 size={9} /> local selected
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
