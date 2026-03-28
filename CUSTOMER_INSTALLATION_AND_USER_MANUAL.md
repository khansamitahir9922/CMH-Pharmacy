# Medical Store Management System
## Customer Installation and User Manual

This manual explains exactly how to install, use, back up, and maintain the app.

---

## 1) Installer file to give customer (today)

Use this file:

- `dist-installer/Medical Store Management System Setup 1.0.0.exe`

This is the Windows installer (`.exe`) your customer needs.

---

## 2) If you need to rebuild installer again (developer steps)

Run these commands from project root:

```powershell
npm install
npm run build
npm run dist
```

After completion, installer is generated in:

- `dist-installer/Medical Store Management System Setup 1.0.0.exe`

---

## 3) Customer-side installation steps (Windows)

1. Copy installer to customer PC.
2. Double click:
   - `Medical Store Management System Setup 1.0.0.exe`
3. If SmartScreen warning appears:
   - Click **More info** -> **Run anyway**.
4. In installer:
   - Click **Next**
   - Choose install directory (or keep default)
   - Click **Install**
5. Finish installation and launch app from:
   - Desktop shortcut `MSMS`, or
   - Start Menu shortcut `MSMS`.

---

## 4) First login / setup

- On first run, create admin user if prompted.
- Then login with admin credentials.
- Configure pharmacy details in Settings if needed.

---

## 5) Core workflow (how to use app)

### 5.1 Dashboard
- Shows medicine and inventory summary cards.
- Shows stock overview, expiry alerts, and category chart.
- Use quick action buttons:
  - Add Medicine
  - Stock Entry
  - Issue Medicine
  - Reports

### 5.2 Add Medicines
1. Open **Medicines** page.
2. Click **Add Medicine**.
3. Fill fields (name, category, batch, expiry, stock, min level, etc.).
4. Save.

### 5.3 Inventory Operations
- **Stock Entry / Stock In-Out** for adjusting inventory.
- **Expiry Report** for expired/near-expiry tracking.
- Inventory summaries update automatically.

### 5.4 Dispensing / Billing (free-of-cost mode)
- App is configured for free dispensing record mode.
- You can generate and print receipt without charging customer.
- Inventory is reduced correctly when receipt is generated.
- Receipt acts as issuance proof/record.

### 5.5 Reports
- Use Reports section for sales/stock/low-stock/expiry and other summaries.
- Export reports (Excel/PDF) where applicable.

---

## 6) Where data is stored (very important)

On Windows, app database file is stored in:

- `C:\Users\<WindowsUser>\AppData\Roaming\skbz-cmh-rawalakot-pharmacy\skbz-cmh-rawalakot-pharmacy.db`

Example:

- `C:\Users\LOQ\AppData\Roaming\skbz-cmh-rawalakot-pharmacy\skbz-cmh-rawalakot-pharmacy.db`

This file contains app data (medicines, stock, bills/receipts, users, settings, etc.).

---

## 7) Backup and restore (recommended routine)

### Daily backup (manual)
1. Close app.
2. Copy `.db` file from AppData path above.
3. Paste into a safe location (external drive/cloud).
4. Keep backup filename with date, e.g.:
   - `skbz-cmh-rawalakot-pharmacy-2026-03-27.db`

### Restore
1. Close app.
2. Replace current `.db` file with backup `.db`.
3. Open app again.

> Always keep at least 7 recent backups.

---

## 8) Update / migration to new version

1. Backup database first.
2. Install new setup exe over existing install.
3. Launch app and verify:
   - Login
   - Medicines list
   - Inventory totals
   - Receipt printing

Database remains in AppData and is reused by new app version.

---

## 9) Troubleshooting

### App not opening
- Run app as normal user first.
- If blocked by Windows warning, use **Run anyway**.
- Reinstall using latest setup exe.

### Printer issues
- Ensure default printer is installed and working from Windows test page.
- Try receipt print again from app.

### Data seems missing
- Check if correct Windows user account is being used.
- Verify database path in AppData.
- Restore latest backup if needed.

### Slow performance
- Restart app.
- Avoid many heavy apps running simultaneously.
- Keep regular backups and periodic system cleanup.

---

## 10) Release package structure to send customer

Recommended package:

1. `Medical Store Management System Setup 1.0.0.exe`
2. `CUSTOMER_INSTALLATION_AND_USER_MANUAL.md` (this file)
3. (Optional) one initial backup `.db` copy after final data verification

---

## 11) Quick final handover checklist

- [ ] Installer tested on at least one clean machine
- [ ] Login verified
- [ ] Add medicine + stock update verified
- [ ] Receipt generation and print verified
- [ ] Backup file created
- [ ] Manual shared with customer

---

If needed, create a PDF from this manual before sharing with non-technical users.
