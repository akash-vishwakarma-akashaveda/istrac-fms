# 🛰️ ISTRAC-SIMS — Frontend Architecture & Developer Reference

> **Document Identifier:** ISTRAC-SIMS-FED-V2.0  
> **Classification:** ISRO / ISTRAC Restricted Technical Documentation  
> **Application:** Satellite Information Management System (Frontend Client)  
> **Version:** 1.1.0 Production Baseline  
> **Runtime Environment:** React 19.2.7 · Vite 8.1.5 · TypeScript 5 · Tailwind CSS v4 · ESM  
> **Target Deployment:** Air-Gapped Intranet Server (Apache 2.4 Reverse Proxy)  

---

## 📑 Table of Contents

1. [Executive Summary & Technology Stack](#1-executive-summary--technology-stack)
2. [Complete Source Code Directory Map](#2-complete-source-code-directory-map)
3. [Application Entry Point & Provider Hierarchy](#3-application-entry-point--provider-hierarchy)
4. [Routing Architecture & 3-Tier Guard System](#4-routing-architecture--3-tier-guard-system)
5. [Page Inventory — All 29 Operational Views](#5-page-inventory--all-29-operational-views)
6. [API Layer & Network Architecture (`src/api/`)](#6-api-layer--network-architecture-srcapi)
7. [State Management Architecture (Zustand Stores)](#7-state-management-architecture-zustand-stores)
8. [Server State & Caching Patterns (TanStack Query v5)](#8-server-state--caching-patterns-tanstack-query-v5)
9. [Real-Time WebSocket Engine (`src/lib/ws.ts`)](#9-real-time-websocket-engine-srclibwsts)
10. [Chunked Streaming File Upload & SHA-256 Hashing](#10-chunked-streaming-file-upload--sha-256-hashing)
11. [Design System Tokens & Tailwind CSS v4 Architecture](#11-design-system-tokens--tailwind-css-v4-architecture)
12. [CORS, Intranet Deployment & Relative BaseURL](#12-cors-intranet-deployment--relative-baseurl)
13. [Step-by-Step Developer Guides (How to Update Code)](#13-step-by-step-developer-guides-how-to-update-code)
14. [Environment Configuration Reference](#14-environment-configuration-reference)
15. [Build, Verification & Deployment Runbook](#15-build-verification--deployment-runbook)

---

## 1. Executive Summary & Technology Stack

The **ISTRAC-SIMS Frontend** is an ultra-fast, air-gapped single-page application (SPA) designed to interface with ISRO ground stations, orbital telemetry tracking systems, and document repositories.

### Technology Stack & Architecture Rationale

| Layer | Technology | Version | Engineering Rationale |
|:---|:---|:---|:---|
| **Core Framework** | React | `19.2.7` | Provides concurrent rendering, transition hooks, automatic batching, and strict immutability. |
| **Build Engine** | Vite | `8.1.5` | Instant HMR development server, Rollup/Rolldown production bundler generating optimized vendor chunks (<1s build time). |
| **Language** | TypeScript | `5.x` | Strict type safety across all telemetry models, file structures, and authentication payloads. |
| **Styling** | Tailwind CSS | `4.3.3` | Zero-runtime CSS engine with `@tailwindcss/vite`, orbital color palette, and hardware-accelerated transitions. |
| **Routing** | React Router | `7.18.2` | Declarative client-side routing with nested layout outlets, 3-tier auth guards, and HTML5 PushState history. |
| **Client State** | Zustand | `5.0.14` | Minimalist, unopinionated micro-store with zero boilerplate, `localStorage` persistence, and selector subscriptions. |
| **Server State** | TanStack Query | `5.101.4` | Declarative asynchronous cache with deduplication, background revalidation, and mutation invalidation. |
| **HTTP Client** | Axios | `1.19.0` | Mutex-protected silent token refresh queue, request interceptors, and HTML fallback error guards. |
| **WebSockets** | Native WebSocket | RFC 6455 | High-efficiency event bus with exponential backoff reconnection and Redis Pub/Sub synchronization. |
| **Icons** | Lucide React | `1.31.0` | Tree-shakable SVG mission control iconography. |
| **Document Viewer** | PDF.js | `6.2.108` | In-browser zero-dependency PDF rendering for mission pass reports. |
| **Sanitizer** | DOMPurify | `3.4.14` | Complete XSS defense for CMS news feeds and operator announcements. |

---

## 2. Complete Source Code Directory Map

```
frontend/
├── dist/                              # Compiled static production bundle (served by Apache)
│   ├── assets/                        # Minified JS, CSS, and SVG chunks
│   └── index.html                     # SPA entrypoint template
├── public/                            # Static public assets (favicons, mission badges)
├── src/
│   ├── api/                           # Domain REST API service modules
│   │   ├── admin.api.ts               # User approval, audit log queries, system metrics
│   │   ├── auth.api.ts                # Login, logout, refresh, OTP verification
│   │   ├── client.ts                  # Central Axios client with relative URL & token interceptor
│   │   ├── cms.api.ts                 # Bulletin board & CMS article management
│   │   ├── department.api.ts          # Operational division metadata & member assignments
│   │   ├── files.api.ts               # Chunked upload, download blob streams, ACL permissions
│   │   ├── notifications.api.ts       # Broadcast and personal operator notifications
│   │   └── satellite.api.ts           # Spacecraft telemetry, pass schedules, orbital params
│   ├── components/                    # Reusable React components
│   │   ├── cms-editor/                # Live visual editor for ground station bulletins
│   │   │   ├── CmsEditorModal.tsx     # Rich-text modal dialog
│   │   │   └── CmsImageInput.tsx      # Media upload and relative image resolver
│   │   ├── ui/                        # Atomic design system components (Button, Modal, Input, Badge)
│   │   ├── FileBrowser.tsx            # Master hierarchical file & telemetry log explorer
│   │   ├── MissionClock.tsx           # Dual UTC and IST synchronized ground station clocks
│   │   ├── SpaceParallaxBackground.tsx# GPU-accelerated interactive starfield canvas
│   │   └── TelemetryDashboard.tsx     # Live spacecraft telemetry visualization gauges
│   ├── context/                       # React Context providers
│   │   └── cmsContext.tsx             # Ground station announcements & dynamic banner state
│   ├── hooks/                         # Custom React hooks
│   │   ├── useAuth.ts                 # Role validation & authentication state shortcuts
│   │   ├── useDebounce.ts             # Input throttling for telemetry search
│   │   └── useWebSocket.ts            # Hook for subscribing to live mission event topics
│   ├── layouts/                       # Shell layouts
│   │   ├── AppShell.tsx               # Authenticated operational shell (Sidebar, Nav, Clock)
│   │   ├── AuthLayout.tsx             # Centered login & password recovery shell
│   │   └── PublicLayout.tsx           # Public landing layout with top navigation
│   ├── lib/                           # Foundational libraries
│   │   ├── constants.ts               # Mission IDs, supported file types, status enums
│   │   ├── queryClient.ts             # TanStack Query cache configuration
│   │   ├── utils.ts                   # Class merging (clsx + twMerge), file size formatters
│   │   └── ws.ts                      # WebSocket client with heartbeat & auto-reconnect
│   ├── pages/                         # All 29 page view components (detailed in Section 5)
│   ├── routes/                        # Route guard components
│   │   ├── AdminRoute.tsx             # Enforces Role === 'ADMIN'
│   │   ├── ForcePasswordGuard.tsx     # Redirects temporary passwords to rotation view
│   │   └── ProtectedRoute.tsx         # Pure binary authentication gate
│   ├── store/                         # Zustand micro-stores
│   │   ├── authStore.ts               # Access token, user profile, role, session persistence
│   │   └── themeStore.ts              # Space / High-Contrast Ground Station theme
│   ├── types/                         # TypeScript domain contracts
│   │   ├── auth.types.ts              # User, Role, Session payloads
│   │   ├── file.types.ts              # File metadata, chunking parameters, ACL models
│   │   └── satellite.types.ts         # Spacecraft telemetry, pass metrics
│   ├── App.tsx                        # Master Router configuration & protected routes
│   ├── index.css                      # Tailwind CSS v4 theme directives & orbital animations
│   └── main.tsx                       # React DOM entrypoint & QueryClientProvider
├── package.json                       # Dependencies, build scripts
├── tsconfig.json                      # Strict TypeScript compiler options
└── vite.config.ts                     # Vite build configuration, chunk splitting
```

---

## 3. Application Entry Point & Provider Hierarchy

### 3.1. `src/main.tsx` — Root Render Tree
```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </StrictMode>
)
```

- **`StrictMode`:** Enabled to catch accidental side effects in WebSocket connections, animation timers, and chunked upload workers during development.
- **`QueryClientProvider` at Root:** Wrapped above `App` so every route, layout, and hook has instant access to cached server state without manual prop passing.
- **`queryClient.ts` Configuration:**
  ```typescript
  export const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,          // Telemetry and file lists remain fresh for 30 seconds
        retry: 1,                   // Exactly one automatic retry on transient intranet glitches
        refetchOnWindowFocus: false, // Prevents request storms when switching console monitors
      },
    },
  })
  ```

### 3.2. `src/App.tsx` — Session Bootstrap & Global Providers
On mount, `App.tsx` executes `useInitAuth()`. If the user has an existing session, it issues a silent background `POST /api/auth/refresh`. While checking, it renders a mission pulse loader, preventing screen flashes and unauthorized route transitions.

---

## 4. Routing Architecture & 3-Tier Guard System

The application enforces a **3-Tier Guard System** using nested React Router `<Outlet>` boundaries:

```
Public Request
      │
      ├───────────────────────► Tier 1: Public Routes (Landing, Login, Register, Forgot Password)
      │
      ▼
┌───────────────────────────┐
│ ProtectedRoute            │ ──► Tier 2: Authenticated Gate (Requires valid user session)
└─────────────┬─────────────┘
              │
              ├───► ForcePasswordGuard (Forces rotation if user.tempPass === true)
              │
              ▼
┌───────────────────────────┐
│ AdminRoute                │ ──► Tier 3: Super Admin Gate (Strictly Role === 'ADMIN')
└───────────────────────────┘
```

---

## 5. Page Inventory — All 29 Operational Views

| # | Route Path | Component Name | Access Tier | Operational Purpose |
|:---|:---|:---|:---|:---|
| 1 | `/` | `Landing.tsx` | Public | CMS-driven ground station landing portal, mission feed, division links. |
| 2 | `/login` | `Login.tsx` | Public | Operator and Administrator authentication portal. |
| 3 | `/register` | `Register.tsx` | Public | Operator self-registration form for internal access clearance. |
| 4 | `/forgot-password` | `ForgetPassword.tsx` | Public | Air-gapped password reset verification portal via 6-digit OTP. |
| 5 | `/departments` | `DepartmentsList.tsx` | Public | Directory of all ISTRAC operational ground divisions. |
| 6 | `/departments/:deptId` | `DepartmentDetail.tsx` | Public / Member | Division profile, telemetry specs, and gated document repository. |
| 7 | `/demo` | `ComponentDemo.tsx` | Public | Visual component library showcase for mission control UI widgets. |
| 8 | `/force-password-change` | `ForcePasswordChange.tsx` | Authenticated | Mandatory password rotation screen for accounts with temporary credentials. |
| 9 | `/dashboard` | `UserHome.tsx` | Authenticated | Master operator console: quick telemetry, assigned division shortcuts, recent files. |
| 10 | `/dashboard/files` | `Files.tsx` | Authenticated | Universal file catalog with multi-filter search and category grouping. |
| 11 | `/dashboard/files/:deptId`| `DeptFileBrowser.tsx` | Authenticated | Department-scoped folder tree with upload capabilities. |
| 12 | `/dashboard/events` | `UserEvents.tsx` | Authenticated | Satellite pass schedules, acquisition-of-signal (AOS) events calendar. |
| 13 | `/dashboard/search` | `SearchPage.tsx` | Authenticated | Global full-text search across files, satellites, bulletins, and telemetry logs. |
| 14 | `/dashboard/notifications`| `NotificationsPage.tsx`| Authenticated | Operational alerts, storage warnings, and station pass notices. |
| 15 | `/dashboard/upload-report`| `UploadReport.tsx` | Authenticated | Telemetry pass report ingestion with metadata tagging. |
| 16 | `/dashboard/department-hub`| `DepartmentHub.tsx` | Authenticated | Multi-department operational dashboard. |
| 17 | `/admin` | `AdminHome.tsx` | Super Admin | Executive overview: active users, storage disk metrics, system daemons. |
| 18 | `/admin/users` | `UserManagement.tsx` | Super Admin | Account provisioning, role assignments, password resets, account locking. |
| 19 | `/admin/approvals` | `ApprovalQueue.tsx` | Super Admin | Review, approve, or reject new operator registration requests. |
| 20 | `/admin/departments` | `DepartmentManager.tsx`| Super Admin | Create and configure operational ground divisions and storage quotas. |
| 21 | `/admin/satellites` | `SatelliteManager.tsx` | Super Admin | Fleet management: orbital parameters, tracking frequencies, mission status. |
| 22 | `/admin/events` | `EventManager.tsx` | Super Admin | Scheduling tracking passes, maintenance windows, and orbit maneuvers. |
| 23 | `/admin/files` | `AdminFileManager.tsx` | Super Admin | Master file system management across all divisions; quota controls. |
| 24 | `/admin/audit-logs` | `AuditLogViewer.tsx` | Super Admin | Immutable audit trail: logins, downloads, deletions, admin actions. |
| 25 | `/admin/cms` | `CmsEditor.tsx` | Super Admin | Live WYSIWYG editor for landing page notices, announcements, and banners. |
| 26 | `/admin/password-resets`| `AdminOtpManagement.tsx`| Super Admin | Offline OTP inspection and manual email dispatch console. |
| 27 | `/admin/broadcast` | `BroadcastNotification.tsx`| Super Admin | Send urgent operational broadcasts to all connected station operators. |
| 28 | `/admin/system-config`| `SystemConfigPanel.tsx`| Super Admin | Hardware drive paths, telemetry intervals, and security parameters. |
| 29 | `/admin/roles` | `RoleManager.tsx` | Super Admin | Role-based permission assignments across operational divisions. |

---

## 6. API Layer & Network Architecture (`src/api/`)

### 6.1. Relative BaseURL Architecture (`src/api/client.ts`)
The application is engineered specifically for intranet deployments behind reverse proxies:

```typescript
// src/api/client.ts
const apiUrl = import.meta.env.VITE_API_URL || "/api"

export const apiClient = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  timeout: 30_000,
  headers: {
    "Content-Type": "application/json",
  },
})
```

- **Why relative `/api`?** By defaulting to `/api`, the frontend automatically sends requests to the current host and port (e.g. `http://10.0.2.15/api` or `http://localhost:8080/api`). It requires **zero rebuilds** when moving between testing and production IP addresses.

### 6.2. Mutex-Protected Token Refresh Interceptor
When an access token expires, multiple simultaneous UI queries will return `401 Unauthorized`. To prevent slamming the server with dozens of parallel refresh requests, `client.ts` implements a mutex queue:

```typescript
let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      if (isRefreshing) {
        // Queue pending requests until the single refresh call completes
        return new Promise((resolve) => {
          refreshQueue.push((token: string) => {
            originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${token}` }
            resolve(apiClient(originalRequest))
          })
        })
      }

      isRefreshing = true
      try {
        const refreshUrl = `${(apiUrl || "/api").replace(/\/+$/, "")}/auth/refresh`
        const { data } = await axios.post(refreshUrl, {}, { withCredentials: true })
        const newToken = data?.data?.accessToken

        useAuthStore.getState().setAccessToken(newToken)
        refreshQueue.forEach((callback) => callback(newToken))
        refreshQueue = []

        originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${newToken}` }
        return apiClient(originalRequest)
      } catch (refreshErr) {
        refreshQueue = []
        useAuthStore.getState().logout()
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)
```

---

## 7. State Management Architecture (Zustand Stores)

### 7.1. `src/store/authStore.ts`
Manages user authentication, profile details, and role clearance:
- **State:** `user: User | null`, `accessToken: string | null`, `isAuthenticated: boolean`.
- **Persistence:** User metadata is serialized to `localStorage` under `istrac_auth`, allowing sessions to persist across browser refreshes while sensitive JWTs remain in memory.
- **Actions:**
  - `setAuth(user, token)`: Stores active credentials and initializes session timers.
  - `setAccessToken(token)`: Updates token following silent refresh without re-rendering the entire app.
  - `logout()`: Clears storage, resets stores, and directs the user to `/login`.

---

## 8. Server State & Caching Patterns (TanStack Query v5)

TanStack Query is used exclusively for server-synced data.

### Example Query Pattern (Fetching Telemetry Satellites):
```tsx
export function useSatellites() {
  return useQuery({
    queryKey: ['satellites'],
    queryFn: async () => {
      const response = await apiClient.get('/satellites')
      return response.data.data
    },
    staleTime: 60_000, // Satellites fleet configuration rarely changes mid-shift
  })
}
```

### Example Mutation Pattern (Creating a Ground Pass Event):
```tsx
export function useCreateEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (newEventPayload) => apiClient.post('/events', newEventPayload),
    onSuccess: () => {
      // Invalidate events cache to trigger automatic real-time UI refresh
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}
```

---

## 9. Real-Time WebSocket Engine (`src/lib/ws.ts`)

The WebSocket client maintains an active connection for real-time mission telemetry:

```
Browser WebSocket Client
       │
       ▼ (Auto-discovery: window.location.protocol -> ws:// or wss://)
Apache Reverse Proxy (Port 80/443: /ws)
       │
       ▼ (mod_proxy_wstunnel)
Node.js Express Backend (127.0.0.1:3000/ws)
       │
       ▼
Redis Pub/Sub Event Channels ('cms.update', 'notification.broadcast', etc.)
```

### Automatic Protocol & Host Resolution:
```typescript
function getBaseWsUrl(): string {
  let envUrl = import.meta.env.VITE_WS_URL || ""
  if (!envUrl && typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
    envUrl = `${proto}//${window.location.host}/ws`
  }
  return envUrl
}
```

### Heartbeat & Reconnection:
- **Ping / Pong:** Transmits a ping every 30 seconds to prevent stateful intranet firewalls and NAT gateways from killing idle TCP sockets.
- **Exponential Backoff:** If disconnected, attempts reconnection at 1s, 2s, 4s, 8s, and 16s intervals.

---

## 10. Chunked Streaming File Upload & SHA-256 Hashing

To upload multi-gigabyte satellite telemetry passes without overwhelming server RAM or failing on network blips:

1. **File Slicing:** The browser slices files into discrete `5MB` binary chunks using the HTML5 `Blob.slice()` API.
2. **Incremental SHA-256:** As chunks are read via `FileReader`, the client computes an ongoing SHA-256 hash using Web Crypto API.
3. **Chunk Uploading:** Chunks are transmitted sequentially to `POST /api/files/upload/chunk` with headers:
   - `x-upload-id`: UUID of the file session
   - `x-chunk-index`: Zero-based chunk sequence number
   - `x-total-chunks`: Total expected chunks
4. **Final Assembly & Verification:** Upon the final chunk, the backend reassembles the file, verifies the computed SHA-256 against the client's payload, and commits the record to MariaDB.

---

## 11. Design System Tokens & Tailwind CSS v4 Architecture

Styling uses Tailwind CSS v4 configured with dark-mode space station ergonomics:

### Core Mission Control Color Palette:
- **Background Deep Space:** `#030712` (`bg-gray-950`)
- **Panel / Surface Gray:** `#0b1329` (`bg-slate-900`)
- **ISRO Telemetry Cyan:** `#06b6d4` (`text-cyan-500` / `border-cyan-500`)
- **Orbital Orbit Gold:** `#f59e0b` (`text-amber-500`)
- **Alert Coral:** `#ef4444` (`text-red-500`)
- **Nominal Operational Green:** `#10b981` (`text-emerald-500`)

---

## 12. CORS, Intranet Deployment & Relative BaseURL

In production intranet hosting:
1. Apache serves the static files from `/opt/istrac-fms/frontend/dist` on port `80`.
2. Browser makes API requests to `/api/*`.
3. Because the request originates from the same hostname and port as the web page, the browser considers it **same-origin**.
4. Even when accessed via different IP addresses (`10.0.2.15` vs `localhost:8080`), requests pass transparently through Apache to the backend without CORS rejections.

---

## 13. Step-by-Step Developer Guides (How to Update Code)

### 13.1. How to Add a New Page View

1. Create the component file in `src/pages/MissionTelemetry.tsx`:
   ```tsx
   import React from 'react'

   export default function MissionTelemetry() {
     return (
       <div className="p-6">
         <h1 className="text-2xl font-bold text-cyan-400">Mission Telemetry Monitor</h1>
       </div>
     )
   }
   ```
2. Register the route in `src/App.tsx`:
   ```tsx
   import MissionTelemetry from './pages/MissionTelemetry'

   // Inside <Routes> -> authenticated <AppShell> outlet:
   <Route
     path="/dashboard/telemetry-monitor"
     element={
       <ProtectedRoute allowedRoles={['ADMIN', 'MEMBER']}>
         <MissionTelemetry />
       </ProtectedRoute>
     }
   />
   ```
3. Add a navigation link to `src/layouts/AppShell.tsx` with a Lucide icon.

---

### 13.2. How to Add a New API Call

1. Add your endpoint function in the relevant file under `src/api/` (e.g. `src/api/satellite.api.ts`):
   ```typescript
   export const getTelemetryFeeds = async (satelliteId: string) => {
     const response = await apiClient.get(`/satellites/${satelliteId}/feeds`)
     return response.data.data
   }
   ```
2. Consume it inside your component using `useQuery`:
   ```tsx
   const { data: feeds, isLoading } = useQuery({
     queryKey: ['telemetry-feeds', satelliteId],
     queryFn: () => getTelemetryFeeds(satelliteId),
   })
   ```

---

## 14. Environment Configuration Reference

Frontend environment variables are prefixed with `VITE_`:

| Variable | Required? | Default | Description |
|:---|:---:|:---|:---|
| `VITE_API_URL` | Optional | `"/api"` | Base URL for REST API. Leave empty in production to use automatic relative proxying. |
| `VITE_WS_URL` | Optional | Auto-detected | Explicit WebSocket endpoint. Defaults to `ws://<host>/ws`. |

---

## 15. Build, Verification & Deployment Runbook

### Compiling Production Assets (on Development Workstation):
```bash
cd /path/to/istrac-fms/frontend

# Typecheck and compile production bundle
npm run build
```

### Deploying to Production RHEL Server:
```bash
# Copy compiled bundle to Apache DocumentRoot
sudo cp -rf dist/* /opt/istrac-fms/frontend/dist/
sudo chmod -R 755 /opt/istrac-fms/frontend/dist

# Hard-refresh browser cache
# Press Ctrl + Shift + R in Firefox / Chrome
```
