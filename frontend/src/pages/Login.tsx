import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Landing } from "./Landing";
import { useAuthStore } from "../store/authStore";
import { useAuthModalStore } from "../store/authModalStore";

export function Login() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const openLogin = useAuthModalStore((s) => s.openLogin);

  useEffect(() => {
    if (user) {
      if (user.role === "ADMIN") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
      return;
    }
    openLogin();
  }, [user, openLogin, navigate]);

  return <Landing />;
}
