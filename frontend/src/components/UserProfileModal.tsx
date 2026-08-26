import { useState } from 'react'
import {
  User,
  Key,
  Crown,
  Building,
  Lock,
  AlertCircle,
  Sliders,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'
import { apiClient } from '../api/client'
import { Modal, Button, Avatar, Input } from '.'

interface UserProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const user = useAuthStore((s) => s.user)
  const addToast = useToastStore((s) => s.addToast)

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences'>('profile')

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
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'bg-accent/20 text-accent-light border border-accent/40 shadow-sm'
                : 'text-text-dim hover:text-white hover:bg-surface'
            }`}
          >
            <User size={13} />
            <span>Clearance Profile</span>
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
        {/* TAB 1: PROFILE & CLEARANCES */}
        {/* ============================================================ */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs num">
              <div className="p-3 rounded-lg border border-border-subtle bg-surface">
                <span className="text-[10px] text-text-dim block uppercase font-bold">ISRO Badge / Employee ID</span>
                <strong className="text-white text-sm font-mono">{user?.employeeId || 'ISRO-OPS-001'}</strong>
              </div>

              <div className="p-3 rounded-lg border border-border-subtle bg-surface">
                <span className="text-[10px] text-text-dim block uppercase font-bold">Ground Station Node</span>
                <strong className="text-accent-light text-sm">BLR MOX Operations</strong>
              </div>

              <div className="p-3 rounded-lg border border-border-subtle bg-surface">
                <span className="text-[10px] text-text-dim block uppercase font-bold">Security Clearance</span>
                <span className="text-text-secondary font-semibold">
                  {isRoot ? 'ROOT EXECUTIVE AUTHORITY' : 'USER LEVEL 3'}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-border-subtle bg-surface">
                <span className="text-[10px] text-text-dim block uppercase font-bold">Session Security</span>
                <span className="text-nominal font-semibold flex items-center gap-1">
                  <Lock size={11} />
                  <span>TLS-1.3 Encrypted</span>
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
