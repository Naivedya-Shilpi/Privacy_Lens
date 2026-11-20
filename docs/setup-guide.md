# PrivacyLens — Setup & Verification Guide (Windows PowerShell)

This guide provides step-by-step Windows PowerShell instructions to configure, run, and verify the **PrivacyLens** foundation.

---

## 1. Prerequisites

Ensure the following tools are installed and accessible in Windows PowerShell:
- **Ollama** (running locally at `http://localhost:11434` with the `qwen2.5:3b` model pulled: `ollama pull qwen2.5:3b`)
- **Node.js** (v18+ recommended; verified with `v22.19.0`)
- **npm** (v9+ recommended; verified with `10.9.3`)
- **Python** (`3.10+`, for offline evaluation dataset & partition verification scripts)
- **Git** (verified with `2.45.2.windows.1`)
- **Google Chrome** (or any Chromium-based browser supporting Manifest V3 extensions)

Verify your environment in PowerShell:
```powershell
ollama --version
ollama list
node -v
npm -v
git --version
```

---

## 2. Backend Setup & Startup

### Step 2.1: Navigate to the Server Directory
From the project root (`Privacy_Lens/`):
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
> **Note:** By default, `server/.env.example` configures `AI_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://localhost:11434`, `OLLAMA_MODEL=qwen2.5:3b`, and `OLLAMA_CONTEXT_LENGTH=8192`. No paid cloud API keys are required for local-first operation. If you wish to use Google Gemini (`gemini-2.5-flash`) as an optional manual fallback, add `GEMINI_API_KEY` to `server/.env`. Never commit `.env` to Git.

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
Invoke-RestMethod -Uri "http://localhost:3000/api/health" -Method Get | ConvertTo-Json -Depth 5
```

Expected response structure:
```json
{
  "success": true,
  "application": "PrivacyLens",
  "status": "healthy",
  "timestamp": "2026-11-18T...",
  "environment": "development",
  "version": "0.2.0",
  "defaultProvider": "ollama",
  "providersConfigured": {
    "defaultProvider": "ollama",
    "ollamaConfigured": true,
    "ollamaBaseUrl": "http://localhost:11434",
    "ollamaModel": "qwen2.5:3b",
    "ollamaContextLength": 8192,
    "openaiConfigured": false,
    "geminiConfigured": false,
    "anthropicConfigured": false,
    "ollamaReachable": true,
    "ollamaModelInstalled": true
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
5. Verify that **PrivacyLens** (`v0.2.0`) appears in your extensions list with **no errors**.
6. Click the **Extensions** puzzle icon in the Chrome toolbar and pin **PrivacyLens**.

---

## 5. Testing the Extension Popup & Persistent Local History

1. Make sure local Ollama (`http://localhost:11434` with `qwen2.5:3b`) and the Express backend server (`npm start` inside `server/`) are running on `http://localhost:3000`.
2. Open any website privacy policy page (for example, `https://www.mozilla.org/en-US/privacy/websites/`).
3. Click the **PrivacyLens** icon in the Chrome toolbar to open the popup:
   - The status pill in the top-right header checks `http://localhost:3000/api/health` and displays **Connected (Local)** (green), with the engine banner showing **`Local AI: Ollama • Qwen2.5 3B`**.
   - Select **V1: Single-Pass Baseline (1 Call)**, **V2: Three-Stage Chained Analysis (3 Calls)**, or **V3: Four-Stage Verified Analysis (4 Calls)** and click **Analyze Current Page** (or use **Manual Paste**).
   - Once completed, the structured plain-language report is automatically saved to `chrome.storage.local`. Closing and reopening the popup on the same URL restores the saved report immediately (`0` AI calls), and clicking **History (`N`)** opens the 20-entry local analysis history panel.
