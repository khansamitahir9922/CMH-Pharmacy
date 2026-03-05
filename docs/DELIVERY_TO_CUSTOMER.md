# How to Give the App to Your Customer (Preview Build)

Use this guide to build the app and send it to your customer so they can run it and confirm it’s OK before you deliver the final version.

---

## Part 1: Your Steps (Build & Package)

### Step 1: Add logo and CMH photo (so they appear in the installed app)

The app shows a **logo** and a **CMH/hospital photo** on the login and setup screens. To have them in the build:

1. In the project folder, open the **`public`** folder.
2. Add these two files (exact names matter):
   - **`logo.png`** — your pharmacy/CMH logo (used in the sidebar and on login/setup).
   - **`hospital.jpg`** — the CMH photo (background on the left panel of login/setup).
3. If your images have different names (e.g. `mylogo.png` or `cmh-photo.jpg`), rename them to **`logo.png`** and **`hospital.jpg`**, or copy them into `public` with these names.

If these files are missing, the app still runs but the logo/photo areas will be empty or show a fallback.

### Step 2: Install dependencies (if not already done)

On your machine, in the project folder:

```bash
npm install
```

### Step 3: Build the app

```bash
npm run dist
```

This runs:

- `electron-vite build` (compiles the app)
- `electron-builder` (creates the Windows installer)

The first time can take a few minutes (downloads Electron if needed).

### Step 4: Find the installer

After the build finishes, the installer is here:

