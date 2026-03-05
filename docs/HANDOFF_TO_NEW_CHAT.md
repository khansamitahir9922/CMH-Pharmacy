# Handoff to New Chat — Full Project Context

**Use this in a new chat:** Open this file and say: *"Read docs/HANDOFF_TO_NEW_CHAT.md and follow its rules. I will continue from there."* So the new chat has full context with no ambiguity.

---

## 1. Project identity

- **Name:** SKBZ/CMH RAWALAKOT PHARMACY — Medical Store Management System (MSMS)
- **Stack:** Electron + React + Vite (electron-vite), TypeScript, Ant Design, Drizzle ORM, SQLite (better-sqlite3)
- **Repo:** `https://github.com/khansamitahir9922/CMH-Pharmacy.git` (user may have uncommitted/unpushed work; always recommend pushing first if they mention “backup” or “something bad happens”)

---

## 2. What has been done so far (completed)

### 2.1 Logo and hospital image on login/packaged app
- **Problem:** Logo and hospital photo did not show in the **installed** app (only in dev).
- **Cause:** Absolute paths (`/logo.png`) fail when the app loads from `file://`; renderer’s public folder was not guaranteed to be the project `public` folder.
- **Fix:**
  - **electron.vite.config.ts:** Renderer has `base: './'` and **`publicDir: resolve(__dirname, 'public')`** so `public/` is copied into the renderer build.
  - **Assets:** Code uses base-aware paths, e.g. `const BASE = (import.meta.env?.BASE_URL) || '/'` then `\`${BASE}logo.png\`` and `\`${BASE}hospital.jpg\`` in LoginPage, SetupWizard, AppLayout, AppLoadingScreen.
  - **Naming:** Files in `public` must be exactly **`logo.png`** and **`hospital.jpg`** (no double extensions like `logo.png.png`).

### 2.2 Audit log was empty
- **Problem:** Settings → Audit Log showed “No audit log entries.”
- **Cause:** The audit `log()` function existed but was never called when actions occurred.
- **Fix:** All relevant IPC handlers now call `audit.log()` from `src/db/queries/audit.ts`:
  - **Auth:** First-time setup, Login, Logout (frontend passes `userId` on logout).
  - **Medicines:** Create, Update, Delete (frontend passes `userId` in payload).
  - **Billing:** Create bill, Void bill (uses `createdBy` / `voidedBy`).
  - **Users:** Create user, Update user, Reset password (payload includes `createdBy` / `currentUserId` where applicable).
  - **Suppliers:** Create, Update, Delete (frontend passes `userId`).
  - **Backup:** Create backup, Restore backup (optional `userId` in payload).

### 2.3 Client requirements: reports + audit
- **Report views logged in audit:** Every time a user opens/generates a report, the app logs **“View report”** with the report name and user id via **`audit:logReportView`** (called from each report page on mount).
- **New reports added** (all under Reports, all logged when viewed):
  - **Stock Variance Report** — Received vs issued by medicine in date range; variance = received − issued.
  - **Near-expiry Alert Report** — Same content as Expiry Report; separate entry in audit.
  - **Adjustment Log Report** — Stock transactions with type `adjust`; date range and optional user filter; shows performer.
  - **Purchase vs Consumption Analysis** — Purchase qty (from POs) vs consumption (stock out) by medicine in date range.
  - **Controlled Drug Register Summary** — Medicines with `is_controlled = true`; current stock.
- **Controlled drugs:** Schema and DB have **`is_controlled`** on medicines (migration in `src/db/init.ts`: `migrateMedicinesIsControlled`). Medicine add/edit form has **“Controlled drug”** switch; create/update and getById handle `is_controlled`.

### 2.4 Per-user audit and role-based visibility
- **User activity summary (Settings → Audit Log):** When a **single user** is selected in the filter, a card shows for the filtered date range: **Bills (sales)**, **Sales amount**, **Stock in (units)**, **Stock out (units)** (from `audit:getUserActivitySummary`).
- **Role-based:** **Admin** can choose “All users” or any user. **Non-admin (pharmacist, dataentry)** see only **their own** audit log (default filter = current user; they cannot select “All users”).

### 2.5 Installer / delivery
- **Start Menu shortcut error (“Unspecified error” for MSMS.lnk):** Documented in **docs/DELIVERY_TO_CUSTOMER.md**: customer can click OK → Finish and use the desktop shortcut; optional “Run as administrator” or delete old shortcut and reinstall.
- **Windows 7:** App requires **Windows 10 or 11** (Electron 33). Documented in DELIVERY_TO_CUSTOMER.md; client must use a PC with Windows 10/11.
- **What to send customer:** Only the **single .exe** installer: `dist-installer\Medical Store Management System Setup 1.0.0.exe` (not the whole folder unless needed for portable/unpacked).

