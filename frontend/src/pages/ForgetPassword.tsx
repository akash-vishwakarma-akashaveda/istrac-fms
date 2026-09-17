import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, Link } from 'react-router-dom'
import { AxiosError } from 'axios'
import { api } from '../lib/axios'
import { Alert, AuthCard, AuthFrame, Button, Input } from '../components'
import { PasswordStrengthMeter, isPasswordValid } from '../components/PasswordStrengthMeter'
import { forgotPasswordSchema, otpSchema, newPasswordSchema } from '../../schemas/authSchemas'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'

type Step = 'email' | 'otp' | 'newPassword' | 'done'

const STEP_ORDER: Step[] = ['email', 'otp', 'newPassword']

function StepRail({ step }: { step: Step }) {
  const index = STEP_ORDER.indexOf(step)
  if (index === -1) return null

  const stepLabels = ['Email Address', 'Security Code', 'New Password']

  return (
    <div className="mb-6 space-y-2">
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-text-secondary uppercase tracking-wider">
          {stepLabels[index]}
        </span>
        <span className="text-text-dim">
          STEP {String(index + 1).padStart(2, '0')} / {String(STEP_ORDER.length).padStart(2, '0')}
        </span>
      </div>

      <div className="flex gap-1.5" aria-hidden="true">
        {STEP_ORDER.map((_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i <= index ? 'bg-accent' : 'bg-white/10'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

export function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)

  // ---- Step 1: email ----
  const emailForm = useForm({ resolver: zodResolver(forgotPasswordSchema) })
  async function onEmailSubmit(data: { email: string }) {
    try {
      await api.post('/auth/forgot-password', data)
    } catch {
      // Prevents user enumeration
    }
    setEmail(data.email)
    setStep('otp')
  }

  // ---- Step 2: OTP ----
  const otpForm = useForm({ resolver: zodResolver(otpSchema) })
  
  function handleOtpChange(val: string) {
    const clean = val.replace(/\D/g, '').slice(0, 6)
    setOtp(clean)
    otpForm.setValue('otp', clean, { shouldValidate: true })
  }

  async function onOtpSubmit(data: { otp: string }) {
    setOtpError(null)
    try {
      await api.post('/auth/verify-reset-otp', { email, otp: data.otp })
      setOtp(data.otp)
      setStep('newPassword')
    } catch (err) {
      const error = err as AxiosError<{ error?: { message?: string } }>
      setOtpError(
        error.response?.data?.error?.message ||
          'Invalid or expired verification code. Please request assistance from your administrator.'
      )
    }
  }

  // ---- Step 3: new password ----
  const pwForm = useForm({ resolver: zodResolver(newPasswordSchema) })
  const watchedPassword = pwForm.watch('newPassword') || ''
  async function onPasswordSubmit(data: { newPassword: string; confirmPassword: string }) {
    try {
      await api.post('/auth/reset-password', { email, otp, newPassword: data.newPassword })
      setStep('done')
    } catch (err) {
      const error = err as AxiosError<{ error?: { message?: string } }>
      otpForm.setError('root', { message: error.response?.data?.error?.message ?? 'Password update failed' })
      setStep('otp')
      setOtpError(error.response?.data?.error?.message || 'Verification code expired or invalid. Please request a new code.')
    }
  }

  return (
    <AuthFrame
      actions={
        <Link to="/login">
          <Button variant="outline" size="sm" className="text-xs">
            Sign In
          </Button>
        </Link>
      }
    >
      {step === 'email' && (
        <AuthCard
          eyebrow="SECURITY CREDENTIALS"
          status="RECOVERY · STEP 01"
          tone="accent"
          title="Reset Account Password"
          description="Enter your registered official email address. A 6-digit verification code will be generated for your System Administrator."
        >
          <StepRail step={step} />

          <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-5">
            <Input
              id="email"
              label="Official Email Address"
              type="email"
              placeholder="operator@istrac.gov.in"
              autoComplete="username"
              error={emailForm.formState.errors.email?.message as string}
              {...emailForm.register('email')}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full justify-center text-xs font-semibold"
              disabled={emailForm.formState.isSubmitting}
            >
              {emailForm.formState.isSubmitting ? 'Submitting Request…' : 'Submit Verification Request'}
            </Button>
          </form>
        </AuthCard>
      )}

      {step === 'otp' && (
        <AuthCard
          eyebrow="IDENTITY VERIFICATION"
          status="VERIFY · STEP 02"
          tone="accent"
          title="Enter Verification Code"
          description={`A 6-digit verification code has been registered for ${email}. Please contact your System Administrator to obtain the code.`}
        >
          <StepRail step={step} />

          {otpError && (
            <Alert variant="critical" title="Verification Failed" className="mb-5">
              {otpError}
            </Alert>
          )}

          <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="otp" className="text-xs font-medium text-text-secondary">
                  6-Digit Verification Code (OTP)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setOtpError(null)
                    setStep('email')
                  }}
                  className="text-[11px] text-accent-light hover:underline cursor-pointer flex items-center gap-1"
                >
                  <ArrowLeft size={11} />
                  <span>Change Email</span>
                </button>
              </div>

              <input
                id="otp"
                type="text"
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="······"
                value={otp}
                onChange={(e) => handleOtpChange(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-card px-3 py-2.5 text-center font-mono text-2xl tracking-[0.4em] text-white placeholder:text-slate-600 outline-none focus:border-accent transition-colors"
              />
              <span className="text-[11px] text-text-dim block text-center">
                Enter the code provided by your administrator via internal mail, chat, or phone.
              </span>
              {otpForm.formState.errors.otp?.message && (
                <p className="text-xs text-critical mt-1 text-center font-mono">
                  {otpForm.formState.errors.otp.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full justify-center text-xs font-semibold"
              disabled={otp.length !== 6 || otpForm.formState.isSubmitting}
            >
              {otpForm.formState.isSubmitting ? 'Verifying…' : 'Verify Code & Proceed'}
            </Button>
          </form>
        </AuthCard>
      )}

      {step === 'newPassword' && (
        <AuthCard
          eyebrow="CREDENTIAL UPDATE"
          status="SECURITY · STEP 03"
          tone="accent"
          title="Establish New Password"
          description="Create a strong password that meets institutional security compliance requirements."
        >
          <StepRail step={step} />

          <form onSubmit={pwForm.handleSubmit(onPasswordSubmit)} className="space-y-5">
            <Input
              id="newPassword"
              label="New Password"
              type="password"
              placeholder="Minimum 10 characters"
              autoComplete="new-password"
              error={pwForm.formState.errors.newPassword?.message as string}
              {...pwForm.register('newPassword')}
            />

            <PasswordStrengthMeter password={watchedPassword} />

            <Input
              id="confirmPassword"
              label="Confirm New Password"
              type="password"
              placeholder="Re-enter password to confirm"
              autoComplete="new-password"
              error={pwForm.formState.errors.confirmPassword?.message as string}
              {...pwForm.register('confirmPassword')}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full justify-center text-xs font-semibold"
              disabled={!isPasswordValid(watchedPassword) || pwForm.formState.isSubmitting}
            >
              {pwForm.formState.isSubmitting ? 'Updating Password…' : 'Update Password'}
            </Button>
          </form>
        </AuthCard>
      )}

      {step === 'done' && (
        <AuthCard
          eyebrow="COMPLETED"
          status="CREDENTIALS SYNCHRONIZED"
          tone="nominal"
          title="Password Successfully Updated"
          description="Your security credentials have been updated. All previous active sessions have been terminated. You may now sign in."
        >
          <div className="space-y-5">
            <div className="rounded-lg border border-nominal/20 bg-nominal/[0.04] p-4 text-xs font-mono text-slate-300 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-text-dim">Status:</span>
                <span className="text-nominal font-bold flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  <span>Verified & Active</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-dim">Account:</span>
                <span className="text-white">{email}</span>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full justify-center text-xs font-semibold"
              onClick={() => navigate('/login')}
            >
              Proceed to Sign In
            </Button>
          </div>
        </AuthCard>
      )}
    </AuthFrame>
  )
}
