import { useState } from 'react'
import {
  Building2,
  Lock,
  CheckCircle2,
  Upload,
  ArrowRight,
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
    <div className="space-y-6 w-full pb-16">
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

      {/* No Clearance Empty State */}
      {!isLoading && activeDepartments.length === 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-[#070e1c] p-8 sm:p-12 text-center shadow-2xl max-w-xl mx-auto space-y-5 my-6">
          <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-inner">
            <Lock size={32} />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-0.5 text-[11px] font-mono font-bold text-amber-300 uppercase">
              Clearance Required
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              No Division Repositories Assigned
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed max-w-md mx-auto">
              You are logged in with member privileges, but your account currently has no department clearances assigned. Telemetry files and flight datasets are strictly compartmentalized by division.
            </p>
          </div>

          <div className="rounded-xl border border-border-default bg-[#050b16] p-4 text-left space-y-2.5 text-xs">
            <p className="text-text-primary font-bold">How to obtain division file access:</p>
            <div className="space-y-1.5 text-text-dim text-[11px] leading-relaxed">
              <p>• Contact your Lead Officer or System Administrator to request division clearance.</p>
              <p>• Once an Administrator approves clearance in User Accounts, your assigned folders will unlock here automatically.</p>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/departments" className="w-full sm:w-auto">
              <Button variant="outline" size="sm" className="w-full text-xs font-bold">
                <Building2 size={13} />
                <span>Explore Operational Divisions</span>
              </Button>
            </Link>
            <Link to="/dashboard" className="w-full sm:w-auto">
              <Button variant="primary" size="sm" className="w-full text-xs font-bold">
                <span>Go to Mission Overview</span>
                <ArrowRight size={13} />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* File browser */}
      {deptId && <FileBrowser deptId={deptId} parentId={null} />}
    </div>
  )
}
