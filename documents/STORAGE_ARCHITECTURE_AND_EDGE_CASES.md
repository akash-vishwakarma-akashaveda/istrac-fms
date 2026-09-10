# ISTRAC-FMS Storage Architecture & Edge Case Specification

> **System:** Indian Space Research Organisation (ISRO) — ISTRAC File Management System (ISTRAC-FMS)  
> **Document Type:** Technical Architecture & Edge Case Resilience Specification  
> **Target Audience:** System Architects, Operations Engineers, Ground Station Admins  
> **Classification:** Internal Technical Documentation  
> **Version:** 1.2.0 (Production Baseline)

---

## 📑 Table of Contents

1. [Executive Summary & Storage Philosophy](#1-executive-summary--storage-philosophy)
2. [Physical Directory Hierarchy](#2-physical-directory-hierarchy)
3. [Core Services & Data Flow](#3-core-services--data-flow)
4. [Comprehensive Edge Case Matrix](#4-comprehensive-edge-case-matrix)
5. [Deep Dive: Handled Edge Cases & Mitigations](#5-deep-dive-handled-edge-cases--mitigations)
   - [5.1 Cross-Platform & Path Normalization (Windows vs. Linux)](#51-cross-platform--path-normalization-windows-vs-linux)
   - [5.2 Dynamic Storage Mount Relocation & Fall-Through Resolution](#52-dynamic-storage-mount-relocation--fall-through-resolution)
   - [5.3 Volume Migration & In-Flight Operations](#53-volume-migration--in-flight-operations)
   - [5.4 Physical Disk & Database Rollback (Compensation Pattern)](#54-physical-disk--database-rollback-compensation-pattern)
   - [5.5 Disk Full & Storage Quotas (ENOSPC Prevention)](#55-disk-full--storage-quotas-enospc-prevention)
   - [5.6 Permission Verification & Probe Testing (EACCES / EPERM)](#56-permission-verification--probe-testing-eacces--eperm)
   - [5.7 File Name Sanitization & Collision Avoidance (Versioning Engine)](#57-file-name-sanitization--collision-avoidance-versioning-engine)
   - [5.8 Database vs. Physical Disk Desynchronization (Orphans & Ghosts)](#58-database-vs-physical-disk-desynchronization-orphans--ghosts)
   - [5.9 Nested Directory Depth & Traversal Protection](#59-nested-directory-depth--traversal-protection)
   - [5.10 Operational Decommissioning & Archived Department Integrity](#510-operational-decommissioning--archived-department-integrity)
6. [Administrator Runbook: Safely Changing Storage Roots](#6-administrator-runbook-safely-changing-storage-roots)
7. [Automated Verification & Integrity Audit Commands](#7-automated-verification--integrity-audit-commands)

---

## 1. Executive Summary & Storage Philosophy

The **ISTRAC File Management System (ISTRAC-FMS)** is designed to store, manage, and distribute high-volume space mission telemetry, orbital ephemerides, payload science data, and daily operational pass reports. Because ISTRAC operates continuous 24/7 ground station tracking, the storage subsystem must satisfy four core architectural principles:

1. **Storage Decoupling & Portability**: Physical disk paths must never be hardcoded or strictly coupled to database identifiers. If an underlying RAID volume, SAN, or NAS mount point changes (e.g., migrating from a Windows development workstation `C:\istrac_storage` to a production Red Hat Enterprise Linux RAID mount `/mnt/istrac_storage`), the system must continue to function without data loss or 404 download errors.
2. **Zero Ingest Interruption**: Telemetry file ingestion from tracking antennas must proceed reliably even during storage configuration updates or storage volume migrations.
3. **Cryptographic & Physical Integrity**: Every file written to physical storage is verified with SHA-256 cryptographic hashing, magic-byte format validation, and atomic filesystem operations.
4. **Resilient Self-Healing**: Discrepancies between physical disk contents and MySQL/MariaDB database catalogs are automatically reconciled through dynamic path resolution and background synchronization.

---

## 2. Physical Directory Hierarchy

All telemetry files, pass reports, and mission documents are organized on physical disk strictly by division and spacecraft/category hierarchy:

```
<PrimaryStorageRoot> (e.g., C:\istrac_storage or /mnt/istrac_storage)
├── .chunks/                               # Temporary chunk staging area for multi-part large uploads
├── .trash/                                # Soft-deleted file quarantine area before permanent purging
├── FDD/                                   # Flight Dynamics Division
│   ├── ADITYA-L1/
│   │   └── ADITYA_L1_HALO_ORBIT_EPHEMERIS_V4.dat
│   ├── CHANDRAYAAN-3/
│   │   └── FDD_LUNAR_TRAJECTORY_MANEUVER_PLAN.pdf
│   └── NISAR/
│       └── NISAR_ORBIT_REVISIT_PRECISION_ANALYSIS.csv
├── GSO/                                   # Ground Station Operations
│   ├── General/
│   │   └── GENERAL_DAILYOPS_20260903_V1.0_samplelocalpdf.pdf
│   └── PSLV-C59/
│       └── PSLV_C59_PS4_TELEMETRY_DUMP.csv
├── MOX/                                   # Mission Operations Complex
│   ├── ADITYA-L1/
│   │   └── ADITYA_L1_SOLAR_WIND_PLASMA_INGEST.csv
│   ├── CHANDRAYAAN-3/
│   │   └── CH3_PROPULSION_MODULE_COMM_RELAY.json
│   └── GAGANYAAN-1/
│       └── GAGANYAAN_CREW_MODULE_TTC_SIM_2026.pdf
├── NETRA/                                 # Space Situational Awareness & Management
│   ├── GAGANYAAN-1/
│   │   └── NETRA_GAGANYAAN_CORRIDOR_DEBRIS_SCAN.csv
│   └── GENERAL/
│       └── IS4OM_CONJUNCTION_ASSESSMENT_Q3_2026.pdf
└── TTC/                                   # Telemetry, Tracking & Command
    ├── CARTOSAT-3/
    │   └── CARTOSAT3_SBAND_PASS_20260825.bin
    ├── NISAR/
    │   └── NISAR_SAR_L_BAND_RADAR_INGEST.bin
    └── XPOSAT/
        └── XPOSAT_POLIX_SCIENCE_TELEMETRY.json
```

---

## 3. Core Services & Data Flow

| Service Component | Primary Responsibility | Key Files |
| :--- | :--- | :--- |
| **`file.service.ts`** | Upload handling, file naming sanitization, version generation, and transactional DB commit with compensation rollback. | `backend/src/services/file.service.ts` |
| **`hdd.service.ts`** | Physical file I/O, path traversal prevention, magic-byte validation, atomic file streaming, and dynamic path resolution. | `backend/src/services/hdd.service.ts` |
| **`driveDetector.service.ts`** | Host volume inspection, storage redundancy failover settings, and online recursive volume migration. | `backend/src/services/driveDetector.service.ts` |
| **`hddSync.service.ts`** | Background reconciliation between physical disk files and database records (identifying orphans and external files). | `backend/src/services/hddSync.service.ts` |
| **`department.routes.ts`** | Department directory management, active mount inheritance, and division lifecycle control. | `backend/src/routes/department.routes.ts` |

---

## 4. Comprehensive Edge Case Matrix

| ID | Edge Case Category | Operational Trigger | Potential Impact | System Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| **EC-01** | Cross-Platform Portability | Database exported from Windows host (`C:\...`) to Linux RHEL server (`/mnt/...`). | Linux cannot resolve drive letters; downloads return 404. | Dynamic `resolvePhysicalPath` strips drive letters and re-anchors paths to host mount targets. |
| **EC-02** | Path Slashes & Formatting | User enters `C:/istrac_storage/`, `C:\istrac_storage\`, or trailing slashes in settings. | Double slashes (`\\` or `//`), string matching failures. | `path.normalize()` and regex stripping of trailing delimiters on all ingest and migration endpoints. |
| **EC-03** | Linux Case-Sensitivity | Department created as `GSO`, but folder on Linux disk exists as `gso`. | Linux ext4/xfs throws `ENOENT` (Case-Sensitive Mismatch). | Multi-candidate search testing original casing and lowercase normalization (`path.resolve(root, sub.toLowerCase())`). |
| **EC-04** | Drive Letter Reassignment | External RAID / SAN drive reassigned from `D:\` to `E:\` upon Windows reboot. | All file pointers in DB point to unmounted drive letter. | Multi-mount fallback scanning scans alternative host volumes automatically before failing. |
| **EC-05** | Storage Migration Interruption | 50 GB data migration interrupted midway due to network drop or power cycle. | Split-brain storage; files partially on old drive, partially on new drive. | Non-destructive copy (`copyDirectoryRecursively`) keeps source intact; fallback resolution serves from both volumes during transition. |
| **EC-06** | In-Flight Uploads During Migration | User uploads a new file while administrator is running a drive migration. | New file written to obsolete drive or overwritten during transfer. | Ingest reads current `STORAGE_PRIMARY_PATH` atomically; new files write directly to target volume. |
| **EC-07** | Database Transaction Failure | Physical file written to disk, but database crashes or foreign key fails. | Orphaned "ghost" file wastes physical disk space. | **Compensation Rollback**: Catch block immediately triggers `hddService.deleteFile` to remove the physical file. |
| **EC-08** | Physical Disk Full (`ENOSPC`) | User uploads 2 GB dataset, but the drive only has 200 MB remaining space. | Corrupted half-written file, incomplete DB record. | Physical streaming fails first; DB transaction is never reached, preventing corrupted catalog records. |
| **EC-09** | Read-Only / Permission Denial | Target directory is root-owned or read-only (`EACCES` / `EPERM`). | Silent upload failures during operational tracking passes. | Ingest verification probe (`.probe_write_test`) verifies physical write/read/unlink permissions before accepting paths. |
| **EC-10** | Filename & Spacecraft Collisions | User uploads `REPORT.pdf` to a folder where `REPORT.pdf` already exists. | Overwriting mission critical historical data. | Automatic Versioning: Previous file remains untouched; new file stored as `.v2_REPORT.pdf` with incremented version counter. |
| **EC-11** | Unsafe Characters & Spaces | Spacecraft name contains spaces (`Aditya-L1 Solar Obs`) or symbols (`#`, `@`, `%`). | Corrupted shell scripts, broken HTTP download URLs. | Strict sanitization: Characters outside `[a-zA-Z0-9._-]` converted to underscores `_` across all directory tiers. |
| **EC-12** | Direct File Drops on Disk | Engineer drops a 10 GB dump directly via SCP/FTP without using the web UI. | File exists on disk but is invisible in the web repository. | Background HDD Sync (`runHddSync`) scans disk, maps files to department directories, and auto-catalogs records. |
| **EC-13** | Manual File Deletions on Disk | Sysadmin deletes a file directly from disk via bash/PowerShell. | Clicking download in portal yields unexpected server crash. | Stream handler safely traps `ENOENT`, audits the missing file, and marks the database record as `ORPHANED`. |
| **EC-14** | Deep Folder Nesting | User creates 10 levels of nested subdirectories. | Windows path length limit (`MAX_PATH` 260 chars) exceeded. | Department policy enforces `maxFolderDepth` (default: 5), guarding directory hierarchy depth. |
| **EC-15** | Archived Department Migration | Division is decommissioned, then storage mount is changed. | Archived department files are missed during migration. | Migration engine updates all departments (`where: { deletedAt: null }`), ensuring archived division files move with active ones. |

---

## 5. Deep Dive: Handled Edge Cases & Mitigations

### 5.1 Cross-Platform & Path Normalization (Windows vs. Linux)
* **Problem**: In heterogeneous environments, developers develop on Windows (e.g., `C:\istrac_storage\GSO`), test on Docker (`/mnt/istrac_storage/GSO`), and deploy to RHEL bare metal servers (`/data/istrac_storage/GSO`). Hardcoded path strings cause instant breakage.
* **Implementation**:
  ```ts
  // backend/src/services/hdd.service.ts
  const norm = filePath.replace(/\\/g, '/')
  const candidateRoots = [
    MOUNT_ROOT,
    'C:/istrac_storage',
    'D:/istrac_storage',
    path.resolve('./storage'),
    '/mnt/istrac_storage',
  ]
  ```
  Path delimiters are normalized prior to evaluation. When comparing directories, POSIX slashes (`/`) and Windows backslashes (`\`) are normalized using `path.normalize()`.

### 5.2 Dynamic Storage Mount Relocation & Fall-Through Resolution
* **Problem**: When a drive is moved or re-mounted, historical database records continue to store the absolute path where the file was originally ingested.
* **Implementation**:
  Before throwing a `404 Not Found`, `hddService.resolvePhysicalPath()` executes a 3-step fall-through algorithm:
  1. **Direct Access Check**: Checks if the stored path exists directly.
  2. **Relative Subpath Extraction**: Strips known old mount prefixes and extracts the departmental relative path:
     ```ts
     let relSubpath = ''
     for (const known of candidateRoots) {
       const normKnown = known.replace(/\\/g, '/').replace(/\/+$/, '')
       if (norm.toLowerCase().startsWith(normKnown.toLowerCase())) {
         relSubpath = norm.slice(normKnown.length).replace(/^\/+/, '')
         break
       }
     }
     ```
  3. **Multi-Root Probe**: Checks the relative path against all candidate mounts (Active Primary, Secondary, `HDD_MOUNT_PATH`, and `./storage`). The download streams seamlessly regardless of where the file was originally saved.

### 5.3 Volume Migration & In-Flight Operations
* **Problem**: Migrating tens of gigabytes between physical drives takes time. During this period, incoming telemetry uploads must not be dropped.
* **Implementation**:
  * **Non-Destructive Copying**: `copyDirectoryRecursively()` copies files to the new volume without deleting the source volume until the administrator verifies the migration.
  * **Atomic Path Updates**: Once copy operations conclude, a single database update updates `File.hddPath`, `FileVersion.hddPath`, and `Department.hddPath` records.
  * **Zero Ingest Collision**: New uploads immediately reference `STORAGE_PRIMARY_PATH` from `SystemConfig`, ensuring new files are directed to the destination drive while historical files are copied.

### 5.4 Physical Disk & Database Rollback (Compensation Pattern)
* **Problem**: A file write consists of two actions: writing bytes to disk, and creating a database transaction. If the database fails (deadlock, connection timeout, duplicate constraint), a stranded file remains on disk forever.
* **Implementation**:
  ```ts
  // backend/src/services/file.service.ts
  try {
    // 1. Write file to disk
    await hddService.writeFile(versionedPath, params.fileBuffer!)
    // 2. Database transaction
    await prisma.$transaction(async (tx) => { ... })
  } catch (dbErr) {
    // COMPENSATION PATTERN: Delete physical file if database transaction fails
    await hddService.deleteFile(versionedPath)
    throw dbErr
  }
  ```

### 5.5 Disk Full & Storage Quotas (ENOSPC Prevention)
* **Problem**: Out-of-disk conditions during a telemetry pass cause partial file writes, leaving corrupted datasets on disk.
* **Implementation**:
  * The physical stream write occurs *before* database records are inserted. If Node.js throws `ENOSPC`, the stream closes with an error, the compensation pattern cleans up the partial `.tmp` file, and no corrupted row is created in MySQL.
  * `driveDetectorService` monitors drive capacity and triggers UI warnings when disk usage exceeds `STORAGE_WARN_THRESHOLD_PERCENT` (default: 85%).

### 5.6 Permission Verification & Probe Testing (EACCES / EPERM)
* **Problem**: An administrator may enter a valid-looking path that the `node` process does not have permission to write to.
* **Implementation**:
  `hddService.initializeMount()` executes a probe test before confirming a storage mount:
  ```ts
  const probeFile = path.join(targetRoot, '.probe_write_test')
  await fs.writeFile(probeFile, 'ISTRAC_STORAGE_PROBE_OK')
  const readContent = await fs.readFile(probeFile, 'utf8')
  await fs.unlink(probeFile)
  ```
  If permission is denied (`EACCES`), an actionable error is returned, preventing runtime ingest failures.

### 5.7 File Name Sanitization & Collision Avoidance (Versioning Engine)
* **Problem**: Spacecraft engineers may upload files with spaces, brackets, or conflicting file names across passes.
* **Implementation**:
  * **Sanitization**: Filenames are sanitized via regex:
    ```ts
    const sanitizedFilename = params.originalName.replace(/[^a-zA-Z0-9._-]/g, '_')
    ```
  * **Automatic Versioning**: If `destPath` already exists, `file.service.ts` detects the active record, computes the next version number, and stores the physical file as `.v{N}_{sanitizedFilename}` while linking it to the file's historical version tree.

### 5.8 Database vs. Physical Disk Desynchronization (Orphans & Ghosts)
* **Problem**: Files can be deleted or added outside the application (via SSH, backup restores, or drive maintenance).
* **Implementation**:
  * **Orphan Detection**: When a user requests a file that has been physically removed from disk, `streamFile` throws an audited `404` error and flags the record for maintenance.
  * **Automatic Cataloging**: `hddSync.service.ts` periodically walks the active mount root, detects untracked files, maps them to their respective department folders, and provisions database records automatically.

### 5.9 Nested Directory Depth & Traversal Protection
* **Problem**: Directory traversal attacks (`../../etc/passwd`) or excessively deep directory trees that crash the filesystem.
* **Implementation**:
  * **Traversal Guard**: `guardPath()` checks all target paths and rejects any relative traversal symbols (`..`):
    ```ts
    guardPath(targetPath: string): string {
      const resolved = path.resolve(targetPath)
      if (targetPath.includes('..')) {
        throw new AppError('path_traversal', 'Invalid storage path access attempt', 400)
      }
      return resolved
    }
    ```
  * **Depth Limiting**: The department configuration enforces `maxFolderDepth` (default: 5) to keep filesystem hierarchies manageable and within OS limits.

### 5.10 Operational Decommissioning & Archived Department Integrity
* **Problem**: When a division or mission is decommissioned (archived), its files must remain 100% accessible to administrators for audits, but protected from modifications by regular members.
* **Implementation**:
  * Archiving sets `isActive: false` on the department.
  * Member download routes, dropzones, and search queries block non-admin access.
  * Physical datasets remain preserved on disk.
  * When storage migration runs, archived department storage paths are migrated along with active ones.

---

## 6. Administrator Runbook: Safely Changing Storage Roots

Follow this step-by-step runbook when relocating or switching storage volumes:

### Option A: Using the Web Portal (Recommended)
1. Log in to the ISTRAC-FMS Portal as an **Administrator**.
2. Navigate to **System Configuration** (`/admin/system`).
3. Under **Storage Mount & Redundancy Failover Architecture**:
   * Inspect the detected host drives list.
   * Enter the new target path in **Primary Storage Mount Root Path** (e.g., `D:\istrac_storage` or `/mnt/istrac_storage`).
4. Click **SYNC & VERIFY DIRECTORIES** to run the write permission probe and auto-create standard departmental folders (`/TTC`, `/FDD`, `/MOX`, `/NETRA`, `/GSO`, `/.chunks`, `/.trash`).
5. Click **SAVE ARCHITECTURE** to commit the new primary mount.
6. If moving datasets to a new drive, use the **Migrate Storage Volume** dialog and select **"Copy Existing Data"**.

### Option B: Manual File Migration via CLI
If migrating high-volume multi-terabyte datasets directly via CLI:
```bash
# On Linux (RHEL / CentOS / Ubuntu)
sudo rsync -avzh --progress /mnt/old_storage/ /mnt/new_storage/
sudo chown -R istrac:istrac /mnt/new_storage/
sudo chmod -R 775 /mnt/new_storage/

# On Windows Server (PowerShell / CMD)
robocopy C:\istrac_storage D:\istrac_storage /E /COPYALL /R:2 /W:5
```
After copying files, update the Primary Storage Mount Root Path in the web portal. The dynamic path resolver will immediately serve files from the new location.

---

## 7. Automated Verification & Integrity Audit Commands

Run these backend commands to verify physical disk integrity, check for missing files, and confirm path alignment:

```bash
# 1. Verify 100% of database files exist on physical disk
node -e "import('./dist/src/config/db.js').then(async ({ prisma }) => {
  const fs = await import('node:fs/promises');
  const files = await prisma.file.findMany({
    where: { deletedAt: null, nodeType: 'FILE' },
    select: { name: true, hddPath: true }
  });
  let verified = 0, missing = 0;
  for (const f of files) {
    try {
      await fs.stat(f.hddPath);
      verified++;
    } catch {
      missing++;
      console.error('MISSING:', f.name, f.hddPath);
    }
  }
  console.log('Result: ' + verified + ' verified on disk, ' + missing + ' missing.');
  process.exit(0);
})"

# 2. Check department storage root alignment with SystemConfig
node -e "import('./dist/src/config/db.js').then(async ({ prisma }) => {
  const cfg = await prisma.systemConfig.findFirst({ where: { configKey: 'STORAGE_PRIMARY_PATH' } });
  const depts = await prisma.department.findMany({ select: { name: true, hddPath: true } });
  console.log('Active Primary Root:', cfg?.configValue);
  depts.forEach(d => console.log(' ', d.name, '->', d.hddPath));
  process.exit(0);
})"
```

---
*ISTRAC File Management System — Storage Architecture & Edge Case Specification v1.2.0*
