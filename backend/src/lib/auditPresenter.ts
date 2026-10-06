import { prisma } from '../config/db.js'

// Turns raw AuditLog rows into something an administrator can read:
//   - who (name, email, role) instead of a user id
//   - what, as one sentence ("Asha uploaded “EOS08_DAILY.pdf” to MOX")
//   - a short list of relevant details
// and strips anything sensitive (passwords, hashes, tokens, OTPs) before it leaves the server.

const SENSITIVE_KEY = /pass(word)?|hash|token|otp|secret|jti|cookie|authorization/i
const MAX_STRING = 300

export function sanitizeAuditValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value
  if (typeof value !== 'object') return value
  if (depth > 3) return '[…]'
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitizeAuditValue(v, depth + 1))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(k)) continue
    out[k] = sanitizeAuditValue(v, depth + 1)
  }
  return out
}

function parse(raw: unknown): Record<string, any> | null {
  if (!raw) return null
  if (typeof raw === 'object') return raw as Record<string, any>
  try {
    const v = JSON.parse(String(raw))
    return v && typeof v === 'object' ? v : null
  } catch {
    return null
  }
}

function browserOf(ua?: string | null): string | null {
  if (!ua) return null
  const m = ua.match(/(Edg|OPR|Chrome|Firefox|Safari)\/(\d+)/)
  if (!m) return ua.slice(0, 40)
  const name = { Edg: 'Edge', OPR: 'Opera' }[m[1]] ?? m[1]
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : /iPhone|iPad/.test(ua) ? 'iOS' : ''
  return `${name} ${m[2]}${os ? ` on ${os}` : ''}`
}

type Names = {
  files: Map<string, { name: string; dept?: string | null }>
  users: Map<string, { name: string; email: string }>
  departments: Map<string, string>
  events: Map<string, string>
  satellites: Map<string, string>
}

const FILE_TYPES = new Set(['file', 'files', 'file_version'])
const USER_TYPES = new Set(['user', 'users'])
const DEPT_TYPES = new Set(['department', 'departments'])
const EVENT_TYPES = new Set(['mission_event', 'events', 'event'])
const SAT_TYPES = new Set(['satellite', 'satellites'])

async function loadNames(logs: any[]): Promise<Names> {
  const ids = (types: Set<string>) =>
    Array.from(new Set(logs.filter((l) => l.resourceId && types.has(String(l.resourceType))).map((l) => String(l.resourceId))))

  const [files, users, depts, events, sats] = await Promise.all([
    prisma.file.findMany({
      where: { id: { in: ids(FILE_TYPES) } },
      select: { id: true, name: true, department: { select: { code: true, name: true } } },
    }),
    prisma.user.findMany({ where: { id: { in: ids(USER_TYPES) } }, select: { id: true, name: true, email: true } }),
    prisma.department.findMany({ where: { id: { in: ids(DEPT_TYPES) } }, select: { id: true, name: true, code: true } }),
    prisma.missionEvent.findMany({ where: { id: { in: ids(EVENT_TYPES) } }, select: { id: true, title: true } }),
    prisma.satellite.findMany({ where: { id: { in: ids(SAT_TYPES) } }, select: { id: true, name: true } }),
  ])

  return {
    files: new Map(files.map((f: any) => [f.id, { name: f.name, dept: f.department?.code || f.department?.name }])),
    users: new Map(users.map((u: any) => [u.id, { name: u.name, email: u.email }])),
    departments: new Map(depts.map((d: any) => [d.id, d.code ? `${d.name} (${d.code})` : d.name])),
    events: new Map(events.map((e: any) => [e.id, e.title])),
    satellites: new Map(sats.map((s: any) => [s.id, s.name])),
  }
}

