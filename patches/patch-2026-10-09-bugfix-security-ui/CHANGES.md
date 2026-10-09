# ISTRAC-SIMS — Bug Fix Report (BUG-01 to BUG-17)

**Date:** 2026-10-06 · **Branch:** `protov1` (changes are uncommitted in the working tree)
**Verified against:** local MySQL + backend (`tsx`, port 3100, Redis offline → in-memory fallbacks) + Vite dev server, Chrome (headless) at desktop 1440px, tablet 820px and mobile 390px, in both themes.

---

## 1. Summary

All 17 items are fixed and verified. Three of them shared **one root cause**:

> `toastStore.addToast()` called `crypto.randomUUID()`. Browsers only provide that API on **HTTPS or localhost**. The intranet deployment is served over **plain HTTP**, so every toast threw an exception in production, and whatever code ran after the toast was skipped.

| Symptom on the HTTP server | What actually happened |
|---|---|
| **BUG-03**: "error shown but user is logged in" | `setAuth()` ran, then the success toast threw, and the `catch` block showed "An unexpected error occurred. Please try again." |
| **BUG-04**: "file deleted but no toast, dialog stays open" | `DELETE /files/:id` succeeded, then the toast threw, so `setDeletingFile(null)` never ran |
| **BUG-07**: "toasts work in development, not in production" | Dev runs on `localhost` (a secure context); production does not |

The same issue affected `navigator.clipboard` (copy buttons) and `useFileUpload` (`randomUUID` for queue item ids). All of these now go through `frontend/src/lib/browserCompat.ts`, which falls back safely.

---

## 2. Per-bug details

### BUG-01: Theme toggle and colour contrast
- **Root cause:** No theme toggle existed; the app was dark-only. In dark mode, "dim" text measured **2.4–2.7:1** and "muted" text **3.8–4.2:1**, both below the WCAG AA minimum of 4.5:1 for normal text. Input borders were 1.4:1, below the 3:1 required for form-control edges.
- **Fix:**
  - **Dark contrast:** text tokens raised to secondary `#a7b4c6`, muted `#93a1b6` and dim `#8391a7`, now **5.6–9.6:1**. The accent is now `#2563eb`, so white button text reaches **5.2:1**. Form controls use the brighter border (**3.2:1**), and focus rings are visible.
  - **Light theme:** a full light token set (all text tokens ≥5.1:1). Older screens hardcode colours such as `bg-[#060c18]`, `text-white` and `amber-400` text, about 2,100 occurrences in total. A scoped CSS layer remaps those instead of rewriting every component.
  - **Dark islands:** space imagery (the hero and the parallax background) stays dark in both themes via `data-theme="dark"` sections.
  - **Toggle:** a sun/moon button in the app top bar and the public navbar, on desktop and mobile. The choice is saved, and an inline script in `index.html` applies it before first paint, so there's no flash of the wrong theme.
  - **Pre-existing bug found during QA:** the custom `.readout` CSS class overrode Tailwind's `hidden`, so top-bar readouts overlapped on phones. Fixed by moving `.readout` into the components layer.
- **Verified:**
  - Screenshots of the landing, departments, admin dashboard, file repository, events, broadcast, audit, search, satellites and notifications pages, in both themes, at desktop and mobile widths.
  - The toggle switches the theme and the choice persists after a page reload (automated check).

### BUG-02: Meaningful error messages
- **Root cause:**
  - The login form showed a fallback message whenever the error path threw (see the shared root cause above).
  - The backend returned raw Zod messages, e.g. `password: Too small: expected string to have >=10 characters`.
  - The login endpoint enforced password *complexity* on sign-in.
  - Generic `Resource already exists` / `Database query failed` messages.
- **Fix:**
  - Login returns **"No account found with this email address. Check the spelling, or register to request access."** for an unknown email. Wrong passwords get **"Incorrect password. Try again, or use 'Forgot password' to reset it."** Pending, suspended and rejected accounts each get a message that says what to do next.
  - Validation errors are rewritten as readable sentences, e.g. *"Email must be a valid email address"*, *"Name must be at least 2 characters"*.
  - Database errors map to readable messages: duplicate value, item no longer exists, item still in use (FK).
  - In production, server errors never include internal details.
  - `api/client.ts` now guarantees every failed request carries a readable message: network down, timeout, 403, 404, 413, 429, 5xx. All ~40 existing `err.response.data.error.message` call sites benefit automatically. New helper: `getErrorMessage(err, fallback)`.
