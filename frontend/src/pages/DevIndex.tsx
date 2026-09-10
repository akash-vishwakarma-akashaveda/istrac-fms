import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Button, PageHeader, Panel } from '../components'

const TEST_USERS = {
  superAdmin: { id: '1', name: 'Test Admin', email: 'admin@istrac.local', role: 'ADMIN' as const, tempPass: false },
  member: { id: '2', name: 'Test Member', email: 'member@istrac.local', role: 'MEMBER' as const, tempPass: false },
}

const PUBLIC_PAGES = [
  { path: '/', label: 'Landing (Hero, Announcement)' },
  { path: '/login', label: 'Login' },
  { path: '/register', label: 'Register' },
  { path: '/forgot-password', label: 'Forgot Password (3-step)' },
]

const USER_PAGES = [
  { path: '/dashboard', label: 'Dashboard (placeholder)' },
  { path: '/dashboard/files', label: 'Files (grid/list, upload, versions)' },
]

const ADMIN_PAGES = [
  { path: '/admin', label: 'Admin Home (stats, activity feed)' },
  { path: '/admin/approvals', label: 'Approval Queue' },
  { path: '/admin/users', label: 'User Management' },
  { path: '/admin/departments', label: 'Department Manager' },
  { path: '/admin/audit-logs', label: 'Audit Log Viewer' },
  { path: '/admin/broadcast', label: 'Broadcast Notification' },
  { path: '/admin/cms', label: 'CMS Editor (5 tabs)' },

]

export function DevIndex() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const user = useAuthStore((s) => s.user)

  if (import.meta.env.PROD) return null

  function Section({ title, meta, pages }: { title: string; meta: string; pages: { path: string; label: string }[] }) {
    return (
      <Panel title={title} meta={meta} flush>
        <div className="grid grid-cols-1 divide-y divide-border-subtle sm:grid-cols-2 sm:divide-y-0">
          {pages.map((p) => (
            <Link
              key={p.path}
              to={p.path}
              className="group flex items-baseline justify-between gap-3 border-l-2 border-l-transparent px-4 py-2.5 transition-colors duration-150 hover:border-l-accent hover:bg-card-hover"
            >
              <span className="min-w-0 truncate text-[13px] text-text-secondary group-hover:text-text-primary">
                {p.label}
              </span>

              <span className="num shrink-0 text-[10px] text-text-dim group-hover:text-accent-light">
                {p.path}
              </span>
            </Link>
          ))}
        </div>
      </Panel>
    )
  }

  return (
    <div className="graticule min-h-screen bg-page py-10">
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4">
        <PageHeader
          eyebrow="Development"
          title="Page index"
          description="Route shortcuts and auth shims. This page is stripped from production builds."
          meta={user ? `${user.name} · ${user.role}` : 'not signed in'}
        />

        {/* Auth shims */}
        <Panel title="Session" meta={user ? user.email : 'none'}>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setAuth(TEST_USERS.superAdmin, 'fake-dev-token')}
            >
              Set as admin
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setAuth(TEST_USERS.member, 'fake-dev-token')}
            >
              Set as member
            </Button>

            <Button variant="ghost" size="sm" onClick={clearAuth}>
              Clear session
            </Button>
          </div>
        </Panel>

        <Section title="Public" meta="no auth" pages={PUBLIC_PAGES} />
        <Section title="User" meta="requires login" pages={USER_PAGES} />
        <Section title="Admin" meta="ADMIN only" pages={ADMIN_PAGES} />
      </div>
    </div>
  )
}
