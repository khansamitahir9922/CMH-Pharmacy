# CMH Pharmacy — Manual Test Plan

Use this checklist to verify that inventory, medicines, billing, and related logic work correctly. Run the app with `npm run dev`, then go through each section and mark ✅ when the expected result matches.

---

## 1. Auth & Setup

| # | Test case | Steps | Expected result |
|---|-----------|--------|-----------------|
| 1.1 | First run (no DB) | Fresh install, launch app | Setup wizard: create admin account (username, password, full name). |
| 1.2 | Login | Enter valid credentials → Sign in | Redirect to loading screen, then dashboard. User name and role shown in header. |
| 1.3 | Wrong password | Enter correct username, wrong password | Error message; stay on login. |
| 1.4 | Session timeout | Log in, leave app idle for session timeout (Settings → Pharmacy Profile: Session Timeout) | “Session expired” modal; after OK, redirect to login. |
| 1.5 | Logout | Click user menu → Sign Out | Redirect to login. |

---

## 2. Medicines

| # | Test case | Steps | Expected result |
|---|-----------|--------|-----------------|
| 2.1 | Add medicine | Medicines → Add Medicine. Fill: name, category, batch, firm, dates, opening stock, buy/sell price, min stock. Save. | Success; new row in list. Stock = opening stock. |
| 2.2 | Edit medicine | Edit existing medicine (name, prices, min stock). Save. | Changes saved; list and detail show new values. Stock quantity unchanged. |
| 2.3 | Delete (soft) medicine | Delete a medicine. | Row disappears from list (or marked deleted). Stock row can remain for history. |
| 2.4 | Search by name | Medicines list: type partial name in search. | List filters to matching names. |
| 2.5 | Filter by category | Select a category in filter. | Only medicines in that category shown. |
| 2.6 | Pagination | Add 25+ medicines; change page / page size. | Correct page of results; total count correct. |
| 2.7 | Export | Medicines → Export (if available). | File downloads with correct columns and data. |
| 2.8 | Number inputs select on focus | Click into Qty, Unit Price, or any number field. | Full value selected; typing replaces it (no need to delete first). |

---

## 3. Inventory & Stock

| # | Test case | Steps | Expected result |
|---|-----------|--------|-----------------|
| 3.1 | Stock In | Inventory → Stock Transactions. Select medicine, type “Stock In”, quantity, reason, date. Submit. | Success. Medicine’s current stock increases by quantity. Transaction appears in list. |
| 3.2 | Stock Out | Select medicine, type “Stock Out”, quantity ≤ current stock, reason. Submit. | Success. Current stock decreases by quantity. Transaction type “out” in history. |
| 3.3 | Stock Out excess | Stock Out with quantity > current stock. | Error (e.g. “Insufficient stock”). Stock unchanged. |
| 3.4 | Adjustment | Type “Adjustment”, quantity. Submit (adjustment reduces stock). | Stock changes by the adjustment amount; transaction recorded. |
| 3.5 | Dashboard Total Stock | Note “Total Stock (units)” on dashboard. Do Stock Out of 200 for one medicine. Go back to Dashboard (or refresh). | Total Stock (units) decreases by 200. |
| 3.6 | Low stock | Set a medicine’s min stock level above its current quantity (or reduce stock below min). | Medicine appears in Low Stock (Inventory / Dashboard). Badge/count updates. |
| 3.7 | Expiring / Expired | Create or edit medicine with expiry in the past or within 30 days. | Appears in Expiring Soon or Expired as per logic; counts correct on dashboard/inventory. |
| 3.8 | Transaction list | Inventory → Stock Transactions. Filter by date range and/or medicine. | Only matching transactions; dates and quantities correct. |

---

## 4. Billing (POS)

