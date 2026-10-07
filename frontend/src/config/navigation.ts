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
  Calendar,
  HardDrive,
  KeyRound,
} from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: typeof LayoutDashboard
  adminOnly?: boolean
}

export const navItems: NavItem[] = [
  // Workspace (All Users)
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Browse Files', path: '/dashboard/files', icon: FileText },
  { label: 'Passes & Events', path: '/dashboard/events', icon: Calendar },
  { label: 'Notifications', path: '/notifications', icon: Bell },
  { label: 'Search', path: '/dashboard/search', icon: Search },

  // Administration (Super Admin / Dept Admin)
  { label: 'Admin Dashboard', path: '/admin', icon: Shield, adminOnly: true },
  { label: 'All Files & Trash', path: '/admin/files', icon: HardDrive, adminOnly: true },
  { label: 'Upload', path: '/admin/upload', icon: Upload, adminOnly: true },
  { label: 'Approvals', path: '/admin/approvals', icon: UserCheck, adminOnly: true },
  { label: 'Satellites', path: '/admin/satellites', icon: Radio, adminOnly: true },
  { label: 'Manage Events', path: '/admin/events', icon: Calendar, adminOnly: true },
  { label: 'Departments', path: '/admin/departments', icon: Building2, adminOnly: true },
  { label: 'Users', path: '/admin/users', icon: Users, adminOnly: true },
  { label: 'Password Resets', path: '/admin/password-resets', icon: KeyRound, adminOnly: true },
  { label: 'Audit Log', path: '/admin/audit-logs', icon: ClipboardList, adminOnly: true },
  { label: 'Broadcasts', path: '/admin/broadcast', icon: Megaphone, adminOnly: true },
  { label: 'Website Content', path: '/admin/cms', icon: Layout, adminOnly: true },
  { label: 'Settings', path: '/admin/settings', icon: Settings, adminOnly: true },
]