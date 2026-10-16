# Configurable SMTP Service: Current Stage & Step-by-Step Action Plan
## ISTRAC Satellite Information Management System (ISTRAC-SIMS)

> **Document Identifier:** ISTRAC-SIMS-SMTP-GUIDE-V2.0  
> **Target Audience:** Project Managers, Clients, Administrators, and Developers  
> **Status:** Simplified Implementation Plan (No Source Files Changed)  
> **Date:** September 2026  

---

## 📌 Executive Summary (In Plain English)

Right now, if a client gives us their email server (SMTP) details, **a software developer must log into the physical server terminal, edit a hidden `.env` file, and restart the backend service**. An administrator cannot view or change email settings from their browser.

**What we want instead:**  
Any administrator can simply log into the web portal, open **Admin Settings**, type in the client's SMTP server host, username, and password, click **"Test Connection"**, and click **"Save"**. 
The system will immediately start sending emails through the client's mail server with **zero server restart and zero developer assistance needed**.

---

## Part 1: Where We Are Right Now (Current Stage)

### 1. How Email Works Today in the Codebase
Today, email sending is handled by one file: `backend/src/services/email.service.ts`.

When the backend starts up, it reads from `backend/src/config/env.ts`:
```typescript
// CURRENT CODE IN email.service.ts:
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST || 'localhost',
  port: env.SMTP_PORT || 25,
  secure: false,
  ignoreTLS: true,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
})
```

### 2. What Happens Today if a Client Gives Us Their SMTP Details?
1. **Developer Required:** A developer or server admin must SSH into the Linux server.
2. **Terminal Editing:** They must manually open the `.env` file (`nano /opt/istrac-fms/backend/.env`) and type:
   ```env
   SMTP_HOST=smtp.client-domain.com
   SMTP_PORT=587
   SMTP_USER=user@client-domain.com
   SMTP_PASS=ClientSecret123
   ```
3. **Downtime / Service Restart:** They must restart the backend daemon:
   ```bash
   sudo systemctl restart istrac-backend
   ```
4. **Blind Testing:** There is no "Test Connection" button. If the password was mistyped or the port is blocked by a firewall, emails fail silently in the background with only a `console.error` in the server log.
5. **No Admin Access:** The web browser Admin Panel has no screen or settings page to view or update SMTP settings.

### 3. Current Limitations Summary
- ❌ **Cannot change without restarting the server.**
- ❌ **Cannot change from the Admin web page.**
- ❌ **No way to test if credentials work before saving.**
- ❌ **Hardcoded sender:** The system always sends from `no-reply@istrac.gov.in` even if the client's domain is different.
- ❌ **Hardcoded TLS settings:** Modern servers (like Office 365 / Google / AWS) require specific TLS handshakes which fail under the current static setup.

---

## Part 2: The Desired System (Target State)

