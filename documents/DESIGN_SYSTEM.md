# ISTRAC-SIMS Design System & UI Specification

> **System:** Indian Space Research Organisation — Satellite Information Management System (ISTRAC-SIMS)  
> **Target Theme:** Mission Control Operations & Aerospace Ground Telemetry  
> **Version:** 1.2.0 Production Baseline  
> **Location:** `documents/DESIGN_SYSTEM.md`

---

## 📑 Table of Contents

1. [Core Design Philosophy & Principles](#1-core-design-philosophy--principles)
2. [Color Palette & Token Architecture](#2-color-palette--token-architecture)
   - [2.1 Background Planes & Surfaces](#21-background-planes--surfaces)
   - [2.2 Hairline Borders & Dividers](#22-hairline-borders--dividers)
   - [2.3 Text Tones & Contrast Hierarchy](#23-text-tones--contrast-hierarchy)
   - [2.4 Brand Accent & Telemetry Status Tones](#24-brand-accent--telemetry-status-tones)
3. [Typography Hierarchy & Font Stacks](#3-typography-hierarchy--font-stacks)
   - [3.1 Font Stacks & Dual-Font Discipline](#31-font-stacks--dual-font-discipline)
   - [3.2 Type Scale & Hierarchy](#32-type-scale--hierarchy)
4. [Spacing Scale, Layout Grid & Breakpoints](#4-spacing-scale-layout-grid--breakpoints)
5. [Elevation, Hairlines & Corner Radii](#5-elevation-hairlines--corner-radii)
6. [Core Component Specifications](#6-core-component-specifications)
   - [6.1 Buttons & Action Triggers](#61-buttons--action-triggers)
   - [6.2 Badges & Telemetry Status Indicators](#62-badges--telemetry-status-indicators)
   - [6.3 Form Controls & Validation States (`Input`, `Select`, `Textarea`)](#63-form-controls--validation-states)
   - [6.4 Auth Frame & Security Cards (`AuthFrame`, `AuthCard`)](#64-auth-frame--security-cards)
   - [6.5 Password Strength Meter (`PasswordStrengthMeter`)](#65-password-strength-meter)
   - [6.6 Mission Data Tables & Repository Grids](#66-mission-data-tables--repository-grids)
   - [6.7 Dual-Month Mission Operations Calendar (`MissionCalendar`)](#67-dual-month-mission-operations-calendar)
   - [6.8 Modals, File Previews & Version Drawers](#68-modals-file-previews--version-drawers)
   - [6.9 Toast Notification System (`toastStore`)](#69-toast-notification-system)
7. [Iconography Guidelines](#7-iconography-guidelines)
8. [Air-Gap, Performance & Accessibility Standards](#8-air-gap-performance--accessibility-standards)

---

## 1. Core Design Philosophy & Principles

The ISTRAC-SIMS interface is architected as an **Aerospace Ground Station Mission Control Operations Console**. It prioritizes high optical density, rapid scanning under low-light control room environments, sub-second telemetry recognition, and strict visual hierarchy.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ISTRAC-SIMS AESTHETIC                           │
├────────────────────────────────────────────────────────────────────────┤
│  • Deep Space Charcoal Planes (#04070e / #080d17 / #0c121e)            │
│  • Hairline Borders (1px #223049) over heavy drop shadows              │
│  • Cyan/ISRO Blue Active Glows (#00f0ff / #1d72fe)                     │
│  • Strict Tabular Monospace numbers for telemetry and file metrics     │
│  • Clear Telemetry Color States (Nominal, Warning, Critical, Special) │
└────────────────────────────────────────────────────────────────────────┘
```

### The Four Foundational Pillars:

1. **Machine Precision vs. Human Editorial:**
   - **Machine Data** (Coordinates, SHA-256 hashes, file sizes, timestamps, station IDs, telemetry counts, UTC dates) **MUST always be set in Monospace** (`font-mono` / tabular-nums).
   - **Human Content** (Titles, descriptions, instructions, button labels, operational division names) **MUST always be set in Sans-Serif** (`font-sans`).

2. **Hairlines over Heavy Drop-Shadows:**
   - Depth and boundaries are established via 1px border value shifts (`border-subtle`, `border-default`, `border-bright`) and inset highlights rather than blurred elevation shadows.

3. **Restrained Chromatic Voice:**
   - The canvas remains neutral deep space charcoal. Color is reserved exclusively for interactive states and operational status telemetry.

4. **Zero-Fluff, Direct Action:**
   - Action verbs must be concise, standard, and imperative: **"Log In"**, **"Request Access"**, **"Upload File"**, **"Restore"**, **"Reconcile Storage"**, **"Approve"**.

---

## 2. Color Palette & Token Architecture

All colors are declared as CSS custom variables in `src/index.css` and bound to Tailwind CSS utility classes.

### 2.1 Background Planes & Surfaces
| Token / Utility | Hex Value | Semantic Usage |
| :--- | :--- | :--- |
| `bg-page` / `--color-page` | `#04070e` | Master canvas background (deep space black-blue). |
| `bg-page-soft` / `--color-page-soft` | `#080d17` | Secondary background for alternate page sections. |
| `bg-surface` / `--color-surface` | `#0c121e` | Structural sidebars, topbars, search bars, and sub-navs. |
| `bg-card` / `--color-card` | `#101726` | Elevated cards, repository data containers, modal dialogs. |
| `bg-card-hover` | `#172033` | Interactive hover state for table rows and cards. |
| `bg-input` | `#09101f` | Form field background with optical inset. |
| `bg-input-focus` | `#0c162b` | Form field background on focus state. |

### 2.2 Hairline Borders & Dividers
| Token / Utility | Hex Value | Semantic Usage |
| :--- | :--- | :--- |
| `border-border-subtle` | `#192336` | Hairline dividers between table rows, sub-menu items. |
| `border-border-default` | `#223049` | Standard structural borders on cards, modals, and inputs. |
| `border-border-bright` | `#364b6e` | Highlighted borders on hover, card focus, active selection. |
| `border-accent/30` | `rgba(0,240,255,0.3)` | Brand active container hairline highlight. |

### 2.3 Text Tones & Contrast Hierarchy
| Token / Utility | Hex Value | Contrast & Usage |
| :--- | :--- | :--- |
| `text-text-primary` | `#f1f5f9` (Slate-100) | High-contrast body, primary headers, values. |
| `text-text-secondary` | `#94a3b8` (Slate-400) | Subtitles, field labels, metadata descriptions. |
| `text-text-dim` | `#64748b` (Slate-500) | Timestamps, placeholder text, hints, helper copy. |
| `text-text-muted` | `#475569` (Slate-600) | Disabled controls, inactive icons, breadcrumb slashes. |

### 2.4 Brand Accent & Telemetry Status Tones
| State Tone | Primary Accent | Subtle Surface BG | Hairline Border | Semantic Meaning |
| :--- | :--- | :--- | :--- | :--- |
| **ISRO Cyan** | `#00f0ff` | `rgba(0, 240, 255, 0.12)` | `rgba(0, 240, 255, 0.30)` | Brand primary, active navigation, focus rings, links. |
| **ISRO Blue** | `#1d72fe` | `rgba(29, 114, 254, 0.15)` | `rgba(29, 114, 254, 0.35)` | Primary action buttons, prominent submit CTAs. |
| **Nominal Green** | `#10b981` | `rgba(16, 185, 129, 0.12)` | `rgba(16, 185, 129, 0.30)` | Operational, online, verified, active pass, healthy HDD. |
| **Warning Amber** | `#f59e0b` | `rgba(245, 158, 11, 0.12)` | `rgba(245, 158, 11, 0.30)` | Pending approval, degraded storage, sync in-progress. |
| **Critical Red** | `#ef4444` | `rgba(239, 68, 68, 0.12)` | `rgba(239, 68, 68, 0.30)` | Suspended account, storage error, deleted file, validation error. |
| **Special Purple** | `#a855f7` | `rgba(168, 85, 247, 0.15)` | `rgba(168, 85, 247, 0.30)` | Super admin badge, version history drawer, orbit maneuvers. |

---

## 3. Typography Hierarchy & Font Stacks

### 3.1 Font Stacks & Dual-Font Discipline
- **Primary Sans:** `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Telemetry Monospace:** `"JetBrains Mono", "Fira Code", SFMono-Regular, Menlo, Monaco, Consolas, monospace`

```tsx
// Rule of Thumb:
<h1 className="font-sans font-bold text-text-primary text-xl">
  Orbit Determination Report
</h1>
<span className="font-mono text-xs text-accent-light">
  SHA256: 8f4a12...9b · 48.2 MB · 2026-08-27T10:30:00Z
</span>
```

### 3.2 Type Scale & Hierarchy
| Level | Font / Weight | Size / Line Height | Tracking | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Display 1** | Sans / Bold (700) | `text-3xl` (30px / 36px) | `tracking-tight` | Landing hero headlines. |
| **Page Title (H1)** | Sans / Bold (700) | `text-xl` (20px / 28px) | `tracking-tight` | Major view headers, modal titles. |
| **Section Header (H2)** | Sans / SemiBold (600) | `text-lg` (18px / 24px) | `tracking-normal` | Card container titles, table headers. |
| **Eyebrow / Status Tag** | Sans / Bold (700) | `text-[10px]` (10px / 14px) | `tracking-wider uppercase` | `SEC LEVEL 4`, `OPERATIONAL STATUS`. |
| **Body Standard** | Sans / Regular (400) | `text-sm` (14px / 20px) | `tracking-normal` | General copy, form labels, tooltips. |
| **Body Compact / Sub** | Sans / Regular (400) | `text-xs` (12px / 16px) | `tracking-normal` | Helper text, secondary descriptions. |
| **Telemetry / Data Tag** | Mono / Medium (500) | `text-xs` (12px / 16px) | `tracking-normal tabular-nums` | File sizes, hashes, coordinate vectors. |

---

## 4. Spacing Scale, Layout Grid & Breakpoints

- **Baseline Grid:** 4px micro-grid / 8px component rhythm (`p-2` = 8px, `p-3` = 12px, `p-4` = 16px, `p-6` = 24px, `p-8` = 32px).
- **Page Container Max-Width:** `max-w-7xl` (1280px) with responsive horizontal padding (`px-4 sm:px-6 lg:px-8`).
- **Sidebar Widths:**
  - Admin/Dashboard Sidebar: `w-64` (256px) expanded, `w-16` (64px) collapsed.
- **Breakpoints:**
  - `sm`: 640px (Mobile landscape / small tablets)
  - `md`: 768px (Tablets / collapsed desktop layouts)
  - `lg`: 1024px (Standard desktop / dual-pane dashboards)
  - `xl`: 1280px (Wide mission operations console)
  - `2xl`: 1536px (Multi-monitor flight console)

---

## 5. Elevation, Hairlines & Corner Radii

- **Corner Radii:**
  - Buttons, Inputs, Badges: `rounded-lg` (8px)
  - Cards, Modal Containers, Alert Boxes: `rounded-xl` (12px)
  - Full Pills / Status Dots: `rounded-full` (9999px)
- **Border Treatments:**
  - All cards use `border border-border-default` with background `#101726`.
  - Focused interactive elements receive `focus:border-accent focus:ring-1 focus:ring-accent/40 outline-none`.

---

## 6. Core Component Specifications

### 6.1 Buttons & Action Triggers
The [`Button`](file:///D:/istrac-fms/frontend/src/components/Button.tsx) component supports 4 primary variants:

```tsx
// 1. Primary Action (ISRO Blue with subtle glow)
<Button variant="primary" size="md">Upload Telemetry</Button>
// Class: bg-accent hover:bg-accent-hover text-white font-medium shadow-md shadow-accent/20

// 2. Outline / Secondary
<Button variant="outline" size="md">Download Dataset</Button>
// Class: border border-border-default hover:border-border-bright bg-surface/50 text-text-primary

// 3. Ghost / Subtle
<Button variant="ghost" size="sm">Cancel</Button>
// Class: hover:bg-card-hover text-text-secondary hover:text-text-primary

// 4. Danger / Destructive
<Button variant="danger" size="md">Purge File</Button>
// Class: bg-critical/15 hover:bg-critical/25 text-critical border border-critical/30
```

---

### 6.2 Badges & Telemetry Status Indicators
The [`Badge`](file:///D:/istrac-fms/frontend/src/components/Badge.tsx) component renders status chips:

```tsx
<Badge variant="nominal">ACTIVE PASS</Badge>
<Badge variant="warning">PENDING APPROVAL</Badge>
<Badge variant="critical">STORAGE DEGRADED</Badge>
<Badge variant="purple">SUPER ADMIN</Badge>
<Badge variant="cyan">AOS LOCK</Badge>
```

**Standard Badge Styling:** `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border`

---

### 6.3 Form Controls & Validation States
The [`Input`](file:///D:/istrac-fms/frontend/src/components/Input.tsx) component provides an all-in-one accessible input with:
- Uppercase column label (`col-label`)
- Automatic optical inset background (`bg-[#09101f]`)
- **Integrated Password Toggle:** Automatically renders a single `Eye` / `EyeOff` button at `right-3` when `type="password"`. **Never wrap with external eye toggle buttons.**
- Accessible error and guidance hint text.

```tsx
// Standard Text Input:
<Input
  id="employeeId"
  label="ISRO Employee ID *"
  placeholder="e.g. BLR-1048"
  error={errors.employeeId?.message}
  {...register("employeeId")}
/>

// Password Input (Toggle handled automatically):
<Input
  id="password"
  label="Account Password *"
  type="password"
  placeholder="••••••••••••"
  error={errors.password?.message}
  {...register("password")}
/>
```

---

### 6.4 Auth Frame & Security Cards
Used across `Login.tsx`, `Register.tsx`, `ForgetPassword.tsx`, and `ForcePasswordChange.tsx`:
- [`AuthFrame`](file:///D:/istrac-fms/frontend/src/components/AuthFrame.tsx): Deep-space backdrop with telemetry grid pattern and top-right navigation actions.
- [`AuthCard`](file:///D:/istrac-fms/frontend/src/components/AuthCard.tsx): Bordered security card featuring an uppercase eyebrow tag (`eyebrow="Air-Gapped Intranet"`) and security badge (`status="SEC LEVEL 4"`).

---

### 6.5 Password Strength Meter
The [`PasswordStrengthMeter`](file:///D:/istrac-fms/frontend/src/components/PasswordStrengthMeter.tsx) displays 4 animated progress segments:
- Segment 1: At least 10 characters
- Segment 2: Contains uppercase letter (`A-Z`)
- Segment 3: Contains a number (`0-9`)
- Segment 4: Contains a special character (`!@#$%^&*`)
Colors transition dynamically from Red (`bg-critical`) → Amber (`bg-warning`) → Green (`bg-nominal`).

---

### 6.6 Mission Data Tables & Repository Grids
- **View Toggle Mode:** Supports both `table` (compact monospace list) and `card` (visual telemetry preview card) modes.
- **Table Headers:** Monospace uppercase headers (`font-mono text-xs uppercase tracking-wider text-text-dim`).
- **Alternating Hairline:** `divide-y divide-border-subtle` with hover row highlight (`hover:bg-card-hover/60`).

---

### 6.7 Dual-Month Mission Operations Calendar
The [`MissionCalendar`](file:///D:/istrac-fms/frontend/src/components/MissionCalendar.tsx) component renders:
- Side-by-side dual-month navigation (Current Month + Next Month).
- Color-coded day markers:
  - Cyan: Satellite Tracking Pass
  - Purple: Orbital Maneuver / Stationkeeping
  - Amber: Ground Station Maintenance
  - Green: Mission Milestone / Anniversary
- Interactive Pass Detail modal with sub-system parameters (Doppler lock, AOS/LOS, elevation).

---

### 6.8 Modals, File Previews & Version Drawers
- [`Modal`](file:///D:/istrac-fms/frontend/src/components/Modal.tsx): Centered dialog with backdrop blur (`backdrop-blur-md bg-black/70`), top close button, and escape key listener.
- [`FilePreviewModal`](file:///D:/istrac-fms/frontend/src/components/FilePreviewModal.tsx): Dynamic preview resolver rendering images, streaming video with range seek, formatted PDF reader via PDF.js worker, and syntax-highlighted telemetry raw text.
- [`VersionHistoryPanel`](file:///D:/istrac-fms/frontend/src/components/VersionHistoryPanel.tsx): Right-side slide-over sheet displaying timestamped version chains (v1, v2, v3...), author names, SHA-256 hashes, and download/restore triggers.

---

### 6.9 Toast Notification System
The [`ToastContainer`](file:///D:/istrac-fms/frontend/src/components/ToastContainer.tsx) component binds to `useToastStore`:
- **Position:** Bottom-right viewport (`fixed bottom-5 right-5 z-50`).
- **Auto-Dismiss:** 4000ms duration per toast with hover-pause math.
- **Tone Colors:** `nominal` (Green), `warning` (Amber), `critical` (Red), `info` (Cyan).

---

## 7. Iconography Guidelines

- **Library:** `lucide-react` exclusively.
- **Sizes:**
  - `size={12}` or `size={13}`: Inline badge icons, table micro-actions.
  - `size={14}` or `size={16}`: Standard button icons, form control indicators.
  - `size={18}` or `size={20}`: Navigation sidebar icons, modal headers.
  - `size={24}`+: Empty state illustrations, hero banners.
- **Stroke Width:** `strokeWidth={1.8}` (or `1.5` for large icons) to maintain machine-drawn hairline precision.

---

## 8. Air-Gap, Performance & Accessibility Standards

1. **Air-Gap Compliance (Zero External CDNs):**
   - All fonts, icons, libraries (`pdfjs-dist`), and styles are compiled and bundled locally via Vite.
   - Zero runtime requests to external font foundries (Google Fonts) or script CDNs.

2. **Optical Contrast (WCAG 2.1 AAA Compliance):**
   - Text color `#f1f5f9` against `#04070e` provides an optical contrast ratio exceeding **16:1** (well above the 7:1 AAA standard).
   - Form inputs include clear focus outlines (`focus:border-accent`) and distinct error states.

3. **Motion Reduction Support:**
   - Interactive transitions are limited to `150ms` (`duration-150 ease-out`).
   - Carousels and banners support pause-on-hover and reduced-motion user preferences.
