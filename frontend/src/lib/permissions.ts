import type { User } from '../store/authStore'

export interface SatelliteAccessTarget {
  id?: string
  departmentIds?: string[]
  departments?: Array<{ id: string; name?: string }>
}

/**
 * Checks whether a user is authorized to view a satellite's full operational dossier.
 *
 * Rules:
 * 1. Guests (unauthenticated): No access.
 * 2. Admin: Full access to all satellites across all departments.
 * 3. Member: Access granted if the user has READ_ONLY or READ_WRITE clearance
 *    for at least one department associated with this satellite.
 */
export function canAccessSatellite(
  user: User | null,
  satellite?: SatelliteAccessTarget | null,
  departmentId?: string | null
): boolean {
  if (!user) return false
  if (user.role === 'ADMIN') return true

  const userDeptIds = new Set(
    (user.departmentAccess || [])
      .filter((da) => da.accessLevel === 'READ_ONLY' || da.accessLevel === 'READ_WRITE')
      .map((da) => da.department?.id || (da as any).departmentId)
      .filter(Boolean)
  )

  const satDeptIds: string[] = []
  if (departmentId) satDeptIds.push(departmentId)
  if (satellite?.departmentIds && Array.isArray(satellite.departmentIds)) {
    satDeptIds.push(...satellite.departmentIds)
  }
  if (satellite?.departments && Array.isArray(satellite.departments)) {
    satDeptIds.push(...satellite.departments.map((d) => d.id))
  }

  return satDeptIds.some((id) => userDeptIds.has(id))
}
