import { useState, useEffect, forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { AxiosError } from 'axios'
import {
  X,
  LogIn,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'
import { useAuthModalStore, type AuthMode } from '../store/authModalStore'
import { loginSchema, registerSchema, type LoginFormData, type RegisterFormData } from '../../schemas/authSchemas'
import { authApi } from '../api'
import { usePublicDepartments } from '../hooks/useDepartments'
import { Button, Alert } from '.'
import { PasswordStrengthMeter, isPasswordValid } from './PasswordStrengthMeter'
import { useCms } from '../context/cmsContext'

// ============================================================================
// PROFESSIONAL SPACIOUS UNDERLINE-ONLY FORM CONTROLS
// ============================================================================

interface UnderlineInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'label'> {
  label: React.ReactNode
  error?: string
  hint?: string
}

const UnderlineInput = forwardRef<HTMLInputElement, UnderlineInputProps>(function UnderlineInput(
  { label, error, hint, id, type = 'text', className = '', ...props },
  ref,
) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const actualType = isPassword ? (showPassword ? 'text' : 'password') : type

  return (
    <div className="flex w-full flex-col gap-1.5">
      {typeof label === 'string' ? (
        <label htmlFor={id} className="text-xs font-medium text-slate-300">
          {label}
        </label>
      ) : (
        <div className="text-xs font-medium text-slate-300">{label}</div>
      )}

      <div className="relative flex items-center">
        <input
          ref={ref}
          id={id}
          type={actualType}
          className={`w-full bg-transparent border-0 border-b pb-2.5 pt-1 text-sm text-white placeholder:text-slate-500 outline-none transition-colors duration-200 ${
            isPassword ? 'pr-8' : ''
          } ${
            error
              ? 'border-critical focus:border-critical'
              : 'border-white/20 focus:border-accent hover:border-white/40'
          } ${className}`}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((p) => !p)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-0 bottom-2.5 text-text-dim hover:text-white transition-colors cursor-pointer"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>

      {error ? (
        <span className="text-[11px] text-critical font-medium leading-4 mt-1">{error}</span>
      ) : hint ? (
        <span className="text-[11px] text-text-dim leading-4 mt-1">{hint}</span>
      ) : null}
    </div>
  )
})

interface UnderlineSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  children: React.ReactNode
}

const UnderlineSelect = forwardRef<HTMLSelectElement, UnderlineSelectProps>(function UnderlineSelect(
  { label, error, id, children, className = '', ...props },
  ref,
) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-slate-300">
        {label}
      </label>

      <select
        ref={ref}
        id={id}
        className={`w-full bg-transparent border-0 border-b pb-2.5 pt-1 text-sm text-white outline-none transition-colors duration-200 cursor-pointer [&>option]:bg-[#0c1424] [&>option]:text-white ${
          error
            ? 'border-critical focus:border-critical'
            : 'border-white/20 focus:border-accent hover:border-white/40'
        } ${className}`}
        {...props}
      >
        {children}
      </select>

      {error && <span className="text-[11px] text-critical font-medium leading-4 mt-1">{error}</span>}
    </div>
  )
})

interface UnderlineTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
}

const UnderlineTextarea = forwardRef<HTMLTextAreaElement, UnderlineTextareaProps>(function UnderlineTextarea(
  { label, error, id, className = '', ...props },
  ref,
) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-slate-300">
        {label}
      </label>

      <textarea
        ref={ref}
        id={id}
        className={`w-full bg-transparent border-0 border-b pb-2 pt-1 text-sm text-white placeholder:text-slate-500 outline-none transition-colors duration-200 resize-none ${
          error
            ? 'border-critical focus:border-critical'
            : 'border-white/20 focus:border-accent hover:border-white/40'
        } ${className}`}
        {...props}
      />

      {error && <span className="text-[11px] text-critical font-medium leading-4 mt-1">{error}</span>}
    </div>
  )
})

// ============================================================================
// ERROR MAPPINGS & DEPARTMENTS
// ============================================================================

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Invalid email or password.',
  account_pending: 'Your account is pending administrator approval.',
  account_suspended: 'Your account has been suspended. Contact your administrator.',
  rate_limit_exceeded: 'Too many attempts. Please wait 15 minutes.',
  user_exists: 'An account with this email or employee ID already exists.',
}

