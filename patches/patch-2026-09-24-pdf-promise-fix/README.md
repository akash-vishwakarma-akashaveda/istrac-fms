# 🛰️ ISTRAC-SIMS Hot-Patch: PDF Viewer Fix (`Promise.withResolvers`)
## Release Date: 2026-09-24 | Target: Older Enterprise/Air-Gapped Client Browsers

---

### 🔍 Issue Solved
* **Symptom**: Opening a PDF document preview on older customer client browsers (Chrome <119, Edge <119, older Chromium) displays an amber alert:
  > **Preview Rendering Error**  
  > `Promise.withResolvers is not a function`
* **Root Cause**: `pdfjs-dist` v4/v6 uses the ECMAScript 2024 `Promise.withResolvers` API inside its document parser and Web Worker threads. Older browsers lack this API natively.
* **Fix Applied**:
  1. Injected `Promise.withResolvers` and `Object.groupBy` polyfills into `index.html` (runs before any scripts load).
  2. Injected polyfills into `main.tsx` (runs before React & application bundles initialize).
  3. Prepend `Promise.withResolvers` into the in-memory Blob Web Worker inside `PdfPreview.tsx` so multi-threaded background PDF rendering succeeds on all older browsers.

---

### 📦 Files in this Patch:
* `apply-patch.sh`: Automated safe installer (prompts for install path, takes backup, syncs frontend, audits health, auto-reverts if anything fails).
* `revert-patch.sh`: Manual one-click revert utility.
* `frontend/dist/`: Compiled frontend assets with the ES2024 PDF polyfill fix.

---

### 🚀 How to Apply on Customer Server (0 Seconds Downtime):
1. Copy `patch-2026-09-24-pdf-promise-fix.zip` onto the server.
2. Extract and run:
   ```bash
   sudo unzip -o patch-2026-09-24-pdf-promise-fix.zip -d /tmp/pdf-patch/
   cd /tmp/pdf-patch/
   sudo bash apply-patch.sh
   ```
3. Hard refresh the browser on client PCs (**`Ctrl + F5`**).
   *(No service restart or server downtime is required for frontend updates).*
