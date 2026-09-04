import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Landing } from "./Landing";
import { useAuthStore } from "../store/authStore";
import { useAuthModalStore } from "../store/authModalStore";
import { useToastStore } from "../store/toastStore";

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const openLogin = useAuthModalStore((s) => s.openLogin);
  const addToast = useToastStore((s) => s.addToast);
  const hasNotified = useRef(false);

  useEffect(() => {
    if (user) {
      if (user.role === "ADMIN") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
      return;
    }

    if (searchParams.get("session_expired") === "true" && !hasNotified.current) {
      hasNotified.current = true;
      addToast({
        title: "Session Timed Out",
        message: "Your session has expired. Please authenticate to resume mission operations.",
        variant: "warning",
      });
    }

    openLogin();
  }, [user, openLogin, navigate, searchParams, addToast]);

  return <Landing />;
}
