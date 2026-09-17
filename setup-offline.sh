#!/usr/bin/env bash
# ==============================================================================
# 🛰️ ISTRAC-SIMS — Master Offline Setup Runner (Ubuntu 24.04 & RHEL 8/9)
# Run this script directly on the air-gapped server:
#   sudo bash setup-offline.sh
# ==============================================================================

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "${SCRIPT_DIR}/deploy/install-apache-offline.sh" ]]; then
    bash "${SCRIPT_DIR}/deploy/install-apache-offline.sh" "$@"
elif [[ -f "${SCRIPT_DIR}/install.sh" ]]; then
    bash "${SCRIPT_DIR}/install.sh" "$@"
else
    echo "❌ Error: Installation script not found in deploy/ or root."
    exit 1
fi
