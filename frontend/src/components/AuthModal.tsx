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
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'
import { useAuthModalStore, type AuthMode } from '../store/authModalStore'
import { loginSchema, registerSchema, type LoginFormData, type RegisterFormData } from '../../schemas/authSchemas'
import { authApi } from '../api'
import { departmentsApi, type Department } from '../api/departments.api'
import { Button, Alert } from '.'
import { useCms } from '../context/cmsContext'

// ============================================================================
// PROFESSIONAL SPACIOUS UNDERLINE-ONLY FORM CONTROLS
// ============================================================================

interface UnderlineInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
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
      <label htmlFor={id} className="text-xs font-medium text-slate-300">
        {label}
      </label>

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
// DEMO CREDENTIAL DATA & ERROR MAPPINGS
// ============================================================================

const DEMO_ACCOUNTS = [
  {
    role: 'Super Admin',
    desc: 'Director MOX · Superuser Access',
    email: 'admin@istrac.local',
    pass: 'ChangeMe123!',
  },
  {
    role: 'Flight User',
    desc: 'Mission Ops & Real-Time Telemetry',
    email: 'operator@istrac.local',
    pass: 'ChangeMe123!',
  },
  {
    role: 'FDD Lead',
    desc: 'Flight Dynamics Directorate Lead',
    email: 'fddlead@istrac.local',
    pass: 'ChangeMe123!',
  },
]

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
  const headerBlock = cmsBlocks['nav_header']?.content as Record<string, any> | undefined
  const brandTitle = headerBlock?.brandTitle ?? 'ISTRAC'
  const brandHighlight = headerBlock?.brandHighlight ?? '-SIMS'

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
  const [departments, setDepartments] = useState<string[]>(FALLBACK_DEPARTMENTS)

  // Login Form
  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    setValue: setLoginValue,
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

  // Fetch departments for registration dropdown
  useEffect(() => {
    departmentsApi
      .getPublicDepartments()
      .then((data: Department[]) => {
        if (data && data.length > 0) {
          setDepartments(data.map((d) => d.name))
        }
      })
      .catch(() => {})
  }, [])

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
    setMode(newMode)
  }

  // Quick fill helper
  const handleQuickFill = (email: string, pass: string) => {
    setLoginValue('email', email, { shouldValidate: true })
    setLoginValue('password', pass, { shouldValidate: true })
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
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-md overflow-y-auto animate-fadeIn"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      {/* Spacious Translucent Minimalist Modal Dialog */}
      <div
        className={`relative w-full my-8 rounded-2xl border border-white/15 bg-[#0a0f1d]/90 shadow-2xl overflow-hidden transition-all duration-300 animate-rise text-text-primary backdrop-blur-md ${
          isRegisterMode ? 'max-w-2xl' : 'max-w-lg'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="border-b border-white/10 bg-[#080d19]/85 px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-accent-light">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-mono font-semibold tracking-wider text-text-dim uppercase">
                <span>ISRO · {brandTitle}{brandHighlight}</span>
                <span>·</span>
                <span className="text-nominal">SECURED</span>
              </div>
              <h2 id="auth-modal-title" className="text-lg font-bold text-white mt-0.5">
                {mode === 'login' ? 'Mission Operations Login' : 'Request Operational Access'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-text-muted hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close modal (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Minimalist Spacious Underline Tabs */}
        <div className="flex border-b border-white/10 bg-black/20 px-8">
          <button
            type="button"
            onClick={() => handleSwitchMode('login')}
            className={`pb-4 pt-3.5 mr-8 flex items-center gap-2 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
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
            className={`pb-4 pt-3.5 flex items-center gap-2 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
              mode === 'register'
                ? 'border-accent text-white'
                : 'border-transparent text-text-dim hover:text-text-secondary'
            }`}
          >
            <UserPlus size={15} />
            <span>Request Access</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-8 sm:p-9 space-y-7 max-h-[calc(85vh-160px)] overflow-y-auto">
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
                label="Access Key / Password"
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

              {/* Minimalist Demo Accounts Console */}
              <div className="rounded-xl border border-white/10 bg-black/25 p-4 space-y-3 mt-6">
                <div className="flex items-center justify-between text-[11px] font-mono text-text-dim">
                  <span className="uppercase font-semibold text-slate-300">Quick-Fill Demo Credentials</span>
                  <span>1-CLICK</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.role}
                      type="button"
                      onClick={() => handleQuickFill(acc.email, acc.pass)}
                      className="rounded-lg border border-white/10 bg-white/5 p-3 text-left transition-colors hover:border-accent hover:bg-accent/10 cursor-pointer"
                    >
                      <div className="font-bold text-xs text-white">{acc.role}</div>
                      <div className="text-[10px] text-text-dim truncate mt-0.5">{acc.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </form>
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
            <span>TLS 1.3 256-Bit Encrypted</span>
          </div>

          <div>
            {mode === 'login' ? (
              <button
                type="button"
                onClick={() => handleSwitchMode('register')}
                className="text-accent-light hover:underline font-medium cursor-pointer"
              >
                Need access? Apply here →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSwitchMode('login')}
                className="text-accent-light hover:underline font-medium cursor-pointer"
              >
                Existing operator? Sign In →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
