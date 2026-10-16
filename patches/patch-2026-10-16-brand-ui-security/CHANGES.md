# Changes since the 2026-10-09 patch

Branch `protov1`. Commits included: `e422536`, `fc8ed07`, `936c312`, `0a26e19`, `fec7657` (merged as `703065e`), plus the fixes in §1 made while verifying this patch.

## 1. Found and fixed while building this patch

| # | Problem | Impact | Fix |
|---|---|---|---|
| 1 | `GET /notifications/public` and the landing banner feed (`/events/active-banner`) returned **every file-upload notification to signed-out visitors** (uploader name, file name, division), including private files | Data exposure to anyone who opens the public site | Signed-out visitors only see upload notices for **featured** files that are not deleted and sit in an active division (`backend/src/lib/publicFiles.ts`, used by both endpoints) |
| 2 | A new custom report category "owned" every legacy file whose old category was OTHER, because the lookup fell back to OTHER for unknown codes | Admins blocked from deleting empty categories; wrong file counts | Only codes that really map to a legacy category match old rows |
| 3 | The "system categories cannot be deleted" guard was lost in the 15 Oct category rework | An admin could permanently delete General, Daily Report, etc. | Guard restored (`cannot_delete_system`, HTTP 400) |
| 4 | Hover rules turned avatar initials and numbers inside any hovered button/link white | Profile button text vanished on hover (light mode); same for phone numbers, counts | Only white-text counters on a coloured fill stay white on hover |
| 5 | Approve/Reject buttons: text turned dark on their red/green hover fill | 2.7:1 contrast on hover | New fill colours added to the white-text rules |

Kept as designed by the team (15 Oct): a category that still has files **cannot be deleted** (files are never moved silently); the error names the files.

## 2. Security and correctness (regression round, `e422536`)

- **Search:** members only see divisions they are granted; anonymous visitors see featured files in active divisions only. `dept:CODE` works. Disk paths are admin-only.
- **Chunked upload:** `chunkIndex` must be an integer 0–999 (closes a path-traversal hole).
- **Department hub:** requires access to that division (by id or code). The access cache only keeps grants, so new grants work immediately.
- **Trashed files:** their version history and downloads are admin-only. Deleting naming presets is admin-only.
- **Sessions:** suspend, force-logout, password reset and password change end live sessions immediately. Change-password keeps the current device signed in.
- **Downloads and uploads:**
  - a disk error mid-download no longer crashes the server
  - re-uploading a file whose old copy is in Trash gets a unique stored name
- **UI crash:** a React hook-order crash in the alert banner is fixed.

## 3. Data correctness (`fc8ed07`)

- **No invented placeholders:**
  - no fake "TTC"/"MOX" divisions, "DAT" types, "Flight Operator", "Primary Fleet" or fake approval reviewers
  - missing values show as "—" or "System"
- **Fixed lists replaced with real data:**
  - registration lists departments from the server only
  - the storage setup wizard lists the real folders on the disk
  - the admin file-type filter lists the extensions actually stored (new `GET /admin/files/extensions`)
  - the upload filename uses today's date instead of a fixed one
- **Real admin identity:** the root admin is whoever `ADMIN_EMAIL` names, not a hard-coded address.
- **Freshness:**
  - when an admin removes a user's division access, it takes effect immediately (Redis cache cleared)
  - the satellite detail page refreshes after an edit
- **Clean-up:** the developer-only `/demo` page and an old cloud WebSocket address are removed.

## 4. Team updates (`936c312`, `0a26e19`, `fec7657`)

- **Notifications:**
  - delivery is scoped by division and mission
  - newly cleared users receive recent division notifications
  - file-upload notices go only to cleared members, admins and the uploader (WebSocket and API)
- **Satellites:** hard delete (removes links first); updated search matching (terms under 3 characters and pure numbers are ignored).
- **Events and file service:** updates to `event.routes`, `file.service` and `user.routes`.
- **Admin and user pages reworked:**
  - approvals, audit log, departments
  - satellite manager, event manager, upload
  - users, OTP management, notifications
  - department detail and hub
- **New components:** a new hard-delete dialog, plus updated version history, PDF preview, inputs, selects and modals.

## 5. ISRO brand and new UI

- **Theme from the logo (ISRO Blue `#0D88D3`, Saffron `#F47115`), light and dark:**
  - neutral surfaces
  - **saffron primary buttons** with white text, and a soft-saffron secondary button style
  - blue for links, the current page and keyboard focus
  - green, amber and red only for status
- **Landing page:**
  - navbar
  - photo hero (CMS slides over the CMS space background)
  - overlapping stats strip
  - division cards (columns adapt to the count)
  - featured report cards on a soft-blue band
  - calendar
  - deep-blue About band
  - contact cards on a soft-saffron band
  - navy footer with a saffron rule
  - a faint graph-paper grid behind sections
- **Dashboards:**
  - one soft-blue icon style, sans labels, clean cards
  - chart colours from the brand palette (server-side)
  - CRITICAL notices now shown in red (was green)
  - "1 file" / "N files" wording
- **Shell:** the current sidebar item is blue, the clock uses the normal font, and the icon buttons are neutral.
- **Contrast:** every text pair meets WCAG AA, except white text on the saffron button (2.9:1). That colour was the product owner's choice to match the logo exactly.

## 6. Verification on the shipped build

| Check | Result |
|---|---|
| Regression suite (anonymous, member, admin; includes new public-feed leak test) | 26/26 |
| Bug-fix API suite | 18/18 |
| Upload / category end-to-end | 5/5 |
| Browser flows (login, wrong password, trash/restore, PDF preview, logout, theme) | 7/7 |
| Hover audit: every link, button and card on 21 pages, light + dark | 0 problems |
| Landing contrast audit (light/dark, desktop/phone) | All text passes except the chosen saffron button |
| Patch contents | No `.env`, source maps or `node_modules` |
| Installer on real Linux (WSL Ubuntu, from the zip) | LF line endings, bash syntax OK; on new code all checks pass and `revert-patch.sh` restores the old files exactly; on old code check 5 fails and the install rolls back automatically |

## 7. Deployment notes

- No database migration, no new dependencies, no new environment variables.
- Installer check 5 now probes `GET /api/admin/files/extensions` (401 = new code).
- After install, hard-refresh browsers once (new CSS). Upload real hero photos in the CMS.
