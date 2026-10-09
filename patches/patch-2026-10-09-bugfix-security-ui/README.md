# ISTRAC-SIMS Patch — 2026-10-09 (Bug fixes BUG-01…17, security hardening, UI)

**Type:** compiled hot-patch (frontend + backend). **Database:** no migration, no data changes.
**Dependencies:** unchanged (no `npm install` needed). **Downtime:** a backend restart of a few seconds.
**Source:** branch `protov1`, commits `358202b` + `a3a4d87` + this patch's health/installer fixes.

## What's in it

| Path | Purpose |
|---|---|
| `frontend/dist/` | Built web app (modern + legacy bundles for older browsers) |
| `backend/dist/` | Built API server and worker |
| `backend/prisma/schema.prisma` | Prisma 7 fix (removes `url` from the datasource; no schema change) |
| `apply-patch.sh` | Installer: backup → copy → restart → 6 health checks → automatic rollback on failure |
| `revert-patch.sh` | Manual rollback to the pre-patch backup |
| `CHANGES.md` | Full change report (per-bug cause, fix, tests) |
| `HOT_PATCHING_GUIDE.md` | General hot-patching guide |

## Highlights

**Bugs:**
- Toasts/dialogs failing on plain-HTTP servers (the root cause of the login, delete and toast bugs)
- Login/logout state
- Trash with restore
- Custom category filters and safe deletion
- Date ranges
- Event status after rescheduling
- Notification filters, broadcast categories and revoke
- Readable audit log
- Table views, input help
- PDF preview on Chrome 110
- Working bulk tagging

**Security:**
- Rate limits now apply to the whole API
- Per-account login lockout (5 tries / 15 min)
- Password-reset code attempt cap
- Upload, broadcast and download limits
- Real client IPs behind the proxy
- Generic "Incorrect email or password"
- Server disk paths no longer sent to anonymous visitors

**UI:**
- Light/dark theme toggle (contrast meets WCAG AA)
- Consistent buttons and headings
- Clearer navigation names

**Ops:** `/api/health` now returns 503 only when the database is down. Redis or storage problems report `"status":"degraded"` with HTTP 200, so servers running without Redis aren't treated as down.

## Before you apply

1. **Proxy address (only if needed).** If Apache/nginx/httpd runs on the **same** server, nothing to do. If a load balancer or proxy on **another** host forwards traffic, add its address to `backend/.env`, otherwise everyone shares one rate-limit bucket:
   ```
   TRUST_PROXY=10.0.0.5          # proxy/load-balancer IP or CIDR
   ```
2. **Sessions:** nobody is logged out by the patch; open sessions keep working after the restart.

## Apply

```bash
sudo unzip -o patch-2026-10-09-bugfix-security-ui.zip -d /tmp/istrac-patch
cd /tmp/istrac-patch
sudo bash apply-patch.sh                     # default /opt/istrac-sims (or /opt/istrac-fms)
sudo bash apply-patch.sh /path/to/istrac-fms # or pass your install path
```

The installer works with **systemd** (`istrac-backend` / `istrac-worker`) or **PM2** (`istrac-sims-backend` / `istrac-sims-worker` from `ecosystem.config.cjs`), and with Apache, httpd or nginx.

### Health checks run automatically
1. Frontend `index.html` present
2. Backend process running
3. Worker process running (warning only)
4. `/api/health` returns 200
5. **The new code is live.** `POST /api/files/tags` must answer 401; an old build answers 404, and the patch rolls back.
6. Web server answering on port 80 (notice only)

Any failure restores the previous frontend, backend and schema from the backups and restarts the services.

## Roll back manually

```bash
sudo bash revert-patch.sh /path/to/istrac-fms
```
Restores the most recent `dist.bak_*` and `schema.prisma.bak_*` backups made by `apply-patch.sh`.

## After applying (2-minute smoke test)

- Sign in with a wrong password → "Incorrect email or password."
- Sign out → you land on the home page (no login popup).
- Admin → All Files & Trash → move a file to Trash → toast appears, dialog closes → switch to **Trash** → **Restore**.
- Open a PDF preview.
- Toggle the sun/moon button in the header → light theme; reload → theme is kept.

## Tested

- API checks: 18/18
- Upload/category end-to-end: 5/5
- Browser flows with HTTPS-only features disabled, to mimic an HTTP intranet: 7/7
- Installer sandbox, both paths: success, and automatic rollback when the old code is detected
