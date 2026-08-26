import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link } from "react-router-dom";
import { AxiosError } from "axios";
import { Sparkles, KeyRound, Eye, EyeOff } from "lucide-react";

import { api } from "../lib/axios";
import { useAuthStore } from "../store/authStore";
import { Alert, AuthCard, AuthFrame, Button, Input } from "../components";
import { loginSchema, type LoginFormData } from "../../schemas/authSchemas";

const DEMO_ACCOUNTS = [
  {
    role: "Super Admin",
    email: "admin@istrac.local",
    pass: "ChangeMe123!",
    badge: "bg-accent/15 text-accent-light border-accent/30",
  },
  {
    role: "Flight User",
    email: "operator@istrac.local",
    pass: "ChangeMe123!",
    badge: "bg-nominal/15 text-nominal border-nominal/30",
  },
  {
    role: "FDD Lead",
    email: "fddlead@istrac.local",
    pass: "ChangeMe123!",
    badge: "bg-purple-400/15 text-purple-400 border-purple-400/30",
  },
];

export function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFormData) {
    setServerError(null);
    setLockoutRemaining(null);

    try {
      const response = await api.post("/auth/login", data);
      const user = response.data.data?.user || response.data?.user;
      const token = response.data.data?.accessToken || response.data?.accessToken;
      setAuth(user, token);

      if (user?.role === 'ADMIN') {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      const error = err as AxiosError<{
        error: {
          code: string;
          message: string;
        };
        lockoutSecondsRemaining?: number;
      }>;

      if (
        error.response?.status === 429 &&
        error.response.data.lockoutSecondsRemaining
      ) {
        setLockoutRemaining(error.response.data.lockoutSecondsRemaining);
      } else if (error.response?.data?.error?.message) {
        setServerError(error.response.data.error.message);
      } else {
        setServerError("Invalid email or password. Please verify your credentials.");
      }
    }
  }

  function handleQuickFill(email: string, pass: string) {
    setValue("email", email, { shouldValidate: true });
    setValue("password", pass, { shouldValidate: true });
  }

  const lockedOut = lockoutRemaining !== null;

  return (
    <AuthFrame
      actions={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            Mission Home
          </Button>

          <Button variant="outline" size="sm" onClick={() => navigate("/register")}>
            Request Access
          </Button>
        </div>
      }
    >
      <AuthCard
        eyebrow="Air-Gapped Intranet"
        status="SEC LEVEL 4"
        title="Sign in to ISTRAC-SIMS"
        description="Access ground station telemetry, orbit determination ephemeris, and flight repository files."
      >
        {/* Lockout notification */}
        {lockoutRemaining !== null && (
          <Alert variant="critical" title="Account Temporarily Locked" className="mb-5">
            Too many failed attempts. Security cool-off period:{" "}
            {Math.ceil(lockoutRemaining / 60)} minute
            {Math.ceil(lockoutRemaining / 60) !== 1 ? "s" : ""}.
          </Alert>
        )}

        {serverError && lockoutRemaining === null && (
          <Alert variant="critical" title="Authentication Failed" className="mb-5">
            {serverError}
          </Alert>
        )}

        {/* Quick-Fill Demo Chips */}
        <div className="mb-5 rounded-xl border border-border-subtle bg-[#080f1d] p-3">
          <p className="eyebrow text-[10px] text-text-dim flex items-center gap-1.5 mb-2">
            <Sparkles size={11} className="text-accent-light" />
            Quick Test Accounts (Click to Fill):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.role}
                type="button"
                onClick={() => handleQuickFill(acc.email, acc.pass)}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-all hover:scale-105 active:scale-95 ${acc.badge}`}
              >
                {acc.role}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <Input
            id="email"
            label="Official ISRO Email"
            type="email"
            placeholder="operator@istrac.local"
            autoComplete="username"
            disabled={lockedOut}
            error={errors.email?.message}
            {...register("email")}
          />

          <div>
            <div className="relative">
              <Input
                id="password"
                label="Password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                autoComplete="current-password"
                disabled={lockedOut}
                error={errors.password?.message}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-[34px] text-text-dim hover:text-white transition-colors"
                tabIndex={-1}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            <div className="mt-2 flex justify-end">
              <Link
                to="/forgot-password"
                className="text-xs text-accent-light hover:text-white transition-colors"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full shadow-lg shadow-accent/25"
            disabled={isSubmitting || lockedOut}
          >
            {isSubmitting ? (
              <>
                <span
                  aria-hidden="true"
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
                Verifying Credentials…
              </>
            ) : (
              <span className="flex items-center gap-2">
                <KeyRound size={15} />
                <span>Log In to Mission Portal</span>
              </span>
            )}
          </Button>
        </form>

        <div className="mt-6 border-t border-border-subtle pt-5 flex items-center justify-between text-xs text-text-muted">
          <span>Need station access?</span>
          <Link
            to="/register"
            className="font-semibold text-accent-light hover:text-white hover:underline transition-colors"
          >
            Request Access →
          </Link>
        </div>
      </AuthCard>
    </AuthFrame>
  );
}