- **Folder:** `dist-installer\`
- **File (typical):**  
  `Medical Store Management System Setup 1.0.0.exe`  
  (exact name may include version, e.g. `Medical Store Management System Setup 1.0.0.exe`)

If you see more than one file (e.g. `.exe` and unpacked folder), the one you need is the **Setup .exe** (the installer).

### Step 5: (Optional) Test the installer on your PC

1. Run the Setup .exe.
2. Choose installation directory (or keep default).
3. Complete installation.
4. Launch **“Medical Store Management System”** (or **“MSMS”**) from the desktop or Start menu.
5. Confirm: first run shows Setup (create admin account), then you can log in and use the app.

If this works for you, it should work for the customer on a similar Windows PC.

### Step 6: Send to the customer

**Option A – Single file (simplest)**  
Send only the installer:

- `Medical Store Management System Setup 1.0.0.exe`  
from the `dist-installer` folder (e.g. via USB, cloud link, or email if size allows).

**Option B – Folder + instructions**  
Zip the whole `dist-installer` folder and send the zip. Ask the customer to unzip and run the Setup .exe inside.

**Include a short note**, for example:

- “This is a preview build of the pharmacy app. Please install, use it, and tell us if everything is OK so we can proceed to the final version.”
- Attach or paste the **Customer instructions** below (Part 2) so they know how to install and run it.

---

## Part 2: Instructions for Your Customer (Copy & Send)

You can copy the text below and send it to the customer (e.g. in email or a one-page PDF).

---

### Pharmacy App – Preview Build – How to Install and Run

**What you received**  
An installer for the **Medical Store Management System** (pharmacy app) so you can try it on your computer and confirm it works before the final version.

**What you need**

- A Windows PC with **Windows 10 or 11**. The app does **not** run on Windows 7 or 8.
- You can install it on your usual work PC or a test PC.

**Installation**

1. Locate the file we sent you:  
   **`Medical Store Management System Setup 1.0.0.exe`**  
   (If we sent a zip file, unzip it first and find this .exe inside.)
2. Double‑click the file to start the installer.
3. If Windows shows a security warning (“Windows protected your PC”), choose **“More info”** and then **“Run anyway”** (the app is not signed with a certificate yet).
4. In the installer:
   - Choose the installation folder (default is fine).
   - Click through the steps and finish the installation.
5. When done, you can close the installer.  
   - **If a message appears** saying “Unspecified error” and a path like `…\Start Menu\Programs\MSMS.lnk`: click **OK**, then **Finish**. The app is still installed; only the Start Menu shortcut was not created. Use the **desktop shortcut** to open the app.

**First run**

1. Open the app from the **desktop shortcut** (“MSMS” or “Medical Store Management System”) or from the **Start menu**.
2. The first time you open it, you will see a **Setup** screen: create the first (admin) account:
   - **Username** (e.g. admin)
   - **Password** (choose a strong one)
   - **Full name** (e.g. your name)
3. Click **Create account** (or equivalent). You will then be taken to the **login** screen.
4. Log in with the same username and password. The app will open to the main screen (dashboard).

**What to try**

- Add a few medicines, do a sample sale (Billing), check Inventory and Reports.
- If anything doesn’t work as expected or you see errors, note down what you did and what happened (or take a screenshot) and send it to us.
- When you’re satisfied, reply with something like: **“It’s OK, you can test it further before giving the final version.”**

**Where is my data stored?**

- All data (medicines, bills, users, etc.) is stored on your PC in the app’s data folder (no internet required for normal use).
- If you uninstall the app, that data may be removed depending on the uninstall options. We can advise on backup before uninstall if needed.

**Uninstall (if needed)**

- Windows: **Settings → Apps → Installed apps** → find “Medical Store Management System” (or “MSMS”) → Uninstall.

**Support**

- For any problem or question about this preview build, contact: [your contact details].

---

## Part 3: If Something Goes Wrong

### Build fails on your machine

- Run `npm run build` first. If that fails, fix the errors (e.g. TypeScript or missing files).
- Then run `npm run dist` again.
- Ensure Node.js version is in the range required by the project (e.g. Node 20–22). Check with: `node -v`.

### Customer says “Windows protected your PC”

- Normal for an unsigned app. Ask them to use **“More info” → “Run anyway”** for the installer and for the app the first time.
- For the final version you can consider signing the app with a code‑signing certificate so this warning goes away.

### Customer sees “Unspecified error” about MSMS.lnk (Start Menu shortcut)

- **What it is:** The installer failed only when creating the **Start Menu** shortcut (`MSMS.lnk`). The app is usually installed correctly; only that shortcut was not created.
- **Why it happens:** Often due to antivirus/Windows security blocking .lnk creation, or a leftover/corrupted shortcut from a previous install.
- **What the customer should do:**
  1. Click **OK**, then **Finish** and close the installer.
  2. Use the **desktop shortcut** (“MSMS”) to open the app. If there is no desktop shortcut, they can run the app from:  
     `C:\Users\<TheirUsername>\AppData\Local\Programs\Medical Store Management System\Medical Store Management System.exe`
  3. If they want the Start Menu shortcut: uninstall the app, delete any existing “MSMS” shortcut from the Start Menu and from the Desktop, then run the installer again **“Run as administrator”** (right‑click the Setup .exe → Run as administrator).

### Customer has Windows 7 or 8

- The app is built with Electron 33 and **does not support Windows 7 or 8**. It requires **Windows 10 or later**. On Windows 7 the app may not start or may crash.
- **Options:** Ask the customer to use a PC with Windows 10/11, or to upgrade. Building a separate version for Windows 7 would require downgrading to an old Electron (e.g. 22) and is not recommended (Windows 7 is end-of-life and unsupported).

### Customer’s PC is 32‑bit

- By default the build is 64‑bit. If they have 32‑bit Windows, you would need to add a 32‑bit target in `electron-builder` config and rebuild.

### You need a portable (no install) version

- In `electron-builder.yml` you can add a `portable` target for Windows so the customer gets a single .exe they can run without installing. Example in the `win` section:  
  `target: [nsis, portable]`  
  Then rebuild with `npm run dist`; you’ll get both the installer and a portable .exe in `dist-installer`.

---

## Summary Checklist (You)

- [ ] Add **logo.png** and **hospital.jpg** to the **`public`** folder
- [ ] Run `npm install`
- [ ] Run `npm run dist`
- [ ] Find `Medical Store Management System Setup 1.0.0.exe` in `dist-installer\`
- [ ] (Optional) Test install and run on your PC
- [ ] Send the installer (or zip of `dist-installer`) to the customer
- [ ] Send the **Customer instructions** (Part 2) so they know how to install and what to do
- [ ] Wait for their “OK” or feedback before final version
