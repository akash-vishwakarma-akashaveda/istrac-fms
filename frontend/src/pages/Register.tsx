import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { AxiosError } from "axios";
import { UserPlus, ArrowRight } from "lucide-react";

import { api } from "../lib/axios";
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

const FALLBACK_DEPARTMENTS = [
  "Telemetry, Tracking & Command (TTC)",
  "Flight Dynamics Division (FDD)",
  "Mission Operations Complex (MOX)",
  "IS4OM / NETRA Space Situational Awareness",
  "Ground Station Operations (GSO)",
];

export function Register() {
  const navigate = useNavigate();

  const [submitted, setSubmitted] = useState(false);
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
      await api.post("/auth/register", data);
      setSubmitted(true);
    } catch (err) {
      const error = err as AxiosError<{
        error: {
          message: string;
        };
      }>;

      setServerError(
        error.response?.data?.error?.message ??
          "Registration request failed. Please check your details and try again.",
      );
    }
  }

  /* =========================================================
     SUCCESS STATE
     ========================================================= */

  if (submitted) {
    return (
      <AuthFrame
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/login")}>
            Log In
          </Button>
        }
      >
        <AuthCard
          eyebrow="Access Request Submitted"
          status="PENDING REVIEW"
          tone="nominal"
          title="Your registration request is in review"
          description="Your application has been queued for Super Admin approval in accordance with ISTRAC Data Security Policy."
        >
          {/* Steps */}
          <ol className="space-y-3.5 border-y border-border-subtle py-5">
            {[
              "Station Administrator validates Employee ID & Department",
              "Role-Based Access Control (RBAC) permissions are assigned",
              "Account activation email sent with login instructions",
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
              <span>Return to Log In</span>
              <ArrowRight size={15} />
            </Button>
          </Link>
        </AuthCard>
      </AuthFrame>
    );
  }

  /* =========================================================
     REGISTER PAGE
     ========================================================= */

  return (
    <AuthFrame
      width="md"
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
        status="NEW OPERATOR"
        tone="accent"
        title="Request ISTRAC Portal Access"
        description="Submit your verified ISRO credentials to request telemetry repository and mission workspace access."
      >
        {serverError && (
          <Alert variant="critical" title="Request submission failed" className="mb-5">
            {serverError}
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              id="name"
              label="Full Name & Designation"
              placeholder="e.g. Dr. Vikram Sharma"
              autoComplete="name"
              error={errors.name?.message}
              {...register("name")}
            />

            <Input
              id="employeeId"
              label="ISRO Employee ID"
              placeholder="e.g. ISRO-OPS-108"
              className="num"
              error={errors.employeeId?.message}
              {...register("employeeId")}
            />
          </div>

          <Input
            id="email"
            label="Official ISRO Email"
            type="email"
            placeholder="name@istrac.isro.gov.in"
            autoComplete="username"
            error={errors.email?.message}
            {...register("email")}
          />

          <Select
            id="departmentPreference"
            label="Target Division / Department"
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

          <Textarea
            id="reasonForAccess"
            label="Operational Justification / Reason for Access"
            rows={3}
            placeholder="Specify your project or flight operations role (e.g. Aditya-L1 orbit monitoring)…"
            error={errors.reasonForAccess?.message}
            {...register("reasonForAccess")}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full shadow-lg shadow-accent/25"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span
                  aria-hidden="true"
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
                Submitting Access Request…
              </>
            ) : (
              <span className="flex items-center gap-2">
                <UserPlus size={15} />
                <span>Submit Access Application</span>
              </span>
            )}
          </Button>
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