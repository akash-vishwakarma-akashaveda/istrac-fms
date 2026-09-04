import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AxiosError } from 'axios'
import { Radio } from 'lucide-react'
import { Modal, Button, Input } from '.'
import { apiClient } from '../api/client'
import { satellitesApi, type Satellite } from '../api/satellites.api'
import {
  departmentSchema,
  type DepartmentFormData,
} from '../../schemas/departmentSchema'

interface CreateDeptModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    name: string
    code?: string
    hddPath: string
    pageTitle?: string
    pageAbout?: string
    pageLeadOfficer?: string
    pageLeadRole?: string
    pageContact?: string
    satelliteIds?: string[]
  }) => Promise<void>
  initialValues?: {
    name: string
    code?: string
    folderName: string
    pageTitle?: string
    pageAbout?: string
    pageLeadOfficer?: string
    pageLeadRole?: string
    pageContact?: string
    satelliteIds?: string[]
  }
  isSubmitting: boolean
}

export function CreateDeptModal({
  isOpen,
  onClose,
  onSubmit,
  initialValues,
  isSubmitting,
}: CreateDeptModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
  })

  const [mountRoot, setMountRoot] = useState('C:\\istrac_storage\\')
  const [enableSatellites, setEnableSatellites] = useState(false)
  const [selectedSatIds, setSelectedSatIds] = useState<string[]>([])
  const [satellitesList, setSatellitesList] = useState<Satellite[]>([])
  const [loadingSatellites, setLoadingSatellites] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setLoadingSatellites(true)
      satellitesApi
        .getAllAdminSatellites()
        .then((sats) => setSatellitesList(sats || []))
        .catch(() => {})
        .finally(() => setLoadingSatellites(false))

      apiClient
        .get('/admin/storage/redundancy')
        .then((res) => {
          const p = res.data?.data?.primaryPath
          if (p) {
            const sep = p.includes('/') ? '/' : '\\'
            setMountRoot(p.replace(/[\\/]+$/, '') + sep)
          }
        })
        .catch(() => {})
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      reset(
        initialValues ?? {
          name: '',
          code: '',
          folderName: '',
          pageTitle: '',
          pageAbout: '',
          pageLeadOfficer: '',
          pageLeadRole: '',
          pageContact: '',
        }
      )

      if (initialValues?.satelliteIds && initialValues.satelliteIds.length > 0) {
        setEnableSatellites(true)
        setSelectedSatIds(initialValues.satelliteIds)
      } else {
        setEnableSatellites(false)
        setSelectedSatIds([])
      }
    }
  }, [isOpen, initialValues, reset])

  async function handleFormSubmit(data: DepartmentFormData) {
    try {
      await onSubmit({
        name: data.name,
        code: data.code || undefined,
        hddPath: `${mountRoot}${data.folderName}`,
        pageTitle: data.pageTitle || undefined,
        pageAbout: data.pageAbout || undefined,
        pageLeadOfficer: data.pageLeadOfficer || undefined,
        pageLeadRole: data.pageLeadRole || undefined,
        pageContact: data.pageContact || undefined,
        satelliteIds: enableSatellites ? selectedSatIds : [],
      })
    } catch (err) {
      const error = err as AxiosError<{
        error: {
          code: string
          message: string
        }
      }>

      if (error.response?.data?.error?.code === 'DUPLICATE_NAME') {
        setError('name', {
          message: 'A department with this name already exists',
        })
      }
    }
  }

  const isEditing = Boolean(initialValues)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Department & CMS Profile' : 'Create Operational Department & CMS Profile'}
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Department Name */}
          <div className="sm:col-span-2">
            <Input
              id="name"
              label="Department Name *"
              placeholder="e.g. Telemetry, Tracking & Command"
              error={errors.name?.message}
              {...register('name')}
            />
          </div>

          {/* Division Code */}
          <div>
            <Input
              id="code"
              label="Division Code"
              placeholder="e.g. TTC"
              error={errors.code?.message}
              {...register('code')}
            />
          </div>
        </div>

        {/* HDD Folder */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="folderName" className="col-label">
            HDD Root Folder *
          </label>

          <div className="flex w-full overflow-hidden rounded-md border border-border-default bg-surface transition-colors duration-150 focus-within:border-accent">
            <span className="num flex shrink-0 items-center border-r border-border-default bg-card px-3 py-2 text-xs text-text-dim font-mono">
              {mountRoot}
            </span>

            <input
              id="folderName"
              className="num font-mono min-w-0 flex-1 bg-transparent px-3 py-2 text-xs text-text-primary outline-none placeholder:text-text-dim"
              placeholder="ttc"
              {...register('folderName')}
            />
          </div>

          {errors.folderName && (
            <span className="text-[11px] leading-4 text-critical">
              {errors.folderName.message}
            </span>
          )}
        </div>

        {/* CMS Page Headline */}
        <div>
          <Input
            id="pageTitle"
            label="Page Hero Headline (CMS Title)"
            placeholder="e.g. Telemetry, Tracking & Command (TTC) Complex"
            {...register('pageTitle')}
          />
        </div>

        {/* CMS About Text */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pageAbout" className="col-label">
            About & Division Mandate (CMS Body)
          </label>
          <textarea
            id="pageAbout"
            rows={2}
            className="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-xs text-text-primary outline-none transition-colors duration-150 placeholder:text-text-dim focus:border-accent"
            placeholder="Describe the operational mandate and mission responsibilities..."
            {...register('pageAbout')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="pageLeadOfficer"
            label="Lead Operations Officer"
            placeholder="e.g. Dr. Vikram Sharma"
            {...register('pageLeadOfficer')}
          />

          <Input
            id="pageLeadRole"
            label="Officer Operational Role"
            placeholder="e.g. Division Head / Mission Director"
            {...register('pageLeadRole')}
          />
        </div>

        <Input
          id="pageContact"
          label="Lab Location & Ground Contact"
          placeholder="e.g. Building MOX-2, 2nd Floor, ISTRAC Bengaluru"
          {...register('pageContact')}
        />

        {/* Satellite Configuration / Multi-Select Section */}
        <div className="rounded-xl border border-border-default bg-[#070d1a] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                id="link-satellites-toggle"
                checked={enableSatellites}
                onChange={(e) => {
                  setEnableSatellites(e.target.checked)
                  if (!e.target.checked) {
                    setSelectedSatIds([])
                  }
                }}
                className="h-4 w-4 rounded border-border-default bg-surface text-accent focus:ring-accent"
              />
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Radio size={14} className="text-accent-light" />
                <span>Link Spacecraft & Satellite Programs</span>
              </span>
            </label>

            {enableSatellites && (
              <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-accent-light bg-accent/15 border border-accent/30 rounded-full px-2.5 py-0.5">
                {selectedSatIds.length} Selected
              </span>
            )}
          </div>

          <p className="text-[11px] text-text-dim leading-relaxed">
            Link satellite mission programs supported by this department. Selected satellites will be displayed as interactive mission cards on the division landing page with live telemetry dossiers.
          </p>

          {enableSatellites && (
            <div className="pt-2 border-t border-border-subtle/80 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-text-secondary font-medium">Select Active Spacecraft:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSatIds(satellitesList.map((s) => s.id))}
                    className="text-accent-light hover:underline font-semibold"
                  >
                    Select All
                  </button>
                  <span className="text-text-dim">·</span>
                  <button
                    type="button"
                    onClick={() => setSelectedSatIds([])}
                    className="text-text-dim hover:text-white"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {loadingSatellites ? (
                <div className="py-4 text-center text-xs text-text-dim">
                  Loading satellite mission registry…
                </div>
              ) : satellitesList.length === 0 ? (
                <div className="py-3 text-center text-xs text-text-dim">
                  No satellite programs registered yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-1.5 rounded-lg border border-border-subtle bg-surface">
                  {satellitesList.map((sat) => {
                    const isChecked = selectedSatIds.includes(sat.id)
                    return (
                      <label
                        key={sat.id}
                        className={`flex items-start gap-2.5 p-2 rounded-md border cursor-pointer transition-all ${
                          isChecked
                            ? 'border-accent/50 bg-accent/10 text-white'
                            : 'border-border-subtle/60 bg-card/40 text-text-secondary hover:border-border-bright hover:bg-card'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSatIds((prev) => [...prev, sat.id])
                            } else {
                              setSelectedSatIds((prev) => prev.filter((id) => id !== sat.id))
                            }
                          }}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-border-default bg-card text-accent focus:ring-accent"
                        />
                        <div className="min-w-0 flex-1 text-xs">
                          <div className="font-semibold truncate">{sat.name}</div>
                          <div className="flex items-center gap-2 text-[10px] text-text-dim mt-0.5">
                            <span className="text-accent-light font-mono font-bold">
                              {sat.satId || sat.code || 'ISRO'}
                            </span>
                            {sat.orbitType && (
                              <span className="truncate">· {sat.orbitType}</span>
                            )}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-2 border-t border-border-subtle pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting}
            className="w-full sm:w-auto bg-accent hover:bg-accent-hover shadow-md shadow-accent/25"
          >
            {isSubmitting
              ? 'Saving…'
              : isEditing
                ? 'Save Department CMS'
                : 'Create Department'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
