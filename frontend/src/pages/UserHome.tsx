import {
  useRecentFiles,
  useUserDepartments,
} from '../hooks/useUserHome'
import { useAuthStore } from '../store/authStore'
import { Link } from 'react-router-dom'
import { Shield, ArrowRight } from 'lucide-react'

import { PageHeader, Panel } from '../components'
import { FileIcon } from '../components/FileIcon'
import { QuickSearchBar } from '../components/QuickSearchBar'
import { UserDeptCard } from '../components/UserDeptCard'
import { formatFileSize } from '../lib/formatFileSize'

export function UserHome() {
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'DEPT_ADMIN'

  const {
    data: departments,
    isLoading: deptsLoading,
  } = useUserDepartments()

  const {
    data: recentFiles,
    isLoading: filesLoading,
  } = useRecentFiles()

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Admin Fast Switch Banner */}
      {isAdmin && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-accent/40 bg-gradient-to-r from-accent/15 via-[#0b1730] to-accent/15 p-4 shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent-light border border-accent/30">
              <Shield size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Administrator Privilege Active
              </h4>
              <p className="text-xs text-text-secondary">
                You have full access to User Management, Approval Queue, CMS, and System Settings.
              </p>
            </div>
          </div>

          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white shadow-lg shadow-accent/25 hover:bg-accent-light transition-all shrink-0"
          >
            <span>Open Admin Command Center</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      <PageHeader
        eyebrow="Mission Workspace"
        title={user?.name ? `Welcome back, ${user.name}` : 'Welcome back'}
        description="Your assigned operational departments and recently updated telemetry flight datasets."
      />

      <div className="max-w-xl">
        <QuickSearchBar />
      </div>

      {/* Departments */}
      <Panel
        title="Your Operational Departments"
        meta={
          departments && departments.length > 0
            ? `${departments.length} assigned`
            : undefined
        }
        flush
      >
        {deptsLoading ? (
          <p className="num p-4 text-xs text-text-dim">Loading departments…</p>
        ) : departments && departments.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((department) => (
              <UserDeptCard
                key={department.id}
                {...department}
              />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="num text-sm text-text-dim">—</p>
            <p className="mt-2 text-[13px] text-text-muted">
              No departments assigned yet.
            </p>
          </div>
        )}
      </Panel>

      {/* Recent Files */}
      <Panel
        title="Recently Ingested Datasets"
        meta={
          recentFiles && recentFiles.length > 0
            ? `${recentFiles.length} entries`
            : undefined
        }
        flush
      >
        {filesLoading ? (
          <p className="num p-4 text-xs text-text-dim">Loading files…</p>
        ) : recentFiles && recentFiles.length > 0 ? (
          <ul className="divide-y divide-border-subtle">
            {recentFiles.map((file) => (
              <li
                key={file.id}
                className="flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-card-hover"
              >
                <div className="flex shrink-0 items-center justify-center">
                  <FileIcon
                    nodeType="FILE"
                    mimeType={file.mimeType}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-text-primary">
                    {file.name}
                  </p>

                  <p className="mt-0.5 truncate text-[11px] text-text-muted">
                    {file.departmentName}
                  </p>
                </div>

                <span className="num hidden w-20 shrink-0 text-right text-[11px] text-text-dim sm:block">
                  {formatFileSize(file.size)}
                </span>

                <span className="num w-24 shrink-0 text-right text-[11px] text-text-dim">
                  {new Date(file.uploadedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-8 text-center">
            <p className="num text-sm text-text-dim">—</p>
            <p className="mt-2 text-[13px] text-text-muted">No recent uploads.</p>
          </div>
        )}
      </Panel>
    </div>
  )
}
