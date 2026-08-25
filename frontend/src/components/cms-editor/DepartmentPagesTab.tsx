import { useEffect, useState } from 'react'
import { useCms } from '../../context/cmsContext'
import { usePreviewRefresh } from '../../context/PreviewRefreshContext'
import { useUpdateCmsBlock } from '../../hooks/useUpdateCmsBlock'
import { useToastStore } from '../../store/toastStore'
import { departmentsApi, type Department } from '../../api/departments.api'
import { Input, Panel, Textarea } from '..'
import { SaveBar } from './SaveBar'

interface DepartmentCmsData {
  labLead?: string
  roomLocation?: string
  facilities?: string[]
  customMandate?: string
}

interface DepartmentPagesBlock {
  customContent?: Record<string, DepartmentCmsData>
}

export function DepartmentPagesTab() {
  const { cmsBlocks } = useCms()
  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDeptId, setSelectedDeptId] = useState<string>('')

  const existing = cmsBlocks['department_pages'] as DepartmentPagesBlock | undefined
  const [allContent, setAllContent] = useState<Record<string, DepartmentCmsData>>({})

  useEffect(() => {
    departmentsApi.getPublicDepartments().then((list) => {
      setDepartments(list || [])
      if (list && list.length > 0 && !selectedDeptId) {
        setSelectedDeptId(list[0].id)
      }
    })
  }, [])

  useEffect(() => {
    setAllContent(existing?.customContent ?? {})
  }, [existing])

  const currentData = selectedDeptId ? allContent[selectedDeptId] || {} : {}

  function updateCurrent(patch: Partial<DepartmentCmsData>) {
    if (!selectedDeptId) return
    setAllContent((prev) => ({
      ...prev,
      [selectedDeptId]: {
        ...(prev[selectedDeptId] || {}),
        ...patch,
      },
    }))
  }

  function handleSave() {
    updateBlock.mutate(
      {
        blockKey: 'department_pages',
        content: { customContent: allContent },
      },
      {
        onSuccess: () => {
          addToast({ message: 'Department page CMS content updated', variant: 'success' })
          triggerRefresh()
        },
        onError: () => {
          addToast({ message: 'Failed to save', variant: 'error' })
        },
      }
    )
  }

  return (
    <Panel title="Department Public Pages CMS" meta="block:department_pages">
      <div className="space-y-6">
        {/* Department Selector */}
        <div>
          <label htmlFor="dept-select" className="col-label block mb-1.5">
            Select Department to Edit
          </label>
          <select
            id="dept-select"
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
            className="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-xs text-text-primary focus:border-accent"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} {d.code ? `(${d.code})` : ''}
              </option>
            ))}
          </select>
        </div>

        {selectedDeptId ? (
          <div className="space-y-4 border-t border-border-subtle pt-4">
            <Input
              id="dept-lead"
              label="Division Lead / Operations Officer"
              value={currentData.labLead || ''}
              onChange={(e) => updateCurrent({ labLead: e.target.value })}
              placeholder="e.g. Dr. S. Rao, Group Director, FDD"
            />

            <Input
              id="dept-location"
              label="Facility & Lab Location"
              value={currentData.roomLocation || ''}
              onChange={(e) => updateCurrent({ roomLocation: e.target.value })}
              placeholder="e.g. MOX-2 Building, 2nd Floor, Bengaluru"
            />

            <Textarea
              id="dept-mandate"
              label="Custom Mission Mandate / Scope"
              rows={3}
              value={currentData.customMandate || ''}
              onChange={(e) => updateCurrent({ customMandate: e.target.value })}
              placeholder="Enter detailed departmental mission scope..."
              hint="Overrides the default backend description on the public department page."
            />
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-text-dim">No department selected.</div>
        )}

        <SaveBar onSave={handleSave} isPending={updateBlock.isPending} />
      </div>
    </Panel>
  )
}