### 2.6 AppLayout TypeScript error
- **Fixed:** `setSummary` expected `InventorySummaryCounts` (includes `totalStockUnits`). AppLayout now uses `window.api.invoke<InventorySummaryCounts>('inventory:getSummary')` and imports `InventorySummaryCounts` from `@/store/alertStore`.

### 2.7 Audit log — print current user’s log
- **Settings → Audit Log:** Added **“Print my audit log”** button. Fetches current signed-in user’s log for the selected date range, opens a print window with report (title, user, period, activity summary, table, generated time), then triggers print and closes. Action is logged via **`audit:logAction`** (IPC in `electron/ipc/audit.ts`).

### 2.8 Prescriptions — view uploaded prescription
- **Backend:** **`prescriptions:getImageDataUrl`** IPC reads the prescription file from disk and returns `{ dataUrl, isPdf }` for display in the renderer.
- **Form (add/edit):** After upload, preview shows the uploaded image or PDF (data URL from `FileReader` in `beforeUpload`; preview stored in state + ref backup). Section visible when `fileList.length > 0` or preview data exists; “Loading preview…” if data not yet set. On save failure, preview is **not** cleared.
- **View modal (Prescriptions list):** When viewing a prescription with `has_image`, the app fetches the image via `getImageDataUrl` and displays it below the prescription details.

### 2.9 Medicines — generic name (formula name)
- **Schema:** **`generic_name`** on `medicines` (text, optional). Migration **`migrateMedicinesGenericName`** in `src/db/init.ts`; **`generic_name`** also added to initial **CREATE TABLE** in init so new DBs have the column.
- **Form:** “Generic Name” field below “Medicine Name” (optional); help text for records/welfare use.
- **List & search:** Medicine list has **Generic Name** column (shows “—” when empty). Search (list + POS + Stock Transactions + Purchase Order) includes **generic_name** (search by medicine name, formula name, or batch). **Everywhere medicine name is shown:** generic is shown when present (e.g. “Name (Generic)” or “Formula: …” in POS, receipts, reports, stock transactions, purchase orders, bill receipt, Low Stock / Expiry / Stock / Issue / Adjustment / Variance / Purchase vs Consumption reports). Export and report Excel/PDF include generic where applicable.

### 2.10 Welfare society — optional prices / zero-cost billing
- **Medicines:** Buy price and sell price are **optional** (no required validation). If left blank, stored as 0. Sell ≥ buy is enforced only when **both** prices are > 0. Medicine list and export show **“—”** for zero sell price. IPC create/update allow 0 and only validate sell ≥ buy when both > 0.
- **Billing:** Bills with **total = 0** are allowed. For cash, **amount received** may be **0** when total is 0 (`src/db/queries/billing.ts`). POS allows generating a bill when total is 0 and amount received 0; Unit Price and Total in cart show “—” when price is 0. Receipt still prints (amounts can be 0). Stock in/out and logic unchanged.

### 2.11 POS — search dropdown closes on selection
- **Issue:** After selecting a medicine from the search dropdown, the panel kept reopening until the user clicked elsewhere.
- **Fix:** **`onDropdownVisibleChange`** only reacts to **close** (`if (v === false) setDropdownOpen(false)`). We do **not** set open to true when the component requests open (e.g. on focus). Dropdown opens only when **`fetchSearch`** sets it after getting results. In **`onSelect`**, we immediately close and clear search/results, then add the medicine so the list disappears as soon as a medicine is selected.

### 2.12 Prescription image preview (in progress / known quirk)
- Preview uses **data URL** from `FileReader.readAsDataURL` in `beforeUpload`, set in the same `onload` callback. Ref backup (`previewDataUrlRef`) used so preview can still render if state is reset. Preview is **not** cleared on save failure or on image `onError`. If the customer still reports “uploaded but not previewed,” the next chat can debug (e.g. CSP, very large images, or Electron renderer behavior).

---

## 3. Current state (as of this handoff)

- **Build:** `npm run build` and `npm run dist` succeed.
- **Git:** User was reminded to push; local changes may still be uncommitted. **Always suggest pushing first** if they mention risk or “something bad happens.”
- **Context:** User’s chat context was full; this handoff is for the **next chat** to continue without re-explaining everything.
- **Next:** Client may send further requirements; prescription image preview may still need debugging in some environments (see 2.12).

