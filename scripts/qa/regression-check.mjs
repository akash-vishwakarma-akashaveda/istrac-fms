// Role-based regression suite: anonymous visitor, member (READ_ONLY on dept A, READ_WRITE on dept B),
// and admin. Covers access control, session security and the main admin flows end to end.
// Usage: ADMIN_PW=<admin password> node scripts/qa/regression-check.mjs   (backend on :3100)
// Creates one throwaway member (suspended at the end) and a few QA_* files (moved to Trash at the end).
import assert from 'node:assert/strict'

const API = process.env.API || 'http://localhost:3100'
const PW = process.env.ADMIN_PW
const results = []
const cleanup = []

async function call(method, path, { body, token, form, headers = {} } = {}) {
  const h = { ...headers }
  if (token) h.Authorization = `Bearer ${token}`
  let payload
  if (form) payload = form
  else if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }
  const r = await fetch(API + path, { method, headers: h, body: payload })
  const text = await r.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = text }
  return { status: r.status, data }
}
async function check(name, fn) {
  try { await fn(); results.push(`PASS  ${name}`) } catch (e) { results.push(`FAIL  ${name}: ${e.message.split('\n')[0]}`) }
}
const login = async (email, password) => (await call('POST', '/auth/login', { body: { email, password } })).data?.data
const tiny = (label) => {
  const s = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF ${label}`
  return new Blob([s], { type: 'application/pdf' })
}
async function upload(token, deptId, name, extra = {}, content = name) {
  const fd = new FormData()
  fd.append('file', tiny(content), name)
  fd.append('departmentId', deptId)
  fd.append('title', name)
  fd.append('category', 'GENERAL')
  for (const [k, v] of Object.entries(extra)) fd.append(k, v)
  const r = await call('POST', '/files/upload', { token, form: fd })
  return { status: r.status, id: r.data?.data?.id || r.data?.data?.file?.id, data: r.data }
}

// ---------------------------------------------------------------- setup
const admin = (await login('admin@istrac.local', PW))
assert.ok(admin?.accessToken, 'admin login failed')
const A = admin.accessToken
const depts = (await call('GET', '/departments/public')).data.data
assert.ok(depts.length >= 3, 'need at least 3 departments')
const [dA, dB, dC] = depts
const stamp = Date.now().toString().slice(-6)
const memberEmail = `qa-member-${stamp}@istrac.local`
const memberPw = 'Member-Pass-2026!'

const reg = await call('POST', '/auth/register', { body: { name: 'QA Member', email: memberEmail, password: memberPw, departmentPreference: dC.code } })
assert.ok(reg.status < 300, 'register: ' + JSON.stringify(reg.data))
const pending = (await call('GET', '/admin/users/pending', { token: A })).data.data
const mUser = pending.find((u) => u.email === memberEmail)
assert.ok(mUser, 'member not pending')
const appr = await call('POST', `/admin/users/${mUser.id}/approve`, { token: A, body: { role: 'MEMBER', departments: [{ departmentId: dA.id, accessLevel: 'READ_ONLY' }, { departmentId: dB.id, accessLevel: 'READ_WRITE' }] } })
assert.ok(appr.status < 300, 'approve: ' + JSON.stringify(appr.data))
let member = await login(memberEmail, memberPw)
assert.ok(member?.accessToken, 'member login failed')
let M = member.accessToken

const fA = await upload(A, dA.id, `QA_RG_A_${stamp}.pdf`)
const fC = await upload(A, dC.id, `QA_RG_C_${stamp}.pdf`)
const fPub = await upload(A, dC.id, `QA_RG_PUBLIC_${stamp}.pdf`)
for (const f of [fA, fC, fPub]) { assert.ok(f.id, 'setup upload failed: ' + JSON.stringify(f.data)); cleanup.push(f.id) }
await call('PATCH', `/files/${fPub.id}/feature`, { token: A, body: { isFeatured: true } })

// ---------------------------------------------------------------- anonymous
await check('ANON search only returns featured files, never internal paths', async () => {
  const r = await call('GET', `/search?q=QA_RG_&limit=100`)
  assert.equal(r.status, 200)
  const names = r.data.data?.results?.map((x) => x.name) ?? r.data.data?.map?.((x) => x.name) ?? []
  const items = r.data.data?.results ?? r.data.data ?? []
  assert.ok(!names.includes(fA.data?.data?.name || `QA_RG_A_${stamp}.pdf`), 'private file A visible to anonymous')
  assert.ok(!names.includes(`QA_RG_C_${stamp}.pdf`), 'private file C visible to anonymous')
  assert.ok(items.every((x) => !x.hddPath), 'hddPath exposed')
})
await check('ANON download: private file 401, featured file 200', async () => {
  assert.equal((await call('GET', `/files/${fA.id}/download`)).status, 401)
  assert.equal((await call('GET', `/files/${fPub.id}/download`)).status, 200)
})
await check('ANON admin/write endpoints are refused (401)', async () => {
  for (const [m, p] of [['GET', '/admin/stats'], ['GET', '/admin/users'], ['POST', '/files/tags'], ['POST', '/admin/notifications/broadcast'], ['GET', '/notifications']]) {
    const r = await call(m, p, { body: m === 'POST' ? {} : undefined })
    assert.equal(r.status, 401, `${m} ${p} -> ${r.status}`)
  }
})
await check('ANON public department listing hides disk paths', async () => {
  const r = await call('GET', `/departments/${dC.id}/files`)
  assert.equal(r.status, 200)
  assert.ok((r.data.data ?? []).every((x) => !x.hddPath))
})

// ---------------------------------------------------------------- member: access control
await check('MEMBER is MEMBER and admin endpoints are 403', async () => {
  assert.equal((await call('GET', '/auth/me', { token: M })).data.data.role, 'MEMBER')
  for (const p of ['/admin/stats', '/admin/users', '/admin/files', '/admin/audit-logs', '/admin/settings']) {
    assert.equal((await call('GET', p, { token: M })).status, 403, p)
  }
})
await check('MEMBER hub: granted dept 200 (by id and by code), other dept 403', async () => {
  assert.equal((await call('GET', `/departments/${dA.id}/hub`, { token: M })).status, 200)
  assert.equal((await call('GET', `/departments/${dA.code}/hub`, { token: M })).status, 200)
  assert.equal((await call('GET', `/departments/${dC.id}/hub`, { token: M })).status, 403)
})
await check('MEMBER search limited to granted depts (registration preference grants nothing)', async () => {
  const r = await call('GET', `/search?q=QA_RG_&limit=100`, { token: M })
  const items = r.data.data?.results ?? r.data.data ?? []
  assert.ok(items.every((x) => [dA.id, dB.id].includes(x.departmentId)), 'result outside granted departments')
  assert.ok(items.some((x) => x.id === fA.id), 'own-department file missing')
  assert.ok(items.every((x) => !x.hddPath), 'hddPath exposed to member')
})
await check('MEMBER search dept: operator respects access', async () => {
  const own = await call('GET', `/search?q=${encodeURIComponent(`QA_RG_ dept:${dA.code}`)}`, { token: M })
  const ownItems = own.data.data?.results ?? own.data.data ?? []
  assert.ok(ownItems.length > 0 && ownItems.every((x) => x.departmentId === dA.id))
  const other = await call('GET', `/search?q=${encodeURIComponent(`QA_RG_ dept:${dC.code}`)}`, { token: M })
  assert.equal((other.data.data?.results ?? other.data.data ?? []).length, 0)
})
await check('MEMBER downloads/versions: own dept allowed, other dept 403', async () => {
  assert.equal((await call('GET', `/files/${fA.id}/download`, { token: M })).status, 200)
  assert.equal((await call('GET', `/files/${fC.id}/download`, { token: M })).status, 403)
  assert.equal((await call('GET', `/files/${fA.id}/versions`, { token: M })).status, 200)
  assert.equal((await call('GET', `/files/${fC.id}/versions`, { token: M })).status, 403)
  assert.equal((await call('GET', `/departments/${dC.id}/tree`, { token: M })).status, 403)
})
await check('MEMBER upload: READ_ONLY dept 403, READ_WRITE dept allowed', async () => {
  assert.equal((await upload(M, dA.id, `QA_RG_MRO_${stamp}.pdf`)).status, 403)
  const ok = await upload(M, dB.id, `QA_RG_MRW_${stamp}.pdf`)
  assert.ok(ok.status < 300 && ok.id, 'READ_WRITE upload failed: ' + JSON.stringify(ok.data).slice(0, 120))
  cleanup.push(ok.id)
  // tagging follows write access too
  assert.equal((await call('POST', '/files/tags', { token: M, body: { fileIds: [fA.id], tags: ['qa-tag-x'] } })).status, 403)
  assert.equal((await call('POST', '/files/tags', { token: M, body: { fileIds: [ok.id], tags: [`qa-tag-${stamp}`] } })).status, 200)
})
await check('MEMBER chunk upload rejects path-traversal chunk index', async () => {
  const fd = new FormData()
  fd.append('chunk', new Blob(['x']), 'c.bin')
  fd.append('fileName', `QA_RG_CHUNK_${stamp}.pdf`)
  fd.append('chunkIndex', '/../../../../tmp/qa-escape')
  fd.append('departmentId', dB.id)
  const bad = await call('POST', '/files/upload/chunk', { token: M, form: fd })
  assert.equal(bad.status, 400, 'traversal accepted: ' + bad.status)
  const fd2 = new FormData()
  fd2.append('chunk', new Blob(['x']), 'c.bin')
  fd2.append('fileName', `QA_RG_CHUNK_${stamp}.pdf`)
  fd2.append('chunkIndex', '0')
  fd2.append('departmentId', dB.id)
  assert.ok((await call('POST', '/files/upload/chunk', { token: M, form: fd2 })).status < 300, 'valid chunk refused')
})
await check('MEMBER cannot delete shared presets or broadcast or manage events', async () => {
  const naming = (await call('GET', '/report-presets/naming', { token: M })).data.data
  if (naming.length) assert.equal((await call('DELETE', `/report-presets/naming/${naming[0].id}`, { token: M })).status, 403)
  const cats = (await call('GET', '/report-presets/categories', { token: M })).data.data
  assert.equal((await call('DELETE', `/report-presets/categories/${cats[0].id}`, { token: M })).status, 403)
  assert.equal((await call('POST', '/admin/notifications/broadcast', { token: M, body: { message: 'x' } })).status, 403)
  assert.equal((await call('POST', '/events', { token: M, body: { title: 'x', eventDate: new Date() } })).status, 403)
  assert.equal((await call('GET', '/events', { token: M })).status, 200)
})
await check('MEMBER profile update cannot change role or status', async () => {
  const r = await call('PUT', '/user/profile', { token: M, body: { name: 'QA Member Renamed', role: 'ADMIN', status: 'ACTIVE' } })
  assert.ok(r.status < 300)
  const me = (await call('GET', '/auth/me', { token: M })).data.data
  assert.equal(me.role, 'MEMBER'); assert.equal(me.name, 'QA Member Renamed')
})
await check('MEMBER notifications: list, count, read-all', async () => {
  assert.equal((await call('GET', '/notifications', { token: M })).status, 200)
  assert.equal((await call('GET', '/notifications/count', { token: M })).status, 200)
  assert.equal((await call('PUT', '/notifications/read-all', { token: M })).status, 200)
  assert.equal((await call('GET', '/notifications/count', { token: M })).data.data.unread, 0)
})
await check('MEMBER cannot list versions of a file moved to Trash', async () => {
  const f = await upload(A, dA.id, `QA_RG_TRASH_${stamp}.pdf`)
  cleanup.push(f.id)
  await call('DELETE', `/files/${f.id}`, { token: A })
  assert.equal((await call('GET', `/files/${f.id}/versions`, { token: M })).status, 404)
  assert.equal((await call('GET', `/files/${f.id}/versions`, { token: A })).status, 200, 'admin should still see it')
})

await check('FILES re-upload after Trash works and the trashed original stays intact', async () => {
  const name = `QA_RG_REUP_${stamp}.pdf`
  const first = await upload(A, dB.id, name, {}, 'original-content')
  assert.ok(first.id, 'first upload failed')
  cleanup.push(first.id)
  await call('DELETE', `/files/${first.id}`, { token: A })
  const second = await upload(A, dB.id, name, {}, 'replacement-content')
  assert.ok(second.status < 300 && second.id, 're-upload refused: ' + JSON.stringify(second.data).slice(0, 140))
  cleanup.push(second.id)
  assert.notEqual(second.id, first.id)
  assert.ok((await call('PUT', `/files/${first.id}/restore`, { token: A })).status < 300, 'restore failed')
  const a = (await call('GET', `/files/${first.id}/download`, { token: A })).data
  const b = (await call('GET', `/files/${second.id}/download`, { token: A })).data
  assert.notEqual(a, b, 'restored original was overwritten by the re-upload')
  // a third upload with the same name versions the active file instead of creating another
  const third = await upload(A, dB.id, name)
  assert.ok(third.status < 300)
})

// ---------------------------------------------------------------- sessions
await check('SESSION change password: other sessions end, this one continues with new tokens', async () => {
  const second = await login(memberEmail, memberPw) // another device
  const newPw = 'Member-Pass-2027!'
  const r = await call('PUT', '/auth/change-password', { token: M, body: { currentPassword: memberPw, newPassword: newPw } })
  assert.equal(r.status, 200, JSON.stringify(r.data))
  assert.ok(r.data.data.accessToken, 'no fresh token returned')
  assert.equal((await call('GET', '/auth/me', { token: second.accessToken })).status, 401, 'other device still signed in')
  assert.equal((await call('POST', '/auth/refresh', { body: { refreshToken: second.refreshToken } })).status, 401, 'other device can refresh')
  M = r.data.data.accessToken
  assert.equal((await call('GET', '/auth/me', { token: M })).status, 200, 'current session lost')
  assert.equal((await call('POST', '/auth/login', { body: { email: memberEmail, password: newPw } })).status, 200)
})
await check('SESSION suspend cuts access immediately; reactivate restores sign-in', async () => {
  const s = await call('POST', `/admin/users/${mUser.id}/suspend`, { token: A })
  assert.ok(s.status < 300, JSON.stringify(s.data))
  assert.equal((await call('GET', '/auth/me', { token: M })).status, 401, 'suspended token still works')
  const blocked = await call('POST', '/auth/login', { body: { email: memberEmail, password: 'Member-Pass-2027!' } })
  assert.equal(blocked.status, 403)
  await call('POST', `/admin/users/${mUser.id}/suspend`, { token: A }) // toggles back to ACTIVE
  const again = await login(memberEmail, 'Member-Pass-2027!')
  assert.ok(again?.accessToken, 'reactivated user cannot sign in')
  M = again.accessToken
})
await check('SESSION force logout ends the session', async () => {
  const r = await call('POST', `/users/${mUser.id}/force-logout`, { token: A })
  assert.ok(r.status < 300, JSON.stringify(r.data))
  assert.equal((await call('GET', '/auth/me', { token: M })).status, 401)
  M = (await login(memberEmail, 'Member-Pass-2027!')).accessToken
})
await check('ACCESS revocation takes effect (within the 30 s cache)', async () => {
  const r = await call('DELETE', `/admin/departments/${dA.id}/users/${mUser.id}`, { token: A })
  assert.ok(r.status < 300, JSON.stringify(r.data))
  let code = 0
  for (let i = 0; i < 8; i++) { // up to ~40 s when Redis caches grants
    code = (await call('GET', `/departments/${dA.id}/hub`, { token: M })).status
    if (code === 403) break
    await new Promise((res) => setTimeout(res, 5000))
  }
  assert.equal(code, 403, 'access still granted after revocation')
  const g = await call('POST', `/admin/departments/${dA.id}/users`, { token: A, body: { userId: mUser.id, accessLevel: 'READ_ONLY' } })
  assert.ok(g.status < 300)
  assert.equal((await call('GET', `/departments/${dA.id}/hub`, { token: M })).status, 200, 'fresh grant not effective immediately')
})

// ---------------------------------------------------------------- admin flows
await check('ADMIN satellite create / update / deactivate / restore', async () => {
  const c = await call('POST', '/admin/satellites', { token: A, body: { name: `QA Sat ${stamp}`, code: `QASAT${stamp}`, satId: `QA-${stamp}`, status: 'ACTIVE' } })
  assert.ok(c.status < 300, JSON.stringify(c.data))
  const id = c.data.data.id
  assert.ok((await call('PUT', `/admin/satellites/${id}`, { token: A, body: { description: 'QA updated' } })).status < 300)
  assert.ok((await call('DELETE', `/admin/satellites/${id}`, { token: A })).status < 300)
  assert.ok((await call('POST', `/admin/satellites/${id}/restore`, { token: A })).status < 300)
  await call('DELETE', `/admin/satellites/${id}`, { token: A })
})
await check('ADMIN event create / update / cancel / delete', async () => {
  const c = await call('POST', '/events', { token: A, body: { title: `QA Event ${stamp}`, eventDate: new Date(Date.now() + 864e5), showOnBanner: false } })
  assert.equal(c.status, 201)
  const id = c.data.data.id
  assert.equal((await call('PUT', `/events/${id}`, { token: A, body: { title: `QA Event ${stamp} v2` } })).status, 200)
  assert.equal((await call('PATCH', `/events/${id}/cancel`, { token: A })).data.data.status, 'CANCELLED')
  assert.ok((await call('DELETE', `/events/${id}`, { token: A })).status < 300)
})
await check('ADMIN CMS block round-trip and setting round-trip', async () => {
  const blocks = (await call('GET', '/cms/blocks')).data.data
  const key = Object.keys(blocks)[0]
  assert.ok((await call('PUT', `/cms/blocks/${key}`, { token: A, body: { content: blocks[key] } })).status < 300)
  const settings = (await call('GET', '/admin/settings', { token: A })).data.data
  const before = settings.downloadRateLimitPerHour ?? 100
  assert.ok((await call('PUT', '/admin/settings/downloadRateLimitPerHour', { token: A, body: { value: Number(before) } })).status < 300)
})
await check('ADMIN audit log has readable entries for these actions', async () => {
  const logs = (await call('GET', '/admin/audit-logs?pageSize=100', { token: A })).data.data
  assert.ok(logs.some((l) => l.action === 'FILE:UPLOAD' && /uploaded “QA_RG_/.test(l.summary)), 'upload not audited')
  assert.ok(logs.every((l) => l.summary && !/passwordHash|refreshToken/.test(JSON.stringify(l))))
})
await check('ANON public notification feeds never name private (non-featured) uploads', async () => {
  const pub = (await call('GET', '/notifications/public')).data.data
  const banner = (await call('GET', '/events/active-banner')).data.data?.broadcasts || []
  const text = [...pub, ...banner].map((n) => n.message || '').join(' | ')
  for (const priv of [`QA_RG_A_${stamp}`, `QA_RG_C_${stamp}`, `QA_RG_MRW_${stamp}`]) {
    assert.ok(!text.includes(priv), `anonymous feed leaks ${priv}`)
  }
})
await check('PUBLIC endpoints respond', async () => {
  for (const p of ['/health', '/departments/public', '/public/stats', '/events', '/notifications/public', '/files/featured-list', '/cms/blocks', '/satellites']) {
    assert.equal((await call('GET', p)).status, 200, p)
  }
})

// ---------------------------------------------------------------- cleanup
for (const id of cleanup) await call('DELETE', `/files/${id}`, { token: A })
await call('POST', `/admin/users/${mUser.id}/suspend`, { token: A })
console.log(results.join('\n'))
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`)
