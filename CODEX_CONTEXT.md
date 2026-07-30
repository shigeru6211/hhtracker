# HHTracker — Codex Handover Context

This document provides context and development guidelines for Codex to maintain and extend HHTracker.

## 1. Project Overview
* **App Name**: HHTracker
* **Architecture**: Serverless Vanilla JS (ES6+) PWA. It reads and writes data directly to the user's Google Sheets using the Google Sheets API v4 and Google Identity Services 3.x.
* **Production URL**: https://shigeru6211.github.io/hhtracker/
* **Repository (Deployment)**: `https://github.com/shigeru6211/hhtracker.git` (main branch)
* **Design Theme**: Midnight Glassmorphism (dark gradient bg, semi-transparent white borders with `backdrop-filter: blur(16px)`).

---

## 2. Spreadsheet Database Structure
The spreadsheet contains two main sheets (tabs):
1. **`Records` (or table name `hhtracker`)**: Stores daily record rows. First column is `日付` (YYYY-MM-DD), followed by habit columns, with `メモ` (Notes) as the last column.
2. **`Settings`**: Stores habit metadata with columns: `id`, `name`, `type` (`stars` | `check` | `memo` | `number`), `icon`, `prevDayCarryover` (`true`|`false`), `category` (`Health` | `Learning` | `Meals` | `Other`), `description`, `hidden` (`true`|`false`), and `column` (`left` | `right`).

### Dynamic Sheet Name Resolution (Google Sheets "Tables" Support)
If a user converts the Google Sheet into a native "Table", the tab name automatically renames from `Records` to the table name `hhtracker`.
* On app launch or reconnection, `resolveSheetNames()` is executed to inspect spreadsheet metadata.
* It dynamically binds the correct names to `actualSheetName` and `actualSettingsSheetName`.
* These are globally accessed via `window.SHEET_NAME` and `window.SETTINGS_SHEET` getters to avoid hardcoded sheet name issues.

---

## 3. Key Implementations & Mechanics

### A. Authentication & Silent Sign-In Concurrency
* **Cached Tokens**: LocalStorage stores `gac_token` and `gac_expiry`. On page load, if a token is cached and not expired, the app uses it immediately and initializes Google Identity Services (GIS) *without* requesting a silent token (`initGIS(false)`). This prevents race conditions and duplicate user profile requests.
* **Session Expiry (401 Handler)**: If a request fails with an HTTP 401 Unauthorized or no token exists, the wrapper `gfetch()` triggers `handleSessionExpired()`. It clears token caches, resets state, updates UI sign-in status, and forces a transition back to the `auth-screen`.

### B. Input Sync & Save Reliability (Robust Concurrency)
* **Keystroke Sync**: Numeric input controls (`type: 'number'`) listen to the `input` event (instead of `change`). This ensures `todayData` is updated on every keystroke, removing delays.
* **Pre-Save DOM Scraping**: Right before pushing updates to Sheets in `saveDayData()`, the app forcefully queries all input/textarea elements from the DOM and syncs them to `todayData` (excluding fallback default values marked with `.is-default`). This acts as a bulletproof safety guard against latency.
* **Save Locking & Queuing**:
  - `isSaving` and `savePending` state flags manage sheet transactions.
  - If a save is requested (either via auto-save timer or manual button click) while a transaction is in flight, the request is flagged as pending.
  - The `finally` block of `saveDayData()` releases the lock and automatically re-runs the save if a pending flag is set, preventing parallel write conflicts.

### C. Analytics (Charts) View
* **Custom SVG Splines**: The app renders custom spline charts using Bezier control points (`cp1 = p1 + (p2 - p0) * 0.15`). It does not rely on third-party libraries, ensuring offline compatibility.
* **Accurate Time-Series**: X-axis coordinates map directly to date timestamps (milliseconds), showing correct horizontal spacing for skipped/missed days.
* **Caching**: `cachedAllRows` caches full spreadsheet records. The cache is automatically cleared on sign-out, new sheet connection, sheet initialization, or daily record save.

---

## 4. Deployment Workflow
* The repository code is managed under a parent obsidian project.
* A dedicated deployment script is located at: `obsidian_project/scripts/deploy_hhtracker.sh`.
* Running this script clones the target `hhtracker` deployment repository into a temp folder, copies modified assets from `src/apps/hhtracker/` (excluding local OAuth client secrets `client_secret_*.json`, `client_secret_cli.json`, and local token cache `token_cli.json` to prevent push protection blocks), commits the changes, and pushes to `origin/main` to trigger the GitHub Pages deploy.