| # | Test case | Steps | Expected result |
|---|-----------|--------|-----------------|
| 4.1 | Add items to bill | Billing → Search medicine, add multiple items; change qty for some. | Rows show name, batch, stock, qty, unit price, total. Subtotal = sum of (qty × unit price). |
| 4.2 | Remove item | Click trash on one row. | Row removed; subtotal recalculated. |
| 4.3 | Discount & tax | Set Discount % and Tax %. | Discount amount and tax amount correct. Total = (subtotal − discount) + tax on reduced amount. |
| 4.4 | Generate Bill (Cash) | Set payment Cash, enter “Amount received” ≥ Total. Click Generate Bill. | Receipt modal; success message. Bill number format BILL-YYYYMMDD-XXXX. |
| 4.5 | Stock after sale | Note current stock of a medicine. Add it to bill (e.g. qty 2), generate bill. Check Medicines or Inventory for that medicine. | Stock reduced by 2. Dashboard “Total Stock (units)” reduced by 2 (after refresh/return to dashboard). |
| 4.6 | Insufficient cash | Cash mode, amount received < total. Click Generate Bill. | Error: amount received less than total; bill not created. |
| 4.7 | Card / Credit | Select Card or Credit, generate bill. | Bill created; no “amount received” or “change due” required. |
| 4.8 | Payment input focus | Click payment amount field (e.g. 0.00). Type new amount. | Value selected on focus; typing replaces it. |
| 4.9 | Empty bill | Click Generate Bill with no items. | Warning; no bill created. |
| 4.10 | Insufficient stock at bill | Add item with qty greater than current stock; Generate Bill. | Error about insufficient stock; bill not created; stock unchanged. |
| 4.11 | Last row visible | Add many items (e.g. 12+). Scroll table to bottom. | Last row (medicine name, qty, price, total, delete) fully visible. |
| 4.12 | New Bill | After generating a bill, click “New Bill” in receipt modal. | Modal closes; cart cleared; can start new bill. |
| 4.13 | Print receipt | Generate bill → Print Receipt. | Print dialog; only receipt content (or correct area) prints. |

---

## 5. Bill History

| # | Test case | Steps | Expected result |
|---|-----------|--------|-----------------|
| 5.1 | Today’s bills | Generate a bill today. Open Bill History. | New bill in list; correct date and time. |
| 5.2 | Today’s Sales | Dashboard: “Today’s Sales” and “Today’s Bills”. | Amount and count include the bill just created. |
| 5.3 | Date filter | Set date range; apply. | Only bills in range shown. |
| 5.4 | View bill | Click eye icon on a bill. | Detail view shows items, totals, payment, customer (if any). |
| 5.5 | Void bill (Admin) | Log in as Admin. Bill History → Void (trash) on a non-voided bill; enter reason. Confirm. | Bill marked void. Stock for that bill’s items is restored (check one medicine’s stock). |
| 5.6 | Void hidden (non-Admin) | Log in as Manager/Pharmacist/Data Entry. Open Bill History. | No Void (trash) button on bills. |
| 5.7 | Include voided | Toggle “Include voided bills”. | Voided bills appear in list with distinct status (e.g. “Void”). |
| 5.8 | Customer search | Enter customer name or phone in filter. | Only bills with matching customer shown. |

---

## 6. Suppliers & Purchase Orders

| # | Test case | Steps | Expected result |
|---|-----------|--------|-----------------|
| 6.1 | Add supplier | Suppliers → Add; name, contact, etc. Save. | Supplier in list. |
| 6.2 | Create PO | Open supplier → Create Order (or equivalent). Add line items (medicine, qty, unit price). Save. | Order created; status e.g. Pending. |
| 6.3 | Receive order | Mark order as Received (and receive items). | Stock for each line increases; stock_transactions “in” created. Order status updated. |
| 6.4 | Record payment | On an order, Record Payment; amount, date. | Payment recorded; balance/paid state correct if shown. |
| 6.5 | Number fields | Focus qty or unit price in PO line. | Value selected; typing replaces it. |

---

## 7. Prescriptions

| # | Test case | Steps | Expected result |
|---|-----------|--------|-----------------|
| 7.1 | Add prescription | Prescriptions → Add. Patient name, doctor, date, medicines text. Save. | Prescription in list. |
| 7.2 | Upload image | Add prescription with image upload (if supported). | Image saved; viewable in list/detail. |
| 7.3 | Link to bill | From prescription, create or link bill (if feature exists). | Bill linked or created; navigation works. |
| 7.4 | Search / filter | Search or filter prescriptions. | Correct subset shown. |

---

## 8. Reports

| # | Test case | Steps | Expected result |
|---|-----------|--------|-----------------|
| 8.1 | Sales report | Reports → Sales. Set date range. | Table/chart by date; totals match bills in range (exclude voided). |
| 8.2 | Stock report | Reports → Stock Balance. Choose date. | Per-medicine (or per-category) closing stock; numbers match inventory view. |
| 8.3 | Low stock report | Reports → Low Stock. | Only medicines below min stock level. |
| 8.4 | Expiry report | Reports → Expiry. | Expired / expiring soon / OK; dates correct. |
| 8.5 | Purchase / Issue reports | Run Purchase and Issue (stock out) reports for a date range. | Data consistent with POs and stock transactions. |
| 8.6 | Export | Export any report to Excel/PDF (if available). | File downloads; data matches screen. |