---

## 4. What we will be doing next (for the new chat to follow)

- **Implement the client’s next requirements** when the user provides them.
- **Keep existing behavior:** Don’t break audit logging, report logging, per-user audit, optional prices/zero-cost billing, generic name, prescription view, or asset paths.
- **If prescription preview still doesn’t show:** Debug `FileReader`/data URL in the renderer; try object URL again in Electron; check CSP / `webPreferences`; add minimal logging to confirm `onload` and `setPreviewDataUrl` run.
- **If the client asks for new reports or new “audit” items:** Add the report (and route + card under Reports if needed), call **`audit:logReportView`** when the report is viewed, and add any new audit event types (e.g. new actions) in the right IPC handlers.

---

## 5. Project rules and conventions (no ambiguity)

### 5.1 Asset paths (logo, images)
- Put assets in **`public/`** at project root. Use names **`logo.png`** and **`hospital.jpg`** for the main assets.
- In code use base-aware paths: `const BASE = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'` then e.g. `\`${BASE}logo.png\``. Do **not** use bare `/logo.png` in the renderer.
- **electron.vite.config.ts** must keep **`publicDir: resolve(__dirname, 'public')`** for the renderer so the packaged app gets these files.

### 5.2 Build and installer
- **Build:** `npm run build` (output in `out/`). **Installer:** `npm run dist` (output in **`dist-installer/`**). Installer file: **`Medical Store Management System Setup 1.0.0.exe`**.
- **electron-builder** config: **electron-builder.yml**; `output: dist-installer`; packages `out/**/*` and package.json.

### 5.3 Adding a new “action” that must appear in the audit log
1. In the **main process** IPC handler that performs the action, import and call **`log`** from **`src/db/queries/audit.ts`** with `user_id`, `action`, optional `table_name`, `record_id`, `details`.
2. If the action is triggered from the renderer and the backend doesn’t know the user, add an optional **`userId`** (or `createdBy`/`currentUserId`) to the IPC payload and have the frontend pass **`currentUser?.id`** from **`useAuthStore()`**.

### 5.4 Adding a new report that should be logged
1. Create the report page under **`src/pages/Reports/`** (or **Inventory** if it’s inventory-specific).
2. On mount, call **`window.api.invoke('audit:logReportView', { reportName: '...', userId: currentUser?.id })`** (use **`useAuthStore()`** for `currentUser`).
3. Add route in **src/components/AppBoot.tsx** (under the `reports` layout) and a card in **src/pages/Reports/ReportsPage.tsx**.
4. Add backend query in **src/db/queries/reports.ts** (or inventory) and IPC handler in **electron/ipc/reports.ts**.

### 5.5 Database and schema
- **Schema:** **src/db/schema.ts**. **Migrations:** **src/db/init.ts** (e.g. `migrateMedicinesIsControlled`). For new columns on existing tables, add a migration that checks `PRAGMA table_info(...)` and runs `ALTER TABLE ... ADD COLUMN ...` if missing.
- **Queries:** **src/db/queries/** (audit.ts, medicines.ts, reports.ts, billing, inventory, etc.). Use **getDb()** from **src/db/init.ts**.

### 5.6 IPC pattern
- Handlers in **electron/ipc/*.ts** (auth, audit, billing, medicines, users, suppliers, backup, reports, inventory, etc.). Registered from **electron/main.ts**. Renderer calls **`window.api.invoke('channel:name', payload)`**.

### 5.7 Frontend
- **Auth:** **useAuthStore()** from **@/store/authStore** for **currentUser** (id, username, full_name, role). Roles: admin, manager, pharmacist, dataentry.
- **Paths:** **@/** points to **src/** (see **electron.vite.config.ts** resolve alias).

### 5.8 Important docs
- **docs/DELIVERY_TO_CUSTOMER.md** — How to build, package, send to customer; customer instructions; troubleshooting (Windows protected PC, Start Menu shortcut error, Windows 7).
- **docs/GIT_PUSH_FIRST.md** — Short reminder to commit and push before risky changes.

---

## 6. One-line summary for the new chat

**“Read docs/HANDOFF_TO_NEW_CHAT.md first. This is an Electron+React pharmacy app (welfare society; prices optional, zero-cost billing allowed). Done: logo/hospital in packaged app, full audit + per-user activity + print audit report, prescription view/preview (getImageDataUrl; preview may need debugging), generic name everywhere + list/export, optional prices + POS dropdown close on select. Follow asset path, audit, report, and DB conventions above; implement next requirements and fix prescription preview if needed.”**
