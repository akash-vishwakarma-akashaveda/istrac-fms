// End-to-end API checks for the bug fixes. Run against a local backend (port 3100).
// Usage: ADMIN_PW=<admin password> node scripts/qa/bugfix-api-check.mjs   (backend on :3100; edit API to change)
import assert from 'node:assert/strict'
const API = 'http://localhost:3100'
const j = async (method, path, body, token, headers = {}) => {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data = null
  try { data = await r.json() } catch {}
  return { status: r.status, data }
}
const results = []
const check = async (name, fn) => {
  try { await fn(); results.push(`PASS  ${name}`) } catch (e) { results.push(`FAIL  ${name}: ${e.message}`) }
}
const PW = process.env.ADMIN_PW

// BUG-02: meaningful login errors
await check('BUG-02 unknown email -> "Account not found"', async () => {
  const r = await j('POST', '/auth/login', { email: 'nobody-' + Date.now() + '@istrac.local', password: 'Whatever1!' })
  assert.equal(r.status, 401); assert.equal(r.data.error.code, 'account_not_found')
  assert.match(r.data.error.message, /Account not found/)
})
await check('BUG-02 wrong password -> generic "Incorrect email or password"', async () => {
  const r = await j('POST', '/auth/login', { email: 'admin@istrac.local', password: 'wrong' })
  assert.equal(r.status, 401); assert.equal(r.data.error.code, 'invalid_credentials')
  assert.equal(r.data.error.message, 'Incorrect email or password.')
})

// SECURITY: per-account lockout (throwaway account so the admin is never locked)
await check('SEC account locks after 5 wrong passwords', async () => {
  const email = `qa-lock-${Date.now()}@istrac.local`
  const reg = await j('POST', '/auth/register', { name: 'QA Lock', email, password: 'Correct-Horse-9' })
  assert.ok(reg.status < 300, 'register: ' + JSON.stringify(reg.data))
  for (let i = 0; i < 4; i++) assert.equal((await j('POST', '/auth/login', { email, password: 'Wrong-pass-1' })).status, 401)
  const fifth = await j('POST', '/auth/login', { email, password: 'Wrong-pass-1' })
  assert.equal(fifth.status, 429); assert.equal(fifth.data.error.code, 'account_locked')
  const correct = await j('POST', '/auth/login', { email, password: 'Correct-Horse-9' })
  assert.equal(correct.status, 429, 'even the right password is refused while locked')
})

// SECURITY: OTP attempt cap
await check('SEC 5 wrong OTPs cancel the code', async () => {
  const email = `qa-otp-${Date.now()}@istrac.local`
  for (let i = 0; i < 4; i++) assert.equal((await j('POST', '/auth/verify-reset-otp', { email, otp: '000000' })).status, 400)
  const r = await j('POST', '/auth/reset-password', { email, otp: '000000', newPassword: 'Another-Pass-9' })
  assert.equal(r.status, 429); assert.equal(r.data.error.code, 'otp_attempts_exceeded')
})
await check('BUG-02 validation messages are readable', async () => {
  const r = await j('POST', '/auth/login', { email: 'bad', password: '' })
  assert.equal(r.status, 400)
  assert.doesNotMatch(r.data.error.message, /expected string|Too small|Invalid string/)
  assert.match(r.data.error.message, /Email must be a valid email address/)
})

// BUG-03: logout revokes refresh token (body-supplied, no cookie) and access token
let token
await check('BUG-03 logout revokes refresh + access token without cookies/redis', async () => {
  const login = await j('POST', '/auth/login', { email: 'admin@istrac.local', password: PW })
  assert.equal(login.status, 200)
  const { accessToken, refreshToken } = login.data.data
  const out = await j('POST', '/auth/logout', { refreshToken }, accessToken)
  assert.equal(out.status, 200)
  const me = await j('GET', '/auth/me', null, accessToken)
  assert.equal(me.status, 401, 'access token should be revoked')
  const ref = await j('POST', '/auth/refresh', { refreshToken })
  assert.equal(ref.status, 401, 'refresh token must be unusable right after logout')
})
token = (await j('POST', '/auth/login', { email: 'admin@istrac.local', password: PW })).data.data.accessToken

