// Upload a real PDF under a custom category and verify BUG-06/08/14 end to end.
// Usage: ADMIN_PW=<admin password> node scripts/qa/bugfix-upload-check.mjs  (uploads one small QA PDF; move it to Trash afterwards)
import assert from 'node:assert/strict'
const API = 'http://localhost:3100'
const PW = process.env.ADMIN_PW
const out = []
const j = async (method, path, body, token) => {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, data: await r.json().catch(() => null) }
}

// Minimal valid one-page PDF with visible text.
function makePdf(text) {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  const stream = `BT /F1 28 Tf 72 700 Td (${text}) Tj ET`
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  let pdf = '%PDF-1.4\n'
  const offsets = []
  objs.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = pdf.length
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}

const token = (await j('POST', '/auth/login', { email: 'admin@istrac.local', password: PW })).data.data.accessToken
// login endpoint needs no auth; re-do without bearer quirks
const dept = (await j('GET', '/admin/departments', null, token)).data.data?.[0] || (await j('GET', '/departments', null, token)).data.data[0]
const code = 'QAUP' + Date.now().toString().slice(-5)
const cat = await j('POST', '/report-presets/categories', { name: 'QA Upload ' + code, code }, token)
assert.equal(cat.status, 201)

const fd = new FormData()
const fname = `QA_PREVIEW_${code}.pdf`
fd.append('file', new Blob([makePdf('ISTRAC QA PREVIEW ' + code)], { type: 'application/pdf' }), fname)
fd.append('departmentId', dept.id)
fd.append('title', 'QA preview ' + code)
fd.append('category', code)
const up = await fetch(API + '/files/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
const upData = await up.json()
assert.ok(up.status < 300, 'upload failed: ' + JSON.stringify(upData))
const fileId = upData.data?.id || upData.data?.file?.id
out.push(`PASS  upload ok (${fname}, id ${fileId})`)

const list = (await j('GET', `/admin/files?category=${code}`, null, token)).data.data
assert.ok(list.some((f) => f.id === fileId), 'custom-category filter finds the upload')
assert.equal(list.find((f) => f.id === fileId).report.categoryCode, code)
out.push('PASS  BUG-08 custom category filter returns the uploaded file')

const usage = (await j('GET', '/report-presets/categories', null, token)).data.data.find((c) => c.code === code)
assert.equal(usage.usageCount, 1)
out.push('PASS  BUG-06 usageCount = 1 for the category in use')

const del = await j('DELETE', `/report-presets/categories/${cat.data.data.id}`, null, token)
assert.equal(del.status, 200); assert.equal(del.data.data.filesMovedToGeneral, 1)
const gen = (await j('GET', `/admin/files?category=GENERAL`, null, token)).data.data
assert.ok(gen.some((f) => f.id === fileId), 'file now under General')
const still = await j('GET', `/files/${fileId}/versions`, null, token)
assert.equal(still.status, 200, 'file still accessible')
out.push(`PASS  BUG-06 delete in-use category: "${del.data.data.message}"`)

const audit = (await j('GET', '/admin/audit-logs?pageSize=20', null, token)).data.data.find((e) => e.action === 'FILE:UPLOAD' && e.resourceId === fileId)
assert.ok(audit, 'upload audited'); assert.match(audit.summary, new RegExp(`uploaded “${fname}”`))
out.push(`PASS  BUG-14 upload audit: "${audit.summary}" details=${JSON.stringify(audit.details.map((d) => d.label))}`)
console.log(out.join('\n'))
console.log('FILE_ID=' + fileId)
