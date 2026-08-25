# ISTRAC-FMS Design System & UI Specification

> **System:** Indian Space Research Auxiliary Centres — File Management System (ISTRAC-FMS)  
> **Target Theme:** Mission Control & Aerospace Ground Operations  
> **Version:** 1.0.0 Production Baseline  
> **Location:** `documents/DESIGN_SYSTEM.md`

---

## 📑 Table of Contents

1. [Core Design Philosophy & Principles](#1-core-design-philosophy--principles)
2. [Color Palette & Token Architecture](#2-color-palette--token-architecture)
3. [Typography Hierarchy & Font Stacks](#3-typography-hierarchy--font-stacks)
4. [Spacing Scale, Layout Grid & Breakpoints](#4-spacing-scale-layout-grid--breakpoints)
5. [Elevation, Hairlines & Corner Radii](#5-elevation-hairlines--corner-radii)
6. [Core Component Specifications](#6-core-component-specifications)
   - [6.1 Buttons & Action Triggers](#61-buttons--action-triggers)
   - [6.2 Badges & Telemetry Indicators](#62-badges--telemetry-indicators)
   - [6.3 Form Controls & Validation States](#63-form-controls--validation-states)
   - [6.4 Mission Data Tables](#64-mission-data-tables)
   - [6.5 Modals, Drawers & Dialogs](#65-modals-drawers--dialogs)
   - [6.6 Toast Notification System](#66-toast-notification-system)
7. [Iconography & Visual Assets Guidelines](#7-iconography--visual-assets-guidelines)
8. [Component State Conventions](#8-component-state-conventions)
9. [Accessibility & Air-Gap Standards](#9-accessibility--air-gap-standards)

---

## 1. Core Design Philosophy & Principles

The ISTRAC-FMS interface is designed as an **Aerospace Mission Control Operations Console**. It prioritizes density, optical contrast, sub-second scanning speed, and strict visual hierarchy.

### The Four Pillars:

1. **Machine Precision vs. Human Editorial:**
   - **Machine Data** (Coordinates, SHA-256 hashes, file sizes, timestamps, station IDs, byte counts) **MUST always be set in Monospace** (`font-mono` / tabular-nums).
   - **Human Content** (Titles, descriptions, instructions, button labels) **MUST always be set in Sans-Serif** (`font-sans`).

2. **Hairlines over Heavy Drop-Shadows:**
   - Visual depth is achieved through 1px border value shifts (`border-subtle`, `border-default`, `border-bright`) and inset highlights rather than blurry drop shadows.

3. **Restrained Chromatic Voice:**
   - The interface uses a deep space charcoal canvas (`#04070e`, `#080d17`, `#101726`) with a single primary brand voice (**ISRO Mission Blue**: `#1d72fe`) and four distinct telemetry status tones (Nominal Green, Warning Amber, Critical Red, Special Purple).

4. **Zero-Fluff, Direct Action:**
   - Avoid ambiguous terminology. Use standard action terms (**"Log In"**, **"Request Access"**, **"Upload File"**, **"Restore"**) rather than abstract phrasing.

---

## 2. Color Palette & Token Architecture

All colors are declared as CSS custom variables in [`src/index.css`](file:///D:/istrac-fms/frontend/src/index.css) and exposed via Tailwind CSS v4 `@theme`.

### 2.1 Background Planes

| Token | Hex Value | Role / Usage |
|---|---|---|
| `--color-page` | `#04070e` | Master canvas background (deep space black-blue). |
| `--color-page-soft` | `#080d17` | Secondary background for alternating page sections. |
| `--color-surface` | `#0c121e` | Structural headers, topbars, sidebars, and sub-panels. |
| `--color-card` | `#101726` | Elevated cards, data table containers, and modal dialogs. |
| `--color-card-hover` | `#172033` | Interactive hover state for cards and table rows. |

### 2.2 Hairline Borders

| Token | Hex Value | Role / Usage |
|---|---|---|
| `--color-border-subtle` | `#192336` | Hairline dividers between table rows and menu items. |
| `--color-border-default` | `#223049` | Standard structural borders on cards and inputs. |
| `--color-border-bright` | `#364b6e` | Highlighted borders on hover or focused containers. |

### 2.3 Typography & Text Tones

| Token | Hex Value | Role / Usage |
|---|---|---|
| `--color-text-primary` | `#f1f5f9` | High-contrast headings and primary labels (`Slate 100`). |
| `--color-text-secondary` | `#94a3b8` | Readable body text and descriptions (`Slate 400`). |
| `--color-text-muted` | `#64748b` | Sub-labels, metadata hints, and table column headers (`Slate 500`). |
| `--color-text-dim` | `#475569` | Micro-readouts, timestamps, and disabled placeholders (`Slate 600`). |

### 2.4 Brand Accent & Telemetry Status Colors

| Role | Primary Hex | Hover Hex | Subtle BG Hex | Semantic Meaning |
|---|---|---|---|---|
| **Mission Blue** | `#1d72fe` | `#3b82f6` | `rgba(29,114,254,0.12)` | Primary actions, links, focus states. |
| **Nominal Green** | `#10b981` | `#34d399` | `#064e3b` | Operational, verified, active, AOS lock. |
| **Warning Amber** | `#f59e0b` | `#fbbf24` | `#451a03` | Standby, pending approval, acquisition delay. |
| **Critical Red** | `#ef4444` | `#f87171` | `#450a0a` | Suspended, deleted, lost of signal (LOS), errors. |
| **Special Purple** | `#a855f7` | `#c084fc` | `#3b0764` | Super admin badge, special operations telemetry. |

---

## 3. Typography Hierarchy & Font Stacks

### 3.1 Font Stacks

```css
/* Sans-Serif Stack for UI & Editorial Content */
--font-sans: "Inter", "Plus Jakarta Sans", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

/* Monospace Stack for Data, Checksums & Coordinates */
--font-mono: "JetBrains Mono", "SF Mono", "DejaVu Sans Mono", ui-monospace, monospace;
```

### 3.2 Typography Scale & Style Rules

| Level | Size | Weight | Tracking | Line Height | Usage Example |
|---|---|---|---|---|---|
| **Display Hero** | `3.6rem (58px)` | `Bold (700)` | `-0.03em` | `1.12` | Main landing headline (`Spacecraft Operations Area`) |
| **Heading 1 (H1)** | `2.25rem (36px)` | `Bold (700)` | `-0.025em` | `1.2` | Page titles (`Department File Manager`) |
| **Heading 2 (H2)** | `1.5rem (24px)` | `SemiBold (600)` | `-0.02em` | `1.3` | Section headings (`Core Capabilities`) |
| **Heading 3 (H3)** | `1.125rem (18px)` | `SemiBold (600)` | `-0.015em` | `1.4` | Card titles (`Air-Gapped Intranet Security`) |
| **Body Large** | `1.0rem (16px)` | `Regular (400)` | `0` | `1.6` | Hero subtitles, lead paragraphs |
| **Body Regular** | `0.875rem (14px)` | `Regular (400)` | `0` | `1.5` | Standard UI text, descriptions, table cells |
| **Body Small** | `0.75rem (12px)` | `Regular (400)` | `0` | `1.4` | Input hints, timestamp readouts |
| **Eyebrow Label** | `0.6875rem (11px)` | `SemiBold (600)` | `0.12em` | `1.0` | `eyebrow`: Uppercase section markers |
| **Monospace Data** | `0.8125rem (13px)` | `Medium (500)` | `0.02em` | `1.0` | `num`: Coordinates, hashes, file byte counts |

---

## 4. Spacing Scale, Layout Grid & Breakpoints

### 4.1 8pt Baseline Spacing
All paddings and margins adhere to an 8px modular scale:
- `gap-1` (`4px`) / `gap-2` (`8px`) / `gap-3` (`12px`) / `gap-4` (`16px`) / `gap-6` (`24px`) / `gap-8` (`32px`) / `gap-12` (`48px`) / `gap-16` (`64px`).

### 4.2 Standard Containers
- **`shell`**: Max-width `1280px` centered with responsive `1.25rem` side padding.
- **`shell-wide`**: Max-width `1560px` centered for wide mission control tables and monitor arrays.

### 4.3 Breakpoints
- `sm`: `640px` (Tablets / small viewports)
- `md`: `768px` (Medium screens / sidebar collapse trigger)
- `lg`: `1024px` (Standard desktop monitors)
- `xl`: `1280px` (High-resolution workstation displays)
- `2xl`: `1536px` (Dual-monitor console arrays)

---

## 5. Elevation, Hairlines & Corner Radii

### 5.1 Corner Radii Scale
- `--radius-xs` (`3px`): Micro badges and indicators.
- `--radius-sm` (`5px`): Input fields and small buttons.
- `--radius-md` (`8px`): Standard buttons, dropdowns, table cards.
- `--radius-lg` (`12px`): Sub-panels, stat cards, preview boxes.
- `--radius-xl` (`16px`): Modals, large feature cards, terminal windows.
- `--radius-2xl` (`20px`): Section hero cards and visualizer plates.

### 5.2 Shadows & Insets
- **`shadow-card`**: `inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 2px 4px rgba(0, 0, 0, 0.5)`
- **`shadow-card-hover`**: `inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 8px 24px -4px rgba(0, 0, 0, 0.65)`
- **`shadow-glow`**: `0 0 20px rgba(29, 114, 254, 0.25)`

---

## 6. Core Component Specifications

### 6.1 Buttons & Action Triggers ([`src/components/Button.tsx`](file:///D:/istrac-fms/frontend/src/components/Button.tsx))

| Variant | Visual Style | Use Case |
|---|---|---|
| **Primary** | Solid `#1d72fe` background, white text, subtle top inset highlight, hover `#3b82f6`. | Main call to action (`Log In`, `Upload`, `Approve`). |
| **Secondary** | `#172033` surface background, `#f1f5f9` text, `border-subtle`. | Secondary actions (`Cancel`, `View Details`). |
| **Outline** | Transparent background, `border-default`, `#f1f5f9` text, hover `bg-card-hover`. | Auxiliary actions (`Request Access`, `Add Filter`). |
| **Danger** | Solid `#ef4444` or critical outline with red text. | Destructive actions (`Delete File`, `Suspend User`, `Revoke`). |
| **Ghost** | Transparent background, no border, text `#94a3b8`, hover `text-white`. | Toolbar icon buttons (`Close`, `Refresh`, `More Options`). |

---

### 6.2 Badges & Telemetry Indicators ([`src/components/Badge.tsx`](file:///D:/istrac-fms/frontend/src/components/Badge.tsx))

Badges use 11px uppercase monospace font with status indicator dots:
- **Active / Nominal:** Green dot + `bg-nominal/10 text-nominal border-nominal/30`
- **Pending / Warning:** Amber dot + `bg-warning/10 text-warning border-warning/30`
- **Suspended / Critical:** Red dot + `bg-critical/10 text-critical border-critical/30`
- **Read Only:** Blue dot + `bg-accent/10 text-accent-light border-accent/30`

---

### 6.3 Form Controls & Validation States ([`src/components/Input.tsx`](file:///D:/istrac-fms/frontend/src/components/Input.tsx))

- **Background:** `bg-surface` (`#0c121e`)
- **Border:** `border-default` (`#223049`), transitions to `border-accent` on focus with a `2px` focus ring.
- **Label:** `col-label` uppercase 11px font with `#94a3b8` tone.
- **Error State:** Red border `border-critical`, error message displayed below in 12px red font.
- **Tabular Inputs:** File hashes, email addresses, and timestamps automatically adopt `font-mono`.

---

### 6.4 Mission Data Tables ([`src/components/Table.tsx`](file:///D:/istrac-fms/frontend/src/components/Table.tsx))

- **Container:** `rounded-xl border border-border-subtle bg-card overflow-hidden`
- **Header:** Sticky `bg-surface`, 11px uppercase `col-label` styling with sort arrow indicators.
- **Rows:** `border-b border-border-subtle hover:bg-card-hover transition-colors`
- **Numerical Columns:** Right-aligned or left-aligned with `num` tabular fonts.

---

### 6.5 Modals & Dialogs ([`src/components/Modal.tsx`](file:///D:/istrac-fms/frontend/src/components/Modal.tsx))

- **Backdrop:** `bg-page/80 backdrop-blur-md`
- **Dialog Surface:** `bg-card border border-border-default rounded-2xl shadow-2xl max-w-lg`
- **Header:** Title + description + close `X` button.
- **Footer:** Action bar right-aligned with `Cancel` (Secondary) and `Confirm` (Primary).

---

### 6.6 Toast Notification System ([`src/components/Toast.tsx`](file:///D:/istrac-fms/frontend/src/components/Toast.tsx))

- **Position:** Fixed top-right / bottom-right stack (`z-50`).
- **Dismissal:** 5-second automatic timer with manual close icon.
- **Variants:** `success` (green pulse), `error` (red pulse), `info` (blue pulse).

---

## 7. Iconography & Visual Assets Guidelines

- **Icon Set:** `lucide-react`
- **Standard Sizing:**
  - Micro icons in badges / buttons: `14px - 16px` (stroke width `1.8 - 2.2`)
  - Standard action icons: `18px - 20px` (stroke width `1.8`)
  - Large feature icons: `24px` (stroke width `1.8`)
- **Air-Gap Mandate:** Zero external SVG links or web fonts. All icons are compiled locally via Vite.

---

## 8. Component State Conventions

| State | Visual Treatment |
|---|---|
| **Hover** | Surface value increases by 1 shade (`bg-card` ➔ `bg-card-hover`), borders brighten (`border-subtle` ➔ `border-default`), text transitions to pure white. |
| **Active / Pressed** | Button translates down by `1px` or scales down to `0.98`. |
| **Focus-Visible** | Visible 2px outline in `--color-accent` with 2px offset. |
| **Disabled** | Opacity reduced to `40%`, cursor set to `not-allowed`, click events suppressed. |
| **Loading / Skeleton** | `bg-card-hover animate-pulse` shimmer with rounded corners. |

---

## 9. Accessibility & Air-Gap Standards

- **Contrast Ratios:** All primary text against canvas meets WCAG AAA standards (> 7:1 contrast).
- **Keyboard Navigation:** Full keyboard navigation (`Tab`, `Shift+Tab`, `Enter`, `Esc` for modals, `Ctrl+K` for global search).
- **ARIA Compliance:** All interactive icons include `aria-label` or `aria-hidden="true"`.
- **Zero Internet Leakage:** No CDN imports, Google Fonts, or remote analytics. All fonts and assets are embedded and cached locally.