// BUG-06 / BUG-08: categories
const code = 'QA' + Date.now().toString().slice(-6)
let catId
await check('BUG-08 create custom category; list includes usageCount', async () => {
  const c = await j('POST', '/report-presets/categories', { name: 'QA Category ' + code, code }, token)
  assert.equal(c.status, 201); catId = c.data.data.id
  const list = await j('GET', '/report-presets/categories', null, token)
  const found = list.data.data.find((x) => x.code === code)
  assert.ok(found, 'new category listed'); assert.equal(found.usageCount, 0)
})
await check('BUG-08 filtering by custom category code works (no 500)', async () => {
  const r = await j('GET', `/admin/files?category=${code}`, null, token)
  assert.equal(r.status, 200); assert.equal(r.data.data.length, 0)
  const s = await j('GET', `/search?q=&category=${code}`, null, token)
  assert.ok(s.status < 500, 'search must not crash on custom code, got ' + s.status)
  const legacy = await j('GET', '/admin/files?category=DAILYOPS', null, token)
  assert.equal(legacy.status, 200)
})
await check('BUG-06 delete custom category returns impact message', async () => {
  const d = await j('DELETE', `/report-presets/categories/${catId}`, null, token)
  assert.equal(d.status, 200); assert.match(d.data.data.message, /deleted/)
  const sys = (await j('GET', '/report-presets/categories', null, token)).data.data.find((x) => x.isSystem)
  const d2 = await j('DELETE', `/report-presets/categories/${sys.id}`, null, token)
  assert.equal(d2.status, 400)
})

// BUG-04: trash listing + restore
await check('BUG-04 delete -> appears in trash -> restore', async () => {
  const files = (await j('GET', '/admin/files', null, token)).data.data
  const f = files[0]
  assert.equal((await j('DELETE', `/files/${f.id}`, null, token)).status, 200)
  const trash = (await j('GET', '/admin/files?trash=true', null, token)).data.data
  assert.ok(trash.some((x) => x.id === f.id), 'file listed in trash')
  const active = (await j('GET', '/admin/files', null, token)).data.data
  assert.ok(!active.some((x) => x.id === f.id), 'file hidden from active list')
  assert.equal((await j('PUT', `/files/${f.id}/restore`, null, token)).status, 200)
})

// BUG-09: custom date range
await check('BUG-09 date range filter returns only matching uploads', async () => {
  const future = await j('GET', `/admin/files?startDate=2099-01-01T00:00:00.000Z`, null, token)
  assert.equal(future.data.data.length, 0)
  const all = await j('GET', `/admin/files?startDate=2000-01-01T00:00:00.000Z&endDate=2099-01-01T00:00:00.000Z`, null, token)
  assert.ok(all.data.data.length > 0)
})

// BUG-10: rescheduling a timed-out event back into the future
await check('BUG-10 moving a past event to the future makes it UPCOMING', async () => {
  const past = new Date(Date.now() - 3 * 3600e3), pastEnd = new Date(Date.now() - 2 * 3600e3)
  const c = await j('POST', '/events', { title: 'QA reschedule ' + code, eventDate: past, endDate: pastEnd, showOnBanner: false }, token)
  assert.equal(c.status, 201); assert.equal(c.data.data.status, 'TIMED_OUT')
  const fut = new Date(Date.now() + 24 * 3600e3), futEnd = new Date(Date.now() + 26 * 3600e3)
  const u = await j('PUT', `/events/${c.data.data.id}`, { eventDate: fut, endDate: futEnd, status: 'TIMED_OUT' }, token)
  assert.equal(u.status, 200); assert.equal(u.data.data.status, 'UPCOMING')
  const list = await j('GET', '/events?status=UPCOMING', null, token)
  assert.ok(list.data.data.some((e) => e.id === c.data.data.id), 'listed as upcoming')
  const bad = await j('PUT', `/events/${c.data.data.id}`, { eventDate: fut, endDate: past }, token)
  assert.equal(bad.status, 400)
  await j('DELETE', `/events/${c.data.data.id}`, null, token)
})