- **Decision to note:** Showing different messages for "no account" and "wrong password" reveals whether an email is registered (account enumeration). This was explicitly requested, and `/register` already reveals the same thing. If the security team objects, revert the two messages in `auth.routes.ts`.
- **Verified:** API checks for unknown email, wrong password and malformed input; a browser check that the modal shows the new message.

### BUG-03: Failed login leaves the user logged in
- **Root cause:**
  1. The shared toast crash described in section 1.
  2. A failed login never cleared stale or partial session state.
  3. Logout revoked only a cookie-borne refresh token. The SPA stores its refresh token and sends it in the body/header, so it stayed valid.
  4. The access-token blacklist wrote straight to Redis; with Redis down, logout did not revoke the access token.
  5. The refresh endpoint's 30-second "grace window" (meant for multi-tab races) also accepted a token that had just been logged out.
- **Fix:**
  - The login handler only stores a session after a complete response. Any failure calls `clearAuth()`. Toasts and navigation run *after* the try/catch, so a UI hiccup can't be reported as a failed login.
  - Logout revokes the refresh token from cookie, body or header, **expires** it so the grace window no longer applies, and blacklists the access token through `sessionStore`, which has an in-memory fallback.
- **Verified:**
  - API: after logout, `/auth/me` returns 401 and `/auth/refresh` returns 401.
  - Browser, with `crypto.randomUUID` removed to simulate HTTP: unknown email and wrong password both leave no session; a successful login shows no error.

### BUG-04: Delete file → Trash
- **Root cause:** The shared toast crash. There was also no way to see or restore Trash anywhere in the UI, and the department file browser said "permanently removed" and offered delete to non-admins, whom the API rejects.
- **Fix:**
  - **Admin File Repository:**
    - Explicit dialog: **"Move file to Trash?"** explains that nothing is erased and how to restore.
    - The dialog always closes, and a toast reports the outcome.
    - The row disappears immediately.
    - New **Active files / Trash** toggle (`GET /admin/files?trash=true`) with a **Restore** button.
  - **Department file browser:** "Move to Trash" wording, admin-only, and partial failures are reported (e.g. "3 of 4 moved").
- **Verified:** API delete → listed in Trash → hidden from active list → restore. Browser: dialog closes, "Moved to Trash" toast appears, Trash view shows the file, Restore works.

### BUG-05: PDF does not render in some browsers (Chrome 110)
- **Root cause:** `pdfjs-dist` 6.x (modern build) calls `URL.parse`, `Promise.try`, `Map#getOrInsert`, `Math.sumPrecise` and `Uint8Array.fromBase64`. Chrome 110 has none of these. They are used inside the PDF **worker**, where the existing page-level polyfills (`Iterator`, `withResolvers`, `groupBy`) don't reach.
- **Fix:** Switched to pdf.js's official **legacy build** (`pdfjs-dist/legacy/build/…`). It bundles core-js polyfills in both the main thread and the worker. The hand-written polyfill prefix was removed.
- **Verified:**
  - The production bundle's worker contains core-js polyfills, including the `URL.parse` polyfill.
  - A real PDF uploaded through the API renders in the preview (automated check, current Chrome).
- **Still to confirm on site:** a check on an actual Chrome 110 machine. I could not run Chrome 110 here.

### BUG-06: Deleting a custom category
- **Root cause:**
  - The confirmation dialog didn't say what happens to files.
  - **Any signed-in user** could delete categories.
  - Files under a deleted category kept a code that no filter listed, so they became unfindable.
- **Fix:**
  - The category list now returns `usageCount`.
  - The dialog states *"used by N file(s); deleting moves them to General; files are not deleted"*, or "not used by any files".
  - Delete is admin-only. In one transaction it moves affected reports to **General**, deletes the category, and writes an audit entry.
  - The list refreshes immediately, including all file lists.
- **Verified:** Empty category, and a category with a real uploaded file (usage 1 → "1 file(s) moved to General" → file listed under General and still accessible). Built-in categories can't be deleted (400).

### BUG-08: Custom categories missing from filters
- **Root cause:**
  - Every filter dropdown was a **hardcoded list**, and some values matched nothing, e.g. `ORBIT_MANEUVER` and `ANOMALY_REPORT` in Admin Files.
  - Uploads store the chosen code in `Report.customCategory`, but filters queried the legacy `Report.category` enum. A custom code made `/search` throw (invalid enum).
  - The enum mapping was also wrong: `SPECOPS` and `PAYLOADOPS` mapped to `DAILY_REPORT`.