### How It Will Work for the Client & Admin

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ADMIN WEB DASHBOARD                             │
│                  Admin Portal ➔ System Settings                        │
│                                                                        │
│  ✉️ Outgoing Mail Gateway (SMTP)                                       │
│  --------------------------------------------------------------------  │
│  Enable Outgoing Emails:     [ ON / OFF ]                              │
│                                                                        │
│  SMTP Server Host:           Port:           Encryption:               │
│  [ smtp.office365.com      ] [ 587 ]         [ STARTTLS (Port 587)  v] │
│                                                                        │
│  Username:                   Password:                                 │
│  [ alerts@client.org       ] [ •••••••••••• (Saved)                  ] │
│                                                                        │
│  Sender Display Name:        Sender Email Address:                     │
│  [ ISTRAC Mission Control  ] [ alerts@client.org                     ] │
│                                                                        │
│  --------------------------------------------------------------------  │
│  Test Recipient: [ director@client.org ]  [ ⚡ Test Connection ]       │
│  Status: ✅ Handshake OK & Test Email Sent Successfully                │
│                                                                        │
│                                      [ 💾 Save Configuration (Instant) ]│
└────────────────────────────────────────────────────────────────────────┘
```

1. **Client sends us their SMTP details** (Host, Port, User, Password, Sender Address).
2. **Admin logs into the portal** and goes to `System Configuration`.
3. **Admin pastes the details** into the fields.
4. **Admin clicks "Test Connection"**:
   - The backend attempts to connect to the mail server.
   - It sends a live test probe email to the admin's inbox.
   - If there is a typo or firewall issue, a clear error message explains what is wrong (e.g., *"Invalid username or password"* or *"Connection timed out on port 587"*).
5. **Admin clicks "Save"**:
   - The settings are saved in the database.
   - The email service instantly switches to the new server.
   - **Zero downtime. No server restart. No developer involved.**

---

## Part 3: What We Have to Do (The 4 Concrete Steps)

To achieve this configurable system, we only need to implement **4 simple pieces**:

```
+------------------------------------------------------------------------------+
| 1. DATABASE          | Already has `SystemConfig` table.                     |
|                      | We just save a new entry: `SMTP_CONFIG`.              |
+----------------------+-------------------------------------------------------+
| 2. BACKEND SERVICE   | Update `email.service.ts`:                            |
|                      | Read from DB first (fallback to .env).                |
|                      | Add test connection & hot-reload capability.          |
+----------------------+-------------------------------------------------------+
| 3. API & CONTROLLER  | Add 3 simple REST endpoints:                          |
|                      | GET  /admin/smtp       (load settings, mask password) |
|                      | PUT  /admin/smtp       (save new settings)            |
|                      | POST /admin/smtp/test  (verify connection & send test)|
+----------------------+-------------------------------------------------------+
| 4. FRONTEND UI       | Add the "SMTP Mail Gateway" card to:                  |
|                      | `frontend/src/pages/SystemConfigPanel.tsx`            |
+------------------------------------------------------------------------------+
```

---

### Step 1: The Database (Where Settings Are Stored)

**Good news:** Our MySQL database already contains a table called `SystemConfig` (`backend/prisma/schema.prisma`):
```prisma
model SystemConfig {
  configKey   String @id
  configValue String @db.LongText
  updatedBy   String?
  updatedAt   DateTime @default(now()) @updatedAt
  deletedAt   DateTime?
}
```

We do **not** need to run any database migrations or schema alterations!  
We will simply store the SMTP settings as a JSON string under:
- **`configKey`**: `"SMTP_CONFIG"`
- **`configValue`**:
  ```json
  {
    "enabled": true,
    "host": "smtp.office365.com",
    "port": 587,
    "secure": false,
    "requireTLS": true,
    "ignoreTlsErrors": false,
    "user": "alerts@client.org",
    "pass": "ClientSecretPassword",
    "fromEmail": "alerts@client.org",
    "fromName": "ISTRAC Ground Operations"
  }
  ```

---

### Step 2: The Backend Service (`backend/src/services/email.service.ts`)

Instead of creating the mail transporter once when the file loads, we update `email.service.ts` to:

1. **`getConfig()`**:
   - Check the `SystemConfig` table in MySQL for `SMTP_CONFIG`.
   - If found in the database, use it!
   - If not found, use whatever is in `.env` as the fallback default.
2. **`updateConfig(newSettings)`**:
   - Save the new settings into `SystemConfig`.
   - Recreate the active mail transporter in memory so future emails immediately use the new settings.
   - If the admin leaves the password blank, keep the previously saved password (so they don't have to re-type it every time).
3. **`testConnection(testSettings)`**:
   - Run `transporter.verify()` to check if the server is reachable and credentials are valid.
   - If a test email is provided, send a quick test message.
   - Return a clear result: `{ success: true }` or `{ success: false, message: "Authentication failed..." }`.
4. **`sendApprovalEmail()`, `sendPasswordResetEmail()`, etc.**:
   - Use the dynamic settings and the sender's configured name and email.
   - If `enabled: false`, skip sending cleanly without errors.

---

### Step 3: The API & Controller (`backend/src/controllers/smtp.controller.ts`)

We expose 3 clean endpoints protected by Admin login (`authMiddleware` + `adminMiddleware`):

| Method | Endpoint | What it does |
| :--- | :--- | :--- |
| **`GET`** | `/admin/smtp` | Loads the current settings for the admin screen. **Never returns the raw password**; returns `hasPassword: true` instead. |
| **`PUT`** | `/admin/smtp` | Receives new settings from the admin, saves to DB, and logs who changed it in the `AuditLog`. |
| **`POST`** | `/admin/smtp/test` | Runs a live test connection and sends a test email to verify credentials before saving. |

---

### Step 4: The Frontend Admin Screen (`frontend/src/pages/SystemConfigPanel.tsx`)

In the existing **System Configuration** page (`/admin/system-config`), we add an **"Outgoing SMTP Mail Gateway"** section:

1. **Input Fields:**
   - Host (e.g. `smtp.office365.com` or `192.168.1.50`)
   - Port (e.g. `587`, `465`, `25`)
   - Encryption dropdown:
     - `STARTTLS (Port 587)`
     - `SSL/TLS (Port 465)`
     - `Plain / Internal Relay (Port 25)`
   - Checkbox: *"Allow Self-Signed TLS Certificates"* (essential for air-gapped ISRO intranet relays).
   - Username & Password (shows a `Password Configured` badge if already saved).
   - Sender Name (e.g. `ISTRAC Mission Complex`) & Sender Email (`alerts@client.gov.in`).
2. **Action Buttons:**
   - **⚡ Test Connection & Send Probe:** Opens a field for a test email address, runs the test, and shows a green checkmark or a red error alert with plain-English instructions.
   - **💾 Save SMTP Configuration:** Instantly commits the settings to the database and shows a success toast notification.

---

## Part 4: Real-World Scenarios (When a Client Gives Us Values)

### Scenario A: Client uses Microsoft 365 / Outlook
- **Host:** `smtp.office365.com`
- **Port:** `587`
- **Mode:** `STARTTLS`
- **Username:** Client email (e.g., `ops@client.com`)
- **Password:** Office 365 App Password
- **Sender:** `ops@client.com`

### Scenario B: Client uses Google Workspace / Gmail
- **Host:** `smtp.gmail.com`
- **Port:** `587` (STARTTLS) or `465` (SSL)
- **Username:** `notifications@client.com`
- **Password:** 16-character Google App Password
- **Sender:** `notifications@client.com`

### Scenario C: Client is on an Air-Gapped ISRO Intranet (Internal Postfix / Exchange Relay)
- **Host:** Internal IP (e.g. `10.20.0.15` or `mailrelay.istrac.lan`)
- **Port:** `25` or `587`
- **Mode:** `Plain` or `STARTTLS`
- **Allow Self-Signed TLS:** `Checked`
- **Username & Password:** Often left blank if the relay allows unauthenticated traffic from the server's IP address.

---

## Part 5: Before vs. After Comparison

| Operational Task | Current Stage (Today) | After Implementing This Plan |
| :--- | :--- | :--- |
| **Who can configure SMTP?** | Developer only (requires SSH terminal) | **Any Ground Station Admin via Web UI** |
| **How long does it take?** | 20–30 minutes + server downtime | **Under 2 minutes via browser** |
| **Does the app need restart?** | **Yes** (`systemctl restart istrac-backend`) | **No (0 seconds, instant hot-reload)** |
| **Can we verify before saving?** | No (hope it works) | **Yes (live test handshake & test email)** |
| **Is the password safe?** | Plaintext in `.env` file | **Masked in UI, protected by admin role** |
| **Air-gapped intranet support?** | Unstable (ignores TLS without control) | **Full toggle for internal self-signed certs** |
| **Audit trail?** | None | **Every change recorded in AuditLog** |

---

## Summary Checklist for Developers

When approved to implement, the developer follows these 4 exact actions:
1. [ ] **Types & Config:** Add `SmtpConfig` interface in `backend/src/types/types.ts` and add helper env defaults in `backend/src/config/env.ts`.
2. [ ] **Service:** Upgrade `backend/src/services/email.service.ts` to read from `SystemConfig` and provide `testConnection()`.
3. [ ] **API Controller & Router:** Create `smtp.controller.ts` + `smtp.routes.ts` and mount them in `backend/src/index.ts`.
4. [ ] **Admin UI:** Add the SMTP form card in `frontend/src/pages/SystemConfigPanel.tsx`.

No database schema migrations, no external packages, and no breaking changes.
