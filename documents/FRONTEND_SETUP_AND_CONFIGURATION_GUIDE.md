# ISTRAC-SIMS Frontend Initial Configuration & Setup Guide

> **Target System:** ISTRAC-SIMS React/Vite Client Portal  
> **Environment Support:** Windows / Linux / Docker / AWS Amplify / Nginx Air-Gapped Web Server  
> **Target Version:** 1.1.0 (V1 Production Baseline)

---

## 📑 Table of Contents

1. [Hardware & Software Prerequisites](#1-hardware--software-prerequisites)
2. [Step-by-Step Local Setup](#2-step-by-step-local-setup)
3. [Environment Configuration Reference (`.env`)](#3-environment-configuration-reference-env)
4. [Vite Development Server & Proxy Configuration](#4-vite-development-server--proxy-configuration)
5. [Production Build & Code-Splitting Optimization](#5-production-build--code-splitting-optimization)
6. [AWS Amplify Hosting & SPA Routing Configuration](#6-aws-amplify-hosting--spa-routing-configuration)
7. [Nginx Air-Gapped Intranet Deployment](#7-nginx-air-gapped-intranet-deployment)
8. [System Verification & Smoke Testing](#8-system-verification--smoke-testing)
9. [Troubleshooting & Frequently Encountered Issues](#9-troubleshooting--frequently-encountered-issues)

---

## 1. Hardware & Software Prerequisites

| Component | Minimum Requirement | Recommended Specification |
| :--- | :--- | :--- |
| **Node.js** | `>= 20.10.0 LTS` | `20.18.0 LTS` or `22.x LTS` |
| **npm** | `>= 10.0.0` | `10.8.0+` |
| **Web Browser** | Chrome 110+, Edge 110+, Firefox 115+ | Latest Chromium / Firefox ESR |
| **Workstation RAM** | `4 GB` | `8 GB+` |
| **Disk Space** | `2 GB SSD` | `5 GB+ SSD` |

---

## 2. Step-by-Step Local Setup

### Step 1: Navigate to Frontend Directory
```bash
cd frontend
```

### Step 2: Install Node Dependencies
```bash
npm install
```
*Installs React 19, Vite 8, Tailwind CSS v4, TanStack Query v5, Zustand, Axios, PDF.js, and Lucide React.*

### Step 3: Configure Environment Variables
```bash
cp .env.example .env
```

### Step 4: Start the Development Server
```bash
npm run dev
```
Open your browser at **`http://localhost:5173`**.

---

## 3. Environment Configuration Reference (`.env`)

```dotenv
# ============================================================
# API & WEBSOCKET ENDPOINTS
# ============================================================

# Local Development (with Vite reverse proxy to port 3000):
VITE_API_URL=/api
VITE_WS_URL=ws://localhost:3000/ws

# Production (e.g. AWS CloudFront / Custom Domain):
# VITE_API_URL=https://d2qycovk79gx2n.cloudfront.net
# VITE_WS_URL=wss://d2qycovk79gx2n.cloudfront.net/ws
```

---

## 4. Production Build Optimization

To compile and build the production bundle:

```bash
npm run build
```
- Executes TypeScript validation (`tsc -b`).
- Generates optimized assets in `dist/` with vendor chunk splitting (PDF.js, React, TanStack Query, and Lucide icons).
- Typical build duration: **~1.0 second**.

---

## 5. AWS Amplify Hosting & SPA Routing Configuration

When deploying the frontend on **AWS Amplify Hosting**, direct URL navigation (e.g., `/login`, `/dashboard`, `/departments/mox`) will produce a `404 Not Found` unless the SPA rewrite rule is present.

### Required Rewrite Rule Configuration:
1. In the **AWS Amplify Console**, select your app (`protov1`).
2. Go to **App settings** ➔ **Rewrites and redirects**.
3. Add the following rule at the top:

| Source Address (Regex) | Target Address | Type |
| :--- | :--- | :--- |
| `</^[^.]+$|\.(?!(css\|gif\|ico\|jpg\|js\|png\|txt\|svg\|woff\|woff2\|ttf\|map\|json\|webp)$)([^.]+$)/>` | `/index.html` | **200 (Rewrite)** |

---

## 6. Nginx Air-Gapped Intranet Deployment

When serving in an isolated ground station environment:

```nginx
server {
    listen 80;
    server_name istrac-portal.local;
    root /var/www/istrac-sims/frontend/dist;
    index index.html;

    # SPA Client Routing Fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Reverse Proxy for Backend REST API
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket Stream Gateway
    location /ws {
        proxy_pass http://127.0.0.1:3000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_read_timeout 86400s;
    }
}
```
