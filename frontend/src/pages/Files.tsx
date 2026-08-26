import { useState } from 'react'
import {
  Building2,
  Lock,
  CheckCircle2,
  Upload,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { useDepartments } from '../hooks/useDepartments'
import { useAuthStore } from '../store/authStore'
import { FileBrowser } from '../components/FileBrowser'
import { PageHeader, Select, Button } from '../components'

export function Files() {
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === 'ADMIN'

  const { data: departments, isLoading } = useDepartments()
  const [activeDept, setActiveDept] = useState<string | null>(null)

  const activeDepartments =
    departments?.filter((department) => !department.archived) ?? []

  const deptId = activeDept ?? activeDepartments[0]?.id

  const selectedDepartment = activeDepartments.find((d) => d.id === deptId)

  // Determine user's specific access level for the selected department
  const userDeptAccess = user?.departmentAccess?.find(
    (da: any) => da.department?.id === deptId || da.departmentId === deptId,
  )
  const isReadWrite = isAdmin || userDeptAccess?.accessLevel === 'READ_WRITE'

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-subtle pb-5">
        <PageHeader
          eyebrow="Workspace"
          title="Division File Repositories"
          description="Browse, preview, and download mission telemetry datasets and flight logs."
        />

        <div className="flex items-center gap-3">
          {/* Department Selector */}
          {activeDepartments.length > 0 && (
            <div className="w-full min-w-[220px] sm:w-72">
              <Select
                id="active-department"
                aria-label="Select department"
                value={deptId ?? ''}
                onChange={(event) => setActiveDept(event.target.value)}
              >
                {activeDepartments.map((department) => {
                  const access = user?.departmentAccess?.find(
                    (da: any) =>
                      da.department?.id === department.id ||
                      da.departmentId === department.id,
                  )
                  const levelTag = isAdmin
                    ? ' [ADMIN]'
                    : access?.accessLevel === 'READ_WRITE'
                      ? ' [RW]'
                      : ' [RO]'

                  return (
                    <option key={department.id} value={department.id}>
                      {department.code ? `/${department.code} — ` : ''}
                      {department.name}
                      {levelTag}
                    </option>
                  )
                })}
              </Select>
            </div>
          )}

          {isAdmin && (
            <Link to="/admin/upload">
              <Button variant="primary" size="sm" className="font-bold shadow-md shadow-accent/20">
                <Upload size={13} strokeWidth={2} />
                <span>Upload Dataset</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Selected Department Overview Banner */}
      {selectedDepartment && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-border-default bg-[#060c18] shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent-light">
              <Building2 size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white truncate">
                  {selectedDepartment.name}
                </h3>
                {selectedDepartment.code && (
                  <span className="rounded bg-accent/20 border border-accent/30 px-2 py-0.2 text-[10px] font-bold num text-accent-light">
                    /{selectedDepartment.code}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-dim truncate">
                {selectedDepartment.description || 'ISRO Mission Operational Division Repository'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
            {isReadWrite ? (
              <span className="flex items-center gap-1.5 rounded-lg border border-nominal/30 bg-nominal/10 px-2.5 py-1 text-xs font-bold text-nominal">
                <CheckCircle2 size={13} />
                <span>READ & WRITE CLEARANCE</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-lg border border-border-default bg-surface px-2.5 py-1 text-xs font-semibold text-text-dim">
                <Lock size={13} className="text-accent-light" />
                <span>READ-ONLY USER ACCESS</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <p className="num text-xs text-text-dim">Loading division repositories…</p>
      )}

      {/* Empty state */}
      {!isLoading && activeDepartments.length === 0 && (
        <div className="rounded-xl border border-border-subtle bg-card p-10 text-center shadow-card">
          <p className="num text-sm text-text-dim">—</p>
          <p className="mt-2 text-[13px] text-text-muted">
            No active departments available.
          </p>
        </div>
      )}

      {/* File browser */}
      {deptId && <FileBrowser deptId={deptId} parentId={null} />}
    </div>
  )
}
