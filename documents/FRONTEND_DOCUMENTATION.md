# ISTRAC-FMS Frontend Architecture & Technical Reference

> **Application:** Indian Space Research Auxiliary Centres — File Management System (ISTRAC-FMS Frontend)  
> **Version:** 1.0.0 (V1 Production Baseline)  
> **Target Environment:** Intranet Air-Gapped / Isolated Ground Station Network  
> **Core Stack:** React 19 · Vite 8 · TypeScript 5 · Tailwind CSS v4 · TanStack Query v5 · Zustand v5 · Axios · Lucide React

---

## 📑 Table of Contents

1. [Executive Summary & Design Philosophy](#1-executive-summary--design-philosophy)
2. [Architectural Decisions — The "What & Why"](#2-architectural-decisions--the-what--why)
   - [2.1 Modular API Client & Automated Token Rotation](#21-modular-api-client--automated-token-rotation)
   - [2.2 State Division: Zustand (UI State) vs. TanStack Query (Server Cache)](#22-state-division-zustand-ui-state-vs-tanstack-query-server-cache)
   - [2.3 Sequential Chunked File Upload Engine & Client-Side SHA-256](#23-sequential-chunked-file-upload-engine--client-side-sha-256)
   - [2.4 Real-Time WebSocket Event Dispatching with Backoff](#24-real-time-websocket-event-dispatching-with-backoff)
   - [2.5 Air-Gapped Zero-CDN Asset Architecture](#25-air-gapped-zero-cdn-asset-architecture)
   - [2.6 Defense-in-Depth XSS & Traversal Sanitization](#26-defense-in-depth-xss--traversal-sanitization)
3. [Complete Codebase Directory Map](#3-complete-codebase-directory-map)
4. [Design System & UI Component Hierarchy](#4-design-system--ui-component-hierarchy)
5. [Modular API Layer (`src/api/`) Reference](#5-modular-api-layer-srcapi-reference)
6. [State Management Architecture (Zustand Stores)](#6-state-management-architecture-zustand-stores)
7. [Server Data Caching & Invalidation Patterns](#7-server-data-caching--invalidation-patterns)
8. [Real-Time WebSocket Protocol & Handler Registration](#8-real-time-websocket-protocol--handler-registration)
9. [Frontend Security & Sanitization Protocols](#9-frontend-security--sanitization-protocols)
10. [Routing, Navigation & Role-Based Guards](#10-routing-navigation--role-based-guards)

---

## 1. Executive Summary & Design Philosophy

The ISTRAC-FMS frontend is designed as a mission-critical **Mission Control File Operations Portal**. It provides ground station engineers, telemetry operators, and mission directors with sub-second file exploration, multi-gigabyte chunked file ingestion, real-time activity streaming, and departmental access controls.

### Core Visual & Functional Directives:
- **Mission Control Aesthetic:** High-density, dark-mode first user interface utilizing deep charcoal surfaces (`#0b0f17`, `#111827`), aerospace telemetry green (`#10b981`), amber warnings (`#f59e0b`), and clean ISRO blue accents (`#3b82f6`).
- **Precision Readouts:** Monospace numerical telemetry readouts (UTC timestamp ticker, byte counters, SHA-256 hashes, file versions).
- **Zero Internet / CDN Dependencies:** Built specifically for isolated, air-gapped intranet networks with local SVG icons and bundled fonts.
- **Strict Role-Based Multi-Tenancy:** Dynamic feature gating for `ADMIN` and `MEMBER` roles with graceful state degradation.

---

## 2. Architectural Decisions — The "What & Why"

### 2.1 Modular API Client & Automated Token Rotation

#### What:
All backend communication is abstracted into specialized service modules inside [`src/api/`](file:///D:/istrac-fms/frontend/src/api) (`auth.api.ts`, `satellites.api.ts`, `departments.api.ts`, `users.api.ts`, `files.api.ts`, `browse.api.ts`, `notifications.api.ts`, `cms.api.ts`, `admin.api.ts`, `health.api.ts`). The underlying Axios instance ([`src/api/client.ts`](file:///D:/istrac-fms/frontend/src/api/client.ts)) features an automated request/response interceptor that transparently handles `401 Unauthorized` token expiry.

#### Why:
1. **Separation of Concerns:** Components and hooks never write raw `fetch` or `axios.post` URLs. Changing an API route only requires modifying a single file in `src/api/`.
2. **Seamless Session Continuation (Stampede Prevention):** When an access token expires (15m TTL), multiple in-flight requests may fail simultaneously with `401`. The interceptor locks execution (`isRefreshing = true`), queues pending requests in `refreshQueue`, makes a single call to `/auth/refresh` using the secure `httpOnly` refresh cookie, updates the Zustand store with the new access token, and retries all queued requests with the new header without logging the user out.

---

### 2.2 State Division: Zustand (UI State) vs. TanStack Query (Server Cache)

#### What:
The application strictly enforces a division between **Server State** and **Client UI State**:
- **TanStack Query (`@tanstack/react-query`):** Manages all server data fetching, caching, deduplication, background refetching, and pagination (departments, file lists, user queues, audit logs, system stats).
- **Zustand (`zustand`):** Manages strictly client-local transient UI state:
  - `authStore`: User identity claims in `sessionStorage` & active memory JWT.
  - `toastStore`: Interactive push notification toasts with timers.
  - `notificationStore`: Real-time unread badge counter.
  - `searchHistoryStore`: Local storage list of recent search queries.
  - `uiStore`: Sidebar collapse toggles, modal open/close states.

#### Why:
Mixing server data into Redux/Zustand creates redundant cache synchronization bugs, stale data, and complex action reducers. TanStack Query automatically manages cache keys, garbage collection, and optimistic UI updates, while Zustand provides lightweight, boilerplate-free state for UI toggles.

---

### 2.3 Sequential Chunked File Upload Engine & Client-Side SHA-256

#### What:
Files exceeding 10MB (`CHUNK_THRESHOLD`) are intercepted by [`useFileUpload.ts`](file:///D:/istrac-fms/frontend/src/hooks/useFileUpload.ts):
1. **Client-Side SHA-256:** The browser reads the file chunks using `FileReader` and computes the exact SHA-256 hash using the Web Crypto API before transmitting.
2. **Sequential Chunk Transmission:** The file is split into 10MB blobs (`CHUNK_SIZE`) and transmitted sequentially to `/files/upload/chunk`.
3. **Commit Phase:** Upon the final chunk transmission, a completion payload is sent to `/files/upload/complete` containing the file name, total chunks, and calculated checksum.

#### Why:
1. **Network Stability on Satellite Links:** Large uploads over unstable satellite intranet links often drop mid-transfer. Chunking prevents re-uploading an entire multi-gigabyte archive from scratch.
2. **Deterministic Progress:** Sequential chunking allows progress bars to accurately reflect bytes verified by the server rather than racing concurrent browser buffer requests.
3. **Integrity Verification:** Pre-computing SHA-256 in the browser guarantees that any corruption between the client workstation and the ground station storage array is detected immediately upon completion.

---

### 2.4 Real-Time WebSocket Event Dispatching with Backoff

#### What:
The [`WSClient`](file:///D:/istrac-fms/frontend/src/lib/ws.ts) establishes a persistent WebSocket connection to `ws://<host>:<port>/ws?token=<accessToken>`. It listens for server events (`CMS_UPDATE`, `NOTIFICATION`, `FILE_UPLOAD`, `FILE_DELETED`, `SYNC_COMPLETE`) and routes them to subscribed hooks and Zustand stores.

#### Why:
1. **Multi-Operator Synchronization:** When Operator A uploads telemetry data to the "Operations" department, Operator B's file browser instantly reflects the new file without requiring a manual page refresh.
2. **Exponential Backoff:** If the ground station server restarts, the WebSocket client reconnects automatically (1s, 2s, 4s, 8s, 16s, max 60s) while respecting code `4401` to avoid spamming the server when an operator's session has expired.

---

### 2.5 Air-Gapped Zero-CDN Asset Architecture

#### What:
All visual components, Lucide icons, fonts, and PDF rendering engines (`pdfjs-dist`) are bundled directly into the Vite build artifact.

#### Why:
In air-gapped ISRO/ISTRAC security enclosures, workstations have no internet gateway. Referencing external CDN links (e.g. Google Fonts, unpkg, cdnjs) causes network timeouts, broken typography, and failed component renders.

---

### 2.6 Defense-in-Depth XSS & Traversal Sanitization

#### What:
[`src/lib/sanitize.ts`](file:///D:/istrac-fms/frontend/src/lib/sanitize.ts) integrates `DOMPurify` and custom sanitizers to scrub all data entering the DOM:
- **`sanitizeHtml()`**: Strips scripts, iframes, and event handlers from CMS blocks.
- **`sanitizeFilename()`**: Removes directory traversal patterns (`../`, `..\`) and control characters before uploads.
- **`isSafeUrl()` / `safeHref()`**: Validates that all links use `http:`, `https:`, `mailto:`, or relative `/` paths, blocking `javascript:` and `data:` injection attacks.
- **`sanitizeSearchQuery()`**: Caps queries at 200 characters and strips dangerous regex control sequences.

#### Why:
Prevents stored XSS attacks when displaying user-uploaded filenames, CMS portal articles, or system broadcast notifications created by other operators.

---

## 3. Complete Codebase Directory Map

```
frontend/
├── package.json               # Dependencies (React 19, Vite 8, Tailwind v4, TanStack Query)
├── vite.config.ts             # Vite configuration with API proxy and vendor chunk splitting
├── tsconfig.json              # TypeScript project configurations
├── public/                    # Static air-gapped assets (logos, favicon)
└── src/
    ├── main.tsx               # Application bootstrap with QueryClientProvider & BrowserRouter
    ├── App.tsx                # Master route hierarchy and layout wrapper
    ├── index.css              # Tailwind CSS v4 design tokens, color variables & mono utility classes
    ├── api/                   # Centralized Modular API Client Layer
    │   ├── client.ts          # Axios instance, token refresh interceptor & data unwrapper
    │   ├── auth.api.ts        # Authentication & password management APIs
    │   ├── satellites.api.ts  # Satellite station management APIs
    │   ├── departments.api.ts # Department & user access APIs
    │   ├── users.api.ts       # User management & pending approval queue APIs
    │   ├── files.api.ts       # File upload (single/chunked), download, versioning APIs
    │   ├── browse.api.ts      # Directory browsing, tree hierarchy & search APIs
    │   ├── notifications.api.ts # User notifications & system broadcast APIs
    │   ├── cms.api.ts         # Portal CMS content block APIs
    │   ├── admin.api.ts       # Admin metrics, audit logs & system settings APIs
    │   ├── health.api.ts      # System & storage hardware health probe APIs
    │   └── index.ts           # Barrel export of all API services & DTO interfaces
    ├── components/            # 52+ Modular UI Component Library
    │   ├── Button.tsx         # Primary, secondary, danger, ghost action buttons
    │   ├── Input.tsx          # Monospace-ready form input with validation errors
    │   ├── Select.tsx         # Dropdown select control with custom theme styling
    │   ├── Modal.tsx          # Accessible modal dialog with backdrop & escape key binding
    │   ├── Table.tsx          # Mission control data table with sortable columns
    │   ├── Card.tsx           # Elevated surface card container
    │   ├── Badge.tsx          # Status indicator pills (Active, Pending, Suspended, Read-Only)
    │   ├── Toast.tsx          # Push notification toasts with auto-dismiss timers
    │   ├── ToastContainer.tsx # Fixed container rendering active toast stack
    │   ├── FileBrowser.tsx    # Interactive file manager table with selection & context actions
    │   ├── FolderTree.tsx     # Collapsible hierarchical folder tree
    │   ├── UploadModal.tsx    # Drag-and-drop file upload dialog with chunk progress bars
    │   ├── FilePreviewModal.tsx # Multi-format file viewer (PDF, image, text, hex)
    │   ├── VersionHistoryPanel.tsx # Drawer showing historical file revisions & download buttons
    │   ├── QuickSearchBar.tsx # Fast omnibox search with keyboard shortcuts (Ctrl+K)
    │   ├── StatCard.tsx       # Metric cards displaying total files, storage, operators
    │   ├── Navbar.tsx         # Top navigational bar with ground station status
    │   └── cms-editor/        # WYSIWYG and structured JSON CMS block editors
    ├── hooks/                 # Custom TanStack Query & Lifecycle Hooks
    │   ├── useAdminStats.ts   # Real-time dashboard statistics
    │   ├── useAuditLog.ts     # Cursor-paginated audit log feed
    │   ├── useDepartments.ts  # Accessible user departments & admin CRUD
    │   ├── useDeptFiles.ts    # Department file listings with sorting
    │   ├── useFileUpload.ts   # Single-shot & sequential chunked upload engine
    │   ├── useFileVersions.ts # File revision history
    │   ├── useFolderTree.ts   # Hierarchical folder structure
    │   ├── useInitAuth.ts     # App boot session validation & silent refresh
    │   ├── useNotifications.ts # Inbox notifications & mark-as-read mutations
    │   ├── usePendingUsers.ts # Approval queue queries & mutations
    │   ├── useSearch.ts       # Full-text search queries
    │   ├── useSystemConfig.ts # Global system configuration settings
    │   ├── useUsers.ts        # User roster queries & account actions
    │   └── useUserHome.ts     # Operator home dashboard metrics
    ├── layouts/               # High-Level Page Layout Shells
    │   ├── AdminLayout.tsx    # Administrator shell with navigation sidebar & topbar
    │   ├── AppLayout.tsx      # Operator workstation shell
    │   ├── AuthLayout.tsx     # Login/Register centered authentication card shell
    │   ├── Sidebar.tsx        # Collapsible ground station navigational sidebar
    │   └── Topbar.tsx         # Top telemetry bar (UTC ticker, user avatar, notifications bell)
    ├── lib/                   # Utilities & Shared Infrastructure
    │   ├── axios.ts           # Re-exported API client for backwards compatibility
    │   ├── ws.ts              # Real-time WebSocket connection manager & event dispatcher
    │   ├── sanitize.ts        # DOMPurify XSS, traversal, and URL validator utilities
    │   ├── formatFileSize.ts  # Human-readable byte formatter (KB, MB, GB, TB)
    │   ├── fileUpload.ts      # Web Crypto SHA-256 hasher & chunk splitting utilities
    │   ├── previewType.ts     # File extension to MIME & previewer resolver
    │   └── queryClient.ts     # Global TanStack QueryClient configuration
    ├── pages/                 # Full Route Page Views (21 Pages)
    │   ├── AdminHome.tsx      # Admin mission control dashboard with live metrics
    │   ├── ApprovalQueue.tsx  # Operator registration review queue
    │   ├── AuditLogViewer.tsx # Infinite-scrolling tamper-evident audit feed
    │   ├── BroadcastNotification.tsx # System-wide emergency notification dispatcher
    │   ├── CmsEditor.tsx      # Portal landing page content management
    │   ├── DepartmentManager.tsx # Department & satellite mapping management
    │   ├── DeptFileBrowser.tsx # Departmental file & folder workspace
    │   ├── Files.tsx          # General files directory
    │   ├── ForcePasswordChange.tsx # Forced password rotation interface
    │   ├── ForgetPassword.tsx # Password reset request submission
    │   ├── Landing.tsx        # Air-gapped public landing portal
    │   ├── Login.tsx          # Operator login with credentials
    │   ├── NotificationsPage.tsx # Full-page notification inbox with date grouping
    │   ├── Register.tsx       # Operator account registration form
    │   ├── SearchPage.tsx     # Global file search results view
    │   ├── SystemConfigPanel.tsx # System parameter configuration panel
    │   ├── UserHome.tsx       # Operator dashboard with department shortcuts
    │   └── UserManagement.tsx # Operator roster & account status toggles
    ├── store/                 # Zustand Transient Client State
    │   ├── authStore.ts       # Active user claims & access token storage
    │   ├── notificationStore.ts # Real-time unread notification count
    │   ├── searchHistoryStore.ts # Local search history
    │   ├── toastStore.ts      # Push notification toasts queue
    │   └── uiStore.ts         # Sidebar & drawer open/close states
    └── types/                 # Shared TypeScript Type Definitions
        ├── file.ts            # FileNode, TreeNode, and Sort interfaces
        └── upload.ts          # UploadItem, Chunk, and Status interfaces
```

---

## 4. Design System & UI Component Hierarchy

### Tailwind Design Tokens ([`src/index.css`](file:///D:/istrac-fms/frontend/src/index.css))

```css
:root {
  --bg-surface: #0b0f17;      /* Primary dark canvas background */
  --bg-card: #111827;         /* Elevated card surface */
  --bg-card-hover: #1f2937;   /* Interactive hover surface */
  --border-subtle: #1e293b;   /* Subtle divider border */
  --border-default: #334155;  /* Standard container border */
  --text-primary: #f8fafc;    /* High-contrast primary text */
  --text-secondary: #94a3b8;  /* Readable secondary label text */
  --text-dim: #64748b;        /* Muted metadata / hint text */
  --accent: #2563eb;          /* ISRO Mission Blue */
  --accent-light: #3b82f6;    /* Interactive focus blue */
  --nominal: #10b981;         /* Telemetry Nominal Green */
  --critical: #ef4444;        /* Critical Warning / Trash Red */
  --warning: #f59e0b;         /* Cautionary Alert Amber */
}
```

### Key UI Components Overview

| Component | File Path | Description |
|---|---|---|
| **`FileBrowser`** | [`src/components/FileBrowser.tsx`](file:///D:/istrac-fms/frontend/src/components/FileBrowser.tsx) | Complete file directory table with bulk selection, sorting, contextual action buttons, and version tags. |
| **`UploadModal`** | [`src/components/UploadModal.tsx`](file:///D:/istrac-fms/frontend/src/components/UploadModal.tsx) | Multi-file drag-and-drop modal showing real-time hashing, sequential chunk progress, and completion states. |
| **`FilePreviewModal`** | [`src/components/FilePreviewModal.tsx`](file:///D:/istrac-fms/frontend/src/components/FilePreviewModal.tsx) | Sandboxed in-browser viewer supporting PDF (`pdfjs-dist`), image preview, text viewer, and raw hex inspections. |
| **`FolderTree`** | [`src/components/FolderTree.tsx`](file:///D:/istrac-fms/frontend/src/components/FolderTree.tsx) | Hierarchical folder tree with expand/collapse nodes and active directory highlighting. |
| **`VersionHistoryPanel`** | [`src/components/VersionHistoryPanel.tsx`](file:///D:/istrac-fms/frontend/src/components/VersionHistoryPanel.tsx) | Side drawer displaying file version history, uploader names, SHA-256 hashes, and download buttons. |
| **`QuickSearchBar`** | [`src/components/QuickSearchBar.tsx`](file:///D:/istrac-fms/frontend/src/components/QuickSearchBar.tsx) | Omnibox search trigger with `Ctrl+K` keybinding. |
| **`ToastContainer`** | [`src/components/ToastContainer.tsx`](file:///D:/istrac-fms/frontend/src/components/ToastContainer.tsx) | Fixed viewport stack rendering floating toast notifications with nominal/critical styling. |

---

## 5. Modular API Layer (`src/api/`) Reference

### Centralized Invocation Pattern

Every API module exports an async object that wraps endpoints and returns strongly-typed results:

```typescript
import { filesApi, departmentsApi } from '../api'

// 1. Fetching user departments
const depts = await departmentsApi.getUserDepartments()

// 2. Initiating chunk upload
await filesApi.uploadChunk(chunkBlob, fileName, chunkIndex, totalChunks, departmentId)

// 3. Downloading file
window.location.href = filesApi.getDownloadUrl(fileId)
```

---

## 6. State Management Architecture (Zustand Stores)

### 1. `useAuthStore` ([`src/store/authStore.ts`](file:///D:/istrac-fms/frontend/src/store/authStore.ts))
- **Stored Data:** `user: User | null`, `accessToken: string | null`
- **Persistence:** Uses `sessionStorage` for the `user` object so closing the tab clears the session, while page refreshes preserve state. The `accessToken` is stored only in memory for security.

### 2. `useToastStore` ([`src/store/toastStore.ts`](file:///D:/istrac-fms/frontend/src/store/toastStore.ts))
- **Stored Data:** Array of active toasts `{ id, title, message, variant: 'nominal' | 'critical' | 'warning' }`
- **Helper Methods:** `toast.success(msg)`, `toast.error(msg)`, `toast.warn(msg)` with 5-second automatic dismissal.

### 3. `useNotificationStore` ([`src/store/notificationStore.ts`](file:///D:/istrac-fms/frontend/src/store/notificationStore.ts))
- **Stored Data:** `unreadCount: number`
- **Action:** Incremented in real-time by WebSocket `NOTIFICATION` events; reset when opening the notifications inbox.

---

## 7. Server Data Caching & Invalidation Patterns

The application uses **TanStack Query** query keys to control server caching:

```typescript
// Query Key Roster:
['departments']                     // User accessible departments
['admin-departments', satelliteId]  // Admin all departments listing
['dept-files', deptId, parentId]    // Files inside a specific folder
['folder-tree', deptId]             // Recursive folder hierarchy
['users', page, search, status]     // Paginated user roster
['pending-users']                   // Registration approval queue
['admin-stats']                     // Mission control statistics
['audit-log', filters]              // Paginated audit entries
['notifications', category]         // User notifications inbox
['file-versions', fileId]           // Historical versions for a file
```

### Invalidation Triggers:
- **After File Upload / Delete:** Invalidates `['dept-files']` and `['admin-stats']`.
- **After User Approval / Rejection:** Invalidates `['pending-users']` and `['users']`.
- **After Department Creation / Archive:** Invalidates `['departments']` and `['admin-departments']`.
- **On WebSocket `FILE_UPLOAD` / `FILE_DELETED`:** Automatically triggers `queryClient.invalidateQueries({ queryKey: ['dept-files'] })`.

---

## 8. Real-Time WebSocket Protocol & Handler Registration

### Subscribing to Events in Components
```typescript
import { useEffect } from 'react'
import { wsClient } from '../lib/ws'
import { useQueryClient } from '@tanstack/react-query'

export function useRealtimeFileSync(deptId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    // Subscribe to FILE_UPLOAD events
    const unsubscribe = wsClient.subscribe('FILE_UPLOAD', () => {
      queryClient.invalidateQueries({ queryKey: ['dept-files', deptId] })
    })

    return () => unsubscribe()
  }, [deptId, queryClient])
}
```

---

## 9. Frontend Security & Sanitization Protocols

```
                      External Input
             (CMS Content / File Names / URLs)
                            │
                            ▼
               ┌──────────────────────────┐
               │    src/lib/sanitize.ts   │
               └────────────┬─────────────┘
                            │
       ┌────────────────────┼────────────────────┐
       ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ sanitizeHtml │     │ sanitizeFile │     │  isSafeUrl   │
│  (DOMPurify) │     │ (Traversal)  │     │ (Protocols)  │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       ▼                    ▼                    ▼
Safe DOM Render      Safe API Upload      Safe Navigation
```

---

## 10. Routing, Navigation & Role-Based Guards

All routes are defined in [`src/App.tsx`](file:///D:/istrac-fms/frontend/src/App.tsx) and guarded:

1. **Public Routes:** `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`
2. **Authenticated Operator Routes (`MEMBER` & `ADMIN`):**
   - `/home` ➔ Operator Dashboard
   - `/departments/:deptId` ➔ Department File Browser
   - `/search` ➔ Global Search Page
   - `/notifications` ➔ Notification Inbox
3. **Admin Guarded Routes (`ADMIN` only):**
   - `/admin` ➔ Mission Control Stats Overview
   - `/admin/approvals` ➔ Registration Approval Queue
   - `/admin/users` ➔ User Account Administration
   - `/admin/departments` ➔ Department & Satellite Manager
   - `/admin/audit-logs` ➔ Tamper-Evident Audit Feed
   - `/admin/broadcast` ➔ Emergency Notification Dispatcher
   - `/admin/cms` ➔ Landing Page Content Editor
   - `/admin/settings` ➔ System Parameters Configuration