- **Fix:**
  - **Server:** one helper (`backend/src/lib/reportCategory.ts`) handles every category filter and display: by code for new rows, by enum for legacy rows. Applied to admin files, search, department, browse and user-home endpoints.
  - **Client:** a `CategoryOptions` component builds every category filter from the live presets (Admin Files, Search, User Home, department file browser).
  - Upload/edit store a normalized code.
  - User-home category charts show preset names.
- **Verified:** Create a custom category, upload a file with it, filter returns the file; legacy codes still filter; no 500 on search.

### BUG-09: Date filter options
- **Root cause:** Only "Today / 7 / 30 days", and "Today" meant the *last 24 hours*, not since midnight.
- **Fix:**
  - A shared `DateRangeFilter` component offers Any date, Today, Yesterday, Last 7/30/90 days, This month, This year, and **Custom range** (From/To, both inclusive, local time).
  - "From after To" is rejected with an inline message.
  - It replaces the old filter in Admin Files (server-side filtering) and the department file browser (client-side).
- **Verified:** A future start date returns 0 results; a wide range returns everything. Range logic is covered by `lib/dateRange.ts`.

### BUG-10: Future events / status
- **Root cause:** Status was stored once and only moved forward by the cron worker. Editing an event's dates never recalculated it, so a TIMED_OUT event moved into the future stayed in "Past". The edit form also re-sent the stale status. The user events page loaded once and never refreshed.
- **Fix:**
  - `backend/src/lib/eventStatus.ts` derives the status from start/end times; only CANCELLED and COMPLETED are manual.
  - It is applied on every read (list, single event, banner) and on create/update.
  - The worker job persists changes in both directions.
  - The API rejects an end time before the start time.
  - The user events page refreshes every 60 seconds and when the tab regains focus.
- **Verified:**
  - Self-check `npx tsx src/lib/eventStatus.check.ts` covers rescheduling, live, timed-out, the boundaries and the manual states.
  - API: create a past event (TIMED_OUT) → move it to the future → UPCOMING, and listed under `?status=UPCOMING`.

### BUG-11: Notification classification
- **Root cause:** No single classification existed; the UI guessed the tab from `type`, `category` and even message text. The public navbar and announcement bar labelled every banner item, including file uploads and event notices, as category `BROADCAST`. Admin broadcast history also listed event notices (`PASS`/`CRITICAL`). Critical broadcasts did *not* appear under Broadcasts.
- **Fix:**
  - Every notification now carries a server-computed **`kind`** (`broadcast` | `event` | `file` | `account` | `system`) from `backend/src/lib/notificationKind.ts`.
  - Only admin-composed broadcasts are `broadcast`; file uploads are `file`; event create, update, cancel and delete are `event`.
  - The notifications page, notifications modal, navbar, announcement bar and admin broadcast history all filter on `kind`.
- **Verified:** A broadcast is `kind=broadcast`; event and file notices are `event`/`file`; the broadcast history contains broadcasts only.

### BUG-12: Custom categories for broadcasts
- **Fix:**
  - Broadcast categories are stored like event categories (a SystemConfig JSON list; defaults General, Operations, Maintenance).
  - Admins add and remove them from the composer.
  - The chosen category is stored with the broadcast (`metadata.label`) and shown as a badge.
  - Users can filter the Broadcasts tab by category, and admins can filter the history.
  - Priority (urgency) stays separate from category.
- **Verified:** Category add, duplicate rejected (409), delete; a broadcast sent with a label arrives with `label` set.

### BUG-13: Revoke a broadcast
- **Fix:**
  - New `DELETE /admin/notifications/broadcasts/:id` removes the broadcast from **every recipient**: one row per user, matched by sender, message, type and send time. It is audited.
  - The UI has a **Revoke** button with confirmation and updates the list immediately.
  - On failure the list is left unchanged and the error is shown.
  - Clients refresh on any unread-count change and every 60 seconds.
- **Verified:** Revoke removes the broadcast from the admin's feed; a second revoke returns a clear 404/409.

### BUG-14: Meaningful audit logs
- **Root cause:**
  - Rows showed raw codes (`POST:/files/upload`) and truncated user ids.
  - The HTTP middleware wrote a second generic row for actions the services already audit, plus a row every time someone marked a notification read.
  - Old and new values could include sensitive fields.
