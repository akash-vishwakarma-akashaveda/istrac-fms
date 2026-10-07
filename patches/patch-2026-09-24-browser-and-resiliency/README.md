# ??? ISTRAC-SIMS Hot-Patch (2026-09-24)
## Outdated Browser Support + Backend Offline Resiliency + Domain & Service Tools

### Contents of this Patch:
- pply-patch.sh : One-click automated zero-downtime patch script for customer servers.
- rontend/dist/ : Compiled frontend containing:
  - Global Iterator polyfill (prevents blank screen on older Chromium/Chrome/Edge).
  - Legacy chunk fallbacks (polyfills-legacy-*.js, index-legacy-*.js).
  - Lazy-loaded PDF preview engine (prevents heavy chunks blocking initial page load).
- ackend/dist/ : Compiled backend TypeScript with:
  - Redis guarded fallback checks (services work normally even if Redis is stopped).
  - Password complexity validation and old/new mismatch verification.
- manage-services-ubuntu.sh : CLI tool to check service status, restart, view logs, and backup.
- scripts/setup-domain.sh : Automated tool to configure custom domain and SSL certificates.
- scripts/verify.sh : System health verification script for port 3000 and /api/health.
- HOT_PATCHING_GUIDE.md : Detailed instructions.
- PRODUCTION_PATCH_LOG_AND_MANUAL.md : Complete datewise changelog and file target map.

### How to Apply on Customer Server:
1. Copy this folder (or unzip the archive) onto the server (e.g. /tmp/patch-2026-09-24).
2. Run:
   `ash
   cd /tmp/patch-2026-09-24
   sudo bash apply-patch.sh
   `
3. Hard-refresh browser (Ctrl + F5).
