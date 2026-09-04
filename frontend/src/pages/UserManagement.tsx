import {
  Search,
  Edit2,
  Building,
  Crown,
  Eye,
  Users,
  UserCheck,
  Clock,
  ShieldCheck,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react'
import { useState } from 'react'
import { useUsers, useSuspendUser, useForceLogout } from '../hooks/useUsers'
import { useDepartments } from '../hooks/useDepartments'
import { useToastStore } from '../store/toastStore'
import { usersApi } from '../api'
import { Badge, Button, PageHeader, Avatar, Modal } from '../components'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { UserProfile } from '../api/auth.api'

const statusVariant: Record<string, 'nominal' | 'warning' | 'critical' | 'neutral'> = {
  ACTIVE: 'nominal',
  PENDING: 'warning',
  SUSPENDED: 'critical',
  REJECTED: 'neutral',
}

export function UserManagement() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [role, setRole] = useState('')

  const { data, isLoading, refetch } = useUsers({
    page,
    search,
    status,
    role,
  })

  const { data: allDepartments } = useDepartments()
  const suspendUser = useSuspendUser()
  const forceLogout = useForceLogout()
  const addToast = useToastStore((s) => s.addToast)

  // Suspend Target State
  const [suspendTarget, setSuspendTarget] = useState<{
    id: string
    name: string
  } | null>(null)

  // Inspect User State
  const [inspectingUser, setInspectingUser] = useState<UserProfile | null>(null)

  // Edit User & Multi-Department Clearance State
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesignation, setEditDesignation] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editBadgeId, setEditBadgeId] = useState('')
  const [editRole, setEditRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER')
  const [editStatus, setEditStatus] = useState('ACTIVE')
  const [selectedDeptAccess, setSelectedDeptAccess] = useState<Record<string, 'READ_ONLY' | 'READ_WRITE'>>({})
  const [savingEdit, setSavingEdit] = useState(false)

  const usersList = data?.data || []
  const totalPages = data?.pagination.totalPages ?? 1
  const totalUsers = data?.pagination.total ?? 0

  // Calculate high-level stats
  const activeCount = usersList.filter((u) => u.status === 'ACTIVE').length
  const pendingCount = usersList.filter((u) => u.status === 'PENDING').length
  const multiDeptCount = usersList.filter(
    (u) => (u.departmentAccess && u.departmentAccess.length > 1) || u.role === 'ADMIN'
  ).length

  const handleOpenEdit = (user: UserProfile) => {
    setEditingUser(user)
    setEditName(user.name)
    setEditDesignation(user.designation || '')
    setEditPhone(user.phone || '')
    setEditBadgeId(user.employeeId || '')
    setEditRole(user.role === 'ADMIN' ? 'ADMIN' : 'MEMBER')
    setEditStatus(user.status)

    const mapped: Record<string, 'READ_ONLY' | 'READ_WRITE'> = {}
    if (user.departmentAccess && Array.isArray(user.departmentAccess)) {
      user.departmentAccess.forEach((da: any) => {
        if (da.department?.id) {
          mapped[da.department.id] = da.accessLevel || 'READ_ONLY'
        }
      })
    }
    setSelectedDeptAccess(mapped)
  }

  const handleToggleDept = (deptId: string) => {
    setSelectedDeptAccess((prev) => {
      const next = { ...prev }
      if (next[deptId]) {
        delete next[deptId]
      } else {
        next[deptId] = 'READ_ONLY'
      }
      return next
    })
  }

  const handleSetDeptLevel = (deptId: string, level: 'READ_ONLY' | 'READ_WRITE') => {
    setSelectedDeptAccess((prev) => ({
      ...prev,
      [deptId]: level,
    }))
  }

  const handleSelectAllDepts = () => {
    const next: Record<string, 'READ_ONLY' | 'READ_WRITE'> = {}
    allDepartments?.forEach((d) => {
      next[d.id] = 'READ_ONLY'
    })
    setSelectedDeptAccess(next)
  }

  const handleClearAllDepts = () => {
    setSelectedDeptAccess({})
  }

  const handleSaveUserPermissions = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    setSavingEdit(true)
    const departmentsPayload = Object.entries(selectedDeptAccess).map(([departmentId, accessLevel]) => ({
      departmentId,
      accessLevel,
    }))

    try {
      await usersApi.updateUser(editingUser.id, {
        name: editName.trim(),
        designation: editDesignation.trim() || undefined,
        phone: editPhone.trim() || undefined,
        employeeId: editBadgeId.trim() || undefined,
        role: editRole,
        status: editStatus,
        departments: departmentsPayload,
      })

      addToast({
        title: 'User Updated',
        message: `Saved multi-department permissions for ${editName}.`,
        variant: 'success',
      })
      setEditingUser(null)
      refetch()
    } catch {
      addToast({ title: 'Error', message: 'Failed to update user clearances', variant: 'error' })
    } finally {
      setSavingEdit(false)
    }
  }

  function handleSuspendConfirm() {
    if (!suspendTarget) return

    suspendUser.mutate(suspendTarget.id, {
      onSuccess: () => {
        addToast({ message: `${suspendTarget.name} suspended`, variant: 'success' })
        setSuspendTarget(null)
        refetch()
      },
      onError: () => addToast({ message: 'Failed to suspend user', variant: 'error' }),
    })
  }

  function handleForceLogout(userId: string, name: string) {
    forceLogout.mutate(userId, {
      onSuccess: () => addToast({ message: `${name}'s session invalidated`, variant: 'success' }),
      onError: () => addToast({ message: 'Failed to force logout', variant: 'error' }),
    })
  }

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Header */}
      <PageHeader
        eyebrow="Administration"
        title="User Management & Clearances"
        description="Manage officer accounts, multi-department access permissions, security clearance tiers, and live sessions."
      />

      {/* ============================================================ */}
      {/* 1. EXECUTIVE SUMMARY STAT CARDS */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-border-default bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-dim block">
              Total Accounts
            </span>
            <strong className="text-2xl font-bold text-white num block mt-0.5">
              {totalUsers}
            </strong>
            <span className="text-[10px] text-text-dim block">Registered personnel</span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface border border-border-subtle text-accent-light">
            <Users size={18} />
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-dim block">
              Active Officers
            </span>
            <strong className="text-2xl font-bold text-nominal num block mt-0.5">
              {activeCount}
            </strong>
            <span className="text-[10px] text-text-dim block">Verified mission users</span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface border border-border-subtle text-nominal">
            <UserCheck size={18} />
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-dim block">
              Pending Clearances
            </span>
            <strong className="text-2xl font-bold text-warning num block mt-0.5">
              {pendingCount}
            </strong>
            <span className="text-[10px] text-text-dim block">Awaiting sign-off</span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface border border-border-subtle text-warning">
            <Clock size={18} />
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-dim block">
              Multi-Dept Cleared
            </span>
            <strong className="text-2xl font-bold text-purple-300 num block mt-0.5">
              {multiDeptCount}
            </strong>
            <span className="text-[10px] text-text-dim block">Cross-division access</span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface border border-border-subtle text-purple-400">
            <ShieldCheck size={18} />
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. FILTERS TOOLBAR */}
      {/* ============================================================ */}
      <div className="rounded-xl border border-border-default bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
          <Filter size={14} className="text-accent-light" />
          <span>Search & Filter Officers</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
            <input
              type="text"
              placeholder="Search by name, email, badge ID…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-lg border border-border-default bg-[#060c18] pl-9 pr-3 py-2 text-xs text-white placeholder:text-text-dim outline-none focus:border-accent"
            />
          </div>

          {/* Status Select */}
          <div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
            >
              <option value="">All Account Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PENDING">PENDING CLEARANCE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>

          {/* Role Select */}
          <div>
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
            >
              <option value="">All Roles</option>
              <option value="ADMIN">ADMIN</option>
              <option value="MEMBER">MEMBER</option>
            </select>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. OPERATOR ACCOUNTS TABLE */}
      {/* ============================================================ */}
      <div className="rounded-xl border border-border-default bg-card shadow-sm overflow-hidden">
        {/* Table Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-default bg-surface/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
              User Accounts Directory
            </span>
            <span className="num font-bold text-xs text-accent-light rounded-full bg-accent/15 border border-accent/30 px-2 py-0.5">
              {totalUsers} Users
            </span>
          </div>

          <span className="num text-[11px] text-text-dim">
            Page {page} of {totalPages}
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-text-dim">
            Loading user accounts & clearance matrix…
          </div>
        ) : usersList.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm font-bold text-white">No Personnel Accounts Found</p>
            <p className="text-xs text-text-dim">No users match the active search or status filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead>
                <tr className="border-b border-border-default bg-surface text-[11px] font-bold text-text-dim uppercase tracking-wider">
                  <th className="px-5 py-3.5 w-[26%]">Applicant / Officer</th>
                  <th className="px-4 py-3.5 w-[14%]">ISRO Badge ID</th>
                  <th className="px-4 py-3.5 w-[10%]">Role</th>
                  <th className="px-4 py-3.5 w-[24%]">Department Clearances</th>
                  <th className="px-4 py-3.5 w-[10%]">Status</th>
                  <th className="px-5 py-3.5 w-[16%] text-right">Actions & Scope</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-xs">
                {usersList.map((userRow) => {
                  const isRoot =
                    userRow.email === 'admin@istrac.local' || userRow.employeeId === 'ISRO-DIR-001'

                  return (
                    <tr key={userRow.id} className="hover:bg-card-hover transition-colors">
                      {/* Officer Info */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={userRow.name} size="sm" />
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate flex items-center gap-1.5 text-xs">
                              <span>{userRow.name}</span>
                              {isRoot && (
                                <span title="Super Admin Root Authority">
                                  <Crown size={13} className="text-yellow-400 shrink-0" />
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-text-dim block truncate font-mono">
                              {userRow.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Badge ID */}
                      <td className="px-4 py-3.5">
                        <span className="num text-xs font-mono font-semibold text-text-secondary bg-[#060c18] px-2 py-1 rounded border border-border-subtle">
                          {userRow.employeeId || '—'}
                        </span>
                      </td>

                      {/* Role Badge */}
                      <td className="px-4 py-3.5">
                        {userRow.role === 'ADMIN' ? (
                          <span className="inline-flex items-center gap-1 rounded border border-yellow-400/40 bg-yellow-400/10 px-2 py-0.5 text-[10px] font-bold text-yellow-300">
                            <Shield size={11} />
                            <span>ADMIN</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent-light">
                            <span>MEMBER</span>
                          </span>
                        )}
                      </td>

                      {/* Department Clearances */}
                      <td className="px-4 py-3.5">
                        {isRoot ? (
                          <span className="inline-flex items-center gap-1 rounded border border-purple-400/40 bg-purple-400/10 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                            <Crown size={11} />
                            <span>ALL DIVISIONS · ROOT</span>
                          </span>
                        ) : !userRow.departmentAccess || userRow.departmentAccess.length === 0 ? (
                          <span className="text-[11px] text-text-dim italic">No assigned scopes</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {userRow.departmentAccess.map((da: any) => (
                              <span
                                key={da.department?.id || da.id}
                                className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase num ${
                                  da.accessLevel === 'READ_WRITE'
                                    ? 'bg-nominal/15 text-nominal border border-nominal/30'
                                    : 'bg-accent/15 text-accent-light border border-accent/30'
                                }`}
                              >
                                {da.department?.code || da.department?.name || 'TTC'} [
                                {da.accessLevel === 'READ_WRITE' ? 'RW' : 'RO'}]
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <Badge variant={statusVariant[userRow.status] || 'neutral'}>
                          {userRow.status}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        {isRoot ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setInspectingUser(userRow)}
                              className="px-2.5 py-1.5 rounded-lg border border-yellow-400/40 bg-yellow-400/10 text-yellow-300 hover:bg-yellow-400/20 transition-all flex items-center gap-1.5 text-xs font-bold"
                              title="View Root Authority Dossier"
                            >
                              <Eye size={13} />
                              <span>View Details</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View Details */}
                            <button
                              type="button"
                              onClick={() => setInspectingUser(userRow)}
                              className="px-2.5 py-1.5 rounded-lg border border-border-default bg-[#0c1424] text-text-muted hover:border-accent hover:text-white transition-all flex items-center gap-1.5 text-xs font-bold"
                              title="View Officer Dossier"
                            >
                              <Eye size={13} className="text-accent-light" />
                              <span>View Details</span>
                            </button>

                            {/* Permissions */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(userRow)}
                              className="px-2.5 py-1.5 rounded-lg border border-border-default bg-[#0c1424] text-text-muted hover:border-nominal hover:text-nominal transition-all flex items-center gap-1.5 text-xs font-bold"
                              title="Edit Multi-Department Permissions"
                            >
                              <Edit2 size={12} />
                              <span>Permissions</span>
                            </button>

                            {/* Suspend Toggle */}
                            {userRow.status === 'ACTIVE' && (
                              <button
                                type="button"
                                onClick={() =>
                                  setSuspendTarget({
                                    id: userRow.id,
                                    name: userRow.name,
                                  })
                                }
                                className="px-2.5 py-1.5 rounded-lg border border-critical/30 bg-critical/10 text-critical hover:bg-critical/20 transition-all text-xs font-bold"
                                title="Suspend Account"
                              >
                                Suspend
                              </button>
                            )}

                            {/* Force Logout */}
                            <button
                              type="button"
                              onClick={() => handleForceLogout(userRow.id, userRow.name)}
                              disabled={forceLogout.isPending}
                              className="p-1.5 rounded-lg border border-border-default bg-[#0c1424] text-warning hover:bg-warning/10 transition-all text-xs font-bold disabled:opacity-40"
                              title="Force Session Logout"
                            >
                              <LogOut size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Pagination Footer */}
        {!isLoading && usersList.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-3.5 border-t border-border-default bg-surface/50">
            <p className="num text-xs text-text-dim">
              Showing page {page} of {totalPages} · {totalUsers} total registered personnel
            </p>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="text-xs"
              >
                <ChevronLeft size={13} />
                <span>Previous</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="text-xs"
              >
                <span>Next</span>
                <ChevronRight size={13} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* MODAL: EDIT USER & MULTI-DEPARTMENT CLEARANCE MATRIX */}
      {/* ============================================================ */}
      <Modal
        isOpen={editingUser !== null}
        onClose={() => setEditingUser(null)}
        title="Edit User Profile & Multi-Department Clearances"
      >
        <form onSubmit={handleSaveUserPermissions} className="space-y-4">
          <div className="p-3 rounded-xl border border-border-default bg-[#060c18]">
            <p className="text-xs text-text-secondary">
              Managing officer account: <strong className="text-white">{editingUser?.email}</strong>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                ISRO Employee / Badge ID
              </label>
              <input
                type="text"
                value={editBadgeId}
                onChange={(e) => setEditBadgeId(e.target.value)}
                placeholder="e.g. ISRO-TTC-042"
                className="num font-mono w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Designation / Operational Title
              </label>
              <input
                type="text"
                value={editDesignation}
                onChange={(e) => setEditDesignation(e.target.value)}
                placeholder="e.g. Lead Astrodynamics Specialist"
                className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Contact Phone / Intercom
              </label>
              <input
                type="text"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="e.g. +91 80 2838 4001"
                className="num font-mono w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                System Role
              </label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as 'MEMBER' | 'ADMIN')}
                className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
              >
                <option value="MEMBER">MEMBER (Standard User)</option>
                <option value="ADMIN">ADMIN (Division / System Administrator)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Account Status
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="PENDING">PENDING</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>
          </div>

          {/* MULTI-DEPARTMENT CLEARANCE MATRIX */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Building size={13} className="text-accent-light" />
                <span>Authorized Department Scopes:</span>
              </label>

              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={handleSelectAllDepts}
                  className="text-accent-light hover:underline font-semibold"
                >
                  Select All
                </button>
                <span className="text-text-dim">·</span>
                <button
                  type="button"
                  onClick={handleClearAllDepts}
                  className="text-text-dim hover:text-white"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-2 p-2 rounded-xl border border-border-default bg-[#060c18]">
              {allDepartments?.map((dept) => {
                const isSelected = !!selectedDeptAccess[dept.id]
                const level = selectedDeptAccess[dept.id] || 'READ_ONLY'

                return (
                  <div
                    key={dept.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-accent/50 bg-accent/[0.06]'
                        : 'border-border-subtle bg-card hover:border-border-bright'
                    }`}
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer select-none min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleDept(dept.id)}
                        className="h-4 w-4 rounded border-border-default bg-surface text-accent focus:ring-accent"
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white truncate block">
                          {dept.code || dept.name} — {dept.name}
                        </span>
                        <span className="text-[10px] text-text-dim truncate block">
                          {dept.description || 'Division Repository'}
                        </span>
                      </div>
                    </label>

                    {isSelected && (
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <select
                          value={level}
                          onChange={(e) =>
                            handleSetDeptLevel(dept.id, e.target.value as 'READ_ONLY' | 'READ_WRITE')
                          }
                          className="rounded-md border border-border-default bg-surface px-2 py-1 text-[11px] font-bold uppercase num text-accent-light outline-none"
                        >
                          <option value="READ_ONLY">READ ONLY</option>
                          <option value="READ_WRITE">READ & WRITE</option>
                        </select>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={savingEdit}
              className="bg-nominal hover:bg-nominal-hover shadow-md shadow-nominal/20"
            >
              {savingEdit ? 'Saving…' : 'Save Account Clearances'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Suspend Confirmation */}
      <ConfirmDialog
        isOpen={suspendTarget !== null}
        onClose={() => setSuspendTarget(null)}
        onConfirm={handleSuspendConfirm}
        title="Suspend user"
        message={`Suspend ${suspendTarget?.name}? They will be immediately logged out and unable to sign in until reinstated.`}
        confirmLabel="Suspend"
        isSubmitting={suspendUser.isPending}
      />

      {/* ============================================================ */}
      {/* MODAL: PROFILE & ACCESS DETAILS INSPECTOR */}
      {/* ============================================================ */}
      <Modal
        isOpen={inspectingUser !== null}
        onClose={() => setInspectingUser(null)}
        title="Officer Dossier & Access Details"
      >
        {inspectingUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-3.5 p-4 rounded-xl border border-border-default bg-[#060c18]">
              <Avatar name={inspectingUser.name} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white truncate">
                    {inspectingUser.name}
                  </h3>
                  {(inspectingUser.email === 'admin@istrac.local' || inspectingUser.employeeId === 'ISRO-DIR-001') && (
                    <span title="Root Authority">
                      <Crown size={14} className="text-yellow-400 shrink-0" />
                    </span>
                  )}
                </div>

                {inspectingUser.designation && (
                  <p className="text-xs text-accent-light font-semibold truncate">
                    {inspectingUser.designation}
                  </p>
                )}

                <p className="text-xs text-text-dim font-mono">{inspectingUser.email}</p>
                
                <div className="flex items-center gap-2 pt-1">
                  <span className="rounded bg-surface border border-border-subtle px-2 py-0.5 text-[10px] font-bold uppercase num text-accent-light">
                    {inspectingUser.role}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                      inspectingUser.status === 'ACTIVE'
                        ? 'bg-nominal/15 text-nominal border border-nominal/30'
                        : 'bg-critical/15 text-critical border border-critical/30'
                    }`}
                  >
                    {inspectingUser.status}
                  </span>
                </div>
              </div>
            </div>

            {/* 6-Grid Telemetry and Profile Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs num">
              <div className="p-3 rounded-lg border border-border-subtle bg-surface">
                <span className="text-[10px] text-text-dim block uppercase font-bold">ISRO Badge / Employee ID</span>
                <strong className="text-white text-sm font-mono">{inspectingUser.employeeId || 'NOT ASSIGNED'}</strong>
              </div>

              <div className="p-3 rounded-lg border border-border-subtle bg-surface">
                <span className="text-[10px] text-text-dim block uppercase font-bold">Contact Phone</span>
                <strong className="text-white text-sm font-mono">{inspectingUser.phone || 'Not Provided'}</strong>
              </div>

              <div className="p-3 rounded-lg border border-border-subtle bg-surface">
                <span className="text-[10px] text-text-dim block uppercase font-bold">Target Division Preference</span>
                <strong className="text-accent-light text-xs">{inspectingUser.departmentPreference || 'All Ground Operations'}</strong>
              </div>

              <div className="p-3 rounded-lg border border-border-subtle bg-surface">
                <span className="text-[10px] text-text-dim block uppercase font-bold">Clearance Level</span>
                <strong className="text-accent-light">
                  {inspectingUser.email === 'admin@istrac.local' ? 'ROOT AUTHORITY' : 'MULTI-DIVISION'}
                </strong>
              </div>

              <div className="p-3 rounded-lg border border-border-subtle bg-surface">
                <span className="text-[10px] text-text-dim block uppercase font-bold">Account Created</span>
                <span className="text-text-secondary">{new Date(inspectingUser.createdAt).toLocaleDateString()}</span>
              </div>

              <div className="p-3 rounded-lg border border-border-subtle bg-surface">
                <span className="text-[10px] text-text-dim block uppercase font-bold">Last Session Login</span>
                <span className="text-text-secondary">
                  {inspectingUser.lastLogin ? new Date(inspectingUser.lastLogin).toLocaleString() : 'Never logged in'}
                </span>
              </div>
            </div>

            {/* Operational Justification */}
            {inspectingUser.reasonForAccess && (
              <div className="p-3 rounded-lg border border-border-default bg-[#060c18] space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim block">
                  Operational Justification / Access Reason:
                </span>
                <p className="text-xs text-text-primary leading-relaxed">
                  "{inspectingUser.reasonForAccess}"
                </p>
              </div>
            )}

            <div>
              <span className="text-xs font-bold text-text-primary block mb-1.5">Authorized Department Repositories:</span>
              {inspectingUser.email === 'admin@istrac.local' || inspectingUser.employeeId === 'ISRO-DIR-001' ? (
                <div className="p-2.5 rounded-lg border border-purple-400/30 bg-purple-400/10 text-xs text-purple-200">
                  👑 <strong>System Root Authority:</strong> Permanent administrative clearance across all department directories and air-gapped repositories.
                </div>
              ) : !inspectingUser.departmentAccess || inspectingUser.departmentAccess.length === 0 ? (
                <p className="text-xs text-text-dim">No specific division access assigned.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {inspectingUser.departmentAccess.map((da: any) => (
                    <span
                      key={da.department?.id || da.id}
                      className="rounded-md border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent-light"
                    >
                      {da.department?.code || da.department?.name || 'TTC'} ({da.accessLevel})
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
              {!(inspectingUser.email === 'admin@istrac.local' || inspectingUser.employeeId === 'ISRO-DIR-001') && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const u = inspectingUser
                    setInspectingUser(null)
                    handleOpenEdit(u)
                  }}
                  className="border-accent/40 text-accent-light hover:bg-accent/10"
                >
                  <Edit2 size={13} />
                  <span>Modify Clearances…</span>
                </Button>
              )}

              <Button type="button" variant="outline" size="sm" onClick={() => setInspectingUser(null)} className="ml-auto">
                Close Dossier
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
