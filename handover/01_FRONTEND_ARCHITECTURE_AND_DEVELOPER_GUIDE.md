# 🛰️ ISTRAC-SIMS — Frontend Architecture & Developer Guide

## 1. Executive Summary & Technology Stack

The **ISTRAC-SIMS (Satellite Information Management System)** frontend is an air-gapped, high-performance, single-page web application (SPA) tailored for ISRO/ISTRAC satellite mission ground stations and operational telemetry monitoring.

### Core Stack
- **Framework:** [React 19](https://react.dev/) (`react@19.2.7`, `react-dom@19.2.7`)
- **Build Tool / Bundler:** [Vite 6 / 8](https://vitejs.dev/) with Rollup/Rolldown chunking optimizations
- **Styling Engine:** [Tailwind CSS v4](https://tailwindcss.com/) (`@tailwindcss/vite`, `@tailwindcss/postcss`) with ISRO Deep-Space UI design tokens
- **Routing:** [React Router v7](https://reactrouter.com/) (`react-router-dom@7.18.2`)
- **State Management:** [Zustand v5](https://github.com/pmndrs/zustand) (`zustand@5.0.14`) for global client state (Authentication, UI, System Preferences)
- **Server Cache & Data Fetching:** [TanStack React Query v5](https://tanstack.com/query/v5) (`@tanstack/react-query@5.101.4`)
- **HTTP Client:** [Axios](https://axios-http.com/) (`axios@1.19.0`) with automatic JWT injection and mutex-locked silent refresh interceptors
- **Form Validation:** [React Hook Form v7](https://react-hook-form.com/) + [Zod v4](https://zod.dev/) schema validation
- **Real-Time Communication:** Native HTML5 WebSocket client with automatic exponential reconnection and Redis Pub/Sub event bridge
- **Iconography:** [Lucide React](https://lucide.dev/) (`lucide-react@1.31.0`)
- **Sanitization:** [DOMPurify](https://github.com/cure53/DOMPurify) (`dompurify@3.4.14`) for mission CMS rendering

---

## 2. Directory Structure & Code References

```
frontend/
├── dist/                              # Compiled static assets (HTML, JS, CSS)
├── public/                            # Raw public assets (favicons, logos)
├── src/
│   ├── api/                           # REST API Service Layer
│   │   ├── client.ts                  # Master Axios instance, interceptors, relative baseURL
│   │   ├── auth.api.ts                # Login, Logout, Session Refresh, 2FA
│   │   ├── files.api.ts               # File upload, download, chunked streams, permissions
│   │   ├── telemetry.api.ts           # Satellite telemetry, metrics, orbit data
│   │   ├── cms.api.ts                 # Ground station announcements, CMS articles
│   │   └── admin.api.ts               # User management, audit logs, disk health
│   ├── components/                    # Reusable UI Component Library
│   │   ├── ui/                        # Core design system (Button, Input, Modal, Badge, Card)
│   │   ├── FileBrowser.tsx            # Mission documents, telemetry logs browser
│   │   ├── SpaceParallaxBackground.tsx# Interactive orbital canvas background
│   │   ├── MissionClock.tsx           # UTC & IST Ground Station synchronized clocks
│   │   ├── TelemetryDashboard.tsx     # Real-time satellite health gauges
│   │   └── cms-editor/                # Rich text & image input editor for bulletins
│   ├── hooks/                         # Custom React Hooks
│   │   ├── useAuth.ts                 # Authentication actions & permission guards
│   │   ├── useWebSocket.ts            # WebSocket subscription hook
│   │   └── useDebounce.ts             # Input debouncing utility
│   ├── layouts/                       # Application Shells & Layouts
│   │   ├── MainLayout.tsx             # Authenticated shell (TopNav, Sidebar, Footer, Clock)
│   │   └── AuthLayout.tsx             # Login & Recovery shell
│   ├── lib/                           # Core utilities
│   │   ├── ws.ts                      # WebSocket client with heartbeat & reconnect
│   │   ├── utils.ts                   # Class name merger (clsx/tailwind-merge), formatters
│   │   └── constants.ts               # Mission IDs, status enums, constants
│   ├── pages/                         # Application Route Views
│   │   ├── Login.tsx                  # ISRO ISTRAC Single-Administrator / Member login
│   │   ├── UserHome.tsx               # Main telemetry & mission feed dashboard
│   │   ├── DepartmentDetail.tsx       # Department-specific telemetry & file workspace
│   │   ├── AdminDashboard.tsx         # System administration, user access, storage health
│   │   ├── Reports.tsx                # Ground station pass reports & PDF generation
│   │   └── NotFound.tsx               # 404 handler
│   ├── store/                         # Zustand Global Stores
│   │   ├── authStore.ts               # Access token, user profile, role, session persistence
│   │   └── themeStore.ts              # Space / High-Contrast Ground Station theme
│   ├── types/                         # TypeScript interfaces and type definitions
│   │   ├── auth.types.ts              # User, Role, Session interfaces
│   │   ├── file.types.ts              # File metadata, chunking, folder structure
│   │   └── satellite.types.ts         # Satellite orbit, pass, telemetry interfaces
│   ├── App.tsx                        # Master Router configuration & protected routes
│   ├── main.tsx                       # React DOM entrypoint & QueryClientProvider
│   └── index.css                      # Tailwind v4 theme directives & orbital animations
├── package.json                       # Dependencies and build scripts
├── tsconfig.json                      # TypeScript strict compiler configuration
└── vite.config.ts                     # Vite build, proxy, and manual code-splitting
```

---

## 3. Core Architecture Details

### 3.1. API Client & Relative URL Architecture (`src/api/client.ts`)
The application is configured to use **relative URL resolution** (`baseURL: "/api"`), making it completely agnostic to whether the app is accessed via `http://localhost`, `http://10.0.2.15`, or an intranet domain.

```typescript
// frontend/src/api/client.ts
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

#### Mutex-Protected Token Refresh Interceptor:
When multiple simultaneous requests encounter a `401 Unauthorized`, `client.ts` uses an in-flight queue lock (`isRefreshing` + `refreshQueue`) to execute only **one** refresh request against `/api/auth/refresh`, and replays all pending requests once the new token is acquired.

---

### 3.2. Real-Time WebSocket Client (`src/lib/ws.ts`)
The frontend maintains a resilient WebSocket connection for telemetry updates, file uploads, and CMS bulletins:
- **Protocol Discovery:** Inspects `window.location.protocol` to use `ws://` (HTTP) or `wss://` (HTTPS).
- **Target URL:** Automatically connects to `${proto}//${window.location.host}/ws`. Apache proxies this to `ws://127.0.0.1:3000/ws`.
- **Heartbeat & Reconnection:** Sends periodic ping frames every 30s. If the connection is severed, it attempts exponential reconnection up to 5 times.
- **Pub/Sub Handler:** Components register listeners via `wsClient.on('cms.update', (data) => ...)`.

---

### 3.3. Authentication & Role-Based Access Control (`src/store/authStore.ts`)
The application enforces a 2-Role system:
1. `ADMIN` — Full access to user provisioning, storage metrics, audit logs, and mission configuration.
2. `MEMBER` — Access to assigned departments, telemetry downloads, and reports.

Authentication state is stored in `authStore.ts` using `localStorage` persistence for the session profile, while short-lived JWT access tokens reside in memory and HTTP-only cookies handle refresh tokens.

---

## 4. How to Update & Extend the Frontend

### 4.1. How to Add a New Page / Route

1. **Create the View Component:**
   Create a new file in `src/pages/`, for example `src/pages/SatelliteTelemetry.tsx`:
   ```tsx
   import React from 'react'
   import { useQuery } from '@tanstack/react-query'
   import { apiClient } from '../api/client'

   export default function SatelliteTelemetry() {
     const { data, isLoading } = useQuery({
       queryKey: ['satellite-telemetry'],
       queryFn: async () => {
         const res = await apiClient.get('/telemetry/live')
         return res.data
       },
     })

     if (isLoading) return <div className="text-white p-6">Loading Telemetry...</div>

     return (
       <div className="p-6 space-y-4">
         <h1 className="text-2xl font-bold text-cyan-400">Live Satellite Telemetry</h1>
         {/* Render telemetry widgets */}
       </div>
     )
   }
   ```

2. **Register the Route in `src/App.tsx`:**
   Import the component and add it inside `MainLayout`:
   ```tsx
   import SatelliteTelemetry from './pages/SatelliteTelemetry'

   // Inside <Routes>:
   <Route
     path="/telemetry"
     element={
       <ProtectedRoute allowedRoles={['ADMIN', 'MEMBER']}>
         <SatelliteTelemetry />
       </ProtectedRoute>
     }
   />
   ```

3. **Add Navigation Link in `src/layouts/MainLayout.tsx`:**
   Add an entry into the navigation menu with a Lucide icon.

---

### 4.2. How to Add a New REST API Endpoint

1. Locate or create an API service file in `src/api/` (e.g., `src/api/telemetry.api.ts`).
2. Export async helper functions utilizing `apiClient`:
   ```typescript
   import { apiClient } from './client'

   export interface TelemetryPacket {
     satelliteId: string
     azimuth: number
     elevation: number
     signalStrength: number
   }

   export const fetchTelemetry = async (satId: string): Promise<TelemetryPacket> => {
     const response = await apiClient.get(`/telemetry/${satId}`)
     return response.data.data
   }
   ```

---

### 4.3. How to Rebuild the Frontend for Production

When code changes are made in the development workspace:

```bash
# Navigate to frontend directory
cd /path/to/istrac-fms/frontend

# Compile TypeScript and build production bundle
npm run build
```

The output will be placed in `frontend/dist/`. To deploy it on the live RHEL server:
```bash
sudo cp -rf dist/* /opt/istrac-fms/frontend/dist/
sudo chmod -R 755 /opt/istrac-fms/frontend/dist
```
Then refresh the browser with `Ctrl + Shift + R`.