function targetName(l: any, n: Names, nv: Record<string, any> | null, ov: Record<string, any> | null): string | null {
  const id = l.resourceId ? String(l.resourceId) : ''
  const t = String(l.resourceType || '')
  if (FILE_TYPES.has(t)) return n.files.get(id)?.name ?? nv?.fileName ?? ov?.fileName ?? null
  if (USER_TYPES.has(t)) {
    const u = n.users.get(id)
    return u ? `${u.name} (${u.email})` : nv?.email ?? null
  }
  if (DEPT_TYPES.has(t)) return n.departments.get(id) ?? nv?.name ?? null
  if (EVENT_TYPES.has(t)) return n.events.get(id) ?? nv?.title ?? ov?.title ?? null
  if (SAT_TYPES.has(t)) return n.satellites.get(id) ?? nv?.name ?? null
  if (t === 'report_category') return ov?.name ?? null
  return null
}

const q = (s: string | null | undefined) => (s ? `“${s}”` : '')

function summarize(l: any, actor: string, target: string | null, n: Names, nv: Record<string, any> | null): string {
  const a = String(l.action)
  const dept = FILE_TYPES.has(String(l.resourceType)) ? n.files.get(String(l.resourceId))?.dept ?? nv?.department : null
  const known: Record<string, () => string> = {
    'FILE:UPLOAD': () => `${actor} uploaded ${q(target) || 'a file'}${dept ? ` to ${dept}` : ''}`,
    'FILE:NEW_VERSION': () => `${actor} uploaded a new version of ${q(target) || 'a file'}`,
    'FILE:DELETE': () => `${actor} moved ${q(target) || 'a file'} to Trash`,
    'FILE:RESTORE': () => `${actor} restored ${q(target) || 'a file'} from Trash`,
    'FILE:DOWNLOAD': () => `${actor} downloaded ${q(target) || 'a file'}`,
    'FILE_VERSION:DOWNLOAD': () => `${actor} downloaded a version of ${q(target) || 'a file'}`,
    'FILE_VERSION:TOGGLE_VISIBILITY': () => `${actor} changed which versions of ${q(target) || 'a file'} users can see`,
    'FILE:ADMIN_UPDATE': () => `${actor} edited the details of ${q(target) || 'a file'}`,
    'FOLDER:CREATE': () => `${actor} created a folder`,
    'FILE:TAG': () =>
      `${actor} tagged ${nv?.fileCount && nv.fileCount > 1 ? `${nv.fileCount} files` : q(target) || 'a file'} with ${(nv?.tags ?? []).map((t: string) => `“${t}”`).join(', ')}`,
    'AUTH:LOGIN_FAILED': () =>
      `Failed sign-in for ${nv?.email ?? 'an account'}${nv?.reason === 'user_not_found' ? ' (no such account)' : nv?.reason === 'bad_password' ? ' (wrong password)' : ''}`,
    'POST:/auth/login': () => `${actor} signed in`,
    'POST:/auth/register': () => `${actor} requested an account`,
    'PASSWORD_RESET_OTP_REQUESTED': () => `${actor} requested a password reset code`,
    'PASSWORD_RESET_SUCCESS': () => `${actor} reset their password`,
    'EVENT:CREATE': () => `${actor} scheduled event ${q(target)}`,
    'EVENT:UPDATE': () => `${actor} updated event ${q(target)}`,
    'EVENT:CANCEL': () => `${actor} cancelled event ${q(target)}`,
    'EVENT:DELETE': () => `${actor} deleted event ${q(target)}`,
    'REPORT_CATEGORY:DELETE': () =>
      `${actor} deleted report category ${q(target)}${nv?.filesMovedToGeneral ? ` (${nv.filesMovedToGeneral} file(s) moved to General)` : ''}`,
    'NOTIFICATION:REVOKE_BROADCAST': () => `${actor} revoked a broadcast${nv?.recipientsAffected ? ` (${nv.recipientsAffected} recipients)` : ''}`,
    'POST:/admin/notifications/broadcast': () => `${actor} sent a broadcast`,
    'POST:/users/:id/approve': () => `${actor} approved the account of ${target ?? 'a user'}`,
    'POST:/users/:id/reject': () => `${actor} rejected the account request of ${target ?? 'a user'}`,
    'POST:/users/:id/active': () => `${actor} reactivated ${target ?? 'a user'}`,
    'POST:/users/:id/suspended': () => `${actor} suspended ${target ?? 'a user'}`,
    'PUT:/users/:id': () => `${actor} updated the profile of ${target ?? 'a user'}`,
    'PUT:/user/profile': () => `${actor} updated their own profile`,
    'POST:/departments': () => `${actor} created department ${q(target)}`,
    'PUT:/departments/:id': () => `${actor} updated department ${q(target)}`,
    'DELETE:/departments/:id': () => `${actor} deleted department ${q(target)}`,
    'POST:/departments/:id/users': () => `${actor} granted department access in ${q(target)}`,
    'DELETE:/departments/:id/users/:uid': () => `${actor} removed department access in ${q(target)}`,
    'DEPARTMENT:UPDATE_PAGE_SETTINGS': () => `${actor} changed the public page settings of ${q(target)}`,
    'PUT:/cms/blocks/:key': () => `${actor} edited website content (${l.resourceId ?? 'section'})`,
    'POST:/cms/upload-asset': () => `${actor} uploaded a website image`,
    'SECURITY:BLOCKED_UNSAFE_SVG': () => `Blocked an unsafe SVG upload by ${actor}`,
  }
  if (known[a]) return known[a]().replace(/\s+/g, ' ').trim()
  if (a.startsWith('PUT:/admin/settings/')) return `${actor} changed system setting ${a.slice('PUT:/admin/settings/'.length)}`
  if (a.startsWith('STORAGE:')) return `${actor} changed storage configuration (${a.slice(8).toLowerCase().replace(/_/g, ' ')})`

  // Generic HTTP-derived rows: "METHOD:/path"
  const m = a.match(/^(POST|PUT|PATCH|DELETE):(.*)$/)
  if (m) {
    const verb = { POST: 'created', PUT: 'updated', PATCH: 'updated', DELETE: 'deleted' }[m[1]]
    const what = String(l.resourceType || 'item').replace(/[_-]+/g, ' ')
    return `${actor} ${verb} ${what}${target ? ` ${q(target)}` : ''}`
  }
  return `${actor}: ${a.replace(/[_:]+/g, ' ').toLowerCase()}`
}

