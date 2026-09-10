import { useEffect, useState } from 'react'
import { useCms } from '../../context/cmsContext'
import { usePreviewRefresh } from '../../context/PreviewRefreshContext'
import { useUpdateCmsBlock } from '../../hooks/useUpdateCmsBlock'
import { useToastStore } from '../../store/toastStore'
import { Input, Panel, Textarea } from '..'
import { SaveBar } from './SaveBar'

interface AccessPanelContent {
  facilitiesTitle?: string
  facilitiesDesc?: string
  reportsTitle?: string
  reportsDesc?: string
}

export function AccessPanelTab() {
  const { cmsBlocks } = useCms()
  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  const existing = cmsBlocks['access_panel'] as AccessPanelContent | undefined

  const [facilitiesTitle, setFacilitiesTitle] = useState('')
  const [facilitiesDesc, setFacilitiesDesc] = useState('')
  const [reportsTitle, setReportsTitle] = useState('')
  const [reportsDesc, setReportsDesc] = useState('')

  useEffect(() => {
    setFacilitiesTitle(existing?.facilitiesTitle ?? 'Multi-Facility Ground Network')
    setFacilitiesDesc(
      existing?.facilitiesDesc ??
        'ISTRAC telemetry feeds and command uplinks are distributed across primary centres and international downrange tracking stations.'
    )
    setReportsTitle(existing?.reportsTitle ?? 'Department Repositories & Flight Reports')
    setReportsDesc(
      existing?.reportsDesc ??
        'Log in with your ISTRAC credentials to access department-segregated mission logs, orbit ephemeris, and telemetry data files.'
    )
  }, [existing])

  function handleSave() {
    updateBlock.mutate(
      {
        blockKey: 'access_panel',
        content: {
          facilitiesTitle,
          facilitiesDesc,
          reportsTitle,
          reportsDesc,
        },
      },
      {
        onSuccess: () => {
          addToast({ message: 'Access & Facilities panel updated', variant: 'success' })
          triggerRefresh()
        },
        onError: () => {
          addToast({ message: 'Failed to save', variant: 'error' })
        },
      }
    )
  }

  return (
    <Panel title="Multi-Facility & Access Panel" meta="block:access_panel">
      <div className="space-y-6">
        {/* Facilities Card Left */}
        <div className="space-y-4">
          <h4 className="eyebrow text-accent-light">Left Card: Ground Facilities Scoping</h4>

          <Input
            id="fac-title"
            label="Facilities Section Title"
            value={facilitiesTitle}
            onChange={(e) => setFacilitiesTitle(e.target.value)}
            placeholder="e.g. Multi-Facility Ground Network"
          />

          <Textarea
            id="fac-desc"
            label="Facilities Description"
            rows={2}
            value={facilitiesDesc}
            onChange={(e) => setFacilitiesDesc(e.target.value)}
            placeholder="Enter facility distribution description..."
          />
        </div>

        {/* Reports Gate Right */}
        <div className="space-y-4 border-t border-border-subtle pt-5">
          <h4 className="eyebrow text-warning">Right Card: Reports & Auth Gate</h4>

          <Input
            id="rep-title"
            label="Reports Gate Title"
            value={reportsTitle}
            onChange={(e) => setReportsTitle(e.target.value)}
            placeholder="e.g. Department Repositories & Flight Reports"
          />

          <Textarea
            id="rep-desc"
            label="Reports Gate Description"
            rows={2}
            value={reportsDesc}
            onChange={(e) => setReportsDesc(e.target.value)}
            placeholder="Enter authorization details..."
          />
        </div>

        <SaveBar onSave={handleSave} isPending={updateBlock.isPending} />
      </div>
    </Panel>
  )
}
