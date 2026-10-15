# ISTRAC File Management System (FMS)
## File Deletion Architecture & Security Specification

This document provides a comprehensive operational and technical explanation of the **File Deletion Architecture**, contrasting **Soft Delete (Trash)** with the newly implemented **Hard Delete (Permanent Erasure)** system, detailing the three deletion scopes, resolved security concerns, and instructions for administrative personnel.

---

## 1. Executive Summary

In mission-critical aerospace ground systems like ISTRAC, data retention and storage management require a balance between **accidental data loss prevention** and **compliance-driven permanent data purging**.

The system implements a two-stage deletion lifecycle:
1. **Stage 1 — Soft Delete (Move to Trash)**: Available to standard operators and administrators. Moves the file out of active operation into a recoverable Trash repository without altering physical storage or database records.
2. **Stage 2 — Hard Delete (Permanent Purge)**: Strictly restricted to System Administrators. Enables irreversible deletion with granular control over whether data is removed from **Database records**, **Physical Storage (HDD)**, or **Both**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ACTIVE OPERATIONAL SYSTEM                       │
│  Files visible in Dashboards, Department Repositories, Mission Passes  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                       Delete File  │ (Soft Delete)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                               TRASH VIEW                               │
│        Files hidden from operations; binary data preserved on HDD      │
└─────────────────┬────────────────────────────────────┬─────────────────┘
                  │                                    │
          Restore │                                    │ Hard Delete
                  ▼                                    ▼
     [Back to Active System]              ┌───────────────────────────┐
                                          │     HARD DELETE MODAL     │
                                          ├───────────────────────────┤
                                          │ 1. Complete Purge (Both)  │
                                          │ 2. Storage HDD Only       │
                                          │ 3. Database Only          │
                                          └───────────────────────────┘
