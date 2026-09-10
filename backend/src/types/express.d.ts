import type { AuthUser } from './api.js'

declare global {
  namespace Express {
    interface Request {
      /** Authenticated user — populated by authMiddleware. Undefined on public routes. */
      user?: AuthUser
      /** UUID v4 injected by requestIdMiddleware on every request. */
      requestId: string
      /** Department access level — populated by deptAccessMiddleware. */
      deptAccessLevel?: string
    }
  }
}

export {}