function details(l: any, n: Names, nv: Record<string, any> | null, target: string | null) {
  const out: Array<{ label: string; value: string }> = []
  const push = (label: string, v: unknown) => {
    if (v !== undefined && v !== null && v !== '') out.push({ label, value: String(v) })
  }
  if (FILE_TYPES.has(String(l.resourceType))) {
    push('File', target)
    push('Department', n.files.get(String(l.resourceId))?.dept ?? nv?.department)
    if (nv?.sizeBytes) push('Size', `${(Number(nv.sizeBytes) / 1024 / 1024).toFixed(2)} MB`)
    push('Version', nv?.versionNum ? `v${nv.versionNum}` : null)
  } else if (target) {
    push(String(l.resourceType || 'Item').replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase()), target)
  }
  push('IP address', l.ipAddress)
  push('Browser', browserOf(l.userAgent))
  return out
}

export async function presentAuditLogs(logs: any[]) {
  const names = await loadNames(logs)
  return logs.map((l) => {
    const nv = parse(l.newValue)
    const ov = parse(l.oldValue)
    const actorName = l.user?.name || (String(l.action).startsWith('AUTH:') ? 'Anonymous visitor' : 'System')
    const target = targetName(l, names, nv, ov)
    return {
      id: Number(l.id),
      userId: l.userId,
      userName: actorName,
      actor: l.user ? { name: l.user.name, email: l.user.email, role: l.user.role } : null,
      action: l.action,
      summary: summarize(l, actorName, target, names, nv),
      target,
      details: details(l, names, nv, target),
      resourceType: l.resourceType,
      resourceId: l.resourceId,
      oldValue: sanitizeAuditValue(ov),
      newValue: sanitizeAuditValue(nv),
      ipAddress: l.ipAddress,
      createdAt: l.createdAt instanceof Date ? l.createdAt.toISOString() : l.createdAt,
    }
  })
}
