# ISTRAC-FMS Frontend Initial Configuration & Setup Guide

> **Target System:** ISTRAC-FMS React/Vite Client Portal  
> **Environment Support:** Windows / Linux / Docker / Nginx Air-Gapped Web Server  
> **Target Version:** 1.0.0

---

## 📑 Table of Contents

1. [Hardware & Software Prerequisites](#1-hardware--software-prerequisites)
2. [Step-by-Step Local Setup](#2-step-by-step-local-setup)
3. [Environment Configuration Reference (`.env`)](#3-environment-configuration-reference-env)
4. [Vite Development Server & Proxy Configuration](#4-vite-development-server--proxy-configuration)
5. [Production Build & Code-Splitting Optimization](#5-production-build--code-splitting-optimization)
6. [Nginx Production Deployment Configuration](#6-nginx-production-deployment-configuration)
7. [Docker Multi-Stage Production Build](#7-docker-multi-stage-production-build)
8. [System Verification & Smoke Testing](#8-system-verification--smoke-testing)
9. [Troubleshooting & Frequently Encountered Issues](#9-troubleshooting--frequently-encountered-issues)

---

## 1. Hardware & Software Prerequisites

| Component | Minimum Requirement | Recommended Specification |
|---|---|---|
| **Node.js** | `>= 20.10.0 LTS` | `20.18.0 LTS` or `22.x LTS` |
| **npm** | `>= 10.0.0` | `10.8.0+` |
| **Web Browser** | Chrome 110+, Edge 110+, Firefox 115+ (ES2022 support) | Latest Chromium / Firefox ESR |
| **Workstation RAM** | `4 GB` | `8 GB+` |
| **Disk Space** | `2 GB SSD` | `5 GB+ SSD` |

---

## 2. Step-by-Step Local Setup

### Step 1: Navigate to Frontend Directory
```bash
cd D:\istrac-fms\frontend
# or on Linux:
cd /opt/istrac-fms/frontend
```

### Step 2: Install Node Dependencies
```bash
npm install
```
*Installs React 19, Vite 8, Tailwind CSS v4, TanStack Query v5, Zustand, Axios, DOMPurify, PDF.js, and Lucide React.*

### Step 3: Configure Environment Variables
Create or verify the `.env` file in `frontend/`:
```bash
cp .env.example .env
```
Ensure the backend endpoints and WebSocket URLs are configured (see Section 3).

### Step 4: Start the Development Server
```bash
npm run dev
```
Open your browser and navigate to: **`http://localhost:5173`**

---

## 3. Environment Configuration Reference (`.env`)

Vite exposes environment variables prefixed with `VITE_` to the client bundle at compile/runtime.

```dotenv
# ============================================================
# API & WEBSOCKET ENDPOINTS
# ============================================================

# In development (when using Vite reverse proxy):
VITE_API_URL=/api
VITE_WS_URL=ws://localhost:3000/ws

# In production (when served directly or via Nginx domain):
# VITE_API_URL=http://istrac-groundstation.local/api
# VITE_WS_URL=ws://istrac-groundstation.local/ws
```

### Variable Details:

| Variable | Required? | Default / Example | Purpose |
|---|---|---|---|
| `VITE_API_URL` | Yes | `/api` | Base URL prefix for all REST API network requests. |
| `VITE_WS_URL` | Yes | `ws://localhost:3000/ws` | Full WebSocket connection URI for real-time telemetry events. |

---

## 4. Vite Development Server & Proxy Configuration

In [`vite.config.ts`](file:///D:/istrac-fms/frontend/vite.config.ts), reverse proxies are pre-configured to eliminate CORS issues during development:

```typescript
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // Proxies http://localhost:5173/api/* to http://localhost:3000/*
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // Proxies WebSocket connections
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
})
```

---

## 5. Production Build & Code-Splitting Optimization

### Building the Production Artifact:
```bash
npm run build
```

### Output Directory Structure (`dist/`):
```
dist/
├── index.html                           # Single-page application entrypoint
└── assets/
    ├── index-[hash].css                 # Compiled Tailwind v4 utility styles
    ├── rolldown-runtime-[hash].js       # Ultra-light runtime
    ├── vendor-react-[hash].js           # React, React-DOM, React-Router-DOM bundle
    ├── vendor-query-[hash].js           # TanStack React Query bundle
    ├── vendor-icons-[hash].js           # Lucide React icons bundle
    ├── pdf.worker.min-[hash].mjs        # Air-gapped PDF.js rendering worker
    └── index-[hash].js                  # Main application bundle
```

### Manual Chunk Splitting Configuration:
Vite is tuned to bundle third-party vendor libraries into isolated, long-term cached chunks:
- `vendor-react`: Isolated React core and routing engine (~180 KB).
- `vendor-query`: Query caching and mutation framework (~37 KB).
- `vendor-icons`: High-performance SVG icons (~19 KB).

---

## 6. Nginx Production Deployment Configuration

For air-gapped ground station deployments, Nginx is recommended to serve the compiled `dist/` directory and reverse-proxy backend API and WebSocket requests.

Create `/etc/nginx/conf.d/istrac-fms.conf`:

```nginx
server {
    listen 80;
    server_name istrac-portal.local;

    # Root directory pointing to compiled frontend build
    root /opt/istrac-fms/frontend/dist;
    index index.html;

    # Gzip Compression for local air-gap performance
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # SPA Routing: Fall back to index.html for client-side React Router
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Reverse proxy for REST API
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Allow large file chunk uploads (up to 50MB)
        client_max_body_size 50M;
    }

    # Reverse proxy for WebSockets
    location /ws {
        proxy_pass http://127.0.0.1:3000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Static Asset Long-Term Caching
    location ~* \.(?:ico|css|js|gif|jpe?g|png|woff2?|eot|ttf|svg|mjs)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

### Applying Nginx Configuration:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. Docker Multi-Stage Production Build

A production-ready `Dockerfile` for containerized frontend deployment:

```dockerfile
# Stage 1: Build Frontend Assets
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve with Lightweight Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## 8. System Verification & Smoke Testing

### 1. Verification of Hot-Reloading in Development
Run `npm run dev`, open developer tools console (F12), and check for clean boot without warnings:
- `[Vite] connected.`
- Clean TanStack Query provider mount.

### 2. Verification of Silent Token Refresh
1. Log into the application (`admin@istrac.local` / `ChangeMe123!`).
2. In browser DevTools ➔ **Application** ➔ **Cookies**, verify that the `refreshToken` httpOnly cookie is present.
3. In **Application** ➔ **Session Storage**, verify that `istrac-auth` stores the active user profile.

### 3. Verification of WebSocket Connectivity
In DevTools ➔ **Network** ➔ **WS**, click on the `ws` entry:
- Check that the HTTP status is `101 Switching Protocols`.
- Inspect the **Messages** sub-tab to confirm periodic `{ type: "ping" }` frames arrive every 30 seconds.

---

## 9. Troubleshooting & Frequently Encountered Issues

### Issue 1: `Network Error` or `404 Not Found` on API Requests in Development
- **Cause:** The backend Express server is not running on port 3000 or the Vite proxy is misconfigured.
- **Solution:** Ensure the backend is running (`npm run dev` in `backend/`). Verify `VITE_API_URL=/api` in `frontend/.env`.

### Issue 2: `Blank White Screen` on Page Refresh when Deployed with Nginx
- **Cause:** Nginx is attempting to find a physical file matching the React Router URL (e.g., `/departments/123`) and returning a 404.
- **Solution:** Ensure `try_files $uri $uri/ /index.html;` is present in your Nginx server block.

### Issue 3: `PDF Viewer Failed to Load Worker`
- **Cause:** The `pdfjs-dist` worker script is blocked by a missing MIME type.
- **Solution:** Ensure your server allows `.mjs` MIME types (`application/javascript`). In Nginx, ensure `include /etc/nginx/mime.types;` is loaded.

### Issue 4: `Session Expired / Infinite Redirect to /login`
- **Cause:** The `httpOnly` refresh cookie was rejected due to domain mismatch or missing `withCredentials: true`.
- **Solution:** Confirm that `client.ts` has `withCredentials: true` enabled and that the backend `cors.ts` has your client origin listed in `env.ALLOWED_ORIGINS`.
