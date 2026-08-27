# ISTRAC-SIMS Frontend Architecture & Technical Reference

> **Application:** Indian Space Research Organisation — Satellite Information Management System (ISTRAC-SIMS Frontend)
> **Version:** 1.1.0 (V1 Production Baseline)
> **Core Stack:** React 19 · Vite 8 · TypeScript 5 · Tailwind CSS v4 · TanStack Query v5 · Zustand v5 · Axios · Lucide React · DOMPurify · PDF.js
> **Build Time:** ~900ms (2154 modules, vendor-chunked)

---

## 📑 Table of Contents

1. [Application Entry Point & Provider Hierarchy](#1-application-entry-point--provider-hierarchy)
2. [Routing Architecture — 3-Tier Guard System](#2-routing-architecture--3-tier-guard-system)
3. [API Layer — Modular Service Clients (`src/api/`)](#3-api-layer--modular-service-clients-srcapi)
4. [State Management — Zustand Stores (`src/store/`)](#4-state-management--zustand-stores-srcstore)
5. [Server State — TanStack Query v5 & Custom Hooks (`src/hooks/`)](#5-server-state--tanstack-query-v5--custom-hooks-srchooks)
6. [File Upload Engine — Chunked Streaming & SHA-256](#6-file-upload-engine--chunked-streaming--sha-256)
7. [Real-Time WebSocket Client (`src/lib/ws.ts`)](#7-real-time-websocket-client-srclibwsts)
8. [CMS Context — Live Editable Landing Page (`src/context/cmsContext.tsx`)](#8-cms-context--live-editable-landing-page-srccontextcmscontexttsx)
9. [Security & Sanitization Utilities (`src/lib/`)](#9-security--sanitization-utilities-srclib)
10. [Page Inventory — Admin vs Member vs Public](#10-page-inventory--admin-vs-member-vs-public)
11. [Component Inventory — Full Catalogue](#11-component-inventory--full-catalogue)
12. [Design System Tokens & CSS Architecture](#12-design-system-tokens--css-architecture)

---

## 1. Application Entry Point & Provider Hierarchy

### `src/main.tsx` — Root Render Tree
```
StrictMode
  └── QueryClientProvider (TanStack Query global cache)
        └── App
              ├── ReactQueryDevtools (initialIsOpen=false, dev only)
              └── [App routing tree]
```
**Why `StrictMode`?** In development, React 19 double-invokes effects and renders to surface side-effects in hooks early. Intentionally left enabled because it helps catch imperative cleanup bugs in the WebSocket client and upload engine.

**Why `QueryClientProvider` at root?** Any component in the tree can call `useQuery` or `useQueryClient` without re-importing the client. Placing it above `App` (and outside `CmsProvider`) ensures the cache is available even for CMS initialization fetches.

**Global `QueryClient` configuration** (in `src/lib/queryClient.ts`):
```ts
staleTime: 30_000          // Server data is considered fresh for 30 seconds
retry: 1                   // One automatic retry on failure before showing error state
refetchOnWindowFocus: false // Prevents API flood when user alt-tabs back to portal
```
**Why `refetchOnWindowFocus: false`?** Ground station operators keep many tabs open simultaneously. Aggressive refetching on focus would trigger dozens of parallel API calls against the backend, overwhelming bandwidth on low-speed intranet links.

---

### `src/App.tsx` — Session Bootstrap & Global Layout
`App` calls `useInitAuth()` immediately on mount. If `isChecking = true`, it renders a full-screen "Establishing session" pulse indicator (class `graticule bg-page`) while the app silently posts `/auth/refresh` using the stored `httpOnly` cookie.

**Why block rendering?** Rendering route content before auth is resolved causes:
1. Protected pages flashing before redirect
2. TanStack Query hooks executing with `null` user and fetching unauthorized data
3. Race conditions in the WebSocket connection (which requires a valid access token)

**Provider wrapping order:**
```
CmsProvider
  └── BrowserRouter
        └── ToastContainer   ← Rendered outside <Routes> so toasts persist across navigations
              └── Routes
```

---

## 2. Routing Architecture — 3-Tier Guard System

The app uses **three layered route guards** nested via React Router v6 `<Outlet>`.

### Tier 1 — Public Routes (no auth required)
Rendered inside `<PublicLayout>` which provides `Navbar` + `Footer` and a `<Outlet>` for page content.

| Path | Component | Purpose |
| :--- | :--- | :--- |
| `/` | `Landing` | CMS-driven public landing page with Hero, Divisions, Calendar |
| `/departments` | `DepartmentsList` | Public operational division catalogue |
| `/departments/:deptId` | `DepartmentDetail` | Division profile + file catalog (gated download) |
| `/login` | `Login` | Email/password sign-in form |
| `/register` | `Register` | 5-step access request form for new operators |
| `/forgot-password` | `ForgotPassword` | Email-based password reset flow |
| `/demo` | `ComponentDemo` | Internal UI component showcase |

### Tier 2 — Authenticated Routes (`<ProtectedRoute>`)
**`src/routes/ProtectedRoute.tsx`:** Reads `user` from `authStore`. If `null`, renders `<Navigate to="/login" replace />`. No other logic — pure binary authentication gate.

Immediately inside, **`<ForcePasswordGuard>`** checks `user.tempPass`. If `true`, it redirects to `/force-password-change` and blocks all other protected pages until the temporary password is changed. This is triggered for new admin-created accounts where ISRO policy requires immediate password rotation.

These routes are wrapped in `<AppShell>` which provides the collapsible sidebar, top navigation bar with notification bell, and the main content `<Outlet>`.

| Path | Component | Access |
| :--- | :--- | :--- |
| `/force-password-change` | `ForcePasswordChange` | `MEMBER` + `ADMIN` (temp pass only) |
| `/dashboard` | `UserHome` | `MEMBER` + `ADMIN` |
| `/dashboard/events` | `UserEvents` | `MEMBER` + `ADMIN` |
| `/dashboard/files` | `Files` | `MEMBER` + `ADMIN` |
| `/dashboard/files/:deptId` | `DeptFileBrowser` | `MEMBER` + `ADMIN` |
| `/dashboard/search` | `SearchPage` | `MEMBER` + `ADMIN` |
| `/notifications` | `NotificationsPage` | `MEMBER` + `ADMIN` |

### Tier 3 — Admin-Only Routes (`<AdminRoute>`)
**`src/routes/AdminRoute.tsx`:** Reads `user` from `authStore`. If `user.role !== 'ADMIN'`, redirects to `/dashboard`. This is a **client-side gate only** — all admin API endpoints also enforce role checking server-side via `adminMiddleware`.

| Path | Component | Purpose |
| :--- | :--- | :--- |
| `/admin` | `AdminHome` | Dashboard with live KPIs, file stats, recent activity |
| `/admin/upload` | `UploadReport` | Full uploader with metadata, tags, naming presets |
| `/admin/files` | `AdminFileManager` | Full file manager with delete, restore, orphan management |
| `/admin/approvals` | `ApprovalQueue` | Pending operator registration review queue |
| `/admin/users` | `UserManagement` | Full roster, role assignment, suspension controls |
| `/admin/departments` | `DepartmentManager` | Create/edit divisions with CMS page fields |
| `/admin/satellites` | `SatelliteManager` | ISTRAC station & satellite fleet registry |
| `/admin/events` | `EventManager` | Schedule passes, maneuvers, maintenance windows |
| `/admin/audit-logs` | `AuditLogViewer` | Cursor-paginated append-only activity logs |
| `/admin/broadcast` | `BroadcastNotification` | Push system-wide notification to all users |
| `/admin/cms` | `CmsEditor` | Live block editor for landing page content |
| `/admin/settings` | `SystemConfigPanel` | Global system config key-value management |

---

## 3. API Layer — Modular Service Clients (`src/api/`)

### `src/api/client.ts` — Axios Instance & Interceptor System

**Single Axios instance** `apiClient` is created with:
- `baseURL: import.meta.env.VITE_API_URL || '/api'` — Falls back to `/api` (proxied by Vite dev server to `localhost:3000`) or uses an absolute URL in production (CloudFront/EC2 endpoint).
- `withCredentials: true` — Critical: tells the browser to include the `httpOnly` `refreshToken` cookie on every request, including the token refresh call.

**Request Interceptor** — Before every request, reads `useAuthStore.getState().accessToken` and injects `Authorization: Bearer <token>` header. Uses `.getState()` (not React hook) because this runs outside React render.

**Response Interceptor — Stampede-Safe Token Refresh:**
- On any `401 Unauthorized`, marks `originalRequest._retry = true` to prevent infinite loops.
- Sets `isRefreshing = true` lock so simultaneous 401s from multiple concurrent requests (e.g., a dashboard loading 5 API calls at once) only trigger one `/auth/refresh` call.
- All subsequent 401s during refresh are queued in `refreshQueue[]` and resolved with the new token once refresh succeeds.
- On refresh failure: clears auth store, empties `refreshQueue`, and only hard-redirects to `/login` if currently on a protected route (`/dashboard` or `/admin`) — avoids disruptive redirects on public pages.

**`extractData<T>()` helper** — Backend API responses are wrapped as `{ data: T, requestId: "..." }`. This helper unwraps the envelope so callers receive `T` directly without chaining `.data.data`.

### API Service Modules

| Module | Endpoints Wrapped | Notes |
| :--- | :--- | :--- |
| `auth.api.ts` | `POST /auth/login`, `/register`, `/logout`, `/refresh`, `GET /auth/me`, `PUT /auth/change-password`, `POST /auth/forgot-password`, `/reset-password` | Full `UserProfile` & `LoginResponse` TypeScript interfaces |
| `departments.api.ts` | `GET /departments/public`, `/departments/public/:id`, `/departments`, `GET+POST+PUT+DELETE /admin/departments`, `/admin/departments/:id/users` | `archived` field derived from `!isActive` on all responses |
| `files.api.ts` | `POST /files/upload`, `/files/upload/chunk`, `/files/upload/complete`, `GET /files/:id/versions`, `DELETE /files/:id`, `PUT /files/:id/restore`, `POST /files/folders` | `getDownloadUrl()` returns absolute URL for `<a href>` download links |
| `browse.api.ts` | `GET /departments/:id/files`, `/departments/:id/tree`, `/search` | Used by file browser, folder tree, and search page |
| `satellites.api.ts` | `GET /satellites`, `GET+POST+PUT+DELETE /admin/satellites` | `Satellite` type shared by `departments.api.ts` |
| `users.api.ts` | `GET /admin/users`, `/admin/users/pending`, `POST /admin/users/:id/approve`, `/reject`, `/suspend`, `/reset-password`, `GET /user/mission-overview` | Full user management including bulk actions |
| `events.api.ts` | `GET /events`, `/events/active-banner`, `POST+PUT+DELETE /events` | `MissionEventItem` covers 6 event types and 3 urgency levels |
| `notifications.api.ts` | `GET /notifications`, `PUT /notifications/:id/read`, `/notifications/read-all`, `DELETE /notifications/:id` | Paginated inbox with unread count |
| `cms.api.ts` | `GET /cms/blocks`, `PUT /cms/blocks/:key` | Returns `Record<string, Record<string, unknown>>` keyed by block name |
| `admin.api.ts` | `GET /admin/stats`, `/admin/audit-logs`, `/admin/settings`, `PUT /admin/settings/:key`, `POST /admin/notifications/broadcast` | Admin-only stat cards and system config |
| `health.api.ts` | `GET /health` | Returns `{ status, db, redis, storage }` for system health probe |
| `reportPresets.api.ts` | Report category and naming convention presets | Used in the upload workflow |

---

## 4. State Management — Zustand Stores (`src/store/`)

All Zustand stores use the **direct subscribe pattern** — components call `useXxxStore((s) => s.field)` for selector-based re-renders. Avoid calling `useXxxStore()` without a selector.

### `authStore.ts` — Session Identity
```ts
{ user: User | null, accessToken: string | null }
```
- **`user`** is persisted to `sessionStorage` (via `zustand/middleware/persist`) so it survives page refreshes but NOT new browser tabs (sessionStorage is tab-scoped). This means each new tab requires a fresh `/auth/refresh` call.
- **`accessToken`** is NOT persisted — it lives in memory only. On page reload, `useInitAuth` posts to `/auth/refresh` using the `httpOnly` cookie to obtain a new access token.
- **Why `sessionStorage` not `localStorage`?** Ground station workstations are shared. `sessionStorage` automatically clears when the browser tab closes, preventing accidental session persistence after an operator walks away.
- **`partialize`** option only persists `user`, never `accessToken`, so the token never touches disk storage.

### `toastStore.ts` — Push Notification Toasts
```ts
{ visible: Toast[], queue: Toast[] }
```
- Max `5` toasts visible simultaneously. Overflow is queued and promoted automatically when a slot opens.
- Each `Toast` has: `id` (UUID), `message`, optional `title`, `variant` (`success|info|warning|error`), `duration` (ms), `remainingOnPause` (for hover-pause support), `isPaused`.
- **Hover-pause:** `pauseToast(id)` calculates `remainingOnPause = duration - (Date.now() - createdAt)` — this prevents toasts from dismissing while the operator is reading them.
- **Resume:** `resumeToast(id)` resets `createdAt = Date.now()` and sets `duration = remainingOnPause` so the countdown restarts from the remaining time.

### `uiStore.ts` — Layout Preferences
```ts
{ sidebarCollapsed: boolean, sidebarManuallySet: boolean, fileViewMode: string }
```
- Persisted to `localStorage` (key: `istrac-ui`). Survives tab closes.
- `sidebarManuallySet` tracks whether the user explicitly toggled the sidebar vs auto-collapsed by `useAutoCollapseSidebar` hook (which collapses the sidebar on small viewports).
- `fileViewMode` toggles between `'grid'` and `'list'` in the `FileBrowser` component.

### `notificationStore.ts` — Unread Badge Counter
```ts
{ unreadCount: number }
```
- In-memory only (no persistence). Populated on login via `GET /notifications` response.
- `incrementUnread()` is called by the WebSocket handler when a `NOTIFICATION` event arrives.
- `resetUnread()` is called when the user opens the notification panel.

### `searchHistoryStore.ts` — Recent Searches
```ts
{ history: string[] }
```
- Persisted to `localStorage` (key: `istrac-search-history`).
- Stores up to the last **20 unique search queries**. Duplicate queries are de-duplicated and moved to the front (most recent first).
- Displayed in the `SearchModal` as quick-access chips.

---

## 5. Server State — TanStack Query v5 & Custom Hooks (`src/hooks/`)

Every server-state hook wraps a `useQuery` call with a typed `queryKey` and `queryFn`.

### Complete Hook Inventory

| Hook | Query Key | Endpoint | Cache Strategy |
| :--- | :--- | :--- | :--- |
| `useUserDepartments()` | `['user-departments']` | `GET /departments` | 30s stale, refetch on invalidate |
| `useRecentFiles()` | `['recent-files']` | `GET /search` (empty query, limit 10) | 30s stale |
| `useMissionOverview()` | `['mission-overview']` | `GET /user/mission-overview` | 30s stale |
| `useDeptFiles(deptId, parentId?)` | `['dept-files', deptId, parentId]` | `GET /departments/:id/files` | Invalidated on upload complete |
| `useFolderTree(deptId)` | `['folder-tree', deptId]` | `GET /departments/:id/tree` | 30s stale |
| `useFileVersions(fileId)` | `['file-versions', fileId]` | `GET /files/:fileId/versions` | 30s stale |
| `useSearch(query, type, page)` | `['search', query, type, page]` | `GET /search` | 30s stale |
| `useNotifications(page)` | `['notifications', page]` | `GET /notifications` | Invalidated on WebSocket `NOTIFICATION` event |
| `useAdminStats()` | `['admin-stats']` | `GET /admin/stats` | Invalidated on file upload/delete |
| `useAuditLog(page, filters)` | `['audit-logs', page, filters]` | `GET /admin/audit-logs` | 30s stale |
| `useRecentAuditLog()` | `['audit-logs-recent']` | `GET /admin/audit-logs?limit=5` | 30s stale |
| `usePendingUsers(page)` | `['pending-users', page]` | `GET /admin/users/pending` | Invalidated on approve/reject |
| `useUsers(page, filters)` | `['users', page, filters]` | `GET /admin/users` | 30s stale |
| `useDepartments()` | `['departments']` | `GET /admin/departments` | Invalidated on create/update |
| `useSystemConfig()` | `['system-config']` | `GET /admin/settings` | 30s stale |
| `useUpdateCmsBlock()` | mutation only | `PUT /cms/blocks/:key` | Invalidates `['cms-blocks']` on success |
| `useCustomRoles()` | `['custom-roles']` | `GET /admin/roles` | 30s stale |
| `useBroadcast()` | mutation only | `POST /admin/notifications/broadcast` | No cache |
| `useLogFileAccess()` | mutation only | `POST /files/:id/log-access` | No cache |

**Cache Invalidation Strategy:** After any mutation (upload, approve, delete, update), the hook calls `queryClient.invalidateQueries({ queryKey: ['target-key'] })`. This marks the cached data stale and triggers background refetch — the UI stays responsive because it shows existing data while fresh data loads.

---

## 6. File Upload Engine — Chunked Streaming & SHA-256

### Decision Tree in `useFileUpload.ts`
```
File selected by user
  ↓
addFiles(FileList) creates UploadItem[] with uuid IDs, status: 'queued'
  ↓
uploadFile(item) called immediately for each item
  ↓
file.size > 10MB (CHUNK_THRESHOLD)?
  ├── YES → uploadChunked()
  │     ├── splitIntoChunks(file, 5MB) → Blob[]
  │     ├── sanitizeFilename(file.name) → strips path separators, control chars, '../' traversal
  │     ├── Sequential for-loop: POST /files/upload/chunk (one at a time, not parallel)
  │     │     → updates progress: Math.round(((i+1) / chunks.length) * 100)
  │     └── POST /files/upload/complete { fileName, departmentId, parentId, totalChunks }
  └── NO → uploadSingleShot()
        └── POST /files/upload with FormData, onUploadProgress callback
              → updates progress from Axios ProgressEvent
  ↓
On success: status = 'complete', invalidate ['dept-files'] and ['admin-stats'] queries
On error: status = 'error', error = res.data.error.message || 'Upload failed'
```

**Why sequential chunks, not parallel?** The backend assembles chunks in sequence using `chunkIndex`. Parallel transmission could cause out-of-order arrival if network latency varies across chunks, resulting in a corrupted file assembly. Sequential transmission guarantees correct ordering on the backend without needing complex reordering logic.

**`src/lib/fileUpload.ts` — SHA-256 & Chunk Splitter:**
- `computeSHA256(file)`: Uses the native Web Crypto API (`crypto.subtle.digest('SHA-256', buffer)`) — no external library required, runs in the browser's native crypto engine at near-native speed.
- `splitIntoChunks(file, 5MB)`: Uses `File.slice(offset, offset + chunkSize)` to create `Blob` references without reading the entire file into memory at once.

**`src/lib/sanitize.ts` — `sanitizeFilename()`:** Before any filename is sent to the backend, it strips ASCII control characters (`\x00–\x1f`), replaces path separators (`/`, `\`) with `_`, and removes directory traversal sequences (`..`). This provides a client-side defense-in-depth layer (backend enforces this too via `guardPath()`).

---

## 7. Real-Time WebSocket Client (`src/lib/ws.ts`)

The `WSClient` class is a **singleton** exported as `wsClient`. It is initialized once when the module loads and reused across all components.

### Connection Lifecycle
```
wsClient.connect()
  ↓
Gets accessToken from authStore.getState() (NOT React hook — runs outside React)
  ↓
Constructs URL: VITE_WS_URL?token=<encoded_access_token>
  ↓
  onopen:  reconnectAttempt = 0, startHeartbeat (ping every 30s)
  onclose: stopHeartbeat
    → code 4401? (auth rejected) → do NOT retry (prevents token spam)
    → any other code? → scheduleReconnect()
  onerror: force close → triggers onclose → retry logic
```

### Exponential Backoff Reconnect
```
Attempt 0: wait 1s
Attempt 1: wait 2s
Attempt 2: wait 4s
Attempt 3: wait 8s
Attempt 4: wait 16s
Attempt 5+: wait 60s (max)
```
This prevents flooding the backend during extended server downtime (e.g., EC2 restarts, maintenance).

### Event Routing
Messages arriving over the WebSocket are JSON-parsed and routed by `type` field:
```ts
this.handlers.get(eventType)?.forEach(h => h(eventType, payload))
this.handlers.get('*')?.forEach(h => h(eventType, payload))  // wildcard handlers
```
Components subscribe with:
```ts
const unsub = wsClient.subscribe('NOTIFICATION', (event, payload) => { ... })
// cleanup in useEffect return: unsub()
```

**Known WebSocket events dispatched by the backend:**
| Event | Scope | Trigger |
| :--- | :--- | :--- |
| `NOTIFICATION` | Target user or broadcast | New notification created |
| `CMS_UPDATE` | All connected clients | Admin edited a CMS block |
| `FILE_UPLOAD` | Users in that department | File uploaded or version added |
| `FILE_DELETED` | Users in that department | File soft-deleted |
| `SYNC_COMPLETE` | Admin users only | HDD storage reconciliation finished |
| `ping` | All | Server-side heartbeat every 30s |

---

## 8. CMS Context — Live Editable Landing Page (`src/context/cmsContext.tsx`)

`CmsProvider` wraps the entire app and fetches `/cms/blocks` once on mount. It also subscribes to the WebSocket `CMS_UPDATE` event so admin edits propagate instantly to all connected browser sessions without a page reload.

### `DEFAULT_CMS_BLOCKS` fallback
When the database has no CMS blocks configured (fresh install or seeding error), the entire landing page renders from the hardcoded `DEFAULT_CMS_BLOCKS` object in `cmsContext.tsx`. This includes:
- **`hero`**: 4 slide image URLs (IDSN dish, MOX control room, satellite constellation, Bengaluru gallery), title, subtitle, CTA text.
- **`announcements`**: 5 pre-built ISTRAC ticker items (Aditya-L1, IDSN calibration, Cartosat-3 pass, Port Blair relays, NETRA debris screening).
- Fallbacks for `about`, `contact`, `featured_reports`, `divisions` blocks.

**Why hardcoded fallbacks?** In ISRO's air-gapped environment, a fresh server install must display a complete, mission-authentic landing page immediately without requiring manual CMS configuration. Operators should see a working portal, not an empty shell.

### CMS Block Update Flow (Admin Edit → Live Propagation)
```
Admin opens CmsEditor page
  ↓
Edits a block (hero title, slide image URL, etc.)
  ↓
PUT /cms/blocks/:key via useUpdateCmsBlock() mutation
  ↓
Backend saves to DB and publishes 'cms.update' to Redis Pub/Sub
  ↓
Redis → wsServer.ts → sendToAll('CMS_UPDATE', { key, data })
  ↓
All browsers' wsClient receive 'CMS_UPDATE' event
  ↓
CmsProvider handler: await refetch() → re-fetches all blocks from API
  ↓
All CMS-consuming components re-render with new content immediately
```

---

## 9. Security & Sanitization Utilities (`src/lib/`)

### `sanitize.ts` — 5-Function XSS & Traversal Defense

| Function | Input | What it does | Why it matters |
| :--- | :--- | :--- | :--- |
| `sanitizeHtml(dirty)` | Raw HTML string from CMS or API | Runs `DOMPurify.sanitize()` with allowlist of safe tags (p, b, i, a, ul, ol, li, h1-h6, code, pre, table, etc.) | Prevents stored XSS from CMS blocks rendered as `innerHTML` |
| `sanitizeFilename(name)` | File name from File object | Strips control chars, replaces `/\` with `_`, collapses `..` sequences | Prevents path traversal in uploaded filenames |
| `isSafeUrl(url)` | Href string from CMS or user input | Rejects `javascript:`, `vbscript:`, `data:`, `file:` schemes | Prevents script injection via `<a href>` links |
| `safeHref(url, fallback)` | Href string | Returns safe URL or `'#'` fallback | Used in every CMS-sourced link rendering |
| `sanitizeSearchQuery(q)` | Raw search input | Trims to 200 chars, collapses multiple whitespace | Prevents oversized query payloads hitting the backend |

**Why DOMPurify?** It is the industry-standard browser-side HTML sanitizer used by Google and GitHub. Unlike a regex approach, it uses the browser's own DOM parser to understand HTML structure, making it immune to parser-differential attacks.

### `previewType.ts` — MIME Type Resolution
`resolvePreviewKind(mimeType)` maps a MIME type string to one of: `'pdf' | 'image' | 'video' | 'text' | 'office' | 'unsupported'`.

Used in `FilePreviewModal` and `DepartmentDetail` to decide what renderer to load:
- `pdf` → PDF.js viewer (bundled as `pdf.worker.min.mjs`)
- `image` → `<img>` tag with signed streaming URL
- `video` → `<video>` with `controls` attribute
- `text` → `<pre>` with `fetch()` of the stream endpoint
- `office` → download prompt (no in-browser rendering)
- `unsupported` → download-only prompt

### `formatFileSize.ts` — Byte Display
```ts
formatFileSize(1073741824) → "1.00 GB"
formatFileSize(5242880)    → "5.0 MB"
formatFileSize(2048)       → "2.0 KB"
formatFileSize(512)        → "512 B"
formatFileSize(null)       → "—"
```
Used in all file cards, table rows, and the `VersionHistoryPanel` to display human-readable sizes. `null` returns an em-dash for files where size is not yet calculated (e.g., directories).

### `exportCsv.ts` — Client-Side CSV Export
Used in `AuditLogViewer` and `UserManagement` to allow admins to download table data as CSV. Proper RFC 4180 CSV escaping: values containing commas or double-quotes are wrapped in double-quotes and internal double-quotes are doubled (`""`).

### `searchOperators.ts` — Structured Search Parsing
`parseSearchQuery("orbit type:pdf dept:mox")` returns:
```ts
{ freeText: "orbit", operators: [{key: "type", value: "pdf"}, {key: "dept", value: "mox"}] }
```
Enables `SearchPage` and `SearchModal` to support operator-based filtering (`type:`, `dept:`, `ext:`) alongside free-text search.

---

## 10. Page Inventory — Admin vs Member vs Public

### Public Pages
- **`Landing.tsx`** — Thin shell (`923 bytes`) that renders component sections: `AnnouncementBar`, `Hero`, `QuickStatsBanner`, `OperationalDivisions`, `FeaturedReports`, `MissionCalendar`, `AboutSection`, `ContactSection`. All content driven from `CmsProvider`.
- **`DepartmentsList.tsx`** — Public divisions hub showing all `isPageEnabled` divisions. Fetches `GET /departments/public`.
- **`DepartmentDetail.tsx`** (`50.9 KB`) — Most complex public page. Shows division CMS profile, officer-in-charge, file catalog with card/table view toggle, file preview modal. **Unauthenticated users** see file metadata but Preview/Download replaced with `[🔒 Sign In to Access File]` buttons that open the `GuestAccessPanel`.
- **`Login.tsx`** — Email/password form with rate-limit error handling and redirect logic (admin → `/admin`, member → `/dashboard`).
- **`Register.tsx`** (`14.6 KB`) — Multi-step access request: personal info → employee ID → department preference → reason for access → confirmation. Includes `PasswordStrengthMeter`.
- **`ForgetPassword.tsx`** — Email form sending `POST /auth/forgot-password`.

### Member Pages (Protected)
- **`UserHome.tsx`** (`47 KB`) — Mission workspace: KPI stat cards (files, divisions, recent activity), assigned division accordion with file counts, recent telemetry catalog. Fetches from `useMissionOverview()`, `useUserDepartments()`, `useRecentFiles()`.
- **`UserEvents.tsx`** (`18.9 KB`) — 3-view switcher: Overview cards, Dual-Month `MissionCalendar`, and tabular pass list. Fetches `GET /events`. Each event card shows satellite, type, urgency, AOS/LOS timing, and tracking location.
- **`NotificationsPage.tsx`** (`7.3 KB`) — Categorized notification inbox with filter tabs: All / Unread / Passes / System / Broadcasts. Mark as read, dismiss, clear all.
- **`Files.tsx`** — Entry point for file browsing. Renders department selector → `FileBrowser`.
- **`DeptFileBrowser.tsx`** — Thin wrapper: extracts `:deptId` from URL, renders `FileBrowser` with it.
- **`SearchPage.tsx`** — Full-page search with operator syntax, type filter, pagination.

### Admin Pages
- **`AdminHome.tsx`** (`28.9 KB`) — Command console: storage health, live user/file/department counts, recent audit log feed, pending approvals count, quick action links.
- **`UploadReport.tsx`** (`36.3 KB`) — Full-featured uploader: drag-and-drop, file metadata form (report title, spacecraft, category, tags), naming convention presets, department + parent folder selector, SHA-256 verification display, progress bars.
- **`AdminFileManager.tsx`** (`32.8 KB`) — Full file CRUD: search, filter by department/status, delete, restore, view orphaned files, version history drawer.
- **`ApprovalQueue.tsx`** (`56.2 KB`) — Largest admin page. Pending user cards showing designation, department preference, reason for access. One-click approve (with department selector) or reject (with `RejectModal`).
- **`UserManagement.tsx`** (`39 KB`) — Full roster: search, filter by role/status, inline role change, suspension toggle, password reset, department access management via `PermissionGrid`.
- **`DepartmentManager.tsx`** — Create/edit divisions: all fields including CMS page fields (`pageTitle`, `pageLeadOfficer`, etc.), storage path, folder depth config.
- **`SatelliteManager.tsx`** — Station registry: create/edit ISTRAC stations and satellite fleet entries.
- **`EventManager.tsx`** (`22.5 KB`) — Full event CRUD for the mission calendar: type (MISSION_PASS/LAUNCH/ORBIT_MANEUVER/MAINTENANCE/SEMINAR/ANOMALY), urgency, status, banner visibility toggle.
- **`AuditLogViewer.tsx`** (`22.5 KB`) — Cursor-paginated audit trail with JSON diff viewer (`AuditDiffView`), filter by action/resource type, CSV export.
- **`BroadcastNotification.tsx`** (`19.2 KB`) — Compose and send system-wide notification to all users via Redis Pub/Sub → WebSocket broadcast.
- **`CmsEditor.tsx`** — Block editor: select CMS key (hero, announcements, about, etc.), edit JSON fields, live preview panel (`LivePreviewPanel`), save.
- **`SystemConfigPanel.tsx`** (`37.1 KB`) — Largest single-file page. Key-value config for system-wide settings (`max_upload_mb`, `maintenance_mode`, etc.) with type-specific renderers for boolean, number, and string.

---

## 11. Component Inventory — Full Catalogue

### Navigation & Layout
- **`Navbar.tsx`** (`10.2 KB`) — Sticky header with ISRO logo, divisions dropdown, global search trigger (`Ctrl+K` opens `SearchModal`), notification bell with unread count badge, user avatar dropdown (profile, logout). Role-aware: shows "Admin Console" link only for `ADMIN`.
- **`AppShell`** (layout) — Collapsible sidebar + top nav + content area. `useAutoCollapseSidebar` hook automatically collapses on small viewports unless `sidebarManuallySet` is true.
- **`Footer.tsx`** — ISRO mandate, copyright, ground station network links, colophon.
- **`PageHeader.tsx`** — Reusable page title + subtitle + optional action button slot.

### Landing Page Sections
- **`AnnouncementBar.tsx`** (`8.3 KB`) — Horizontal scrolling ticker of mission alerts. Reads from `cmsBlocks.announcements.items`. Category color-coded: MISSION (blue), MAINTENANCE (amber), PASS (green), RELAY (purple), SECURITY (red).
- **`Hero.tsx`** (`22.6 KB`) — Multi-slide carousel (manual + auto-advance). Reads `cmsBlocks.hero.slides[]`. Admin inline edit pencil icon triggers CMS update directly from the landing page.
- **`QuickStatsBanner.tsx`** (`3.2 KB`) — 4 stat highlights: "5 Ground Stations", "10+ Spacecraft", "24/7 MOX Ops", "SHA-256 Checksums". Static component, no API call.
- **`OperationalDivisions.tsx`** (`7.1 KB`) — 5-column card grid for MOX, FDD, NETRA, TTC, GSO. Each card: division name, lead officer, dataset count, brief mission description.
- **`FeaturedReports.tsx`** (`17.1 KB`) — Report cards from `cmsBlocks.featured_reports`. Shows category badge, spacecraft, file format icon. Unauthenticated users see `GuestAccessPanel` modal on click.
- **`MissionCalendar.tsx`** (`18.1 KB`) — Dual-month interactive calendar. Fetches `GET /events`. Day cells show colored dots per event urgency. Click day → details panel. Pass details: satellite name, AOS/LOS, frequency, ground station.
- **`AboutSection.tsx`** — Ground station network readout, security assurances, ISRO mandate paragraph.
- **`ContactSection.tsx`** — HQ address, SMTP desk, 24/7 EPABX mission hotline.

### File Management
- **`FileBrowser.tsx`** (`20 KB`) — Fully featured file browser: card/table view toggle (persisted in `uiStore`), breadcrumb navigation, folder tree sidebar (`FolderTree`), drag-and-drop upload trigger (admin only), search/filter bar, pagination, context menu (rename, move, delete, view versions). Invalidates TanStack Query on all mutations.
- **`FolderTree.tsx`** (`3.4 KB`) — Recursive sidebar tree view of folder hierarchy. Fetches `GET /departments/:id/tree`.
- **`UploadModal.tsx`** (`7 KB`) — Drag-and-drop upload modal, renders `useFileUpload` items with progress bars and status indicators.
- **`VersionHistoryPanel.tsx`** (`6.1 KB`) — Right-side drawer showing file version chain. Each version: version number, size, SHA-256 hash (truncated), uploader name, timestamp, download link.
- **`FilePreviewModal.tsx`** (`3.7 KB`) — Routes to correct renderer based on `resolvePreviewKind()`. Uses PDF.js for PDFs, native `<img>`/`<video>` for media, `<pre>` for text.
- **`FileIcon.tsx`** — Returns appropriate Lucide icon + color based on file extension.
- **`GuestAccessPanel.tsx`** (`8.3 KB`) — Auth-gate modal shown to unauthenticated users attempting to preview/download. Shows "🔒 Authentication Required" header, explains access policy, links to `/login` and `/register`.

### Admin Modals & Forms
- **`CreateDeptModal.tsx`** (`7.1 KB`) — Full department creation form with satellite selector, code, storage path, CMS fields.
- **`UserProfileModal.tsx`** (`15 KB`) — Full user profile viewer/editor for admins: shows all fields, department access list, suspension status, last login.
- **`SetupWizardModal.tsx`** (`30.3 KB`) — Largest component. First-run setup wizard covering: satellite creation, department creation, storage mount verification, admin account setup. Shown when `system_setup_complete` config key is false.
- **`RejectModal.tsx`** — Rejection reason text input for declining operator registrations.
- **`TagModal.tsx`** — Tag editor for file metadata.
- **`ConfirmDialog.tsx`** — Generic "Are you sure?" confirmation dialog used before destructive operations.

### Form Controls & UI Primitives
- **`Button.tsx`** — Variants: `primary`, `secondary`, `ghost`, `danger`. Sizes: `sm`, `md`, `lg`. Loading spinner state.
- **`Input.tsx`** — Labeled input with error state, optional prefix/suffix icons.
- **`Select.tsx`** — Styled native `<select>` with option groups.
- **`Textarea.tsx`** — Auto-grow textarea with char count.
- **`Badge.tsx`** — Status/category badge: `success`, `warning`, `danger`, `info`, `default`.
- **`Alert.tsx`** — Inline alert banner with close button.
- **`Modal.tsx`** — Base modal wrapper with `<dialog>` semantics and overlay click-to-close.
- **`Table.tsx`** — Sortable table with sticky headers, zebra rows, bulk select checkboxes.
- **`StatCard.tsx`** — KPI card: number, label, optional trend indicator.
- **`Toast.tsx`** / **`ToastContainer.tsx`** — Renders `useToastStore().visible` as stacked toast notifications.
- **`SearchModal.tsx`** (`8.8 KB`) — Global `Ctrl+K` search overlay. Shows search history chips, live search results as user types, operator syntax hints.
- **`PasswordStrengthMeter.tsx`** — Visual strength bar and criteria checklist (length, uppercase, number, special char).
- **`AuditDiffView.tsx`** — Side-by-side JSON diff renderer for audit log old/new value comparison.
- **`Space3DVisualizer.tsx`** (`15.4 KB`) — 3D orbital visualization using canvas rendering. Shown on `AdminHome` as an ambient background element.
- **`DynamicAlertBanner.tsx`** — Full-width system alert banner that reads from `SystemConfig` `maintenance_mode` key.

---

## 12. Design System Tokens & CSS Architecture

All design tokens are declared as CSS custom properties in `src/index.css` via Tailwind v4's `@theme` block, making them available as Tailwind utility classes.

### Background Plane Tokens
| CSS Variable | Hex | Tailwind Class | Use Case |
| :--- | :--- | :--- | :--- |
| `--color-page` | `#04070e` | `bg-page` | Master page canvas |
| `--color-page-soft` | `#080d17` | `bg-page-soft` | Alternating section backgrounds |
| `--color-surface` | `#0c121e` | `bg-surface` | Sidebar, top nav, sub-panels |
| `--color-card` | `#101726` | `bg-card` | Cards, modals, table containers |
| `--color-card-hover` | `#172033` | `bg-card-hover` | Card/row hover state |

### Border Tokens
| CSS Variable | Hex | Use Case |
| :--- | :--- | :--- |
| `--color-border-subtle` | `#192336` | Table row hairlines |
| `--color-border-default` | `#223049` | Cards, inputs |
| `--color-border-bright` | `#364b6e` | Focused/highlighted containers |

### Text Tokens
| CSS Variable | Hex | Tailwind Class | Use Case |
| :--- | :--- | :--- | :--- |
| `--color-text-primary` | `#f1f5f9` | `text-text-primary` | Headings, primary labels |
| `--color-text-secondary` | `#94a3b8` | `text-text-secondary` | Body text, descriptions |
| `--color-text-muted` | `#64748b` | `text-text-muted` | Meta info, column headers |
| `--color-text-dim` | `#475569` | `text-text-dim` | Timestamps, disabled text |

### Accent / Status Tokens
| Token | Hex | Usage |
| :--- | :--- | :--- |
| `--color-accent` (ISRO Blue) | `#1d72fe` | Primary buttons, active states, links |
| `--color-accent-light` (ISRO Cyan) | `#00f0ff` | Glow effects, telemetry readout highlights |
| `--color-success` | `#10b981` | AOS, active, nominal, approved status |
| `--color-warning` | `#f59e0b` | Pending, standby, acquisition delay |
| `--color-danger` | `#ef4444` | LOS, suspended, error, delete |
| `--color-purple` | `#a855f7` | Super admin badges, special ops |

### Typography Rules
- **Machine data** (SHA-256 hashes, file sizes, timestamps, station codes, employee IDs): `font-mono` class (`num` alias in custom utilities). Uses tabular numeral spacing.
- **Human editorial** (headings, labels, descriptions): `font-sans` (Inter → Plus Jakarta Sans → system stack).
- **HUD readouts** on Hero and AdminHome: Monospace, tracking `[0.14em]`, uppercase, `text-[11px]`.

### Custom Utility Classes (defined in `index.css`)
- `.graticule` — Subtle crosshatch background pattern for full-screen loading states.
- `.num` — Shorthand for `font-mono tabular-nums`.
- `.animate-pulse-slow` — 3s pulse animation for loading indicators.
- `.hairline` — 1px `border-b border-border-subtle` horizontal divider.
