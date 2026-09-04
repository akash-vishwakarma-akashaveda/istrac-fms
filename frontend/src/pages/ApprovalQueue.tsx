import { useState, useEffect } from 'react'
import {
  UserCheck,
  Check,
  X,
  History,
  ShieldCheck,
  Search,
  FileText,
  Eye,
  Crown,
  Building,
  KeyRound,
  Edit2,
} from 'lucide-react'
import { apiClient } from '../api/client'
import {
  usePendingUsers,
  useApproveUser,
  useRejectUser,
} from '../hooks/usePendingUsers'
import { useDepartments } from '../hooks/useDepartments'
import { useToastStore } from '../store/toastStore'
import { Avatar, Badge, Button, PageHeader, Modal, Textarea } from '../components'
import { RejectModal } from '../components/RejectModal'
import type { UserProfile } from '../api/auth.api'

interface DepartmentAccessItem {
  id: string
  name: string
  code: string
  accessLevel: 'READ_ONLY' | 'READ_WRITE'
}

interface HistoryRecord {
  id: string
  name: string
  email: string
  employeeId?: string | null
  role: string
  status: string
  appliedAt: string
  decidedAt: string
  lastLogin?: string | null
  isRootSuperAdmin?: boolean
  departments: DepartmentAccessItem[]
  reviewedBy: {
    name: string
    email: string
  }
  decisionAction: string
}

interface DocumentRequestRecord {
  id: string
  requestedBy: {
    id: string
    name: string
    email: string
    employeeId?: string | null
  }
  department: {
    id: string
    name: string
    code: string
  }
  report?: {
    id: string
    title: string
    reportNumber?: string | null
  } | null
  requestedLevel: string
  status: string
  reason?: string | null
  adminComment?: string | null
  requestedAt: string
  processedAt?: string | null
  processedBy?: {
    id: string
    name: string
    email: string
  } | null
}

