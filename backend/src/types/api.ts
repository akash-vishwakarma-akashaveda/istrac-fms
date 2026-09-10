// ============================================================
// SHARED API TYPES — used across all modules
// ============================================================

/**
 * Authenticated user payload attached to req.user after JWT verification.
 * Mirrors the JWT access-token claims.
 */
export interface AuthUser {
  id: string
  role: 'ADMIN' | 'MEMBER'
  email: string
  name: string
}

/**
 * Standard success response envelope.
 */
export interface ApiResponse<T> {
  data: T
  requestId: string
}

/**
 * Standard error response envelope.
 */
export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: unknown
  }
  requestId: string
}

/**
 * Query-string shape for paginated list endpoints.
 * Values arrive as strings from query params; parse them to int before use.
 */
export interface PaginationQuery {
  page?: string
  limit?: string
}

/**
 * Standard paginated response envelope.
 */
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  requestId: string
}
