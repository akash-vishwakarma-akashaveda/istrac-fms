# 🛰️ Local RHEL / Rocky Linux 9 VirtualBox Setup & Testing Guide

This guide provides a step-by-step, beginner-friendly walkthrough to set up a clean **Rocky Linux 9** (100% binary-compatible with **Red Hat Enterprise Linux 9**) virtual machine using **Oracle VirtualBox** on Windows, and test the automated deployment script ([`setup-rhel.sh`](file:///C:/Users/AYAN%20SHARMA/Desktop/project/setup-rhel.sh)).

---

## Table of Contents
1. [Prerequisites & Downloads](#1-prerequisites--downloads)
2. [Creating the Virtual Machine in VirtualBox](#2-creating-the-virtual-machine-in-virtualbox)
3. [Installing Rocky Linux 9](#3-installing-rocky-linux-9)
4. [Post-Installation Configuration & First Snapshot](#4-post-installation-configuration--first-snapshot)
5. [Transferring Project Files to the VM](#5-transferring-project-files-to-the-vm)
6. [Executing the Setup Script](#6-executing-the-setup-script)
7. [Testing the Whole App from Windows](#7-testing-the-whole-app-from-windows)
8. [Troubleshooting & Rollback via Snapshots](#8-troubleshooting--rollback-via-snapshots)

---

## 1. Prerequisites & Downloads

Download the following two free installers onto your Windows machine:

1. **Oracle VirtualBox for Windows:**
   - URL: [https://www.virtualbox.org/wiki/Downloads](https://www.virtualbox.org/wiki/Downloads)
   - Download **Windows hosts** and install it.
   - *(Optional but recommended)*: On the same page, download and double-click to install the **VirtualBox Extension Pack**.

2. **Rocky Linux 9 "Minimal" ISO:**
   - URL: [https://rockylinux.org/download](https://rockylinux.org/download)
   - Choose Architecture: **x86_64**
   - Click **Minimal** (~2.2 GB ISO).
   - *(Why Minimal? It comes without unnecessary desktop GUI bloat and matches headless enterprise server environments).*

---

## 2. Creating the Virtual Machine in VirtualBox

1. Open **Oracle VM VirtualBox**.
2. Click the blue **New** button (or press `Ctrl + N`).
3. Fill in the **Name and Operating System**:
   - **Name:** `RockyLinux9-ISTRAC-Test`
   - **Folder:** Keep default (or choose an SSD drive with at least 40 GB free space).
   - **ISO Image:** Click the dropdown $\rightarrow$ **Other...** $\rightarrow$ select the downloaded `Rocky-9-xxx-Minimal.iso`.
   - **Type:** `Linux`
   - **Version:** `Red Hat (64-bit)`
   - Check the box: **Skip Unattended Installation** *(recommended so you control credentials)*.
   - Click **Next**.
4. **Hardware Settings:**
   - **Base Memory (RAM):** Slide to at least **4096 MB (4 GB)**. *(Minimum 2048 MB, but 4096 MB ensures smooth Node.js compilation and Vite build).*
   - **Processors (CPU):** Set to at least **2 CPUs**.
   - Check **Enable EFI** (optional, default unchecked is fine).
   - Click **Next**.
5. **Virtual Hard Disk:**
   - Select **Create a Virtual Harddisk Now**.
   - **Disk Size:** Set to **35.00 GB** or **40.00 GB**.
   - Click **Next**, then click **Finish**.

### ⚠️ Network Configuration (Crucial Step)
Before starting the VM, configure how Windows will communicate with it:

1. Click on your newly created VM in the list, then click the yellow **Settings** icon (`Ctrl + S`).
2. Go to the **Network** tab $\rightarrow$ **Adapter 1**.
3. Choose one of the following two modes:
   - **Mode A: Bridged Adapter (Easiest for Home/Personal Wi-Fi)**
     - Set *Attached to:* **Bridged Adapter**.
     - Set *Name:* Select your active Windows Wi-Fi or Ethernet card.
     - *Result:* The VM gets its own local IP address on your network (e.g. `192.168.1.55`), just like a separate physical laptop.
   - **Mode B: NAT with Port Forwarding (Best if Office/College Wi-Fi blocks Bridged Mode)**
     - Leave *Attached to:* **NAT**.
     - Click **Advanced** $\rightarrow$ click **Port Forwarding**.
     - Add these rules:
       - **Rule 1 (SSH):** Host Port `2222` | Guest Port `22`
       - **Rule 2 (HTTP Web):** Host Port `8080` | Guest Port `80`
       - **Rule 3 (Backend API):** Host Port `3000` | Guest Port `3000`
4. Click **OK** to save settings.

---

## 3. Installing Rocky Linux 9

1. Select your VM and click the green **Start** button.
2. In the boot menu, use the arrow keys to select:
   `Install Rocky Linux 9.x` and press **Enter**.
3. **Language Selection:** Select `English` $\rightarrow$ `English (United States)` $\rightarrow$ click **Continue**.
4. You will see the **Installation Summary** dashboard. Configure these 4 sections:
   - **Installation Destination:**
     - Click it, select the virtual disk with a checkmark, leave Storage Configuration on **Automatic**, and click **Done** (top-left).
   - **Network & Host Name:**
     - Click it.
     - Toggle the switch at top-right to **ON** (Connected).
     - Notice the assigned IP address (e.g., `192.168.x.x` or `10.0.2.15`).
     - Set Hostname (e.g., `istrac-vm`) and click **Apply**.
     - Click **Done**.
   - **Root Password:**
     - Click it, enter a secure root password (e.g. `RootSecure123!`), confirm it, and click **Done**.
   - **User Creation:**
     - Click it.
     - **Full Name:** `istrac`
     - **Username:** `istrac`
     - Check the box: **Make this user administrator** *(very important, grants `sudo` access)*.
     - Set a password (e.g. `Istrac123!`) and click **Done**.
5. Click **Begin Installation** (bottom right).
6. Wait 3–5 minutes for installation to finish.
7. Click **Reboot System**.

*(If it boots back into the installer, go to VirtualBox menu: **Devices** $\rightarrow$ **Optical Drives** $\rightarrow$ **Remove disk from virtual drive**, then restart).*

---

## 4. Post-Installation Configuration & First Snapshot

Log in at the terminal prompt using your username (`istrac`) and password.

### Step 4.1: Find the VM's IP Address
Run:
```bash
ip a
```
Look for your network interface (`enp0s3` or similar) and note the IPv4 address (e.g. `192.168.1.150`).

### Step 4.2: Update & Install Basic Tools
Run:
```bash
sudo dnf update -y
sudo dnf install -y git curl wget tar firewalld
```

### Step 4.3: 📸 Take a "Clean State" Snapshot (Your Superpower)
Before running the deployment script, take a snapshot. If anything fails, you can roll back to this exact second in 5 seconds.

1. In the VirtualBox VM window menu bar:
   Click **Machine** $\rightarrow$ **Take Snapshot...**
2. **Snapshot Name:** `Clean OS Ready for Setup`
3. **Description:** `Fresh Rocky Linux 9 with updates and network configured.`
4. Click **OK**.

---

## 5. Transferring Project Files to the VM

Open **PowerShell** on your Windows host machine.

### Method A: Using SCP (Secure Copy from Windows)

Replace `<VM_IP>` with your VM's IP address (e.g. `192.168.1.150`):

```powershell
# Run from Windows PowerShell:
scp -r "C:\Users\AYAN SHARMA\Desktop\project" istrac@<VM_IP>:/home/istrac/istrac-fms
```

*(If you used NAT with Port Forwarding on port 2222):*
```powershell
scp -P 2222 -r "C:\Users\AYAN SHARMA\Desktop\project" istrac@127.0.0.1:/home/istrac/istrac-fms
```

### Method B: Using Git (If code is hosted on GitHub/GitLab)

Inside the VM terminal, run:
```bash
git clone <YOUR_GIT_REPO_URL> /home/istrac/istrac-fms
```

---

## 6. Executing the Setup Script

Connect to your VM via SSH from Windows PowerShell (or use the VirtualBox terminal window):

```powershell
# From Windows PowerShell:
ssh istrac@<VM_IP>
```

Once inside the VM:

1. Navigate to the project directory:
   ```bash
   cd /home/istrac/istrac-fms
   ```

2. Make the scripts executable:
   ```bash
   chmod +x setup-rhel.sh manage-services-rhel.sh
   ```

3. Execute the automated setup script with `sudo`:
   ```bash
   sudo ./setup-rhel.sh
   ```

### What the script will execute automatically:
1. **System packages:** Installs EPEL, C++ compiler, OpenSSL, SELinux tools.
2. **Node.js 20 LTS:** Downloads and configures Node.js 20 & npm.
3. **MariaDB Server:** Installs MariaDB, initializes databases & grants privileges.
4. **Redis:** Installs, enables, and starts Redis on port 6379.
5. **Storage mount:** Configures `/mnt/istrac_storage` and assigns SELinux contexts.
6. **Backend setup:** Generates Prisma client, runs DB migrations, seeds initial data, builds TypeScript.
7. **Frontend setup:** Builds Vite production bundle into `/frontend/dist`.
8. **PM2 & Nginx:** Starts backend with PM2 and sets up Nginx reverse proxy on port 80.
9. **Firewall:** Opens ports 80 & 443 in `firewalld`.
10. **Health verification:** Runs an automated probe.

When completed, you will see:
```text
==============================================================================
 🚀 ISTRAC-SIMS DEPLOYMENT ON RED HAT ENTERPRISE LINUX IS COMPLETE!
==============================================================================
```

---

## 7. Testing the Whole App from Windows

Keep the VM running, and perform the tests from your **Windows host**:

### Test 1: Service Status Check (Inside VM)
Inside the VM or SSH session, run:
```bash
./manage-services-rhel.sh status
```
Ensure all items (Nginx, PM2 Backend, MariaDB, Redis, Storage) display green **ACTIVE / Running**.

---

### Test 2: Health Endpoint Probe (From Windows PowerShell)

Run this in Windows PowerShell:
```powershell
# If using Bridged Mode:
Invoke-RestMethod -Uri "http://<VM_IP>/api/health"

# If using NAT Port Forwarding:
Invoke-RestMethod -Uri "http://localhost:8080/api/health"
```

**Expected JSON Response:**
```json
status    db  redis hdd timestamp
------    --  ----- --- ---------
ok        ok  ok    ok  2026-09-10T...
```
*(All 4 components must show `ok`)*.

---

### Test 3: Test Login API (From Windows PowerShell)

```powershell
Invoke-RestMethod -Uri "http://<VM_IP>/api/auth/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"email":"admin@istrac.local","password":"ChangeMe123!"}'
```
*Expected: Returns an HTTP 200 payload containing the JWT token and user profile.*

---

### Test 4: Web Browser Test (Chrome / Edge on Windows)

1. Open your browser on Windows and navigate to:
   - Bridged Mode: `http://<VM_IP>/`
   - NAT Port Forwarding: `http://localhost:8080/`
2. You should see the **ISTRAC-SIMS Login Portal**.
3. Press `F12` on Windows to open Browser Developer Tools.
4. Log in with the default seeded credentials:
   - **Email:** `admin@istrac.local`
   - **Password:** `ChangeMe123!`
5. Verify:
   - Dashboard loads with satellite facilities and metrics.
   - Network tab shows no `502 Bad Gateway` errors.
   - WebSocket connection at `/ws` shows status `101 Switching Protocols`.

---

## 8. Troubleshooting & Rollback via Snapshots

### How to Roll Back if Something Fails:
1. In VirtualBox, click **Machine** $\rightarrow$ **Close** $\rightarrow$ **Power off the machine**.
2. Go to the VirtualBox main manager window.
3. Select your VM $\rightarrow$ click the menu icon next to the VM name $\rightarrow$ select **Snapshots**.
4. Click on `Clean OS Ready for Setup` $\rightarrow$ click **Restore**.
5. Uncheck "Create a snapshot of the current machine state" and click **Restore**.
6. Start the VM again. You are now back to a 100% clean OS in seconds!

### Common Fixes:

* **Nginx shows `502 Bad Gateway`:**
  Check PM2 logs on the VM:
  ```bash
  pm2 logs istrac-sims-backend --lines 50
  ```
  Ensure SELinux allows Nginx network reverse proxying:
  ```bash
  sudo setsebool -P httpd_can_network_connect 1
  sudo systemctl restart nginx
  ```

* **Health check reports `hdd: error`:**
  Verify `/mnt/istrac_storage` directory permissions:
  ```bash
  sudo chmod -R 775 /mnt/istrac_storage
  ```

* **Windows cannot ping or curl `<VM_IP>`:**
  Check VM firewall:
  ```bash
  sudo firewall-cmd --permanent --add-service=http
  sudo firewall-cmd --reload
  ```
  If on Wi-Fi and Bridged mode does not obtain an IP, switch to **NAT with Port Forwarding** (Port 8080 $\rightarrow$ 80).