```

---

## 2. Deletion Models Explained

### Model A: Soft Delete (Move to Trash)
- **Endpoint**: `DELETE /api/v1/files/:fileId`
- **What Happens**:
  - The database row is flagged with a timestamp: `deletedAt = NOW()`.
  - The file is immediately hidden from user searches, department views, and mission dashboards.
  - **Storage Impact**: Zero. The physical file binary and all version files remain untouched on the server hard drive.
  - **Recovery**: Any Administrator can click **Restore** at any time to instantly return the file to active status without data loss.

---

### Model B: Hard Delete (Permanent Purge)
- **Endpoint**: `DELETE /api/v1/admin/files/:fileId/hard-delete`
- **Permission**: Strict Administrator Role (`ADMIN`) Required.
- **Scope Options**:

| Hard Delete Mode | Database Records | Physical HDD Files | Storage Reclaimed? | Primary Use Case |
| :--- | :---: | :---: | :---: | :--- |
| **1. Complete Purge (`BOTH`)** *(Recommended)* | **Deleted Permanently** | **Deleted Permanently** | **Yes** | Complete expunction of sensitive, classified, duplicate, or faulty datasets. No trace remains except the immutable audit log. |
| **2. Storage / Memory HDD Only (`STORAGE_ONLY`)** | **Preserved** (Flagged as `DELETED` & `[PURGED FROM STORAGE]`) | **Deleted Permanently** | **Yes** | **Reclaiming Server Disk Space**: Telemetry/payload files can be gigabytes or terabytes. This removes the heavy disk bytes while retaining cryptographic SHA-256 hashes, metadata, and provenance in the database for audit compliance. |
| **3. Database Only (`DATABASE_ONLY`)** | **Deleted Permanently** | **Preserved on Disk** | **No** | **Catalog Decoupling**: Removes corrupt or outdated metadata entries from the web application while ensuring raw sensor/satellite binaries remain safe in physical cold storage for future offline analysis or re-indexing. |

---

## 3. How the System Tracks Each File Deletion Phase

The system uses a combination of **PostgreSQL database fields**, **disk storage state**, **audit log actions**, and **UI status badges** to keep track of every file's exact lifecycle phase:

| Lifecycle Phase | Database Fields (`File`) | Physical Disk (`HDD`) | Audit Log Action | UI Status / Visibility |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1: Active** | • `deletedAt = null`<br>• `status = 'ACTIVE'` | Binary file present at `file.hddPath` | `FILE:UPLOAD`<br>`FILE:NEW_VERSION` | Visible in all Dashboards, Department Browsers, and Search. |
| **Phase 2: Soft-Deleted (In Trash)** | • `deletedAt = <Timestamp>`<br>• `status = 'ACTIVE'`<br>• `isFeatured = false` | Binary file completely preserved at `file.hddPath` | `FILE:DELETE` | Hidden from normal views. Visible in **Trash** tab with badge `Soft Deleted`. **Restore** and **Hard Delete** buttons available. |
| **Phase 3: Storage Purged (`STORAGE_ONLY`)** | • `deletedAt = <Timestamp>`<br>• `status = 'DELETED'`<br>• `description = "[PURGED FROM STORAGE]"`<br>• `FileVersion.deletedAt = <Timestamp>` | Binary files unlinked & erased from disk | `FILE:HARD_DELETE_STORAGE_ONLY` | Visible in **Trash** tab with badge `Payload Purged` and status `Bytes Purged`. Restore disabled (binary gone). Metadata & SHA-256 preserved for audit. |
| **Phase 4: Database Purged (`DATABASE_ONLY`)** | Row removed from PostgreSQL database (`File`, `FileVersion`, etc.) | Binary file remains on disk at `/storage/...` | `FILE:HARD_DELETE_DATABASE_ONLY` | Disappears from application UI. Disk sync detector recognizes file on disk as `UNREGISTERED` payload. |
| **Phase 5: Full Hard Delete (`BOTH`)** | Row removed from PostgreSQL database | Binary files unlinked & erased from disk | `FILE:HARD_DELETE_BOTH` | Expunged completely from both UI and disk. Permanent record preserved in `AuditLog` table. |

---

## 4. Security Concerns Identified & Resolved

During the architecture and implementation of this feature, key security and data integrity vulnerabilities were identified and resolved:

### 1. Privilege Escalation & Unauthorized Purging
- **Risk**: Regular departmental users or malicious actors attempting to permanently erase files.
- **Solution**: The hard delete endpoint is protected by dual-layer middleware: `authMiddleware` and `adminMiddleware`. Standard users (even those with `READ_WRITE` department access) receive an HTTP `403 Forbidden` response.

### 2. Path Traversal & System File Deletion
- **Risk**: If a malicious actor or corrupted database field contains relative path characters (e.g. `../../../../etc/passwd` or `C:\Windows\System32`), disk unlinking could destroy critical operating system files.
- **Solution**:
  - `hddService.guardPath()` strictly verifies that paths contain no traversal patterns (`..`).
  - System root directories (`/`, `C:\`, `D:\`) are blocked with an HTTP `403 Forbidden` exception.
  - The unlinking engine uses `resolvePhysicalPath()` to strictly constrain file deletion within approved storage mount points (`/storage`, `C:/istrac_storage`, etc.).

### 3. Database Foreign Key Constraints & Data Inconsistency
- **Risk**: Prisma models (`FileVersion`, `FileTag`, `FileFavorite`, `FilePermission`, `FileShareLink`) enforce `onDelete: Restrict`. Deleting a `File` row directly causes a PostgreSQL foreign key violation (error code `P2003`), leaving broken records.
- **Solution**: All deletions are executed inside an atomic database transaction (`prisma.$transaction`). Dependent junction tables and version records are safely deleted before the parent `File` row is removed. If the file was linked to a dedicated `Report` with no other sibling files, the report record is cleaned up simultaneously.

### 4. Accidental Deletion of Directories (Non-Empty Folders)
- **Risk**: Hard deleting a folder could orphan child files or cause accidental cascade loss of dozens of files.
- **Solution**: The engine checks `file.nodeType === 'FOLDER'`. If child items exist inside the folder, the operation is blocked with an HTTP `400 Bad Request` informing the user: *"Cannot permanently delete directory because it contains X item(s). Please remove all contents first."*

### 5. Storage Unlink Failures & Offline Mount Resilience
- **Risk**: If a file was previously moved or manually deleted from disk by a systems engineer, standard `fs.unlink()` throws an `ENOENT` error, causing the entire database transaction to abort.
- **Solution**: The storage service safely handles `ENOENT` (file not found on disk). If the physical file is already gone, the database cleanup completes successfully without blocking the administrator.

### 6. Non-Repudiation & Audit Trail Integrity
- **Risk**: Permanent deletion leaves no trace in operational tables. If a critical file is expunged, administrators must have verifiable proof of who deleted it.
- **Solution**: BEFORE executing the deletion, an unalterable audit log entry is written to `AuditLog`:
  - Action: `FILE:HARD_DELETE_BOTH`, `FILE:HARD_DELETE_STORAGE_ONLY`, or `FILE:HARD_DELETE_DATABASE_ONLY`
  - Actor User ID & Name
  - Client IP Address
  - File Name, SHA-256 Checksum, Size in Bytes, Department, and Spacecraft target
  - Timestamp of execution.

### 7. Accidental User Click Protection (UI Safeguards)
- **Risk**: A single accidental click permanently destroying a mission file.
- **Solution**:
  - Hard Delete is not accessible on active files; it is staged behind the **Trash** view.
  - Clicking "Hard Delete" displays a modal with color-coded severity badges.
  - The confirmation button remains **disabled** until the administrator explicitly checks the checkbox: *"I confirm that I understand this deletion is permanent and non-recoverable."*

---

## 5. Administrator Step-by-Step User Guide

### How to Move a File to Trash (Soft Delete)
1. Navigate to the **File Repository** (`/admin/files`) or your **Department File Browser**.
2. Locate the file you wish to delete and click the **Trash** icon.
3. Confirm the prompt: *"Move to Trash"*.
4. The file is immediately removed from all dashboards and active department catalogs.

### How to View Trashed Files
1. Navigate to **Admin Dashboard -> File Repository** (`/admin/files`).
2. In the top filter bar, click the **Trash** tab (highlighted in red).
3. The table displays all soft-deleted files along with the user who deleted them.

### How to Restore a File
1. While in the **Trash** tab, locate the desired file.
2. Click the **Restore** button (with the counter-clockwise arrow icon).
3. The file is immediately restored to its department and active status.

### How to Permanently Hard Delete a File
1. While in the **Trash** tab, locate the file.
2. Click the red **Hard Delete** button.
3. In the **Permanent Hard Delete** modal:
   - Review the target file summary (name, size, department, versions).
   - Select one of the 3 scopes:
     - 🔴 **Full Purge (Database & Storage HDD)**: Complete erasure.
     - 🟠 **Storage HDD Only**: Reclaim disk space; keep metadata for audit.
     - 🟡 **Database Record Only**: Remove database entry; keep file on disk.
   - Check the safety confirmation checkbox.
   - Click **Execute Hard Delete**.
4. The file is permanently processed, storage metrics are updated, and an audit log entry is saved.

---

## 6. Technical Verification & Build Status

- **Backend Build**: Verified with TypeScript Compiler (`npm run build`) — **0 Errors**.
- **Frontend Build**: Verified with Vite & TypeScript (`tsc -b && vite build`) — **0 Errors**.
- **Storage Metrics**: Dynamic query invalidation ensures storage widgets in the dashboard recalculate immediately upon permanent deletion.