const FALLBACK_DEPARTMENTS = [
  'Telemetry, Tracking & Command (TTC)',
  'Flight Dynamics Division (FDD)',
  'Mission Operations Complex (MOX)',
  'IS4OM / NETRA Space Situational Awareness',
  'Ground Station Operations (GSO)',
]

export function AuthModal() {
  const { cmsBlocks } = useCms()
  const headerBlock = (cmsBlocks['nav_header']?.content || cmsBlocks['nav_header'] || cmsBlocks['nav_footer']) as Record<string, any> | undefined
  const brandTitle = headerBlock?.brandTitle ?? 'ISTRAC'
  const brandHighlight = headerBlock?.brandHighlight !== undefined ? headerBlock.brandHighlight : '-SIMS'

  const { isOpen, mode, setMode, closeModal } = useAuthModalStore()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const addToast = useToastStore((s) => s.addToast)

  // Login State
  const [loginError, setLoginError] = useState<string | null>(null)
  const [lockoutRemaining, setLockoutRemaining] = useState<number | null>(null)

  // Register State
  const [registerSubmitted, setRegisterSubmitted] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [registerError, setRegisterError] = useState<string | null>(null)

  // Login Form
  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    setValue: setLoginValue,
    getValues: getLoginValues,
    reset: resetLoginForm,
    formState: { errors: loginErrors, isSubmitting: isLoggingIn },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  // Register Form
  const {
    register: registerReg,
    handleSubmit: handleRegSubmit,
    reset: resetRegForm,
    formState: { errors: regErrors, isSubmitting: isRegistering },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const prefillEmail = useAuthModalStore((s) => s.prefillEmail)

  // Reset Password State
  const [resetStep, setResetStep] = useState<'request_or_verify' | 'new_password' | 'done'>('request_or_verify')
  const [resetEmail, setResetEmail] = useState('')
  const [resetOtp, setResetOtp] = useState('')
  const [resetOtpError, setResetOtpError] = useState<string | null>(null)
  const [isRequestingOtp, setIsRequestingOtp] = useState(false)
  const [otpRequestSuccessMsg, setOtpRequestSuccessMsg] = useState<string | null>(null)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  useEffect(() => {
    if (prefillEmail) {
      setLoginValue('email', prefillEmail)
      setResetEmail(prefillEmail)
    }
  }, [prefillEmail, setLoginValue])

  const { data: publicDepts } = usePublicDepartments()
  const departments = publicDepts && publicDepts.length > 0 ? publicDepts.map((d) => d.name) : FALLBACK_DEPARTMENTS

  // Lockout Countdown Timer
  useEffect(() => {
    if (lockoutRemaining === null || lockoutRemaining <= 0) return
    const timer = setInterval(() => {
      setLockoutRemaining((prev) => (prev && prev > 1 ? prev - 1 : null))
    }, 1000)
    return () => clearInterval(timer)
  }, [lockoutRemaining])

  const handleClose = () => {
    closeModal()
    if (window.location.pathname === '/login' || window.location.pathname === '/register') {
      navigate('/', { replace: true })
    }
  }

  // ESC Key Listener & body scroll lock
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Reset forms on mode switch or close
  const handleSwitchMode = (newMode: AuthMode) => {
    setLoginError(null)
    setRegisterError(null)
    setRegisterSubmitted(false)
    setResetOtpError(null)
    setPasswordError(null)
    setOtpRequestSuccessMsg(null)
    setMode(newMode)
  }

  const handleSwitchToReset = (emailCandidate?: string) => {
    setLoginError(null)
    setRegisterError(null)
    setResetOtpError(null)
    setPasswordError(null)
    setOtpRequestSuccessMsg(null)
    setResetStep('request_or_verify')
    const emailToUse = emailCandidate || getLoginValues('email') || ''
    if (emailToUse) {
      setResetEmail(emailToUse)
    }
    setMode('reset')
  }

  const handleRequestOtp = async () => {
    if (!resetEmail || !resetEmail.includes('@')) {
      setResetOtpError('Please enter a valid official email address.')
      return
    }
    setIsRequestingOtp(true)
    setResetOtpError(null)
    setOtpRequestSuccessMsg(null)
    try {
      await authApi.forgotPassword(resetEmail.trim())
      setOtpRequestSuccessMsg(
        'Verification request submitted. A 6-digit security code has been recorded for your System Administrator. Please contact your administrator to obtain the code.'
      )
      addToast({
        title: 'Request Submitted',
        message: 'Verification code recorded for System Administrator dispatch.',
        variant: 'info',
      })
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to submit verification request'
      setResetOtpError(msg)
    } finally {
      setIsRequestingOtp(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetEmail || !resetEmail.includes('@')) {
      setResetOtpError('Please enter a valid official email address.')
      return
    }
    if (!resetOtp || !/^\d{6}$/.test(resetOtp.trim())) {
      setResetOtpError('Please enter the 6-digit verification code provided by your administrator.')
      return
    }

    setIsVerifyingOtp(true)
    setResetOtpError(null)
    try {
      await authApi.verifyResetOtp({ email: resetEmail.trim(), otp: resetOtp.trim() })
      setResetStep('new_password')
      addToast({
        title: 'Identity Confirmed',
        message: 'Verification code accepted. You may now establish your new password.',
        variant: 'success',
      })
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        'Invalid or expired verification code. Please check with your administrator.'
      setResetOtpError(msg)
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)

    if (!isPasswordValid(newPassword)) {
      setPasswordError('Please ensure your password meets all security criteria.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }

    setIsUpdatingPassword(true)
    try {
      await authApi.resetPassword({
        email: resetEmail.trim(),
        otp: resetOtp.trim(),
        newPassword,
      })
      setResetStep('done')
      addToast({
        title: 'Password Successfully Updated',
        message: 'Your password has been changed. You may now sign in.',
        variant: 'success',
      })
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        'Failed to update password. Please check your verification code.'
      setPasswordError(msg)
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  const handleDoneReturnToLogin = () => {
    setLoginValue('email', resetEmail, { shouldValidate: true })
    setMode('login')
    setResetStep('request_or_verify')
    setResetOtp('')
    setNewPassword('')
    setConfirmPassword('')
  }

  // Handle Login Submit
  async function onLogin(data: LoginFormData) {
    setLoginError(null)
    setLockoutRemaining(null)

    try {
      const response = await authApi.login(data)
      const user = response?.user
      const token = response?.accessToken
      const refreshToken = response?.refreshToken
      setAuth(user, token, refreshToken)

      addToast({
        title: 'Authentication Successful',
        message: `Welcome back, ${user?.name || 'Operator'} (${user?.role})`,
        variant: 'success',
      })

      closeModal()
      resetLoginForm()

      if (user?.role === 'ADMIN') {
        navigate('/admin')
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      const error = err as AxiosError<{
        error?: { code: string; message: string }
        lockoutSecondsRemaining?: number
      }>

      if (error.response?.status === 429 && error.response.data.lockoutSecondsRemaining) {
        setLockoutRemaining(error.response.data.lockoutSecondsRemaining)
      } else if (error.response?.data?.error?.message) {
        setLoginError(error.response.data.error.message)
      } else {
        const code = error.response?.data?.error?.code
        setLoginError(ERROR_MESSAGES[code!] ?? 'An unexpected error occurred. Please try again.')
      }
    }
  }

  // Handle Register Submit
  async function onRegister(data: RegisterFormData) {
    setRegisterError(null)

    try {
      await authApi.register(data)
      setRegisteredEmail(data.email)
      setRegisterSubmitted(true)
      resetRegForm()
      addToast({
        title: 'Access Request Queued',
        message: 'Your clearance request has been forwarded to administrators.',
        variant: 'success',
      })
    } catch (err) {
      const error = err as AxiosError<{
        error?: { code?: string; message?: string }
        message?: string
      }>

      const code = error.response?.data?.error?.code
      setRegisterError(ERROR_MESSAGES[code!] ?? 'An unexpected error occurred. Please try again.')
    }
  }

  if (!isOpen) return null

  const isRegisterMode = mode === 'register'

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 md:p-8 bg-black/60 backdrop-blur-md overflow-y-auto animate-fadeIn"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      {/* Spacious Translucent Minimalist Modal Dialog */}
      <div
        className={`relative w-full my-6 sm:my-8 rounded-2xl border border-white/15 bg-[#0a0f1d]/90 shadow-2xl overflow-hidden transition-all duration-300 animate-rise text-text-primary backdrop-blur-md ${
          isRegisterMode ? 'max-w-2xl' : 'max-w-lg'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="border-b border-white/10 bg-[#080d19]/85 px-5 sm:px-8 py-4 sm:py-5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-accent-light">
              <ShieldCheck size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono font-semibold tracking-wider text-text-dim uppercase">
                <span>ISRO · {brandTitle}{brandHighlight}</span>
                <span>·</span>
                <span className="text-nominal">SECURED</span>
              </div>
              <h2 id="auth-modal-title" className="text-base sm:text-lg font-bold text-white mt-0.5 truncate">
                {mode === 'login'
                  ? 'Mission Operations Login'
                  : mode === 'register'
                  ? 'Request Operational Access'
                  : 'Reset Password with Verification Code'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-text-muted hover:text-white hover:bg-white/10 transition-colors cursor-pointer ml-2"
            aria-label="Close modal (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Minimalist Spacious Underline Tabs */}
        <div className="flex border-b border-white/10 bg-black/20 px-5 sm:px-8">
          <button
            type="button"
            onClick={() => handleSwitchMode('login')}
            className={`pb-3.5 sm:pb-4 pt-3 sm:pt-3.5 mr-6 sm:mr-8 flex items-center gap-2 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
              mode === 'login'
                ? 'border-accent text-white'
                : 'border-transparent text-text-dim hover:text-text-secondary'
            }`}
          >
            <LogIn size={15} />
            <span>Sign In</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchMode('register')}
            className={`pb-3.5 sm:pb-4 pt-3 sm:pt-3.5 ${
              mode === 'reset' ? 'mr-6 sm:mr-8' : ''
            } flex items-center gap-2 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
              mode === 'register'
                ? 'border-accent text-white'
                : 'border-transparent text-text-dim hover:text-text-secondary'
            }`}
          >
            <UserPlus size={15} />
            <span>Request Access</span>
          </button>

          {mode === 'reset' && (
            <button
              type="button"
              className="pb-3.5 sm:pb-4 pt-3 sm:pt-3.5 flex items-center gap-2 text-sm font-semibold transition-colors border-b-2 border-accent text-white"
            >
              <KeyRound size={15} />
              <span>Reset Password</span>
            </button>
          )}
        </div>

        {/* Modal Body Content */}
        <div className="p-5 sm:p-8 space-y-6 sm:space-y-7 max-h-[calc(85vh-160px)] overflow-y-auto">
          {/* ============================================================ */}
          {/* LOGIN FORM MODE */}
          {/* ============================================================ */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit(onLogin)} className="space-y-6">
              {loginError && (
                <Alert variant="critical" title="Authentication Error">
                  {loginError}
                </Alert>
              )}

              {lockoutRemaining && (
                <Alert variant="warning" title="Rate Limit Active">
                  Too many failed attempts. Terminal unlocked in{' '}
                  <strong className="font-mono text-white">{lockoutRemaining}s</strong>.
                </Alert>
              )}

              {/* Email Field — Underline Only */}
              <UnderlineInput
                id="modal-login-email"
                label="Official Email Address"
                type="email"
                placeholder="operator@istrac.local"
                autoComplete="email"
                error={loginErrors.email?.message}
                {...registerLogin('email')}
              />

              {/* Password Field — Underline Only */}
              <UnderlineInput
                id="modal-login-password"
                label={
                  <div className="flex items-center justify-between">
                    <span>Access Key / Password</span>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => handleSwitchToReset(getLoginValues('email'))}
                      className="text-[11px] text-accent-light hover:underline font-medium cursor-pointer"
                    >
                      Forgot password? Enter code →
                    </button>
                  </div>
                }
                type="password"
                placeholder="••••••••••••"
                autoComplete="current-password"
                error={loginErrors.password?.message}
                {...registerLogin('password')}
              />

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={isLoggingIn || lockoutRemaining !== null}
                className="w-full justify-center bg-accent hover:bg-accent-hover font-semibold mt-6 py-3 cursor-pointer text-sm rounded-lg shadow-sm"
              >
                {isLoggingIn ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>Verifying Credentials…</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn size={16} />
                    <span>Authenticate & Access Console</span>
                    <ArrowRight size={14} className="opacity-80" />
                  </span>
                )}
              </Button>

              {/* Reset Password Callout Link */}
              <div className="text-center pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => handleSwitchToReset(getLoginValues('email'))}
                  className="text-xs text-text-dim hover:text-accent-light transition-colors cursor-pointer"
                >
                  Forgot your password? <span className="text-accent-light font-medium underline">Enter verification code</span> to reset credentials
                </button>
              </div>
            </form>
          )}

          {/* ============================================================ */}
          {/* RESET PASSWORD / OTP VERIFICATION MODE */}
          {/* ============================================================ */}
          {mode === 'reset' && (
            <>
              {resetStep === 'done' ? (
                <div className="py-8 text-center space-y-5 animate-fadeIn">
                  <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-nominal/15 border border-nominal/30 text-nominal">
                    <CheckCircle2 size={34} />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-lg font-bold text-white">Password Successfully Updated</h3>
                    <p className="text-sm text-text-secondary leading-relaxed max-w-md mx-auto">
                      Your access credentials for <strong className="text-white font-mono">{resetEmail}</strong> have been updated. All previous active sessions have been terminated.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-white/10 bg-card/60 text-left text-xs space-y-2 font-mono max-w-md mx-auto">
                    <div className="text-[11px] text-text-dim uppercase font-semibold">Security Confirmation</div>
                    <div className="flex items-center justify-between text-text-secondary">
                      <span>Verification Status:</span>
                      <span className="text-nominal font-bold">VERIFIED & CONSUMED</span>
                    </div>
                    <div className="flex items-center justify-between text-text-secondary">
                      <span>Session Status:</span>
                      <span className="text-slate-300">All sessions revoked (Re-login required)</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleDoneReturnToLogin}
                    className="justify-center bg-accent shadow-sm cursor-pointer px-8 mt-2 text-xs font-semibold"
                  >
                    <LogIn size={15} />
                    <span>Proceed to Sign In</span>
                  </Button>
                </div>
              ) : resetStep === 'new_password' ? (
                <form onSubmit={handleUpdatePassword} className="space-y-6 animate-fadeIn">
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-nominal/30 bg-nominal/10 text-xs">
                    <div className="flex items-center gap-2 text-nominal font-semibold">
                      <CheckCircle2 size={16} />
                      <span>Security Code Verified for <span className="font-mono text-white">{resetEmail}</span></span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setResetStep('request_or_verify')}
                      className="text-[11px] text-text-dim hover:text-white underline cursor-pointer"
                    >
                      Change Code
                    </button>
                  </div>

                  {passwordError && (
                    <Alert variant="critical" title="Security Validation Error">
                      {passwordError}
                    </Alert>
                  )}

                  {/* New Password */}
                  <UnderlineInput
                    id="modal-reset-newpassword"
                    label="New Security Password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 10 characters (uppercase, digit & symbol)"
                    autoComplete="new-password"
                    required
                  />

                  <PasswordStrengthMeter password={newPassword} />

                  {/* Confirm Password */}
                  <UnderlineInput
                    id="modal-reset-confirmpassword"
                    label="Confirm New Password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password to confirm"
                    autoComplete="new-password"
                    required
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={isUpdatingPassword || !isPasswordValid(newPassword) || newPassword !== confirmPassword}
                    className="w-full justify-center bg-accent hover:bg-accent-hover font-semibold mt-6 py-3 cursor-pointer text-xs rounded-lg shadow-sm"
                  >
                    {isUpdatingPassword ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        <span>Updating Password…</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Lock size={15} />
                        <span>Update Password & Finalize</span>
                        <ArrowRight size={13} className="opacity-80" />
                      </span>
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-6 animate-fadeIn">
                  {resetOtpError && (
                    <Alert variant="critical" title="Verification Code Error">
                      {resetOtpError}
                    </Alert>
                  )}

                  {otpRequestSuccessMsg && (
                    <Alert variant="nominal" title="Request Registered with Administrator">
                      {otpRequestSuccessMsg}
                    </Alert>
                  )}

                  {/* Email Field */}
                  <UnderlineInput
                    id="modal-reset-email"
                    label="Official Email Address"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="operator@istrac.gov.in"
                    autoComplete="email"
                    required
                  />

                  {/* Request Verification Code Card */}
                  <div className="rounded-xl border border-white/10 bg-card/60 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <KeyRound size={14} className="text-accent-light" />
                        <span>Security Verification Required</span>
                      </div>
                      <div className="text-[11px] text-text-dim">
                        Submit a request to generate a 6-digit authorization code for your System Administrator.
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={isRequestingOtp || !resetEmail}
                      onClick={handleRequestOtp}
                      className="shrink-0 cursor-pointer text-xs font-medium"
                    >
                      {isRequestingOtp ? 'Submitting…' : 'Request Security Code'}
                    </Button>
                  </div>

                  {/* 6-Digit OTP Field */}
                  <div className="space-y-2">
                    <label htmlFor="modal-reset-otp" className="text-xs font-medium text-slate-300 flex items-center justify-between">
                      <span>6-Digit Verification Code (OTP)</span>
                      <span className="text-[10px] text-accent-light font-mono">ISSUED BY SYSTEM ADMIN</span>
                    </label>
                    <input
                      id="modal-reset-otp"
                      type="text"
                      maxLength={6}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="······"
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full bg-transparent border-0 border-b border-white/20 focus:border-accent pb-2.5 pt-1 text-center font-mono text-2xl tracking-[0.4em] text-white placeholder:text-slate-600 outline-none transition-colors"
                    />
                    <span className="text-[11px] text-text-dim block text-center">
                      Enter the 6-digit security code provided by your administrator via internal mail, chat, or phone.
                    </span>
                  </div>

                  {/* Verify Code Button */}
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={isVerifyingOtp || resetOtp.length !== 6 || !resetEmail}
                    className="w-full justify-center bg-accent hover:bg-accent-hover font-semibold mt-6 py-3 cursor-pointer text-xs rounded-lg shadow-sm"
                  >
                    {isVerifyingOtp ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        <span>Verifying Code…</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <ShieldCheck size={15} />
                        <span>Verify Code & Continue</span>
                        <ArrowRight size={13} className="opacity-80" />
                      </span>
                    )}
                  </Button>
                </form>
              )}
            </>
          )}

          {/* ============================================================ */}
          {/* REGISTER / REQUEST ACCESS FORM MODE */}
          {/* ============================================================ */}
          {mode === 'register' && (
            <>
              {registerSubmitted ? (
                <div className="py-8 text-center space-y-5 animate-fadeIn">
                  <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-nominal/15 border border-nominal/30 text-nominal">
                    <CheckCircle2 size={34} />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-lg font-bold text-white">Access Request Registered</h3>
                    <p className="text-sm text-text-secondary leading-relaxed max-w-md mx-auto">
                      Your clearance application for <strong className="text-white">{registeredEmail}</strong> has been submitted to ISTRAC Security Administration.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-white/10 bg-black/25 text-left text-xs space-y-2 font-mono max-w-md mx-auto">
                    <div className="text-[11px] text-text-dim uppercase font-semibold">Clearance Protocol</div>
                    <div className="flex items-center justify-between text-text-secondary">
                      <span>Status:</span>
                      <span className="text-nominal font-bold">● PENDING_CLEARANCE</span>
                    </div>
                    <div className="flex items-center justify-between text-text-secondary">
                      <span>Review Window:</span>
                      <span className="text-white">~2–4 Operational Hours</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={() => handleSwitchMode('login')}
                    className="justify-center bg-accent shadow-sm cursor-pointer px-8 mt-2"
                  >
                    <span>Return to Portal Sign In</span>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleRegSubmit(onRegister)} className="space-y-6">
                  {registerError && (
                    <Alert variant="critical" title="Registration Error">
                      {registerError}
                    </Alert>
                  )}

                  {/* Section 1: Personnel Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
                    <UnderlineInput
                      id="modal-reg-name"
                      label="Full Name"
                      placeholder="Dr. Vikram Sarabhai"
                      error={regErrors.name?.message}
                      {...registerReg('name')}
                    />

                    <UnderlineInput
                      id="modal-reg-designation"
                      label="Designation / Role"
                      placeholder="Flight Operations Engineer"
                      error={regErrors.designation?.message}
                      {...registerReg('designation')}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
                    <UnderlineInput
                      id="modal-reg-empid"
                      label="Employee / ISRO Badge ID"
                      placeholder="ISRO-1094"
                      error={regErrors.employeeId?.message}
                      {...registerReg('employeeId')}
                    />

                    <UnderlineInput
                      id="modal-reg-phone"
                      label="Contact Number"
                      placeholder="+91 98765 43210"
                      error={regErrors.phone?.message}
                      {...registerReg('phone')}
                    />
                  </div>

                  {/* Section 2: Department & Government Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
                    <UnderlineInput
                      id="modal-reg-email"
                      label="Official Government Email"
                      type="email"
                      placeholder="officer@isro.gov.in"
                      error={regErrors.email?.message}
                      {...registerReg('email')}
                    />

                    <UnderlineSelect
                      id="modal-reg-dept"
                      label="Target Department"
                      error={regErrors.departmentPreference?.message}
                      {...registerReg('departmentPreference')}
                    >
                      <option value="">Select an operational division...</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </UnderlineSelect>
                  </div>

                  <UnderlineTextarea
                    id="modal-reg-justification"
                    label="Reason for Access / Mission Scope"
                    rows={2}
                    placeholder="Briefly state your operational role and mission datasets required..."
                    error={regErrors.reasonForAccess?.message}
                    {...registerReg('reasonForAccess')}
                  />

                  {/* Section 3: Credentials */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
                    <UnderlineInput
                      id="modal-reg-password"
                      label="Security Password"
                      type="password"
                      placeholder="Min 10 chars (uppercase & symbol)"
                      error={regErrors.password?.message}
                      {...registerReg('password')}
                    />

                    <UnderlineInput
                      id="modal-reg-confirmpassword"
                      label="Confirm Password"
                      type="password"
                      placeholder="Re-enter password"
                      error={regErrors.confirmPassword?.message}
                      {...registerReg('confirmPassword')}
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={isRegistering}
                    className="w-full justify-center bg-accent hover:bg-accent-hover font-semibold mt-6 py-3 cursor-pointer text-sm rounded-lg shadow-sm"
                  >
                    {isRegistering ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        <span>Submitting Application…</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <UserPlus size={16} />
                        <span>Submit Access Application</span>
                        <ArrowRight size={14} className="opacity-80" />
                      </span>
                    )}
                  </Button>
                </form>
              )}
            </>
          )}
        </div>

        {/* Modal Footer Strip */}
        <div className="border-t border-white/10 bg-[#080d19]/85 px-8 py-4 flex items-center justify-between text-xs text-text-dim">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <Lock size={13} className="text-nominal" />
            
          </div>

          <div className="flex items-center gap-3">
            {mode === 'login' ? (
              <>
                <button
                  type="button"
                  onClick={() => handleSwitchToReset(getLoginValues('email'))}
                  className="text-accent-light hover:underline font-medium cursor-pointer"
                >
                  Forgot password?
                </button>
                <span className="text-white/20">·</span>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('register')}
                  className="text-text-secondary hover:text-white hover:underline font-medium cursor-pointer"
                >
                  Request Access →
                </button>
              </>
            ) : mode === 'register' ? (
              <button
                type="button"
                onClick={() => handleSwitchMode('login')}
                className="text-accent-light hover:underline font-medium cursor-pointer"
              >
                Existing operator? Sign In →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSwitchMode('login')}
                className="text-accent-light hover:underline font-medium cursor-pointer"
              >
                Return to Sign In →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
