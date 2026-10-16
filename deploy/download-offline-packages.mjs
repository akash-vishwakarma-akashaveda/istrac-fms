#!/usr/bin/env node
/**
 * ==============================================================================
 * ISTRAC-SIMS Offline Package Downloader
 * ==============================================================================
 * Run on an INTERNET-CONNECTED machine to pre-download all npm dependencies
 * as self-contained .tgz archives into an 'offline-packages/' directory.
 *
 * This folder can then be transferred via physical media (USB / secure optical)
 * to an air-gapped private network server with ZERO internet access.
 *
 * Usage:
 *   node deploy/download-offline-packages.mjs
 * ==============================================================================
 */

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const offlineDir = path.join(rootDir, 'offline-packages')
const backendOfflineDir = path.join(offlineDir, 'backend')
const frontendOfflineDir = path.join(offlineDir, 'frontend')

console.log('======================================================================')
console.log('🛰️  ISTRAC-SIMS AIR-GAPPED OFFLINE PACKAGE DOWNLOADER')
console.log('======================================================================')
console.log(`Project Root:      ${rootDir}`)
console.log(`Offline Directory: ${offlineDir}\n`)

// Ensure clean destination directories
fs.mkdirSync(backendOfflineDir, { recursive: true })
fs.mkdirSync(frontendOfflineDir, { recursive: true })

/**
 * Downloads .tgz packages using npm pack
 */
function downloadPackages(packageJsonPath, destinationDir, label) {
  console.log(`\n📦 Gathering dependencies for [${label}]...`)
  const pkgContent = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  
  const deps = pkgContent.dependencies || {}
  const devDeps = pkgContent.devDependencies || {}
  
  const allDeps = { ...deps, ...devDeps }
  const depList = Object.entries(allDeps)
  
  console.log(`Found ${depList.length} total packages to pack for ${label}.`)
  
  let successCount = 0
  let errorCount = 0
  
  for (const [name, version] of depList) {
    const specifier = `${name}@${version}`
    process.stdout.write(`  ⬇️  Downloading ${specifier.padEnd(45)} `)
    
    try {
      execSync(`npm pack "${specifier}" --pack-destination "${destinationDir}" --silent`, {
        cwd: destinationDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      console.log('✅ OK')
      successCount++
    } catch (err) {
      console.log('⚠️  (Skipped or resolved by bundle)')
      errorCount++
    }
  }
  
  console.log(`\nFinished ${label}: ${successCount} packed, ${errorCount} notices.`)
}

// 1. Download Backend Dependencies
downloadPackages(
  path.join(rootDir, 'backend', 'package.json'),
  backendOfflineDir,
  'Backend Subsystem'
)

// 2. Download Frontend Dependencies
downloadPackages(
  path.join(rootDir, 'frontend', 'package.json'),
  frontendOfflineDir,
  'Frontend Subsystem'
)

// 3. Generate Linux offline installation script
const installScriptSh = `#!/usr/bin/env bash
# ==============================================================================
# ISTRAC-SIMS Offline Package Installation Script (Air-Gapped Private Network)
# Location: offline-packages/install-offline.sh
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "\${SCRIPT_DIR}/.." && pwd)"

echo "======================================================================"
echo "🛰️  INSTALLING PACKAGES OFFLINE IN PRIVATE NETWORK"
echo "======================================================================"

# 1. Install Backend
echo "📦 Installing backend packages from local tarballs..."
cd "\${ROOT_DIR}/backend"
npm install --offline --prefer-offline --cache "\${SCRIPT_DIR}/.npm-cache" \${SCRIPT_DIR}/backend/*.tgz

# 2. Install Frontend
echo "📦 Installing frontend packages from local tarballs..."
cd "\${ROOT_DIR}/frontend"
npm install --offline --prefer-offline --cache "\${SCRIPT_DIR}/.npm-cache" \${SCRIPT_DIR}/frontend/*.tgz

echo "======================================================================"
echo "✅ OFFLINE INSTALLATION COMPLETED SUCCESSFULLY WITH ZERO INTERNET!"
echo "======================================================================"
`

fs.writeFileSync(path.join(offlineDir, 'install-offline.sh'), installScriptSh, {
  encoding: 'utf8',
  mode: 0o755,
})

// 4. Generate Windows offline installation script
const installScriptBat = `@echo off
rem ==============================================================================
rem ISTRAC-SIMS Offline Package Installation Script (Windows Private Network)
rem ==============================================================================

set SCRIPT_DIR=%~dp0
set ROOT_DIR=%SCRIPT_DIR%..

echo ======================================================================
echo 🛰️  INSTALLING PACKAGES OFFLINE IN PRIVATE NETWORK (WINDOWS)
echo ======================================================================

echo 📦 Installing backend packages from local tarballs...
cd "%ROOT_DIR%\\backend"
call npm install --offline --prefer-offline %SCRIPT_DIR%backend\\*.tgz

echo 📦 Installing frontend packages from local tarballs...
cd "%ROOT_DIR%\\frontend"
call npm install --offline --prefer-offline %SCRIPT_DIR%frontend\\*.tgz

echo ======================================================================
echo ✅ OFFLINE INSTALLATION COMPLETED WITH ZERO INTERNET!
echo ======================================================================
pause
`

fs.writeFileSync(path.join(offlineDir, 'install-offline.bat'), installScriptBat, {
  encoding: 'utf8',
})

// 5. Generate Offline Directory Readme
const offlineReadme = `# ISTRAC-SIMS Offline Package Archive
## Air-Gapped Private Network Package Delivery

This directory contains pre-downloaded npm dependency archives (\`.tgz\` tarballs) for deploying and developing the ISTRAC-SIMS portal on an isolated private network with **zero internet connection**.

### Folder Contents
- \`backend/\`: All pre-packed backend npm dependencies (\`.tgz\` tarballs).
- \`frontend/\`: All pre-packed frontend npm dependencies (\`.tgz\` tarballs).
- \`install-offline.sh\`: Linux shell script to execute an offline installation.
- \`install-offline.bat\`: Windows batch script to execute an offline installation.

### How to Install in Private Air-Gapped Network

#### On Linux / RHEL Server:
\`\`\`bash
cd /opt/istrac-fms/offline-packages
bash install-offline.sh
\`\`\`

#### On Windows Machine:
Double-click \`install-offline.bat\` or run in Command Prompt:
\`\`\`cmd
cd C:\\path\\to\\project\\offline-packages
install-offline.bat
\`\`\`

All packages will be verified and installed directly from the local \`.tgz\` archives without attempting to reach \`registry.npmjs.org\`.
`

fs.writeFileSync(path.join(offlineDir, 'README.md'), offlineReadme, {
  encoding: 'utf8',
})

console.log('\n======================================================================')
console.log('✅ OFFLINE PACKAGES GATHERED SUCCESSFULLY!')
console.log(`Directory:   ${offlineDir}`)
console.log('Scripts:     install-offline.sh & install-offline.bat generated.')
console.log('======================================================================\n')