export function ApprovalQueue() {
  const { data: pendingUsers, isLoading: loadingPending, refetch: refetchPending } = usePendingUsers()
  const { data: allDepartments } = useDepartments()
  const approveUser = useApproveUser()
  const rejectUser = useRejectUser()
  const addToast = useToastStore((s) => s.addToast)

  // Active Tab: 'pending' | 'history' | 'document_requests'
  const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'document_requests'>('pending')

  // History State
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL')

  // Document Requests State
  const [docRequests, setDocRequests] = useState<DocumentRequestRecord[]>([])
  const [loadingDocRequests, setLoadingDocRequests] = useState(false)

  // Modals & States
  const [rejectingUserId, setRejectingUserId] = useState<string | null>(null)
  const [inspectingUser, setInspectingUser] = useState<HistoryRecord | null>(null)
  const [editingUserAccess, setEditingUserAccess] = useState<HistoryRecord | null>(null)

  // Approve & Clearance Grant Modal State
  const [grantingUser, setGrantingUser] = useState<UserProfile | null>(null)
  const [grantRole, setGrantRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER')
  const [grantBadgeId, setGrantBadgeId] = useState('')
  const [selectedDeptAccess, setSelectedDeptAccess] = useState<Record<string, 'READ_ONLY' | 'READ_WRITE'>>({})
  const [savingGrant, setSavingGrant] = useState(false)

  // Document Request Processing Modal State
  const [processingDocRequest, setProcessingDocRequest] = useState<DocumentRequestRecord | null>(null)
  const [docDecisionComment, setDocDecisionComment] = useState('')
  const [processingDocAction, setProcessingDocAction] = useState<'APPROVED' | 'REJECTED' | null>(null)
  const [submittingDoc, setSubmittingDoc] = useState(false)

  // Fetch History Records
  const fetchHistory = async () => {
    setLoadingHistory(true)
    try {
      const res = await apiClient.get('/admin/approvals/history', {
        params: {
          search: historySearch || undefined,
          status: historyStatusFilter !== 'ALL' ? historyStatusFilter : undefined,
        },
      })
      if (res.data?.data) {
        setHistory(res.data.data)
      }
    } catch {
      addToast({ title: 'Error', message: 'Failed to load decision history', variant: 'error' })
    } finally {
      setLoadingHistory(false)
    }
  }

  // Fetch Document Requests
  const fetchDocRequests = async () => {
    setLoadingDocRequests(true)
    try {
      const res = await apiClient.get('/admin/approvals/document-requests')
      if (res.data?.data) {
        setDocRequests(res.data.data)
      }
    } catch {
      addToast({ title: 'Error', message: 'Failed to load document access requests', variant: 'error' })
    } finally {
      setLoadingDocRequests(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory()
    } else if (activeTab === 'document_requests') {
      fetchDocRequests()
    }
  }, [activeTab, historySearch, historyStatusFilter])

  // Open Grant Clearance Modal for Pending User
  const handleOpenGrantModal = (user: UserProfile) => {
    setGrantingUser(user)
    setGrantRole('MEMBER')
    setGrantBadgeId(user.employeeId || '')
    
    // Check if user requested a specific department
    const initialDepts: Record<string, 'READ_ONLY' | 'READ_WRITE'> = {}
    if (user.departmentPreference && allDepartments) {
      const matched = allDepartments.find(
        (d) =>
          d.name.toLowerCase() === user.departmentPreference?.toLowerCase() ||
          (d.code && user.departmentPreference?.toLowerCase().includes(d.code.toLowerCase()))
      )
      if (matched) {
        initialDepts[matched.id] = 'READ_WRITE'
      }
    }

    if (Object.keys(initialDepts).length === 0 && allDepartments && allDepartments.length > 0) {
      initialDepts[allDepartments[0].id] = 'READ_ONLY'
    }
    setSelectedDeptAccess(initialDepts)
  }

  // Open Edit Clearance Modal for Existing User
  const handleOpenEditAccessModal = (user: HistoryRecord) => {
    setEditingUserAccess(user)
    setGrantRole(user.role === 'ADMIN' ? 'ADMIN' : 'MEMBER')
    setGrantBadgeId(user.employeeId || '')
    const mapped: Record<string, 'READ_ONLY' | 'READ_WRITE'> = {}
    user.departments.forEach((d) => {
      mapped[d.id] = d.accessLevel || 'READ_ONLY'
    })
    setSelectedDeptAccess(mapped)
  }

  // Toggle department in access matrix
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

  // Confirm Grant Clearance & Multi-Department Approval
  const handleSaveApproval = (e: React.FormEvent) => {
    e.preventDefault()
    if (!grantingUser) return

    setSavingGrant(true)
    const departmentsPayload = Object.entries(selectedDeptAccess).map(([departmentId, accessLevel]) => ({
      departmentId,
      accessLevel,
    }))

    approveUser.mutate(
      {
        userId: grantingUser.id,
        role: grantRole,
        employeeId: grantBadgeId.trim() || undefined,
        departments: departmentsPayload,
      },
      {
        onSuccess: () => {
          addToast({
            title: 'User Approved',
            message: `${grantingUser.name} granted clearance across ${departmentsPayload.length} department(s).`,
            variant: 'success',
          })
          setGrantingUser(null)
          refetchPending()
          if (activeTab === 'history') fetchHistory()
        },
        onError: () => addToast({ message: 'Failed to approve user — try again', variant: 'error' }),
        onSettled: () => setSavingGrant(false),
      }
    )
  }

  // Save Modified Access for Existing User
  const handleSaveModifiedAccess = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUserAccess) return

    setSavingGrant(true)
    const departmentsPayload = Object.entries(selectedDeptAccess).map(([departmentId, accessLevel]) => ({
      departmentId,
      accessLevel,
    }))

    try {
      await apiClient.put(`/admin/users/${editingUserAccess.id}`, {
        role: grantRole,
        employeeId: grantBadgeId.trim() || undefined,
        departments: departmentsPayload,
      })

      addToast({
        title: 'Clearances Updated',
        message: `Updated multi-department permissions for ${editingUserAccess.name}.`,
        variant: 'success',
      })
      setEditingUserAccess(null)
      setInspectingUser(null)
      fetchHistory()
    } catch {
      addToast({ title: 'Update Failed', message: 'Could not save modified clearance settings', variant: 'error' })
    } finally {
      setSavingGrant(false)
    }
  }

  function handleRejectConfirm(reason: string) {
    if (!rejectingUserId) return
    const user = pendingUsers?.find((u) => u.id === rejectingUserId)

    rejectUser.mutate(
      { userId: rejectingUserId, reason },
      {
        onSuccess: () => {
          addToast({ title: 'Rejected', message: `${user?.name ?? 'User'} registration rejected`, variant: 'info' })
          setRejectingUserId(null)
          refetchPending()
          if (activeTab === 'history') fetchHistory()
        },
        onError: () => addToast({ message: 'Failed to reject — try again', variant: 'error' }),
      },
    )
  }

  // Process Document Access Decision
  async function handleDocRequestSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!processingDocRequest || !processingDocAction) return

    setSubmittingDoc(true)
    try {
      await apiClient.put(`/admin/approvals/document-requests/${processingDocRequest.id}`, {
        status: processingDocAction,
        adminComment: docDecisionComment || undefined,
      })

      addToast({
        title: processingDocAction === 'APPROVED' ? 'Access Granted' : 'Request Rejected',
        message: `Processed request for ${processingDocRequest.requestedBy.name}`,
        variant: processingDocAction === 'APPROVED' ? 'success' : 'info',
      })

      setProcessingDocRequest(null)
      setProcessingDocAction(null)
      setDocDecisionComment('')
      fetchDocRequests()
    } catch {
      addToast({ title: 'Error', message: 'Could not process access request', variant: 'error' })
    } finally {
      setSubmittingDoc(false)
    }
  }

  const pendingCount = pendingUsers?.length || 0
  const pendingDocCount = docRequests.filter((r) => r.status === 'PENDING').length

  return (
    <div className="w-full space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-subtle pb-5">
        <PageHeader
          eyebrow="Administration"
          title="Approval Queue & Access Governance"
          description="Grant multi-department clearance tiers, assign operational roles, and audit past access decisions."
        />

        <div className="flex items-center gap-2">
          {pendingCount > 0 ? (
            <Badge variant="warning">{pendingCount} Registrations Pending</Badge>
          ) : (
            <Badge variant="nominal">Queue Clear</Badge>
          )}
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-border-default pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'pending'
              ? 'bg-accent text-white shadow-md shadow-accent/25'
              : 'text-text-secondary hover:text-white hover:bg-card'
          }`}
        >
          <UserCheck size={14} />
          <span>Pending Registrations</span>
          {pendingCount > 0 && (
            <span className="ml-1 rounded-full bg-warning/30 text-warning px-1.5 py-0.2 text-[10px] num font-extrabold">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'history'
              ? 'bg-accent text-white shadow-md shadow-accent/25'
              : 'text-text-secondary hover:text-white hover:bg-card'
          }`}
        >
          <History size={14} />
          <span>Approval & Decision History</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('document_requests')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'document_requests'
              ? 'bg-accent text-white shadow-md shadow-accent/25'
              : 'text-text-secondary hover:text-white hover:bg-card'
          }`}
        >
          <FileText size={14} />
          <span>Department Access Requests</span>
          {pendingDocCount > 0 && (
            <span className="ml-1 rounded-full bg-accent/30 text-accent-light px-1.5 py-0.2 text-[10px] num font-extrabold">
              {pendingDocCount}
            </span>
          )}
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: PENDING REGISTRATIONS */}
      {/* ============================================================ */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {loadingPending ? (
            <div className="h-48 rounded-xl border border-border-subtle bg-card flex items-center justify-center text-xs text-text-dim">
              Scanning pending approval queue…
            </div>
          ) : !pendingUsers || pendingUsers.length === 0 ? (
            <div className="rounded-xl border border-border-subtle bg-card px-6 py-16 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-nominal/30 bg-nominal/10 text-nominal">
                <ShieldCheck size={24} />
              </div>
              <p className="text-sm font-bold text-white">No Pending Registrations</p>
              <p className="text-xs text-text-secondary max-w-sm mx-auto">
                All operator registration requests have been reviewed and verified.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border-default bg-card shadow-sm">
              <div className="divide-y divide-border-subtle">
                {pendingUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 hover:bg-card-hover transition-colors"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border-default bg-[#0b1424] text-accent-light font-bold text-sm">
                        {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-white truncate">
                            {user.name}
                          </h4>
                          {user.designation && (
                            <span className="rounded-md border border-border-subtle bg-surface px-2 py-0.5 text-[11px] text-text-dim">
                              {user.designation}
                            </span>
                          )}
                          <span className="rounded-md border border-accent/40 bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent-light num">
                            {user.role}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-dim">
                          <span>{user.email}</span>
                          {user.phone && <span>· {user.phone}</span>}
                          {user.employeeId && (
                            <span className="font-mono text-text-muted">
                              · ID: {user.employeeId}
                            </span>
                          )}
                        </div>

                        {user.departmentPreference && (
                          <div className="pt-1 flex items-center gap-1.5 text-xs text-text-secondary">
                            <span className="font-semibold text-accent-light">Requested Division:</span>
                            <span className="rounded bg-[#0e1b33] border border-accent/20 px-2 py-0.5 text-[11px] text-text-primary">
                              {user.departmentPreference}
                            </span>
                          </div>
                        )}

                        {user.reasonForAccess && (
                          <p className="text-xs text-text-dim italic bg-surface/50 border-l-2 border-accent/50 pl-2.5 py-1 rounded-r mt-1 max-w-xl">
                            "{user.reasonForAccess}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenGrantModal(user)}
                        className="font-bold shadow-md shadow-nominal/20 bg-nominal hover:bg-nominal-hover"
                      >
                        <KeyRound size={14} />
                        <span>Grant Clearance & Scope…</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRejectingUserId(user.id)}
                        className="border-critical/40 text-critical hover:bg-critical/10"
                      >
                        <X size={14} />
                        <span>Reject</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: AUDIT DECISION HISTORY */}
      {/* ============================================================ */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* History Search & Filter Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border border-border-default bg-card shadow-sm">
            <div className="sm:col-span-2 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
              <input
                type="text"
                placeholder="Search decision history by name, email, or badge ID…"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-[#060c18] pl-9 pr-3 py-2 text-xs text-white placeholder:text-text-dim outline-none focus:border-accent"
              />
            </div>

            <div>
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-[#060c18] px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
              >
                <option value="ALL">All Decision Outcomes</option>
                <option value="ACTIVE">APPROVED / ACTIVE USERS</option>
                <option value="REJECTED">REJECTED APPLICATIONS</option>
                <option value="SUSPENDED">SUSPENDED USERS</option>
              </select>
            </div>
          </div>

          {/* History Records Table */}
          {loadingHistory ? (
            <div className="h-56 rounded-xl border border-border-subtle bg-card flex items-center justify-center text-xs text-text-dim">
              Loading access decision logs…
            </div>
          ) : history.length === 0 ? (
            <div className="rounded-xl border border-border-subtle bg-card p-12 text-center space-y-2">
              <History size={28} className="mx-auto text-text-dim" />
              <p className="text-sm font-bold text-white">No Decision History Found</p>
              <p className="text-xs text-text-secondary">No user accounts matched your search criteria.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border-default bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[950px]">
                  <thead>
                    <tr className="border-b border-border-default bg-surface text-[11px] font-bold text-text-dim uppercase tracking-wider">
                      <th className="px-4 py-3.5">Applicant / Officer</th>
                      <th className="px-4 py-3.5">ISRO Badge ID</th>
                      <th className="px-4 py-3.5">Role & Clearance Scope</th>
                      <th className="px-4 py-3.5">Decision Status</th>
                      <th className="px-4 py-3.5">Decided At</th>
                      <th className="px-4 py-3.5">Reviewed By</th>
                      <th className="px-4 py-3.5 text-right">Clearance Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle text-xs">
                    {history.map((record) => (
                      <tr key={record.id} className="hover:bg-card-hover transition-colors">
                        {/* Name & Email */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={record.name} size="sm" />
                            <div className="min-w-0">
                              <p className="font-bold text-white truncate flex items-center gap-1.5">
                                <span>{record.name}</span>
                                {record.isRootSuperAdmin && (
                                  <Crown size={12} className="text-yellow-400 shrink-0" />
                                )}
                              </p>
                              <p className="text-[10px] text-text-dim truncate">{record.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Employee ID */}
                        <td className="px-4 py-3.5 num text-text-secondary">
                          {record.employeeId || '—'}
                        </td>

                        {/* Role & Multi-Department Badges */}
                        <td className="px-4 py-3.5">
                          <div className="space-y-1">
                            <span className="font-bold text-text-primary text-[11px] block">
                              {record.role}
                            </span>
                            {record.isRootSuperAdmin ? (
                              <span className="inline-flex rounded border border-purple-400/40 bg-purple-400/10 px-1.5 py-0.5 text-[9px] font-bold text-purple-300">
                                ALL DIVISIONS · ROOT ACCESS
                              </span>
                            ) : record.departments.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {record.departments.map((dept) => (
                                  <span
                                    key={dept.id}
                                    className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase num ${
                                      dept.accessLevel === 'READ_WRITE'
                                        ? 'bg-nominal/15 text-nominal border border-nominal/30'
                                        : 'bg-accent/15 text-accent-light border border-accent/30'
                                    }`}
                                    title={`Department: ${dept.name} (${dept.accessLevel})`}
                                  >
                                    {dept.code || dept.name} [{dept.accessLevel === 'READ_WRITE' ? 'RW' : 'RO'}]
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-text-dim italic">No assigned scopes</span>
                            )}
                          </div>
                        </td>

                        {/* Status / Decision Outcome */}
                        <td className="px-4 py-3.5">
                          {record.isRootSuperAdmin ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400/15 border border-yellow-400/40 px-2 py-0.5 text-[10px] font-bold text-yellow-300 uppercase">
                              <Crown size={10} />
                              <span>ROOT AUTHORITY</span>
                            </span>
                          ) : record.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-nominal/15 border border-nominal/30 px-2 py-0.5 text-[10px] font-bold text-nominal uppercase">
                              <Check size={10} />
                              <span>Approved</span>
                            </span>
                          ) : record.status === 'REJECTED' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-critical/15 border border-critical/30 px-2 py-0.5 text-[10px] font-bold text-critical uppercase">
                              <X size={10} />
                              <span>Rejected</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 border border-warning/30 px-2 py-0.5 text-[10px] font-bold text-warning uppercase">
                              <span>Suspended</span>
                            </span>
                          )}
                        </td>

                        {/* Decided At */}
                        <td className="px-4 py-3.5 num text-text-dim text-[11px]">
                          {new Date(record.decidedAt).toLocaleString([], {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>

                        {/* Reviewed By */}
                        <td className="px-4 py-3.5">
                          <div className="text-[11px]">
                            <span className="font-semibold text-text-primary block">{record.reviewedBy.name}</span>
                            <span className="text-[10px] text-text-dim">{record.reviewedBy.email}</span>
                          </div>
                        </td>

                        {/* Actions: View Details & Edit Clearances */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View Details Button */}
                            <button
                              type="button"
                              onClick={() => setInspectingUser(record)}
                              className="px-2.5 py-1 rounded-md border border-border-default bg-[#0c1424] text-text-muted hover:border-accent hover:text-white transition-all flex items-center gap-1.5 text-[11px] font-bold"
                              title="View Officer Dossier & Access Details"
                            >
                              <Eye size={12} className="text-accent-light" />
                              <span>View Details</span>
                            </button>

                            {/* Modify Clearances Button (Only for Non-Root Users) */}
                            {!record.isRootSuperAdmin && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditAccessModal(record)}
                                className="px-2.5 py-1 rounded-md border border-border-default bg-[#0c1424] text-text-muted hover:border-nominal hover:text-nominal transition-all flex items-center gap-1 text-[11px] font-semibold"
                                title="Modify Department Clearance Scopes"
                              >
                                <Edit2 size={11} />
                                <span className="hidden lg:inline">Permissions</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: DOCUMENT & DEPARTMENT ACCESS REQUESTS */}
      {/* ============================================================ */}
      {activeTab === 'document_requests' && (
        <div className="space-y-4">
          {loadingDocRequests ? (
            <div className="h-56 rounded-xl border border-border-subtle bg-card flex items-center justify-center text-xs text-text-dim">
              Loading department access requests…
            </div>
          ) : docRequests.length === 0 ? (
            <div className="rounded-xl border border-border-subtle bg-card p-12 text-center space-y-2">
              <FileText size={28} className="mx-auto text-text-dim" />
              <p className="text-sm font-bold text-white">No Department Access Requests</p>
              <p className="text-xs text-text-secondary">No elevated report or division access requests have been submitted.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border-default bg-card shadow-sm">
              <div className="divide-y divide-border-subtle">
                {docRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-card-hover transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="text-sm text-white">{req.requestedBy.name}</strong>
                        <span className="text-xs text-text-dim">({req.requestedBy.email})</span>
                        <span className="rounded bg-accent/15 border border-accent/30 px-2 py-0.5 text-[10px] font-bold text-accent-light uppercase">
                          {req.department.code || req.department.name}
                        </span>
                      </div>

                      <p className="text-xs text-text-secondary">
                        Requested Clearance: <strong className="text-white">{req.requestedLevel}</strong>
                        {req.report && (
                          <span> · Document: <strong className="text-accent-light">{req.report.title}</strong></span>
                        )}
                      </p>

                      {req.reason && (
                        <p className="text-[11px] text-text-dim bg-[#060c18] p-2 rounded-md border border-border-subtle/50 mt-1 max-w-xl">
                          <em>"{req.reason}"</em>
                        </p>
                      )}

                      <p className="text-[10px] text-text-dim num pt-0.5">
                        Submitted: {new Date(req.requestedAt).toLocaleString()}
                        {req.status !== 'PENDING' && (
                          <span className="ml-2 font-bold uppercase text-nominal">[{req.status}]</span>
                        )}
                      </p>
                    </div>

                    {req.status === 'PENDING' ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setProcessingDocRequest(req)
                            setProcessingDocAction('APPROVED')
                          }}
                          className="bg-nominal hover:bg-nominal-hover"
                        >
                          <Check size={14} />
                          <span>Approve Access</span>
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setProcessingDocRequest(req)
                            setProcessingDocAction('REJECTED')
                          }}
                          className="border-critical/40 text-critical hover:bg-critical/10"
                        >
                          <X size={14} />
                          <span>Reject</span>
                        </Button>
                      </div>
                    ) : (
                      <div className="text-right shrink-0 text-xs">
                        <span className={`font-bold ${req.status === 'APPROVED' ? 'text-nominal' : 'text-critical'}`}>
                          {req.status}
                        </span>
                        {req.processedBy && (
                          <p className="text-[10px] text-text-dim">by {req.processedBy.name}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: GRANT CLEARANCE & MULTI-DEPARTMENT AUTHORIZATION (PENDING USER) */}
      <Modal
        isOpen={grantingUser !== null}
        onClose={() => setGrantingUser(null)}
        title="Grant Clearance & Authorize Department Repositories"
      >
        <form onSubmit={handleSaveApproval} className="space-y-4">
          <div className="p-3.5 rounded-xl border border-border-default bg-[#060c18] space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">
                  {grantingUser?.name}
                  {grantingUser?.designation && (
                    <span className="text-xs text-accent-light ml-2 font-normal">
                      ({grantingUser.designation})
                    </span>
                  )}
                </p>
                <p className="text-xs text-text-dim font-mono">{grantingUser?.email}</p>
              </div>

              {grantingUser?.phone && (
                <span className="rounded bg-surface border border-border-subtle px-2 py-1 text-[11px] font-mono text-text-secondary">
                  📞 {grantingUser.phone}
                </span>
              )}
            </div>

            {grantingUser?.departmentPreference && (
              <div className="flex items-center gap-2 text-xs pt-1 border-t border-white/5">
                <span className="text-text-dim">Requested Division:</span>
                <strong className="text-accent-light font-bold">
                  {grantingUser.departmentPreference}
                </strong>
              </div>
            )}

            {grantingUser?.reasonForAccess && (
              <p className="text-xs text-text-muted italic bg-surface/50 p-2 rounded-lg border border-border-subtle">
                "{grantingUser.reasonForAccess}"
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                System Role
              </label>
              <select
                value={grantRole}
                onChange={(e) => setGrantRole(e.target.value as 'MEMBER' | 'ADMIN')}
                className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
              >
                <option value="MEMBER">MEMBER (Standard User)</option>
                <option value="ADMIN">ADMIN (Division / System Administrator)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                ISRO Employee / Badge ID
              </label>
              <input
                type="text"
                value={grantBadgeId}
                onChange={(e) => setGrantBadgeId(e.target.value)}
                placeholder="e.g. ISRO-TTC-042"
                className="num font-mono w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
              />
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
            <Button type="button" variant="outline" size="sm" onClick={() => setGrantingUser(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={savingGrant}
              className="bg-nominal hover:bg-nominal-hover shadow-md shadow-nominal/20"
            >
              {savingGrant ? 'Saving…' : 'Confirm Approval & Clearances'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: EDIT CLEARANCES FOR EXISTING USER */}
      <Modal
        isOpen={editingUserAccess !== null}
        onClose={() => setEditingUserAccess(null)}
        title="Modify Multi-Department Clearances & Scope"
      >
        <form onSubmit={handleSaveModifiedAccess} className="space-y-4">
          <div className="p-3 rounded-xl border border-border-default bg-[#060c18]">
            <p className="text-xs text-text-secondary">
              Managing permissions for user: <strong className="text-white">{editingUserAccess?.name}</strong> ({editingUserAccess?.email})
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                System Role
              </label>
              <select
                value={grantRole}
                onChange={(e) => setGrantRole(e.target.value as 'MEMBER' | 'ADMIN')}
                className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
              >
                <option value="MEMBER">MEMBER (Standard User)</option>
                <option value="ADMIN">ADMIN (Division / System Administrator)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                ISRO Employee / Badge ID
              </label>
              <input
                type="text"
                value={grantBadgeId}
                onChange={(e) => setGrantBadgeId(e.target.value)}
                placeholder="e.g. ISRO-TTC-042"
                className="num font-mono w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-white outline-none focus:border-accent"
              />
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
            <Button type="button" variant="outline" size="sm" onClick={() => setEditingUserAccess(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={savingGrant}
              className="bg-nominal hover:bg-nominal-hover shadow-md shadow-nominal/20"
            >
              {savingGrant ? 'Saving…' : 'Save Modified Clearances'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: REJECT REGISTRATION CONFIRMATION */}
      <RejectModal
        isOpen={rejectingUserId !== null}
        onClose={() => setRejectingUserId(null)}
        onConfirm={handleRejectConfirm}
        isSubmitting={rejectUser.isPending}
      />

      {/* MODAL: APPLICANT PROFILE INSPECTOR */}
      <Modal
        isOpen={inspectingUser !== null}
        onClose={() => setInspectingUser(null)}
        title="Applicant Profile & Access Record"
      >
        {inspectingUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border-default bg-[#060c18]">
              <Avatar name={inspectingUser.name} size="lg" />
              <div className="min-w-0">
                <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                  <span>{inspectingUser.name}</span>
                  {inspectingUser.isRootSuperAdmin && (
                    <Crown size={14} className="text-yellow-400 shrink-0" />
                  )}
                </h3>
                <p className="text-xs text-text-dim">{inspectingUser.email}</p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="rounded bg-surface border border-border-subtle px-2 py-0.5 text-[10px] font-bold uppercase num text-accent-light">
                    {inspectingUser.role}
                  </span>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                    inspectingUser.status === 'ACTIVE'
                      ? 'bg-nominal/15 text-nominal border border-nominal/30'
                      : 'bg-critical/15 text-critical border border-critical/30'
                  }`}>
                    {inspectingUser.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs num">
              <div className="p-3 rounded-lg border border-border-subtle bg-surface">
                <span className="text-[10px] text-text-dim block uppercase font-bold">ISRO Employee ID</span>
                <strong className="text-white text-sm">{inspectingUser.employeeId || 'NOT ASSIGNED'}</strong>
              </div>

              <div className="p-3 rounded-lg border border-border-subtle bg-surface">
                <span className="text-[10px] text-text-dim block uppercase font-bold">Reviewed By Officer</span>
                <strong className="text-white">{inspectingUser.reviewedBy.name}</strong>
              </div>

              <div className="p-3 rounded-lg border border-border-subtle bg-surface">
                <span className="text-[10px] text-text-dim block uppercase font-bold">Registration Applied</span>
                <span className="text-text-secondary">{new Date(inspectingUser.appliedAt).toLocaleDateString()}</span>
              </div>

              <div className="p-3 rounded-lg border border-border-subtle bg-surface">
                <span className="text-[10px] text-text-dim block uppercase font-bold">Decision Processed</span>
                <span className="text-text-secondary">{new Date(inspectingUser.decidedAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-text-primary block mb-1.5">Authorized Department Repositories:</span>
              {inspectingUser.isRootSuperAdmin ? (
                <div className="p-2.5 rounded-lg border border-purple-400/30 bg-purple-400/10 text-xs text-purple-200">
                  👑 <strong>System Root Authority:</strong> Full administrative clearance across all department directories and air-gapped repositories.
                </div>
              ) : inspectingUser.departments.length === 0 ? (
                <p className="text-xs text-text-dim">No specific division access assigned.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {inspectingUser.departments.map((dept) => (
                    <span
                      key={dept.id}
                      className="rounded-md border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent-light"
                    >
                      {dept.code || dept.name} ({dept.accessLevel})
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
              {!inspectingUser.isRootSuperAdmin && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const user = inspectingUser
                    setInspectingUser(null)
                    handleOpenEditAccessModal(user)
                  }}
                  className="border-accent/40 text-accent-light hover:bg-accent/10"
                >
                  <Edit2 size={13} />
                  <span>Modify Clearances…</span>
                </Button>
              )}

              <Button type="button" variant="outline" size="sm" onClick={() => setInspectingUser(null)} className="ml-auto">
                Close Profile
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: DOCUMENT ACCESS DECISION */}
      <Modal
        isOpen={processingDocRequest !== null}
        onClose={() => setProcessingDocRequest(null)}
        title={processingDocAction === 'APPROVED' ? 'Grant Department Access' : 'Reject Access Request'}
      >
        <form onSubmit={handleDocRequestSubmit} className="space-y-4">
          <p className="text-xs text-text-secondary leading-relaxed">
            You are deciding to <strong className={processingDocAction === 'APPROVED' ? 'text-nominal' : 'text-critical'}>{processingDocAction}</strong> access for{' '}
            <strong className="text-white">{processingDocRequest?.requestedBy.name}</strong> to the{' '}
            <strong className="text-accent-light">{processingDocRequest?.department.name}</strong> division repository.
          </p>

          <Textarea
            id="doc-decision-comment"
            label="Officer Decision Note / Justification"
            rows={2}
            value={docDecisionComment}
            onChange={(e) => setDocDecisionComment(e.target.value)}
            placeholder="Add operational clearance reference or reason..."
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button type="button" variant="outline" size="sm" onClick={() => setProcessingDocRequest(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={submittingDoc}
              className={processingDocAction === 'APPROVED' ? 'bg-nominal hover:bg-nominal-hover' : 'bg-critical hover:bg-critical-hover'}
            >
              {submittingDoc ? 'Processing…' : `Confirm ${processingDocAction}`}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