// BUG-11/12/13: notifications
let bcId
await check('BUG-12 custom broadcast category CRUD', async () => {
  const add = await j('POST', '/admin/notifications/broadcast-categories', { label: 'QA ' + code }, token)
  assert.equal(add.status, 201)
  const dup = await j('POST', '/admin/notifications/broadcast-categories', { label: 'QA ' + code }, token)
  assert.equal(dup.status, 409)
})
await check('BUG-11/12 broadcast is kind=broadcast with label; event notices are kind=event', async () => {
  const msg = '[NOTICE] QA broadcast ' + code
  assert.equal((await j('POST', '/admin/notifications/broadcast', { message: msg, type: 'NOTICE', label: 'QA ' + code }, token)).status, 201)
  const mine = (await j('GET', '/notifications?limit=50', null, token)).data.data
  const n = mine.find((x) => x.message === msg)
  assert.ok(n, 'admin received broadcast'); assert.equal(n.kind, 'broadcast'); assert.equal(n.label, 'QA ' + code)
  const ev = mine.find((x) => x.category === 'event')
  if (ev) assert.equal(ev.kind, 'event')
  const fileN = mine.find((x) => x.category === 'file')
  if (fileN) assert.equal(fileN.kind, 'file')
  const history = (await j('GET', '/admin/notifications/broadcasts', null, token)).data.data
  assert.ok(history.every((h) => !['event', 'file'].includes(String(h.category).toLowerCase())), 'history only has broadcasts')
  bcId = history.find((h) => h.message === msg).id
})
await check('BUG-13 revoke broadcast removes it for recipients; second revoke is rejected', async () => {
  const r = await j('DELETE', `/admin/notifications/broadcasts/${bcId}`, null, token)
  assert.equal(r.status, 200); assert.ok(r.data.data.recipientsAffected >= 1)
  const mine = (await j('GET', '/notifications?limit=50', null, token)).data.data
  assert.ok(!mine.some((x) => x.message === '[NOTICE] QA broadcast ' + code), 'gone from feed')
  const again = await j('DELETE', `/admin/notifications/broadcasts/${bcId}`, null, token)
  assert.ok([404, 409].includes(again.status))
})
await check('BUG-12 delete broadcast category', async () => {
  const id = ('QA ' + code).toUpperCase().replace(/[^A-Z0-9]/g, '_')
  assert.equal((await j('DELETE', `/admin/notifications/broadcast-categories/${id}`, null, token)).status, 200)
})

// BUG-14: audit logs are readable and don't overshare
await check('BUG-14 audit entries carry summary/actor and no secrets', async () => {
  const r = await j('GET', '/admin/audit-logs?pageSize=50', null, token)
  assert.equal(r.status, 200)
  const e = r.data.data
  assert.ok(e.length > 0 && e.every((x) => typeof x.summary === 'string' && x.summary.length > 0))
  const restore = e.find((x) => x.action === 'FILE:RESTORE')
  assert.ok(restore && /restored “.+” from Trash/.test(restore.summary), 'restore summary: ' + restore?.summary)
  const raw = JSON.stringify(e)
  assert.doesNotMatch(raw, /"(passwordHash|otp|token|refreshToken)"\s*:/i)
  assert.ok(!e.some((x) => /^PUT:\/notifications/.test(x.action)), 'no notification read noise')
})

// Bulk tagging (previously a no-op that still showed "Tags applied")
await check('TAGS bulk tag persists and is returned with the file', async () => {
  const files = (await j('GET', '/admin/files', null, token)).data.data
  const f = files.find((x) => x.department?.id)
  const tag = 'qa-tag-' + code.toLowerCase()
  const r = await j('POST', '/files/tags', { fileIds: [f.id], tags: [tag, ' ' + tag + ' '] }, token)
  assert.equal(r.status, 200, JSON.stringify(r.data))
  assert.equal(r.data.data.tags.length, 1, 'duplicates collapsed')
  const listing = await j('GET', `/departments/${f.department.id}/files`, null, token)
  const row = (listing.data?.data ?? []).find((x) => x.id === f.id)
  assert.ok(row && row.tags.includes(tag), 'tag returned with file')
  assert.equal((await j('POST', '/files/tags', { fileIds: [f.id], tags: [] }, token)).status, 400)
  assert.equal((await j('POST', '/files/tags', { fileIds: ['00000000-0000-0000-0000-000000000000'], tags: ['x'] }, token)).status, 404)
})

console.log(results.join('\n'))
