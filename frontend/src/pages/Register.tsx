import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Landing } from "./Landing";
import { useAuthStore } from "../store/authStore";
import { useAuthModalStore } from "../store/authModalStore";

export function Register() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const openRegister = useAuthModalStore((s) => s.openRegister);

  useEffect(() => {
    if (user) {
      if (user.role === "ADMIN") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
      return;
    }
    openRegister();
  }, [user, openRegister, navigate]);

  return <Landing />;
}