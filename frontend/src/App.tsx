import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { PublicLayout } from "./layouts/PublicLayout"
import { AppShell } from "./layouts/AppShell"
import { ProtectedRoute } from "./routes/ProtectedRoute"
import { AdminRoute } from "./routes/AdminRoute"
import { ComponentDemo } from "./pages/ComponentDemo"
import { useInitAuth } from "./hooks/useInitAuth"
import { Login } from "./pages/Login"
import { Register } from "./pages/Register"
import { CmsProvider } from "./context/cmsContext"
import { ForcePasswordGuard } from "./routes/ForcePasswordGuard"
import { ForcePasswordChange } from "./pages/ForcePasswordChange"
import { ForgotPassword } from "./pages/ForgetPassword"
import { AdminHome } from "./pages/AdminHome"
import { ToastContainer } from "./components/ToastContainer"
import { AuthModal } from "./components/AuthModal"
import { ApprovalQueue } from "./pages/ApprovalQueue"
import { UserManagement } from "./pages/UserManagement"
import { DepartmentManager } from "./pages/DepartmentManager"
import { SatelliteManager } from "./pages/SatelliteManager"
import { UploadReport } from "./pages/UploadReport"
import { Files } from "./pages/Files"
import { AuditLogViewer } from "./pages/AuditLogViewer"
import { BroadcastNotification } from "./pages/BroadcastNotification"
import { CmsEditor } from "./pages/CmsEditor"
import { SystemConfigPanel } from "./pages/SystemConfigPanel"
import { EventManager } from "./pages/EventManager"
import { DepartmentHub } from "./pages/DepartmentHub"
import { AdminFileManager } from "./pages/AdminFileManager"
import { UserHome } from "./pages/UserHome"
import { UserEvents } from "./pages/UserEvents"
import { DeptFileBrowser } from "./pages/DeptFileBrowser"
import { DevIndex } from "./pages/DevIndex"
import { SearchPage } from "./pages/SearchPage"
import { Landing } from "./pages/Landing"
import { NotificationsPage } from "./pages/NotificationsPage"
import { DepartmentsList } from "./pages/DepartmentsList"
import { DepartmentDetail } from "./pages/DepartmentDetail"
import { useAuthStore } from "./store/authStore"

function AppRedirect() {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (user.role === "ADMIN") return <Navigate to="/admin" replace />
  return <Navigate to="/dashboard" replace />
}

export default function App() {
  const { isChecking } = useInitAuth()

  if (isChecking) {
    return (
      <div
        role="status"
        className="graticule flex min-h-screen flex-col items-center justify-center gap-3 bg-page"
      >
        <span aria-hidden="true" className="h-6 w-px bg-accent-light" />
        <p className="num animate-pulse-slow text-[11px] tracking-[0.14em] text-text-muted uppercase">
          Establishing session
        </p>
      </div>
    )
  }

  return (
    <CmsProvider>
      <BrowserRouter>
        <ToastContainer />
        <AuthModal />
        <Routes>
          <Route path="/dev" element={<DevIndex />} />

          {/* Public routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/departments" element={<DepartmentsList />} />
            <Route path="/departments/:deptId" element={<DepartmentDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/demo" element={<ComponentDemo />} />
          </Route>

          {/* Mission Console smart redirect route */}
          <Route path="/app" element={<AppRedirect />} />

          {/* Protected — any authenticated user, nested inside AppShell */}
          <Route element={<ProtectedRoute />}>
            <Route path="/force-password-change" element={<ForcePasswordChange />} />
            <Route element={<ForcePasswordGuard />}>
              <Route element={<AppShell />}>
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/dashboard" element={<UserHome />} />
                <Route path="/dashboard/events" element={<UserEvents />} />
                <Route path="/dashboard/files" element={<Files />} />
                <Route path="/dashboard/files/:deptId" element={<DeptFileBrowser />} />
                <Route path="/departments/:deptId" element={<DepartmentHub />} />
                <Route path="/dashboard/search" element={<SearchPage />} />

                {/* Admin-only — nested one level deeper */}
                <Route element={<AdminRoute />}>
                  <Route path="/admin" element={<AdminHome />} />
                  <Route path="/admin/files" element={<AdminFileManager />} />
                  <Route path="/admin/upload" element={<UploadReport />} />
                  <Route path="/admin/approvals" element={<ApprovalQueue />} />
                  <Route path="/admin/satellites" element={<SatelliteManager />} />
                  <Route path="/admin/events" element={<EventManager />} />
                  <Route path="/admin/departments" element={<DepartmentManager />} />
                  <Route path="/admin/users" element={<UserManagement />} />
                  <Route path="/admin/audit-logs" element={<AuditLogViewer />} />
                  <Route path="/admin/broadcast" element={<BroadcastNotification />} />
                  <Route path="/admin/cms" element={<CmsEditor />} />
                  <Route path="/admin/settings" element={<SystemConfigPanel />} />
                </Route>
              </Route>
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </CmsProvider>
  )
}
