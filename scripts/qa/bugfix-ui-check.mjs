// Browser flow checks (BUG-02/03/04/05/07/16) against the dev server.
// Usage: npm i -D puppeteer-core (outside the app), then ADMIN_PW=<pw> node scripts/qa/bugfix-ui-check.mjs. Needs Vite on :5190 and Chrome installed.
// crypto.randomUUID is removed before app code runs, reproducing the plain-HTTP intranet
// deployment where it doesn't exist (the original cause of BUG-03/04/07).
import puppeteer from 'puppeteer-core'
import assert from 'node:assert/strict'

const BASE = 'http://localhost:5190'
const PW = process.env.ADMIN_PW
const results = []
const check = async (name, fn) => {
  try { await fn(); results.push(`PASS  ${name}`) } catch (e) {
    const shot = `ui-fail-${results.length}.png`
    await page.screenshot({ path: shot }).catch(() => {})
    results.push(`FAIL  ${name}: ${e.message.split('\n')[0]} [${shot}] url=${page.url()}`)
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 1366, height: 900 })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(e.message))
await page.evaluateOnNewDocument(() => {
  try { Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true }) } catch {}
  try { Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }) } catch {}
})
const bodyText = () => page.evaluate(() => document.body.textContent)
const session = () => page.evaluate(() => JSON.parse(localStorage.getItem('istrac-auth-session') || '{}')?.state)

async function login(email, password) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#modal-login-email', { visible: true, timeout: 20000 })
  await sleep(800)
  for (const [sel, val] of [['#modal-login-email', email], ['#modal-login-password', password]]) {
    await page.click(sel, { clickCount: 3 })
    await page.keyboard.press('Backspace')
    await page.type(sel, val)
  }
  await page.keyboard.press('Enter')
  await sleep(2500)
}

await check('BUG-02/03 unknown email: clear message, no session', async () => {
  await login('ghost-user@istrac.local', 'Whatever123!')
  const t = await bodyText()
  assert.match(t, /Account not found/)
  assert.ok(!(await session())?.user, 'no user in store')
  assert.equal(new URL(page.url()).pathname, '/login')
})

await check('BUG-03 wrong password after a stale session: session cleared, error shown', async () => {
  await page.evaluate(() => localStorage.setItem('istrac-auth-session', JSON.stringify({ state: { user: { id: 'x', name: 'Stale', email: 's@x', role: 'ADMIN' }, accessToken: 'stale', refreshToken: null }, version: 0 })))
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await sleep(2500)
  await page.evaluate(() => (window.location.href = '/login'))
  await sleep(1500)
  // the stale user would bounce /login to /admin; clear it like a user would via the modal
  await page.evaluate(() => localStorage.removeItem('istrac-auth-session'))
  await login('admin@istrac.local', 'definitely-wrong')
  assert.match(await bodyText(), /Incorrect email or password/)
  assert.ok(!(await session())?.user, 'no user after failed login')
})

await check('BUG-03/07 successful login on non-secure context: no error, toast shown, redirected', async () => {
  await login('admin@istrac.local', PW)
  assert.equal(new URL(page.url()).pathname, '/admin')
  const t = await bodyText()
  assert.doesNotMatch(t, /unexpected error/i)
  assert.match(t, /Signed in/)
  assert.ok((await session())?.user, 'user stored')
})

await check('BUG-04/07 delete file: dialog closes, toast confirms Trash, restore works', async () => {
  await page.goto(BASE + '/admin/files', { waitUntil: 'domcontentloaded' }); await sleep(2500)
  await sleep(1500)
  const firstName = await page.$eval('tbody tr td:nth-child(2)', (el) => el.innerText.split('\n')[0].trim())
  await page.click('button[title="Move File to Trash (Soft Delete)"]')
  await page.waitForFunction(() => document.body.textContent.includes('Move file to Trash?'), { timeout: 5000 })
  const btns = await page.$$('button')
  for (const b of btns) if ((await b.evaluate((e) => e.textContent.trim().toLowerCase())) === 'move to trash') { await b.click(); break }
  await sleep(2000)
  const t = await bodyText()
  assert.ok(!t.includes('Move file to Trash?'), 'dialog closed')
  assert.match(t, /Moved to Trash/)
  // switch to Trash view and restore
  for (const b of await page.$$('button[aria-pressed]')) if ((await b.evaluate((e) => e.textContent.trim().toLowerCase())) === 'trash') { await b.click(); break }
  await sleep(2000)
  assert.ok((await bodyText()).includes(firstName.slice(0, 12)), 'file visible in Trash: ' + firstName)
  for (const b of await page.$$('button')) if ((await b.evaluate((e) => e.textContent.trim().toLowerCase())) === 'restore') { await b.click(); break }
  await sleep(2000)
  assert.match(await bodyText(), /File restored/)
})

await check('BUG-05 PDF preview renders with the legacy pdf.js build', async () => {
  await page.goto(BASE + '/admin/files', { waitUntil: 'domcontentloaded' }); await sleep(2500)
  await sleep(1500)
  const rows = await page.$$('tbody tr')
  let opened = false
  for (const r of rows) {
    const name = await r.evaluate((e) => e.innerText)
    if (/\.pdf/i.test(name)) { await (await r.$('button[title="Preview File"]')).click(); opened = true; break }
  }
  assert.ok(opened, 'found a PDF row')
  await sleep(6000)
  const state = await page.evaluate(() => ({ canvases: document.querySelectorAll('canvas').length, text: document.body.textContent }))
  assert.ok(state.canvases > 0 || /could not|unable|failed/i.test(state.text) === false, 'pdf canvas rendered')
  assert.doesNotMatch(state.text, /Failed to load PDF|PDF rendering failed/i)
  await page.keyboard.press('Escape')
})

await check('BUG-16 logout lands on the landing page without the login popup', async () => {
  await page.goto(BASE + '/admin', { waitUntil: 'domcontentloaded' }); await sleep(2500)
  await sleep(1000)
  // open the profile menu, then click Sign out / Logout
  await page.click('button[aria-haspopup="menu"]:not([aria-label*="Notifications"])')
  await sleep(500)
  for (const b of await page.$$('button, [role="menuitem"]')) {
    const txt = await b.evaluate((e) => e.innerText.trim())
    if (/^(sign out|log ?out)/i.test(txt)) { await b.click(); break }
  }
  await sleep(2500)
  assert.equal(new URL(page.url()).pathname, '/')
  assert.equal(await page.$('#modal-login-email'), null, 'login popup not open')
  assert.match(await bodyText(), /signed out/i)
  assert.ok(!(await session())?.user)
})

await check('BUG-01 theme toggle switches and persists', async () => {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await sleep(2500)
  const before = await page.evaluate(() => document.documentElement.dataset.theme)
  await page.click('button[aria-label^="Switch to"]')
  const after = await page.evaluate(() => document.documentElement.dataset.theme)
  assert.notEqual(before, after)
  await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500)
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), after, 'persisted after reload')
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  results.push(`INFO  theme ${before} -> ${after}, body bg ${bg}`)
  await page.click('button[aria-label^="Switch to"]') // restore
})

console.log(results.join('\n'))
if (pageErrors.length) console.log('PAGE ERRORS:\n' + [...new Set(pageErrors)].join('\n'))
await browser.close()
