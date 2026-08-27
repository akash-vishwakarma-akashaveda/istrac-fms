import { useState, useEffect } from 'react'
import {
  User,
  Key,
  Crown,
  Building,
  Lock,
  AlertCircle,
  Sliders,
  Edit2,
  Save,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'
import { apiClient } from '../api/client'
import { usersApi } from '../api/users.api'
import { Modal, Button, Avatar, Input } from '.'

interface UserProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const addToast = useToastStore((s) => s.addToast)

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences'>('profile')

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileName, setProfileName] = useState(user?.name || '')
  const [profileDesignation, setProfileDesignation] = useState(user?.designation || '')
  const [profilePhone, setProfilePhone] = useState(user?.phone || '')
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  // Sync state when user changes or modal opens
  useEffect(() => {
    if (user) {
      setProfileName(user.name || '')
      setProfileDesignation(user.designation || '')
      setProfilePhone(user.phone || '')
    }
  }, [user, isOpen])

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  // Preference Toggles
  const [soundAlerts, setSoundAlerts] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const isRoot = user?.email === 'admin@istrac.local' || user?.employeeId === 'ISRO-DIR-001'

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profileName.trim()) {
      addToast({
        title: 'Validation Error',
        message: 'Full Name is required.',
        variant: 'error',
      })
      return
    }

    setIsSavingProfile(true)
    try {
      const updated = await usersApi.updateProfile({
        name: profileName.trim(),
        designation: profileDesignation.trim() || undefined,
        phone: profilePhone.trim() || undefined,
      })

      if (updated) {
        updateUser({
          name: updated.name,
          designation: updated.designation,
          phone: updated.phone,
        })
      }

      addToast({
        title: 'Profile Updated',
        message: 'Your officer details have been saved successfully.',
        variant: 'success',
      })
      setIsEditingProfile(false)
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to update profile.'
      addToast({
        title: 'Update Failed',
        message: msg,
        variant: 'error',
      })
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.')
      return
    }

    setIsChangingPassword(true)
    try {
      await apiClient.put('/auth/change-password', {
        currentPassword,
        newPassword,
      })

      addToast({
        title: 'Password Updated',
        message: 'Your security credentials have been updated successfully.',
        variant: 'success',
      })

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setActiveTab('profile')
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to update password. Verify current password.'
      setPasswordError(msg)
      addToast({
        title: 'Update Failed',
        message: msg,
        variant: 'error',
      })
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Officer Dossier & Security Profile"
    >
      <div className="space-y-4 max-h-[78vh] overflow-y-auto pr-1">
        {/* Officer Header Card */}
        <div className="flex items-center gap-3.5 p-4 rounded-xl border border-border-default bg-[#060c18]">
          <Avatar name={user?.name ?? '?'} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white truncate">{user?.name}</h3>
              {isRoot && (
                <span title="Super Admin Root Authority">
                  <Crown size={14} className="text-yellow-400 shrink-0" />
                </span>
              )}
            </div>
            {user?.designation && (
              <p className="text-xs text-accent-light font-semibold truncate">
                {user.designation}
              </p>
            )}
            <p className="text-xs text-text-dim font-mono">{user?.email}</p>
            <div className="flex items-center gap-2 pt-1">
              <span className="rounded bg-surface border border-border-subtle px-2 py-0.5 text-[10px] font-bold uppercase num text-accent-light">
                {user?.role}
              </span>
              <span className="rounded bg-nominal/15 border border-nominal/30 px-2 py-0.5 text-[10px] font-bold uppercase num text-nominal flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-nominal animate-pulse" />
                ACTIVE SESSION
              </span>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 border-b border-border-subtle pb-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('profile')
              setIsEditingProfile(false)
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'bg-accent/20 text-accent-light border border-accent/40 shadow-sm'
                : 'text-text-dim hover:text-white hover:bg-surface'
            }`}
          >
            <User size={13} />
            <span>Officer Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'security'
                ? 'bg-accent/20 text-accent-light border border-accent/40 shadow-sm'
                : 'text-text-dim hover:text-white hover:bg-surface'
            }`}
          >
            <Key size={13} />
            <span>Change Password</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preferences')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'preferences'
                ? 'bg-accent/20 text-accent-light border border-accent/40 shadow-sm'
                : 'text-text-dim hover:text-white hover:bg-surface'
            }`}
          >
            <Sliders size={13} />
            <span>Preferences</span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* TAB 1: PROFILE & EDIT DETAILS */}
        {/* ============================================================ */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            {!isEditingProfile ? (
              // ---- VIEW MODE ----
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-text-dim">
                    Profile Attributes & Clearances
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingProfile(true)}
                    className="flex items-center gap-1.5 text-xs py-1"
                  >
                    <Edit2 size={12} className="text-accent-light" />
                    <span>Edit Profile</span>
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs num">
                  <div className="p-3 rounded-lg border border-border-subtle bg-surface">
                    <span className="text-[10px] text-text-dim block uppercase font-bold">Full Name</span>
                    <strong className="text-white text-sm">{user?.name}</strong>
                  </div>

                  <div className="p-3 rounded-lg border border-border-subtle bg-surface">
                    <span className="text-[10px] text-text-dim block uppercase font-bold">Official Designation</span>
                    <strong className="text-accent-light text-sm">
                      {user?.designation || 'Flight Operations Specialist'}
                    </strong>
                  </div>

                  <div className="p-3 rounded-lg border border-border-subtle bg-surface">
                    <span className="text-[10px] text-text-dim block uppercase font-bold">Contact Telephone</span>
                    <span className="text-white text-xs font-mono font-medium">
                      {user?.phone || 'Not configured'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-border-subtle bg-surface">
                    <span className="text-[10px] text-text-dim block uppercase font-bold">ISRO Badge / Employee ID</span>
                    <div className="flex items-center gap-1.5">
                      <strong className="text-white text-sm font-mono">{user?.employeeId || 'ISRO-OPS-001'}</strong>
                      <span title="Assigned ID (Read Only)">
                        <Lock size={10} className="text-text-dim shrink-0" />
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-border-subtle bg-surface">
                    <span className="text-[10px] text-text-dim block uppercase font-bold">Security Clearance</span>
                    <span className="text-text-secondary font-semibold">
                      {isRoot ? 'ROOT EXECUTIVE AUTHORITY' : 'USER LEVEL 3'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-border-subtle bg-surface">
                    <span className="text-[10px] text-text-dim block uppercase font-bold">Session Encryption</span>
                    <span className="text-nominal font-semibold flex items-center gap-1">
                      <Lock size={11} />
                      <span>TLS-1.3 Air-Gapped</span>
                    </span>
                  </div>
                </div>

                {/* Department Clearances */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                    <Building size={13} className="text-accent-light" />
                    <span>Authorized Division Scopes:</span>
                  </span>

                  {isRoot ? (
                    <div className="p-3 rounded-lg border border-purple-400/30 bg-purple-400/10 text-xs text-purple-200 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Crown size={14} className="text-yellow-400" />
                        <span>System Root Authority Active</span>
                      </div>
                      <p className="text-[11px] text-purple-300">
                        Full read, write, upload, and approval authority across all ground tracking and telemetry divisions.
                      </p>
                    </div>
                  ) : !user?.departmentAccess || user.departmentAccess.length === 0 ? (
                    <div className="p-3 rounded-lg border border-border-subtle bg-surface text-xs text-text-dim">
                      Standard station account. Contact administrator to request department clearance.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {user.departmentAccess.map((da: any) => (
                        <div
                          key={da.department?.id || da.id}
                          className="flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1.5 text-xs text-accent-light"
                        >
                          <span className="font-bold">/{da.department?.code || da.department?.name || 'TTC'}</span>
                          <span className="text-[10px] num px-1 py-0.2 rounded bg-surface border border-accent/20">
                            {da.accessLevel === 'READ_WRITE' ? 'READ/WRITE' : 'READ ONLY'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // ---- EDIT PROFILE MODE ----
              <form onSubmit={handleSaveProfile} className="space-y-3.5">
                <div className="p-3 rounded-lg border border-accent/30 bg-accent/[0.06] text-xs text-text-secondary space-y-1">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    <Edit2 size={13} className="text-accent-light" />
                    <span>Edit Officer Profile Details</span>
                  </p>
                  <p className="text-[11px] text-text-dim">
                    Update your official display name, role designation, and operational contact number.
                  </p>
                </div>

                <div>
                  <Input
                    id="profile-name"
                    type="text"
                    label="Full Legal / Officer Name *"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="e.g. Dr. Vikram Sharma"
                  />
                </div>

                <div>
                  <Input
                    id="profile-designation"
                    type="text"
                    label="Official Designation / Title"
                    value={profileDesignation}
                    onChange={(e) => setProfileDesignation(e.target.value)}
                    placeholder="e.g. Flight Telemetry Console Operator / Lead Astrodynamics Specialist"
                    hint="Your operational role title displayed across logs and mission reports."
                  />
                </div>

                <div>
                  <Input
                    id="profile-phone"
                    type="text"
                    label="Contact Telephone Number"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="e.g. +91 80 2838 4001"
                    hint="Official intercom or secure console contact extension."
                  />
                </div>

                {/* Locked Identity Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-lg border border-border-default bg-[#060c18] opacity-75">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-[10px] uppercase font-bold text-text-dim">Official ISRO Email</span>
                      <span className="text-[10px] text-text-dim flex items-center gap-1 font-mono">
                        <Lock size={10} /> Locked
                      </span>
                    </div>
                    <span className="text-xs text-text-secondary font-mono block truncate">{user?.email}</span>
                    <span className="text-[10px] text-text-dim block pt-1">Permanent identity attribute.</span>
                  </div>

                  <div className="p-3 rounded-lg border border-border-default bg-[#060c18] opacity-75">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-[10px] uppercase font-bold text-text-dim">ISRO Employee ID</span>
                      <span className="text-[10px] text-text-dim flex items-center gap-1 font-mono">
                        <Lock size={10} /> Locked
                      </span>
                    </div>
                    <span className="text-xs text-text-secondary font-mono block truncate">{user?.employeeId || 'N/A'}</span>
                    <span className="text-[10px] text-text-dim block pt-1">Assigned by system administrator.</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (user) {
                        setProfileName(user.name || '')
                        setProfileDesignation(user.designation || '')
                        setProfilePhone(user.phone || '')
                      }
                      setIsEditingProfile(false)
                    }}
                  >
                    Cancel
                  </Button>

                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isSavingProfile || !profileName.trim()}
                    className="bg-nominal hover:bg-nominal-hover shadow-md shadow-nominal/20 flex items-center gap-1.5"
                  >
                    <Save size={13} />
                    <span>{isSavingProfile ? 'Saving Changes…' : 'Save Profile'}</span>
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: CHANGE PASSWORD */}
        {/* ============================================================ */}
        {activeTab === 'security' && (
          <form onSubmit={handleChangePassword} className="space-y-3.5">
            <div className="p-3 rounded-lg border border-border-default bg-[#060c18] text-xs text-text-secondary space-y-1">
              <p className="font-bold text-white">Update Security Credentials</p>
              <p className="text-[11px]">
                Ensure your new password contains at least 8 characters with numbers and symbols.
              </p>
            </div>

            {passwordError && (
              <div className="p-2.5 rounded-lg border border-critical/40 bg-critical/10 text-xs text-critical flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <div>
              <Input
                id="current-password"
                type="password"
                label="Current Password *"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>

            <div>
              <Input
                id="new-password"
                type="password"
                label="New Password *"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter at least 8 characters"
              />
            </div>

            <div>
              <Input
                id="confirm-password"
                type="password"
                label="Confirm New Password *"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPasswordError('')
                  setCurrentPassword('')
                  setNewPassword('')
                  setConfirmPassword('')
                }}
              >
                Reset
              </Button>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isChangingPassword || !currentPassword || !newPassword}
                className="bg-nominal hover:bg-nominal-hover shadow-md shadow-nominal/20"
              >
                {isChangingPassword ? 'Updating Password…' : 'Save New Password'}
              </Button>
            </div>
          </form>
        )}

        {/* ============================================================ */}
        {/* TAB 3: STATION PREFERENCES */}
        {/* ============================================================ */}
        {activeTab === 'preferences' && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg border border-border-default bg-[#060c18] space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-white block">Real-time Telemetry Chime</span>
                  <span className="text-[10px] text-text-dim block">Play audio alert on incoming critical broadcasts</span>
                </div>
                <input
                  type="checkbox"
                  checked={soundAlerts}
                  onChange={(e) => setSoundAlerts(e.target.checked)}
                  className="h-4 w-4 rounded accent-accent"
                />
              </label>

              <div className="border-t border-white/5 pt-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-white block">Auto-Refresh Dashboard Streams</span>
                    <span className="text-[10px] text-text-dim block">Poll file repositories and mission events every 30s</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="h-4 w-4 rounded accent-accent"
                  />
                </label>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border-subtle bg-surface text-xs space-y-1">
              <span className="text-[10px] font-bold text-text-dim uppercase block">Telemetry Display Mode</span>
              <p className="text-white font-mono text-[11px]">UTC ISO-8601 (Bengaluru Ground Station Sync)</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-border-subtle">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close Dossier
          </Button>
        </div>
      </div>
    </Modal>
  )
}
