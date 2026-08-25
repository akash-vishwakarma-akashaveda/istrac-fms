import {
  LayoutDashboard,
  FileText,
  Search,
  Bell,
  Users,
  UserCheck,
  ClipboardList,
  Settings,
  Building2,
  Megaphone,
  Layout,
  Shield,
  Radio,
  Upload,
} from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: typeof LayoutDashboard
  adminOnly?: boolean
}

export const navItems: NavItem[] = [
  // Workspace (All Users)
  { label: 'Mission Overview', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Upload Report', path: '/dashboard/upload', icon: Upload },
  { label: 'File Repositories', path: '/dashboard/files', icon: FileText },
  { label: 'Search Archives', path: '/dashboard/search', icon: Search },
  { label: 'Notifications', path: '/notifications', icon: Bell },

  // Administration (Super Admin / Dept Admin)
  { label: 'Admin Overview', path: '/admin', icon: Shield, adminOnly: true },
  { label: 'Approval Queue', path: '/admin/approvals', icon: UserCheck, adminOnly: true },
  { label: 'Satellites & Missions', path: '/admin/satellites', icon: Radio, adminOnly: true },
  { label: 'Departments', path: '/admin/departments', icon: Building2, adminOnly: true },
  { label: 'User Accounts', path: '/admin/users', icon: Users, adminOnly: true },
  { label: 'Audit Logs', path: '/admin/audit-logs', icon: ClipboardList, adminOnly: true },
  { label: 'Broadcast Alert', path: '/admin/broadcast', icon: Megaphone, adminOnly: true },
  { label: 'Portal CMS', path: '/admin/cms', icon: Layout, adminOnly: true },
  { label: 'System Settings', path: '/admin/settings', icon: Settings, adminOnly: true },
]