- **Fix:**
  - `backend/src/lib/auditPresenter.ts` turns each row into a sentence, e.g. *"Super Admin uploaded “EOS08_DAILY.pdf” to GSO"* or *"Failed sign-in for x@y (wrong password)"*.
  - Each row gets the actor's name, email and role, the target's name, and short details (file, department, size, IP, browser).
  - It **strips** passwords, hashes, tokens and OTPs.
  - Duplicate and noise rows are no longer written.
  - Upload, delete and restore now record the file name.
  - The viewer labels times as local time; it previously claimed "UTC" while showing local time.
- **Verified:** Every entry has a summary; no secret keys appear in the output; the upload summary matches the uploaded file name.

### BUG-15: Table view for card lists
- **Fix:** A reusable **Cards / Table** toggle (the choice is remembered per page) using the existing `Table` component, now on:
  - the public **Departments** list
  - **Satellites & Missions**
  - **Events & Calendar** (admin)
  - **Department Manager**

  Tables keep the same actions (edit, deactivate, restore, delete) and allow long text to wrap.
- **Verified:** Screenshot of the satellites table in the light theme.

### BUG-16: Logout redirected to the login popup
- **Root cause:**
  1. Both logout handlers called `navigate('/login')`.
  2. Fixing that alone was not enough. React Router 7 runs navigation as a transition, so clearing the session re-rendered the still-mounted admin route guard, which redirected to `/login`.
  3. Revoking tokens before clearing the local session let background polls hit 401 and trigger the "session expired" redirect.
- **Fix:**
  - Logout clears the local session first, then revokes on the server, with the tokens passed explicitly.
  - It navigates to **`/`** (the landing page) and shows "You have been signed out."
  - The store records `signedOutByUser`, so the route guards send that case to `/` instead of the login popup.
  - Idle-timeout and expired-session flows still go to the login page, which is intended.
- **Verified:** Browser: sign out → landing page, no popup, no session.

### BUG-17: Help for inputs
- **Fix:**
  - A `HelpTip` (?) button next to the search inputs on: Departments list, Department page, Department hub, the repository file browser, Admin Files and Search.
  - **Signed-in users** get full guidance: what the search matches, partial and case-insensitive matching, how filters combine, how the custom date range works, where Trash is.
  - **Visitors** get a short version that doesn't describe internal data and points them to sign in.
  - The help is keyboard-accessible and closes with Esc or a click outside.
- **Note:** `lib/searchOperators.ts` (`key:value` syntax) exists but nothing uses it, so the help does not advertise operators.

---

## 3. Files changed

**New (backend):**
- `src/lib/reportCategory.ts`
- `src/lib/eventStatus.ts`
- `src/lib/eventStatus.check.ts`
- `src/lib/notificationKind.ts`
- `src/lib/auditPresenter.ts`

**New (frontend):**
- `src/lib/browserCompat.ts`
- `src/lib/dateRange.ts`
- `src/lib/notificationKind.ts`
- `src/store/themeStore.ts`
- `src/components/CategoryOptions.tsx`
- `src/components/DateRangeFilter.tsx`
- `src/components/HelpTip.tsx`
- `src/components/ThemeToggle.tsx`
- `src/components/ViewToggle.tsx`

**New (QA):**
- `scripts/qa/bugfix-api-check.mjs`
- `scripts/qa/bugfix-upload-check.mjs`
- `scripts/qa/bugfix-ui-check.mjs`

**Modified (backend `src/`):**
- `lib/errors.ts`, `lib/schema.ts`, `lib/validate.ts`
- `middleware/audit.middleware.ts`
- `jobs/mission-event-status.job.ts`
- `routes/admin.routes.ts`, `routes/auth.routes.ts`, `routes/browse.routes.ts`, `routes/department.routes.ts`, `routes/event.routes.ts`, `routes/file.routes.ts`, `routes/notification.routes.ts`, `routes/reportPreset.routes.ts`, `routes/user.routes.ts`
- `services/file.service.ts`, `services/search.service.ts`

