import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { AxiosError } from "axios";
import {
  Send,
  ArrowRight,
  CheckCircle2,
  Lock,
  User,
  Building,
  BadgeCheck,
} from "lucide-react";
import { departmentsApi, type Department } from "../api/departments.api";
import {
  Alert,
  AuthCard,
  AuthFrame,
  Button,
  Input,
  Select,
  Textarea,
} from "../components";
import {
  registerSchema,
  type RegisterFormData,
} from "../../schemas/authSchemas";
import { authApi } from "../api";

const FALLBACK_DEPARTMENTS = [
  "Telemetry, Tracking & Command (TTC)",
  "Flight Dynamics Division (FDD)",
  "Mission Operations Complex (MOX)",
  "IS4OM / NETRA Space Situational Awareness",
  "Ground Station Operations (GSO)",
];
const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Invalid email or password.',
  account_pending: 'Your account is pending administrator approval.',
  account_suspended: 'Your account has been suspended. Contact your administrator.',
  rate_limit_exceeded: 'Too many attempts. Please wait 15 minutes.',
  user_exists: 'An account with this email or employee ID already exists.',
}

export function Register() {
  const navigate = useNavigate();

  const [submitted, setSubmitted] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<string[]>(FALLBACK_DEPARTMENTS);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  useEffect(() => {
    departmentsApi
      .getPublicDepartments()
      .then((data: Department[]) => {
        if (data && data.length > 0) {
          setDepartments(data.map((d) => d.name));
        }
      })
      .catch(() => {});
  }, []);

  async function onSubmit(data: RegisterFormData) {
    setServerError(null);

    try {
     await authApi.register(data)
      setRegisteredEmail(data.email);
      setSubmitted(true);
    } catch (err) {
      const error = err as AxiosError<{
        error?: {
          code?: string;
          message?: string;
        };
        message?: string;
      }>;

      const code = error.response?.data?.error?.code
setServerError(ERROR_MESSAGES[code!] ?? 'An unexpected error occurred. Please try again.')
    }
  }

  /* =========================================================
     SUCCESS STATE (APPLICATION QUEUED)
     ========================================================= */

  if (submitted) {
    return (
      <AuthFrame
        width="md"
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/login")}>
            Log In
          </Button>
        }
      >
        <AuthCard
          eyebrow="Security Provisioning"
          status="APPLICATION QUEUED"
          tone="nominal"
          title="Access request submitted successfully"
          description="Your credentials and operational security application have been registered and sent to the administrator approval queue."
        >
          <div className="p-4 rounded-xl border border-border-default bg-[#060c18] space-y-2 mb-5">
            <div className="flex items-center gap-2 text-xs font-bold text-nominal">
              <CheckCircle2 size={16} />
              <span>Login Credentials Configured & Stored</span>
            </div>
            <p className="text-xs text-text-secondary">
              Account created for: <strong className="text-white font-mono">{registeredEmail}</strong>
            </p>
            <p className="text-[11px] text-text-dim leading-relaxed">
              Once an administrator grants clearance, you will be able to log in directly using your registered email and password.
            </p>
          </div>

          {/* Steps */}
          <ol className="space-y-3.5 border-y border-border-subtle py-4">
            {[
              "Station Administrator reviews application & ISRO Employee ID",
              "Multi-department repository clearances (TTC, MOX, FDD) assigned",
              "Instant clearance activation — sign in with your credentials",
            ].map((stage, index) => (
              <li
                key={stage}
                className="flex items-start gap-3 text-xs leading-relaxed text-text-secondary"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent-light text-[10px] font-bold">
                  0{index + 1}
                </span>
                <span>{stage}</span>
              </li>
            ))}
          </ol>

          <Link to="/login" className="mt-6 block">
            <Button variant="primary" size="lg" className="w-full shadow-lg shadow-accent/25">
              <span>Go to Sign In</span>
              <ArrowRight size={15} />
            </Button>
          </Link>
        </AuthCard>
      </AuthFrame>
    );
  }

  /* =========================================================
     REGISTER FORM (STRUCTURED 2-COLUMN RESPONSIVE LAYOUT)
     ========================================================= */

  return (
    <AuthFrame
      width="lg"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            Mission Home
          </Button>

          <Link to="/login">
            <Button variant="outline" size="sm">
              Log In
            </Button>
          </Link>
        </div>
      }
    >
      <AuthCard
        eyebrow="Security Provisioning"
        status="NEW USER"
        tone="accent"
        title="Request ISTRAC Portal Access"
        description="Submit your verified ISRO personnel details and set up your station credentials for mission telemetry access."
      >
        {serverError && (
          <Alert variant="critical" title="Request submission failed" className="mb-5">
            {serverError}
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          {/* SECTION 1: USER IDENTITY (2-COLUMN GRID) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
              <User size={14} className="text-accent-light" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                1. User Identification
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Field 1: Full Name */}
              <div>
                <Input
                  id="name"
                  label="Full Name *"
                  placeholder="e.g. Dr. Vikram Sharma"
                  autoComplete="name"
                  error={errors.name?.message}
                  {...register("name")}
                />
              </div>

              {/* Field 2: Designation / Title */}
              <div>
                <Input
                  id="designation"
                  label="Designation / Title *"
                  placeholder="e.g. Senior Flight Operations Analyst"
                  error={errors.designation?.message}
                  {...register("designation")}
                />
              </div>

              {/* Field 3: ISRO Employee ID */}
              <div>
                <Input
                  id="employeeId"
                  label="ISRO Employee / Badge ID *"
                  placeholder="e.g. ISRO-OPS-108"
                  className="num font-mono"
                  error={errors.employeeId?.message}
                  {...register("employeeId")}
                />
              </div>

              {/* Field 4: Official Email */}
              <div>
                <Input
                  id="email"
                  label="Official ISRO Email *"
                  type="email"
                  placeholder="name@istrac.isro.gov.in"
                  autoComplete="username"
                  error={errors.email?.message}
                  {...register("email")}
                />
              </div>

              {/* Field 5: Contact Phone Number */}
              <div>
                <Input
                  id="phone"
                  label="Contact Phone Number *"
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  autoComplete="tel"
                  error={errors.phone?.message}
                  {...register("phone")}
                />
              </div>

              {/* Field 6: Target Division / Department */}
              <div>
                <Select
                  id="departmentPreference"
                  label="Primary Target Division *"
                  error={errors.departmentPreference?.message}
                  {...register("departmentPreference")}
                >
                  <option value="">Select an operational department</option>

                  {departments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          {/* SECTION 2: OPERATIONAL JUSTIFICATION */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
              <Building size={14} className="text-accent-light" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                2. Operational Scope
              </h3>
            </div>

            <div>
              <Textarea
                id="reasonForAccess"
                label="Operational Justification / Access Reason (Optional)"
                rows={2}
                placeholder="e.g. Assigned to Aditya-L1 flight dynamics analysis and tracking pass monitoring…"
                error={errors.reasonForAccess?.message}
                {...register("reasonForAccess")}
              />
            </div>
          </div>

          {/* SECTION 3: CREDENTIALS & PASSWORD CREATION (2-COLUMN GRID) */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between border-b border-border-subtle pb-2">
              <div className="flex items-center gap-2">
                <Lock size={14} className="text-accent-light" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  3. Account Password Setup
                </h3>
              </div>
              <span className="text-[10px] text-text-dim font-mono">Min. 8 characters</span>
            </div>

            <div className="p-4 rounded-xl border border-border-default bg-[#060c18] space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Password Input */}
                <Input
                  id="password"
                  label="Account Password *"
                  type="password"
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  error={errors.password?.message}
                  {...register("password")}
                />

                {/* Confirm Password Input */}
                <Input
                  id="confirmPassword"
                  label="Confirm Password *"
                  type="password"
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  error={errors.confirmPassword?.message}
                  {...register("confirmPassword")}
                />
              </div>

              <p className="text-[11px] text-text-dim flex items-center gap-1.5 pt-1 border-t border-white/5">
                <BadgeCheck size={13} className="text-nominal shrink-0" />
                <span>You will use this email & password to sign in immediately once approved.</span>
              </p>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full shadow-lg shadow-accent/25 font-bold"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span
                    aria-hidden="true"
                    className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                  />
                  Sending Access Request…
                </>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Send size={15} />
                  <span>Send Request</span>
                </span>
              )}
            </Button>
          </div>
        </form>

        <div className="mt-6 border-t border-border-subtle pt-5 flex items-center justify-between text-xs text-text-muted">
          <span>Already registered?</span>
          <Link
            to="/login"
            className="font-semibold text-accent-light hover:text-white hover:underline transition-colors"
          >
            Sign In →
          </Link>
        </div>
      </AuthCard>
    </AuthFrame>
  );
}