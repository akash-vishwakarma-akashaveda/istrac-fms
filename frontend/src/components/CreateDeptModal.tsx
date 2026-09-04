import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AxiosError } from 'axios'
import { Modal, Button, Input } from '.'
import { apiClient } from '../api/client'
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

  useEffect(() => {
    if (isOpen) {
      apiClient.get('/admin/storage/redundancy')
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
