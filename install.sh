#!/usr/bin/env bash
# ==============================================================================
# 🛰️ ISTRAC-SIMS — Master Setup Launcher for Ubuntu Linux
# Usage: sudo ./install.sh
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "${SCRIPT_DIR}/deploy/setup-ubuntu.sh" ]]; then
    chmod +x "${SCRIPT_DIR}/deploy/setup-ubuntu.sh"
    exec "${SCRIPT_DIR}/deploy/setup-ubuntu.sh" "$@"
else
    echo "❌ Error: deploy/setup-ubuntu.sh not found."
    exit 1
fi
