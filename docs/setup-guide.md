# PrivacyLens — Setup & Verification Guide (Windows PowerShell)

This guide provides step-by-step Windows PowerShell instructions to configure, run, and verify the **PrivacyLens** foundation.

---

## 1. Prerequisites

Ensure the following tools are installed and accessible in Windows PowerShell:
- **Node.js** (v18+ recommended; verified with `v22.19.0`)
- **npm** (v9+ recommended; verified with `10.9.3`)
- **Git** (verified with `2.45.2.windows.1`)
- **Google Chrome** (or any Chromium-based browser supporting Manifest V3 extensions)

Verify your environment in PowerShell:
```powershell
node -v
npm -v
git --version
```

---

## 2. Backend Setup & Startup

### Step 2.1: Navigate to the Server Directory
From the project root (`PrivacyLens/`):
```powershell
Set-Location -Path ".\server"
```

### Step 2.2: Install Dependencies
If `package-lock.json` is present (default in repository), run a clean deterministic install:
```powershell
npm ci
```
*(Or run `npm install` if updating dependencies.)*

### Step 2.3: Configure Environment Variables
Copy `.env.example` to `.env` inside the `server` directory:
```powershell
Copy-Item -Path ".\.env.example" -Destination ".\.env"
```
> **Note:** During Phase 1 (Initial Setup), no live AI API calls are made, so the server will start and pass health checks even with empty API key placeholders in `server/.env`. Never commit `.env` to Git.

### Step 2.4: Start the Backend Server
To start the server in standard mode:
```powershell
npm start
```
Or in development watch mode (using `nodemon`):
```powershell
npm run dev
```
The server binds to `http://localhost:3000` by default.

---

## 3. Verifying the Backend Health Endpoint

With the server running in one PowerShell terminal, open a second PowerShell terminal and run:
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/health" -Method Get | ConvertTo-Json -Depth 4
```

Expected response structure:
```json
{
  "success": true,
  "application": "PrivacyLens",
  "status": "healthy",
  "timestamp": "2026-11-01T...",
  "environment": "development",
  "version": "0.1.0",
  "providersConfigured": {
    "openaiConfigured": false,
    "geminiConfigured": false,
    "anthropicConfigured": false
  }
}
```

---

## 4. Loading the Browser Extension in Google Chrome

1. Open **Google Chrome** and navigate to:
   ```text
   chrome://extensions/
   ```
2. Enable **Developer mode** using the toggle switch in the top-right corner.
3. Click the **Load unpacked** button in the top-left area.
4. Select the `extension` folder inside your cloned project workspace:
   ```text
   <repo-root>\extension
   ```
5. Verify that **PrivacyLens** (`0.1.0`) appears in your extensions list with **no errors**.
6. Click the **Extensions** puzzle icon in the Chrome toolbar and pin **PrivacyLens**.

---

## 5. Testing the Extension Popup

1. Make sure the backend server (`npm start` inside `server/`) is running on `http://localhost:3000`.
2. Open any standard webpage (for example, `https://example.com`).
3. Click the **PrivacyLens** icon in the Chrome toolbar to open the popup:
   - The status pill in the top-right header should automatically check `http://localhost:3000/api/health` and display **Connected** (green).
   - Click **Test Server Connection** to manually re-verify the backend health response.
   - Click **Analyze This Page** to test on-demand script injection (`activeTab` + `scripting`). The popup will confirm active tab access and clearly report that the full AI policy analysis pipeline is scheduled for the next phase.
