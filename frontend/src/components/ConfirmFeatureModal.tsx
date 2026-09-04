import { useState } from 'react'
import { Star, AlertTriangle, RefreshCw, CheckCircle2, ShieldAlert } from 'lucide-react'
import { Modal, Button } from '.'
import { filesApi } from '../api/files.api'
import { useToastStore } from '../store/toastStore'

interface ConfirmFeatureModalProps {
  isOpen: boolean
  file: { id: string; name: string; isFeatured?: boolean } | null
  onClose: () => void
  onSuccess: (updated: { id: string; isFeatured: boolean }) => void
}

export function ConfirmFeatureModal({ isOpen, file, onClose, onSuccess }: ConfirmFeatureModalProps) {
  const addToast = useToastStore((s) => s.addToast)
  const [loading, setLoading] = useState(false)

  if (!file) return null

  const isCurrentlyFeatured = Boolean(file.isFeatured)

  async function handleConfirm() {
    if (!file) return
    setLoading(true)
    try {
      const res = await filesApi.toggleFeature(file.id, !isCurrentlyFeatured)
      addToast({
        title: isCurrentlyFeatured ? 'Removed from Featured' : 'Featured in Mission Reports',
        message: res.message || (isCurrentlyFeatured ? `${file.name} removed from public showcase` : `${file.name} is now showcased in public Mission Reports`),
        variant: 'success',
      })
      onSuccess(res)
      onClose()
    } catch (err: any) {
      addToast({
        title: 'Action Failed',
        message: err.response?.data?.error?.message || err.message || 'Could not update featured status',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isCurrentlyFeatured ? 'Remove from Featured Reports' : 'Feature Mission Report'}
      size="sm"
    >
      <div className="space-y-4">
        {/* Header Icon + Summary */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border-default bg-[#060c18]">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
            isCurrentlyFeatured
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
              : 'border-accent/30 bg-accent/10 text-accent-light'
          }`}>
            <Star size={20} className={isCurrentlyFeatured ? 'fill-amber-400' : ''} />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-white truncate">{file.name}</h4>
            <span className={`inline-flex items-center gap-1 mt-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
              isCurrentlyFeatured
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                : 'bg-accent/15 border-accent/30 text-accent-light'
            }`}>
              {isCurrentlyFeatured ? 'Currently Publicly Featured' : 'Standard Department File'}
            </span>
          </div>
        </div>

        {/* Informative Explanation */}
        <div className={`p-3.5 rounded-xl border text-xs leading-relaxed space-y-2 ${
          isCurrentlyFeatured
            ? 'border-amber-500/20 bg-amber-500/5 text-text-secondary'
            : 'border-accent/20 bg-accent/5 text-text-secondary'
        }`}>
          <div className="flex items-center gap-1.5 font-bold text-white">
            {isCurrentlyFeatured ? <AlertTriangle size={13} className="text-amber-400 shrink-0" /> : <CheckCircle2 size={13} className="text-accent-light shrink-0" />}
            <span>{isCurrentlyFeatured ? 'Unfeaturing this file:' : 'Featuring this file:'}</span>
          </div>
          <p>
            {isCurrentlyFeatured
              ? 'This report will be removed from the public Featured Mission Reports section. It will revert to standard security clearance access and will no longer be viewable or downloadable without user login.'
              : 'This report will be showcased in the public Featured Mission Reports showcase. Visitors and flight operators can view it in-browser without logging in, or download the raw dataset directly if visual rendering is not supported.'}
          </p>
        </div>

        {/* Security Note */}
        <div className="flex items-center gap-2 px-1 text-[11px] text-text-dim font-mono">
          <ShieldAlert size={12} className="text-accent-light shrink-0" />
          <span>Requires Read & Write clearance or Administrator privileges</span>
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-border-subtle flex items-center justify-end gap-2.5">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={loading}
            className={isCurrentlyFeatured ? 'bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/20' : 'bg-accent hover:bg-accent-hover shadow-md shadow-accent/20'}
          >
            {loading ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Processing…</span>
              </>
            ) : isCurrentlyFeatured ? (
              <>
                <Star size={13} />
                <span>Confirm & Unfeature</span>
              </>
            ) : (
              <>
                <Star size={13} className="fill-white" />
                <span>Confirm & Feature Report</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
