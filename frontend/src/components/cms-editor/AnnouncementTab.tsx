import { useEffect, useState } from 'react'
import { Sliders, Eye, Megaphone, Radio, FolderArchive, ArrowRight, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCms } from '../../context/cmsContext'
import { usePreviewRefresh } from '../../context/PreviewRefreshContext'
import { useUpdateCmsBlock } from '../../hooks/useUpdateCmsBlock'
import { useToastStore } from '../../store/toastStore'
import { Panel } from '..'
import { SaveBar } from './SaveBar'

interface AnnouncementContent {
  visible?: boolean
  maxBannerItems?: number
  autoScrollSeconds?: number
  showModalButton?: boolean
}

export function AnnouncementTab() {
  const { cmsBlocks } = useCms()
  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  const existing = cmsBlocks['announcements'] as AnnouncementContent | undefined

  const [visible, setVisible] = useState(true)
  const [maxBannerItems, setMaxBannerItems] = useState(10)
  const [autoScrollSeconds, setAutoScrollSeconds] = useState(5)
  const [showModalButton, setShowModalButton] = useState(true)

  useEffect(() => {
    setVisible(existing?.visible ?? true)
    setMaxBannerItems(existing?.maxBannerItems ?? 10)
    setAutoScrollSeconds(existing?.autoScrollSeconds ?? 5)
    setShowModalButton(existing?.showModalButton ?? true)
  }, [existing])

  function handleSave() {
    updateBlock.mutate(
      {
        blockKey: 'announcements',
        content: {
          visible,
          maxBannerItems: Number(maxBannerItems) || 10,
          autoScrollSeconds: Number(autoScrollSeconds) || 5,
          showModalButton,
        },
      },
      {
        onSuccess: () => {
          addToast({
            title: 'Ticker Settings Saved',
            message: `Notice banner updated: Max ${maxBannerItems} visible items, ${autoScrollSeconds}s cycle speed.`,
            variant: 'success',
          })
          triggerRefresh()
        },
        onError: () => {
          addToast({ message: 'Failed to save announcement settings', variant: 'error' })
        },
      }
    )
  }

  return (
    <Panel title="Operational Notices & Top Ticker" meta="block:announcements" flush>
      <div className="p-4 space-y-6">
        {/* Banner Visibility */}
        <div
          className={`border-l-2 pl-3.5 transition-colors duration-150 ${
            visible ? 'border-l-nominal' : 'border-l-border-subtle'
          }`}
        >
          <label htmlFor="announcement-visible" className="col-label flex items-center gap-1.5">
            <Eye size={13} />
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
              Display the live notice ticker banner below the navbar across the landing page and authenticated console
            </span>
          </div>
        </div>

        {/* Banner Limits & Display Controls */}
        <div className="rounded-xl border border-border-default bg-[#070e1c] p-4 space-y-4 shadow-sm">
          <h4 className="text-xs font-bold uppercase tracking-wider text-accent-light flex items-center gap-2">
            <Sliders size={14} />
            <span>Banner Display Limits & Cycle Control</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Max Items in Ticker */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-text-primary">
                Max Notices Visible in Banner Ticker
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={maxBannerItems}
                  onChange={(e) => setMaxBannerItems(Math.max(1, Number(e.target.value) || 1))}
                  className="w-20 rounded-lg border border-border-default bg-surface px-3 py-1.5 text-xs font-mono font-bold text-white focus:border-accent focus:outline-none"
                />
                <div className="flex items-center gap-1">
                  {[5, 10, 15, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setMaxBannerItems(num)}
                      className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                        maxBannerItems === num
                          ? 'bg-accent text-white shadow-sm'
                          : 'bg-surface hover:bg-white/10 text-text-dim hover:text-white'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-text-dim">
                Limits how many notices cycle in the top ticker (default: 10). Any remaining notices are accessible via the "All Notices" drawer modal or the nav.
              </p>
            </div>

            {/* Cycle Speed */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-text-primary">
                Auto-Cycle Speed (Seconds)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={2}
                  max={30}
                  value={autoScrollSeconds}
                  onChange={(e) => setAutoScrollSeconds(Math.max(2, Number(e.target.value) || 2))}
                  className="w-20 rounded-lg border border-border-default bg-surface px-3 py-1.5 text-xs font-mono font-bold text-white focus:border-accent focus:outline-none"
                />
                <div className="flex items-center gap-1">
                  {[3, 5, 8, 10].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setAutoScrollSeconds(sec)}
                      className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                        autoScrollSeconds === sec
                          ? 'bg-accent text-white shadow-sm'
                          : 'bg-surface hover:bg-white/10 text-text-dim hover:text-white'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-text-dim">
                Duration each notice remains on screen before automatically advancing to the next.
              </p>
            </div>
          </div>

          {/* Modal Button Toggle */}
          <div className="pt-2 border-t border-border-subtle">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showModalButton}
                onChange={(e) => setShowModalButton(e.target.checked)}
                className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-accent"
              />
              <span className="text-xs text-text-secondary">
                Show <strong>"All Notices (X)"</strong> button to open the full drawer modal with category filters and search
              </span>
            </label>
          </div>
        </div>

        {/* Live Database Data Source Architecture */}
        <div className="rounded-xl border border-border-default bg-[#081122] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-nominal" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Automated Live Database Feed
            </h4>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            The notice banner does not use static text. It automatically pulls and synchronizes real-time operational messages directly from the database:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="rounded-lg border border-border-subtle bg-surface/80 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-accent-light font-bold text-xs">
                <Megaphone size={14} />
                <span>Station Broadcasts</span>
              </div>
              <p className="text-[11px] text-text-dim">
                Emergency bulletins and operational station notices.
              </p>
              <Link
                to="/admin/broadcast"
                className="text-[11px] font-bold text-accent-light hover:underline inline-flex items-center gap-1 pt-1"
              >
                <span>Broadcast Alert</span>
                <ArrowRight size={11} />
              </Link>
            </div>

            <div className="rounded-lg border border-border-subtle bg-surface/80 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[#FF8533] font-bold text-xs">
                <Radio size={14} />
                <span>Passes & Events</span>
              </div>
              <p className="text-[11px] text-text-dim">
                Upcoming spacecraft tracking passes and maneuvers.
              </p>
              <Link
                to="/admin/events"
                className="text-[11px] font-bold text-[#FF8533] hover:underline inline-flex items-center gap-1 pt-1"
              >
                <span>Events Calendar</span>
                <ArrowRight size={11} />
              </Link>
            </div>

            <div className="rounded-lg border border-border-subtle bg-surface/80 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-purple-400 font-bold text-xs">
                <FolderArchive size={14} />
                <span>Telemetry Ingests</span>
              </div>
              <p className="text-[11px] text-text-dim">
                Automated notifications when files are ingested into RAID.
              </p>
              <Link
                to="/notifications"
                className="text-[11px] font-bold text-purple-400 hover:underline inline-flex items-center gap-1 pt-1"
              >
                <span>View Live Feed</span>
                <ArrowRight size={11} />
              </Link>
            </div>
          </div>
        </div>

        <SaveBar onSave={handleSave} isPending={updateBlock.isPending} />
      </div>
    </Panel>
  )
}
