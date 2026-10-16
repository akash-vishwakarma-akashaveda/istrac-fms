# ISTRAC-SIMS Patch — 2026-10-16 (ISRO brand redesign, security fixes, team updates)

**Type:** compiled hot-patch (frontend + backend). **Database:** no migration, no data changes.
**Dependencies:** unchanged (no `npm install` needed). **Environment:** no new or changed variables.
**Downtime:** a backend restart of a few seconds.
**Cumulative:** contains everything in the 2026-10-09 patch plus all changes since. Installing this patch on a server that never got the 2026-10-09 patch is fine.
**Source:** branch `protov1` at `703065e` plus the fixes listed in `CHANGES.md` §1 (made while verifying this patch).

## What's in it

| Path | Purpose |
|---|---|
| `frontend/dist/` | Built web app (modern + legacy bundles for older browsers) |
| `backend/dist/` | Built API server and worker |
| `backend/prisma/schema.prisma` | Unchanged schema (shipped so the install folder matches the code) |
| `apply-patch.sh` | Installer: backup → copy → restart → 6 health checks → automatic rollback on failure |
| `revert-patch.sh` | Manual rollback to the pre-patch backup |
| `CHANGES.md` | Full change report since the 2026-10-09 patch, with tests |
| `HOT_PATCHING_GUIDE.md` | General hot-patching guide |

## Highlights

**Security (must-have):**
- Signed-out visitors could read every file-upload notification (uploader, file name, division) on the landing page. Now only uploads of featured (public) files are shown.
- Built-in report categories (General, Daily Report…) could be deleted. Blocked again.
- Department access isolation in search and the department hub. Path-safe chunked uploads. Trashed-file versions are admin-only.
- Suspend, force-logout and password changes now end live sessions immediately.

**Correctness:**
- Custom categories no longer claim unrelated files, so an empty category can be deleted.
- No more invented values (fake "TTC"/"MOX" departments, fake reviewers, fixed dates, stock photos).

**New look:** ISRO-brand theme from the logo for light and dark mode.
- Saffron primary buttons and blue links.
- Redesigned landing page (photo hero, divisions, featured reports, calendar, About band, contact).
- Restyled admin and user dashboards.
- Consistent hover states throughout.

**Team updates included:**
- Department-scoped notification delivery.
- Satellite hard-delete.
- Reworked admin pages (approvals, audit log, departments, satellites, events, upload, users, OTPs).

## Install

```bash
unzip patch-2026-10-16-brand-ui-security.zip -d /tmp/istrac-patch
cd /tmp/istrac-patch
sudo bash apply-patch.sh            # auto-detects the install folder, or: sudo bash apply-patch.sh /opt/istrac-sims
```

The installer backs up the current build and copies the new one. It then restarts the backend and worker and runs six checks:
- the files are in place
- the backend is up
- the health endpoint responds
- the API is reachable through Apache/Nginx
- the new code is live (probe: `GET /api/admin/files/extensions` → 401)
- the worker is running

If any check fails it **rolls back automatically**. To undo later: `sudo bash revert-patch.sh`.

## After installing (admin, 2 minutes)

1. Open the site and press **Ctrl+Shift+R** once (or clear the cache) so the browser loads the new styles.
2. **CMS → Hero & Carousel:** upload real ISTRAC photos. The default slides point to internet photos that do not load on the intranet. Until real photos are uploaded, the hero shows the CMS space background.
3. Check that the main administrator account matches `ADMIN_EMAIL` in the backend `.env`. That account is now the protected "root" admin.
