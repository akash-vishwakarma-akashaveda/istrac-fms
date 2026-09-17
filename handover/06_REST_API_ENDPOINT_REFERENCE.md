# 🛰️ ISTRAC-SIMS — Complete REST API & WebSocket Endpoint Reference

> **Document Identifier:** ISTRAC-SIMS-API-V2.0  
> **Classification:** ISRO / ISTRAC Operational Software Interface Specification  
> **Application:** Satellite Information Management System (REST & WebSocket API)  
> **Version:** 1.1.0 Production Baseline  
> **Protocol:** HTTP/1.1 & HTTP/2 (TLS) · RFC 6455 WebSockets  
> **Base URL:** `/api` (Proxied via Apache 2.4 to `http://127.0.0.1:3000/api`)  

---

## 📑 Table of Contents

1. [Standard API Response Envelopes](#1-standard-api-response-envelopes)
2. [Authentication & Authorization Headers](#2-authentication--authorization-headers)
3. [Module 1: Authentication Endpoints (`/api/auth`)](#3-module-1-authentication-endpoints-apiauth)
4. [Module 2: Operator User Endpoints (`/api/users`)](#4-module-2-operator-user-endpoints-apiusers)
5. [Module 3: Administrative Control Endpoints (`/api/admin`)](#5-module-3-administrative-control-endpoints-apiadmin)
6. [Module 4: Ground Divisions Endpoints (`/api/departments`)](#6-module-4-ground-divisions-endpoints-apidepartments)
7. [Module 5: Spacecraft Fleet Endpoints (`/api/satellites`)](#7-module-5-spacecraft-fleet-endpoints-apisatellites)
8. [Module 6: File & Chunked Upload Endpoints (`/api/files`)](#8-module-6-file--chunked-upload-endpoints-apifiles)
9. [Module 7: Directory & File Browse Endpoints (`/api/browse`)](#9-module-7-directory--file-browse-endpoints-apibrowse)
10. [Module 8: Mission Announcements Endpoints (`/api/cms`)](#10-module-8-mission-announcements-endpoints-apicms)
11. [Module 9: Satellite Tracking Events (`/api/events`)](#11-module-9-satellite-tracking-events-apievents)
12. [Module 10: Operational Notifications (`/api/notifications`)](#12-module-10-operational-notifications-apinotifications)
13. [Module 11: Pass Report Presets (`/api/report-presets`)](#13-module-11-pass-report-presets-apireport-presets)
14. [Module 12: Background Scheduler (`/api/scheduler`)](#14-module-12-background-scheduler-apischeduler)
15. [Module 13: System Liveness & Health Probes (`/api/health`)](#15-module-13-system-liveness--health-probes-apihealth)
16. [Module 14: Real-Time WebSocket Interface (`/ws`)](#16-module-14-real-time-websocket-interface-ws)

---

## 1. Standard API Response Envelopes

All JSON responses follow strict envelope conventions:

### Success Envelope (HTTP 200, 201)
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully.",
  "timestamp": "2026-09-17T06:00:00.000Z"
}
```

### Error Envelope (HTTP 400, 401, 403, 404, 409, 500, 503)
```json
{
  "success": false,
  "error": {
    "code": "invalid_credentials",
    "message": "The provided email or password is incorrect.",
    "details": null
  },
  "timestamp": "2026-09-17T06:00:00.000Z"
}
```

---

## 2. Authentication & Authorization Headers

For protected endpoints, include the Bearer JWT in the standard HTTP header:
```http
Authorization: Bearer <jwt_access_token>
Content-Type: application/json
```

---

## 3. Module 1: Authentication Endpoints (`/api/auth`)

### `POST /api/auth/login`
- **Auth Required:** None (Rate Limited: 10 req/min)
- **Body:**
  ```json
  {
    "email": "admin@istrac.local",
    "password": "ChangeMe123!"
  }
  ```
- **Response (200 OK):**
  Sets `refreshToken` in `httpOnly` cookie.
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "usr_super_admin_01",
        "email": "admin@istrac.local",
        "name": "Super Admin (Director MOX)",
        "role": "ADMIN",
        "tempPass": false
      },
      "accessToken": "eyJhbGciOiJIUzI1NiIs..."
    }
  }
  ```

### `POST /api/auth/logout`
- **Auth Required:** None (Reads `refreshToken` from cookie)
- **Response (200 OK):** Deletes cookie and invalidates session token.

### `POST /api/auth/refresh`
- **Auth Required:** None (Validates `refreshToken` from cookie)
- **Response (200 OK):** Issues fresh 15-minute `accessToken`.

### `POST /api/auth/register`
- **Auth Required:** None
- **Body:**
  ```json
  {
    "name": "Orbital Analyst 1",
    "email": "analyst1@istrac.local",
    "employeeId": "ISRO-OA-044",
    "departmentId": "dept_mox_01",
    "password": "SecurePassword123!"
  }
  ```
- **Response (201 Created):** Account queued for Super Admin approval.

### `POST /api/auth/otp/request`
- **Auth Required:** None
- **Body:** `{ "email": "admin@istrac.local" }`
- **Response (200 OK):** Emits 6-digit OTP to systemd journal.

### `POST /api/auth/otp/verify`
- **Auth Required:** None
- **Body:**
  ```json
  {
    "email": "admin@istrac.local",
    "otp": "549120",
    "newPassword": "BrandNewPassword123!"
  }
  ```
- **Response (200 OK):** Password updated successfully.

---

## 4. Module 2: Operator User Endpoints (`/api/users`)

### `GET /api/users/profile`
- **Auth Required:** Bearer Token
- **Response (200 OK):** Returns operator details, division clearances, and preferences.

### `POST /api/users/change-password`
- **Auth Required:** Bearer Token
- **Body:** `{ "currentPassword": "...", "newPassword": "..." }`
- **Response (200 OK):** Rotates password and revokes previous sessions.

---

## 5. Module 3: Administrative Control Endpoints (`/api/admin`)

### `GET /api/admin/users`
- **Auth Required:** Bearer Token (`Role === 'ADMIN'`)
- **Response (200 OK):** Returns array of all operator accounts with status and roles.

### `GET /api/admin/approvals`
- **Auth Required:** Bearer Token (`Role === 'ADMIN'`)
- **Response (200 OK):** List of pending operator access requests.

### `POST /api/admin/approvals/:id/approve`
- **Auth Required:** Bearer Token (`Role === 'ADMIN'`)
- **Response (200 OK):** Activates operator account and grants department access.

### `GET /api/admin/audit-logs`
- **Auth Required:** Bearer Token (`Role === 'ADMIN'`)
- **Query Params:** `?page=1&limit=50&action=FILE_DOWNLOAD`
- **Response (200 OK):** Paginated immutable security audit trail.

### `GET /api/admin/metrics`
- **Auth Required:** Bearer Token (`Role === 'ADMIN'`)
- **Response (200 OK):** CPU utilization, RAM usage, storage volume capacity, daemon states.

---

## 6. Module 4: Ground Divisions Endpoints (`/api/departments`)

### `GET /api/departments`
- **Auth Required:** Public / Bearer Token
- **Response (200 OK):** List of ground stations, mission complexes, and tracking divisions.

### `POST /api/departments`
- **Auth Required:** Bearer Token (`Role === 'ADMIN'`)
- **Body:**
  ```json
  {
    "name": "IDSN Byalalu Deep Space Network",
    "code": "IDSN-BYL",
    "description": "32m Deep Space Antenna Complex",
    "storageQuotaBytes": 1073741824000
  }
  ```

---

## 7. Module 5: Spacecraft Fleet Endpoints (`/api/satellites`)

### `GET /api/satellites`
- **Auth Required:** Bearer Token
- **Response (200 OK):** Returns fleet catalog (Aditya-L1, Chandrayaan-3, Ground Stations).

### `GET /api/satellites/:id/passes`
- **Auth Required:** Bearer Token
- **Response (200 OK):** Returns tracking passes, AOS/LOS timestamps, and tracking frequencies.

---

## 8. Module 6: File & Chunked Upload Endpoints (`/api/files`)

### `POST /api/files/upload/chunk`
- **Auth Required:** Bearer Token (Multipart Form-Data)
- **Headers:**
  - `x-upload-id`: UUID string
  - `x-chunk-index`: Integer (0-based)
  - `x-total-chunks`: Integer
  - `x-file-name`: Encoded file name
  - `x-file-size`: Total byte size
  - `x-department-id`: Division UUID
- **Response (200 OK):** `{ "success": true, "chunkReceived": 0 }`

### `POST /api/files/upload/complete`
- **Auth Required:** Bearer Token
- **Body:**
  ```json
  {
    "uploadId": "550e8400-e29b-41d4-a716-446655440000",
    "clientSha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "category": "TELEMETRY_RAW",
    "departmentId": "dept_mox_01"
  }
  ```
- **Response (201 Created):** Assembles chunks, validates hash, commits file to MariaDB.

### `GET /api/files/:id/download`
- **Auth Required:** Bearer Token
- **Response (200 OK):** Binary stream with `Content-Disposition: attachment; filename="..."`.

---

## 9. Module 7: Directory & File Browse Endpoints (`/api/browse`)

### `GET /api/browse/folders`
- **Auth Required:** Bearer Token
- **Query Params:** `?deptId=...&parentId=...`
- **Response (200 OK):** Folder hierarchy and breadcrumb navigation tree.

---

## 10. Module 8: Mission Announcements Endpoints (`/api/cms`)

### `GET /api/cms/notices`
- **Auth Required:** Public / Bearer Token
- **Response (200 OK):** Active operational bulletins and banners displayed on landing portal.

### `POST /api/cms/articles`
- **Auth Required:** Bearer Token (`Role === 'ADMIN'`)
- **Body:** Rich text JSON payload sanitized via DOMPurify.

---

## 11. Module 9: Satellite Tracking Events (`/api/events`)

### `GET /api/events/passes`
- **Auth Required:** Bearer Token
- **Query Params:** `?startDate=2026-09-17&endDate=2026-09-24`
- **Response (200 OK):** Scheduled tracking passes across all active ground antenna dishes.

---

## 12. Module 10: Operational Notifications (`/api/notifications`)

### `GET /api/notifications`
- **Auth Required:** Bearer Token
- **Response (200 OK):** Personal operational notifications and broadcast alerts.

### `POST /api/notifications/broadcast`
- **Auth Required:** Bearer Token (`Role === 'ADMIN'`)
- **Body:** `{ "title": "...", "message": "...", "level": "CRITICAL" }`
- **Response (201 Created):** Transmits alert via WebSocket to all connected stations.

---

## 13. Module 11: Pass Report Presets (`/api/report-presets`)

### `GET /api/report-presets`
- **Auth Required:** Bearer Token
- **Response (200 OK):** Standardized pass reporting templates (Telemetry Quality, Bit Error Rate).

---

## 14. Module 12: Background Scheduler (`/api/scheduler`)

### `GET /api/scheduler/status`
- **Auth Required:** Bearer Token (`Role === 'ADMIN'`)
- **Response (200 OK):** Current execution frequency and last run status of the pass automator.

---

## 15. Module 13: System Liveness & Health Probes (`/api/health`)

### `GET /api/health` (also accessible at `/health`)
- **Auth Required:** None (Public)
- **Response (200 OK / 503 Service Unavailable):**
  ```json
  {
    "status": "ok",
    "db": "ok",
    "redis": "ok",
    "hdd": "ok",
    "timestamp": "2026-09-17T06:00:00.000Z"
  }
  ```

### `GET /api/admin/health/hdd`
- **Auth Required:** Bearer Token (`Role === 'ADMIN'`)
- **Response (200 OK):** Detailed disk metrics: mounted state, path, and degradation flag.

---

## 16. Module 14: Real-Time WebSocket Interface (`/ws`)

- **Connection URL:** `ws://<host>/ws?token=<jwt_access_token>`
- **Protocol:** JSON message frames: `{ "event": string, "payload": any }`

### Subscribed Event Channels:
| Event Name | Direction | Payload Description |
|:---|:---:|:---|
| `ping` / `pong` | Bidirectional | Connection keepalive heartbeat (every 30s). |
| `cms.update` | Server -> Client | Notifies UI that bulletins have changed; triggers re-fetch. |
| `notification.broadcast` | Server -> Client | Immediate alert banner displayed across operator screens. |
| `file.uploaded` | Server -> Client | Real-time update to folder view when new telemetry lands. |
| `hdd.sync` | Server -> Client | Storage volume metrics refresh event. |