---

## 9. Settings

| # | Test case | Steps | Expected result |
|---|-----------|--------|-----------------|
| 9.1 | Pharmacy profile (all roles) | Settings → Pharmacy Profile. Change name, GST %, currency, session timeout. Save. | Values saved; used in receipts and app (e.g. GST in POS, session timeout). |
| 9.2 | User Management (Admin only) | As Admin: Settings → User Management. Add user (role e.g. Pharmacist). Edit role; deactivate user. | New user can log in; role shown; deactivated user cannot log in (if enforced). |
| 9.3 | Non-Admin Settings | Log in as non-Admin. Open Settings. | Only “Pharmacy Profile” tab; no User Management, Backup, Audit Log. |
| 9.4 | Backup (Admin) | Settings → Backup & Restore. Create backup. | Backup file created; path/size shown; log entry. |
| 9.5 | Restore (Admin) | Restore from a backup (use a test DB). | App restarts; data matches backup. |
| 9.6 | Audit log (Admin) | Perform a few actions (e.g. add medicine, generate bill). Settings → Audit Log. | Entries for those actions with user and details. |
| 9.7 | Seed dummy data | Settings → Backup & Restore → Seed 10,000 dummy medicines. | 10k medicines and stock created; DB size increases; Medicines list and dashboard totals update. |

---

## 10. Dashboard

| # | Test case | Steps | Expected result |
|---|-----------|--------|-----------------|
| 10.1 | Today’s Sales / Bills | Generate a bill. Open Dashboard. | Today’s Sales and Today’s Bills include the new bill. |
| 10.2 | Medicine Products | Add or delete a medicine (catalog). | “Medicine Products” count increases or decreases. |
| 10.3 | Total Stock (units) | Do Stock In or Stock Out (or generate bill). Return to Dashboard or refresh. | Total Stock (units) updated (or refresh/focus updates it). |
| 10.4 | Low stock / Expiring | Create low stock or expiring medicine. | Dashboard cards/badges show correct counts; links to inventory work. |
| 10.5 | Recent bills | Generate a few bills. | Dashboard “Recent Bills” shows them; click opens Bill History or detail. |
| 10.6 | Refresh | Change data elsewhere (e.g. stock out). Click Dashboard refresh or refocus window. | Numbers update (today’s sales, total stock, etc.). |
| 10.7 | Charts | Check sales-by-day and any pie/bar charts. | Data matches selected period and report logic. |

---

## 11. Edge Cases & Data Integrity

| # | Test case | Steps | Expected result |
|---|-----------|--------|-----------------|
| 11.1 | Bill then void | Generate bill with 2 items (note stock). Void the bill. | Stock restored for both items; voided bill in history; Today’s Sales excludes voided amount. |
| 11.2 | Two tabs/windows | Open dashboard in one view; in another do Stock Out. Refocus dashboard. | Total Stock (units) refreshes and shows reduced value. |
| 11.3 | Deleted medicine | Soft-delete a medicine. Try to add it to a bill (search). | Deleted medicine not offered or error if selected. |
| 11.4 | Large list (10k medicines) | With 10k dummy medicines: open Medicines list, search, paginate. | List and search respond; pagination shows 20 per page; no crash. |
| 11.5 | Payment focus | In POS, focus payment field (0.00). Type amount. | No need to delete “0” first; amount replaces correctly. |

---

## Quick smoke (minimal run)

If you need a short pass:

1. **Login** → Dashboard loads.  
2. **Medicines** → Add one medicine with opening stock 100.  
3. **Inventory** → Stock Out 10 for that medicine → stock becomes 90; dashboard Total Stock −10 after refresh.  
4. **Billing** → Add that medicine (qty 2), generate bill (Cash, amount ≥ total).  
5. **Bill History** → New bill listed; view shows 2 qty.  
6. **Dashboard** → Today’s Sales and Today’s Bills updated; Total Stock (units) down by 2.  
7. **Void (Admin)** → Void that bill → stock for that medicine +2 again.

---

*Document version: 1.0. Use as a living checklist; add rows or sections for new features.*
