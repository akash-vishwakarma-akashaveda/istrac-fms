import { useToastStore } from "../store/toastStore"
import { Toast } from "./Toast"

/**
 * Toast container is given maximum z-index (z-[99999]) so notifications
 * always render on top of modals, dropdowns, headers, and full-screen drawers.
 */
export function ToastContainer() {
  const visible = useToastStore((s) => s.visible)

  return (
    <div className="pointer-events-none fixed top-5 right-5 z-[99999] flex flex-col gap-3 max-w-md w-full">
      {visible.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          title={toast.title}
          variant={toast.variant}
          duration={toast.duration}
          isPaused={toast.isPaused}
        />
      ))}
    </div>
  )
}