**Modified (frontend):**
- `index.html`, `schemas/authSchemas.ts`, `src/index.css`
- **api/:** `client.ts`, `auth.api.ts`, `admin.api.ts`, `events.api.ts`, `notifications.api.ts`, `reportPresets.api.ts`
- **store/:** `authStore.ts`, `toastStore.ts`
- **routes/:** `ProtectedRoute.tsx`, `AdminRoute.tsx`
- **hooks/:** `useBroadcast.ts`, `useDeptFiles.ts`, `useFileUpload.ts`, `useLiveNotificationSync.ts`, `useNotifications.ts`, `useReportPresets.ts`, `useSystemConfig.ts`
- **components/:** `AnnouncementBar.tsx`, `AuditFeed.tsx`, `AuthModal.tsx`, `BulkActionBar.tsx`, `FileBrowser.tsx`, `FilePreviewModal.tsx`, `Hero.tsx`, `Navbar.tsx`, `NotificationsModal.tsx`, `SpaceParallaxBackground.tsx`, `Table.tsx`, `preview/PdfPreview.tsx`
- **layouts/:** `Topbar.tsx`
- **pages/:** `AdminFileManager.tsx`, `AdminOtpManagement.tsx`, `AuditLogViewer.tsx`, `BroadcastNotification.tsx`, `DepartmentDetail.tsx`, `DepartmentHub.tsx`, `DepartmentManager.tsx`, `DepartmentsList.tsx`, `EventManager.tsx`, `NotificationsPage.tsx`, `SatelliteManager.tsx`, `SearchPage.tsx`, `SystemConfigPanel.tsx`, `UploadReport.tsx`, `UserEvents.tsx`, `UserHome.tsx`

No database migration is needed: new data uses existing columns (`Report.customCategory`, `Notification.metadata`, `SystemConfig`).

*Not part of this work:* these files already had uncommitted changes before this work started and were not touched for these bugs:
- `backend/package.json`, `prisma/schema.prisma`, `health.routes.ts`, `scheduler.routes.ts`
- `frontend/src/main.tsx`, `UserProfileModal.tsx`, `cms-editor/HeroTab.tsx`, `context/cmsContext.tsx`, `types/cms.ts`

---

## 4. Tests performed

| Check | Result |
|---|---|
| Backend `tsc --noEmit`, `npm run build` | ✅ clean |
| Frontend `tsc -b`, `npm run build` (incl. legacy bundle) | ✅ clean |
| `npx tsx src/lib/eventStatus.check.ts` | ✅ 8/8 |
| `scripts/qa/bugfix-api-check.mjs` (BUG-02/03/04/06/08/09/10/11/12/13/14) | ✅ 15/15 |
| `scripts/qa/bugfix-upload-check.mjs` (real PDF upload → custom category → filter → delete category → audit) | ✅ 5/5 |
| `scripts/qa/bugfix-ui-check.mjs` (Chrome, `crypto.randomUUID` & clipboard removed to mimic HTTP) | ✅ 7/7 (BUG-01/02/03/04/05/07/16) |
| Visual QA screenshots: 10+ pages, dark & light, desktop/tablet/mobile | ✅ reviewed |
| ESLint on new files | ✅ (2 dev-only `react-refresh` notices, same pattern as existing code) |

## 5. Remaining known issues / follow-ups

1. **Chrome 110 on a real machine:** not available here. The fix uses pdf.js's supported legacy build, and the polyfills are confirmed in the bundle. Please open one PDF on the client's Chrome 110 to sign off BUG-05.
2. **Bulk "Tag" in the department file browser** shows "Tags applied", but `useBulkTagFiles` never calls an API; tagging isn't implemented. Left as-is because building tagging is a new feature. Recommend hiding the button or implementing the endpoint.
3. **Light theme coverage:** older screens use about 2,100 hardcoded colour classes, so light mode is achieved by remapping rather than per-component rewrites. The main pages were reviewed. Rarely used modals (e.g. CMS editor tabs, setup wizard) may still need small touch-ups.
4. **Account enumeration** (BUG-02 trade-off): described under BUG-02; easy to revert if security requires.
5. **Revoked broadcasts** reach other users' open sessions within ≤60 seconds (polling), not instantly.
6. **Security findings from the earlier analysis are still open:**
   - no rate limit on `/auth/reset-password`
   - `trust proxy` not set
   - global rate limiter mounted after the routes, so it never runs for them
   - refresh token stored in `localStorage`
   - credential files tracked in git

---

## 6. Follow-up round (security hardening, login wording, UI consistency)

### Login messages
- Unknown email → **"Account not found. Check the email address, or request access if you are new."**
- Wrong password → **"Incorrect email or password."** This is deliberately generic and never confirms which part was wrong. (It replaces the earlier "Incorrect password" wording from BUG-02.)

### Rate limiting & security
`backend/src/middleware/rateLimiter.middleware.ts` was rewritten. The four copy-pasted limiters became one shared limiter (Redis, with an in-memory fallback).

| Protection | Limit (production) |
|---|---|
| All API traffic per IP | 300 / min (now mounted **before** the routes; previously it ran after them and never applied) |
| Sign-in per IP | 20 / 15 min |
| **Per-account lockout** | 5 wrong passwords → account locked 15 min (blocks password guessing spread across many IPs) |
| Password-reset requests | 5 / hour per IP **and** 3 / hour per account |
| OTP verification / reset submission | 10 / 15 min per IP; **5 wrong codes cancel the code** (a new code must be requested) |
| Registration | 5 / hour per IP |
| Uploads | 120 / hour per user |
| Broadcasts | 20 / hour per admin |
| Downloads | Admin setting "Download rate limit" (was saved but **ignored** before; now enforced) |

**Other changes:**
- `trust proxy` is now set, so per-IP limits and audit logs see the real client address behind nginx/Apache rather than the proxy's. The default trusts only a proxy on the same host. Set `TRUST_PROXY` if the proxy runs elsewhere (documented in `.env.example`).
- The form-body size limit was reduced from 50 MB to 1 MB; file uploads use multipart and are unaffected.

### UI consistency & light/dark polish
Review covered all 21 routes in both themes, on desktop and mobile.

**Light-theme fixes:**
- Hardcoded dark gradients are remapped: notification rows, settings panels, the admin banner and the upload naming panel.
- Very dark tinted backgrounds become pale tints.
- The login modal content was invisible on its backdrop; fixed.
- Shadows are softened.
- Photo areas (hero, department carousel, image lightbox) stay dark in both themes.

**Consistency fixes:**
- **Buttons:** one sentence-case style everywhere, where previously some were UPPERCASE and some were not. The danger button colour now meets AA contrast. The secondary button no longer flashes dark on hover in light mode.
- **Headings:** section headings are sentence case and semibold instead of bold UPPERCASE (24 files).
- **Numbers:** tabular sans figures instead of monospace; monospace is kept for hashes and IDs.
- **Text size:** text under 10px was raised to 10px (103 places).
- **Navigation names** are distinct:
  - Dashboard / Admin Dashboard
  - Browse Files / All Files & Trash
  - Notifications, Search, Upload, Approvals, Satellites
  - Manage Events, Users, Password Resets, Audit Log, Broadcasts, Website Content, Settings
- **Top bar:** decluttered. It no longer repeats the brand (shown in the sidebar) or the role (shown in the user menu).
- **Page headers:** one divider instead of two.
- **Layout bugs fixed:**
  - file cards' size/date overlapping their action buttons
  - empty Folders panel (now has an empty state)
  - upload page's stretched sidebar
  - empty role badge on pending approvals
  - "View Details" wrapping onto two lines
  - "N Active Events" badge counting past events
  - mobile top-bar overlap (a pre-existing CSS layering bug in `.readout`)

### Tests (this round)
- `scripts/qa/bugfix-api-check.mjs`: **17/17**, including account lockout and the OTP cap. The lockout test registers throwaway `qa-lock-…` accounts; reject them in Approvals afterwards.
- `scripts/qa/bugfix-ui-check.mjs`: **7/7**
- Frontend and backend production builds: clean.

---

## 7. Follow-up round 2

- **Bulk tagging now works.** Before, the "Tag" button in the department file browser showed "Tags applied" but saved nothing.
  - New endpoint `POST /files/tags`. Admins, or users with read-write access to every selected file's department, can tag. It validates input (1–10 tags, 40 characters each, duplicates collapsed), uses the existing `Tag` / `FileTag` tables (no migration) and is audited (*"X tagged “report.pdf” with “orbit”"*).
  - Tags appear as chips on file cards, and the repository search matches them.
- **Security: disk paths leaked to anonymous visitors.** `GET /departments/:id/files` is served without sign-in and returned each file's server disk path (`hddPath`). That path now goes to admins only, and tags go to signed-in users only. The other public endpoints were probed anonymously and are clean.
- **Dead route:** `browse.routes.ts` also defines `GET /departments/:deptId/files`, but `department.routes.ts` registers the same path first, so the browse version never runs. It was left in place and should be removed in a later cleanup.
- **Dialogs in light mode:** the dialogs (edit metadata, upload version, file broadcast, add satellite, schedule event, new department, profile, custom category) and all 11 CMS editor tabs were reviewed in the light theme. Form controls now have one consistent white fill.
- **Tests:** API checks **18/18** (new: tagging); browser checks **7/7**; builds clean.
