# PrivacyLens

**Problem Statement:** C18 — Terms and Conditions in Plain Language  
**Course:** Prompt Engineering (SCSE4041), Bennett University  
**Team Name:** ladybug (4 Members)  
**Repository:** [https://github.com/Naivedya-Shilpi/Privacy_Lens.git](https://github.com/Naivedya-Shilpi/Privacy_Lens.git)

---

## 1. Project Description & Problem Statement (C18)

**PrivacyLens** is an academic prompt-engineering research project and Chrome Manifest V3 browser extension companion designed to help ordinary internet users understand website privacy policies and terms of service before agreeing to them.

Internet users routinely accept lengthy, complex legal policies without understanding what personal data is collected, how it is used, whether it is shared with third parties, how long it is stored, or what rights they have. **PrivacyLens** addresses **Problem Statement C18 (Terms and Conditions in Plain Language)** by combining a lightweight browser extension frontend, a local-first Node.js/Express backend powered by **Ollama (`qwen2.5:3b`)** (with optional manual **Google Gemini (`gemini-2.5-flash`)** fallback), a multi-stage prompt orchestration engine (**Prompt V1, V2, and V3**), and persistent local analysis history (`chrome.storage.local`).

When a user clicks **Analyze This Page** on a privacy policy or terms of service webpage, PrivacyLens extracts the document text from the live DOM, runs the selected prompt version, persists the completed analysis locally in the browser, and renders:
- A simple, plain-language executive summary.
- Clear breakdowns of **data collection** and **data usage purposes**.
- Transparency into **third-party data sharing**.
- Information on **data retention** and **user rights**.
- Identification of **potentially risky, vague, or broad clauses** with calibrated severity badges and plain-language explanations of why they warrant user attention.
- **Verbatim supporting excerpts** from the original policy backing every key finding, alongside explicit `"Not specified"` reporting for omitted information.
- **Stage 4 Verification Audit Notes** (when running Prompt V3) showing verified grounding and any unsupported claims removed.

---

## 2. Getting Started in 5 Minutes (Teammate Quick-Start Guide)

New teammates can clone, install, run, and verify the complete local-first PrivacyLens pipeline in under 5 minutes. No paid cloud API keys are required because PrivacyLens runs locally by default using **Ollama (`qwen2.5:3b`)**.

### Step 1: Ensure Ollama & `qwen2.5:3b` Are Running Locally

1. Install [Ollama](https://ollama.com/) (`http://localhost:11434`).
2. Pull the default local model (`qwen2.5:3b`, ~1.9 GB):
   ```powershell
   ollama pull qwen2.5:3b
   ```
3. Verify the model is available:
   ```powershell
   ollama list
   ```

### Step 2: Clone & Set Up Backend (`server/`)

#### Option A: One-Command Automated Setup (Windows PowerShell)

```powershell
# 1. Clone the repository and enter the project directory
git clone https://github.com/Naivedya-Shilpi/Privacy_Lens.git
Set-Location -Path ".\Privacy_Lens"

# 2. Run the automated prerequisite & dependency setup script
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1

# 3. Start the Express backend server (binds to http://localhost:3000)
Set-Location -Path ".\server"
npm start
```

#### Option B: Manual Step-by-Step Setup

##### Windows PowerShell
```powershell
# 1. Clone repository
git clone https://github.com/Naivedya-Shilpi/Privacy_Lens.git
Set-Location -Path ".\Privacy_Lens"

# 2. Install backend Node.js dependencies deterministically from package-lock.json
Set-Location -Path ".\server"
npm ci

# 3. Create local environment file from template
Copy-Item -Path ".\.env.example" -Destination ".\.env"

# 4. Start backend server on http://localhost:3000
npm start
```

##### macOS / Linux (bash / zsh)
```bash
git clone https://github.com/Naivedya-Shilpi/Privacy_Lens.git
cd Privacy_Lens/server
npm ci
cp .env.example .env
npm start
```

### Step 3: Verify Backend & Load Chrome Extension (2 Minutes)
1. **Verify Backend & Local AI Health (in a second PowerShell window):**
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:3000/api/health" -Method Get | ConvertTo-Json -Depth 5
   ```
   *(Expected: `"status": "healthy"`, `"defaultProvider": "ollama"`, `"ollama": { "reachable": true, "modelInstalled": true, "configuredModel": "qwen2.5:3b" }`.)*
2. **Load Chrome Extension:**
   - Open Google Chrome and go to `chrome://extensions/`.
   - Toggle **Developer mode** ON (top-right corner).
   - Click **Load unpacked** (top-left) and select the `<repo-root>\extension` folder.
   - Open any `http://` or `https://` privacy policy webpage (e.g., `https://www.mozilla.org/en-US/privacy/websites/`), click the **PrivacyLens** toolbar icon, and verify that the header badge displays **Connected** (green) and **`Local AI: Ollama • Qwen2.5 3B`** (`Ready`).
3. **What Works Right Now:**
   - Live health check between the Chrome extension popup, the Express server (`GET /api/health`), and local Ollama (`http://localhost:11434`).
   - On-demand active tab policy extraction via **Analyze This Page** (`activeTab` + `scripting`) in `extension/content/extractor.js`.
   - End-to-end **Prompt V1** (`1` call + deterministic normalizer), **Prompt V2** (`3` sequential calls), and **Prompt V3** (`4` sequential calls with Stage 4 Grounding Auditor) execution via `POST /api/analyze` using local **Ollama (`qwen2.5:3b`)** by default (or optional manual **Gemini (`gemini-2.5-flash`)** fallback).
   - **Persistent Analysis Results & Local History (`chrome.storage.local`):** Automatic saving of completed analyses, zero-call automatic restoration when reopening the popup or returning to a previously analyzed URL, **Re-Analyze Page** trigger, and a **20-entry History panel** with offline viewing, individual deletion, and confirmed **Clear All**.
   - Offline dataset preparation and partition verification scripts (`scripts/prepare-evaluation-dataset.py` and `scripts/verify-evaluation-partitions.py`).

---

## 3. Project Status: Implemented vs. Pending Evaluation Milestones

To maintain strict academic transparency, PrivacyLens clearly distinguishes between what is **implemented and running end-to-end** and what remains **pending for the Milestone 2/3 benchmark evaluation runs**:

### 3.1 Implemented Functionality (Active & Runnable Today)
- **Chrome Extension & Persistent Local History (`extension/`):** Manifest V3 (`v0.2.0`) extension with minimal permissions (`activeTab`, `scripting`, `storage`; no `<all_urls>`), DOM policy text extractor (`content/extractor.js`), V1/V2/V3 prompt selector, safe DOM result rendering (`document.createElement` + `textContent`), automatic URL-keyed result restoration (`popup/storage-manager.js`), and a 20-entry local history manager (`chrome.storage.local`).
- **Express Backend & Prompt Orchestrator (`server/`):** Node.js/Express API bound to `localhost:3000` with `helmet` security headers, origin-restricted `cors` for Chrome extensions, `zod` request & output validation (`services/prompt/schemas.js`), multi-stage V1/V2/V3 prompt runner (`services/prompt/prompt-runner.js`), `GET /api/health`, and `POST /api/analyze` (`routes/analyze.routes.js`).
- **Local-First AI Layer (`server/src/services/ai/`):** Primary `OllamaProvider` (`ollama.provider.js`, `qwen2.5:3b` at `http://localhost:11434`, `num_ctx: 8192`) and optional manual fallback `GeminiProvider` (`gemini.provider.js`, `gemini-2.5-flash` via `@google/genai`), with zero automatic fallback to cloud APIs when local mode is selected.
- **Prompt Engineering Core (`prompts/`):** Complete specifications for **Prompt V1 (`baseline-v1.md`)**, **Prompt V2 (`chained-v2.md` — 3-stage sequential chain)**, **Prompt V3 (`verified-v3.md` — 4-stage pipeline with independent accuracy/grounding auditor)**, and the canonical `PrivacyLensUnifiedAnalysis` JSON schema (`prompt-workflow.md`).
- **10-Metric Evaluation Framework & Reproducible Dataset Scripts (`evaluation/`, `scripts/`):** Detailed `0–2` scoring rubric (**M1–M10**), evaluation protocol, pre-registered experimental design, 4-scorer calibration guides, and Python scripts (`prepare-evaluation-dataset.py` and `verify-evaluation-partitions.py`) processing the 100-platform corpus into 718 usable clause test cases (`580` consensus clauses) across disjoint calibration (`10` clauses) and held-out evaluation (`498` English / `570` multilingual) partitions.

### 3.2 Pending Academic Evaluation Milestones (Milestone 2 / Milestone 3)
- Execution of the pre-registered 4-scorer human calibration phase (`10` dev clauses + `SYNTH-001`) and calculation of inter-annotator agreement.
- Execution of the full held-out V1 vs. V2 vs. V3 benchmark evaluation experiments and population of the empirical result tables in `evaluation/experiment-design.md`.

---

## 4. Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Browser Extension** | Chrome Extension Manifest V3 (`v0.2.0`), HTML5, CSS3, Vanilla JavaScript, `chrome.storage.local` |
| **Backend API** | Node.js (`>=18.0.0`, tested on `v22.19.0`), Express.js (`^4.21.2`), `cors`, `helmet`, `dotenv`, `zod` |
| **Primary Local AI Provider** | **Ollama** (`http://localhost:11434/api/chat`), Model: **`qwen2.5:3b`** (`num_ctx: 8192`) |
| **Optional Cloud AI SDKs** | `@google/genai` (`^2.32.0`, `gemini-2.5-flash` manual fallback), `openai` (`^4.86.1`), `@anthropic-ai/sdk` (`^0.39.0`) |
| **Data & Evaluation Scripts** | Python (`3.10+`, tested on `3.14.7`), `pandas` (`>=2.0.0`), `openpyxl` (`>=3.1.0`) |
| **Dev & Collaboration Tools** | npm (`nodemon` for dev watch mode), Git, GitHub, Windows PowerShell |

---

## 5. System Architecture

```text
+-------------------------------------------------------------------------------+
|                     Chrome Browser Extension (Manifest V3)                    |
|                                                                               |
|  +-----------------------------+   Explicit User Click    +-----------------+ |
|  | Popup UI (popup.html/css/js)| -----------------------> |  extractor.js   | |
|  |  - Prompt Selector (V1/V2/V3)|  (activeTab + scripting) | (DOM Extraction | |
|  |  - Saved Result Restoration |                          |  & Noise Filter)| |
|  |  - History Panel (Max 20)   |                          +-----------------+ |
|  +--------------+--------------+                                              |
|                 |  ^                                                          |
|                 |  | Auto-Save & Zero-Call URL Restoration                    |
|                 |  v                                                          |
|  +--------------+--------------+                                              |
|  |     storage-manager.js      |  (chrome.storage.local: runtime state        |
|  |  & background/service-worker|   + 20-entry persistent local history)       |
|  +--------------+--------------+                                              |
+-----------------|-------------------------------------------------------------+
                  | HTTP / JSON (http://localhost:3000)
                  | (Zero API keys stored in browser extension)
                  v
+-------------------------------------------------------------------------------+
|                         Express Backend Server (Node.js)                      |
|                                                                               |
|  +----------------------------------+  +-----------------------------------+  |
|  | Routes:                          |  | Middleware:                       |  |
|  |  - GET  /api/health              |  |  - Helmet, Origin-Restricted CORS |  |
|  |  - POST /api/analyze             |  |  - IP Rate Limiter (15 / 10 min)  |  |
|  +-----------------+----------------+  |  - Zod Request & Env Validation   |  |
|                    |                   +-----------------------------------+  |
|                    v                                                          |
|  +-------------------------------------------------------------------------+  |
|  |            Prompt Orchestration Engine (prompt-runner.js)               |  |
|  |  - V1: 1-Call Baseline + Deterministic Normalizer                       |  |
|  |  - V2: 3-Call Chained Pipeline (Stage 1 -> Stage 2 -> Stage 3)          |  |
|  |  - V3: 4-Call Verified Pipeline (Stages 1-3 + Stage 4 Grounding Auditor)|  |
|  |  - Strict Stage & Unified Output Validation via Zod (schemas.js)        |  |
|  +-----------------+-----------------------------------+-------------------+  |
|                    | Default ("ollama")                | Manual ("gemini")    |
|                    v                                   v                      |
|  +-----------------------------------+   +---------------------------------+  |
|  | Primary Local AI: OllamaProvider  |   | Optional Fallback: GeminiProvider|  |
|  | (http://localhost:11434/api/chat) |   | (@google/genai: gemini-2.5-flash)|  |
|  | Model: qwen2.5:3b (num_ctx: 8192) |   | (Used ONLY if explicitly passed) |  |
|  +-----------------------------------+   +---------------------------------+  |
+-------------------------------------------------------------------------------+
```

---

## 6. Complete Repository Folder Structure

```text
Privacy_Lens/
|
|-- extension/                                  # Chrome Manifest V3 Browser Extension (v0.2.0)
|   |-- manifest.json                           # Extension manifest (activeTab, scripting, storage)
|   |-- popup/
|   |   |-- popup.html                          # Popup UI layout (Analyze view + History panel)
|   |   |-- popup.css                           # Navy/white/blue styling, badges & history cards
|   |   |-- popup.js                            # Extraction, V1/V2/V3 analysis & history controller
|   |   |-- storage-manager.js                  # chrome.storage.local persistence & 20-entry history
|   |-- background/
|   |   |-- service-worker.js                   # Background lifecycle & storage key hygiene
|   |-- content/
|       |-- extractor.js                        # On-demand DOM privacy policy extractor & cleaner
|
|-- server/                                     # Node.js + Express Backend
|   |-- package.json                            # Server dependencies & npm scripts
|   |-- package-lock.json                       # Deterministic dependency lockfile
|   |-- .env.example                            # Safe environment variable template (Ollama default)
|   |-- src/
|       |-- server.js                           # HTTP server entry point (localhost:3000)
|       |-- app.js                              # Express app, Helmet, CORS, routes
|       |-- config/
|       |   |-- env.js                          # dotenv loader & Zod validation schema
|       |-- routes/
|       |   |-- health.routes.js                # GET /api/health endpoint (Ollama & provider readiness)
|       |   |-- analyze.routes.js               # POST /api/analyze endpoint (rate limit, validation, runner)
|       |-- middleware/
|       |   |-- error-handler.js                # 404 & global JSON error middleware
|       |-- services/
|           |-- ai/
|           |   |-- provider-interface.js       # Abstract BaseAIProvider contract
|           |   |-- ollama.provider.js          # Primary Local Ollama provider (qwen2.5:3b)
|           |   |-- gemini.provider.js          # Optional manual Google GenAI provider (gemini-2.5-flash)
|           |   |-- openai.provider.js          # OpenAI SDK adapter foundation
|           |   |-- claude.provider.js          # Anthropic SDK adapter foundation
|           |-- prompt/
|               |-- schemas.js                  # Zod schemas & JSON schema blocks for Stages 1-4 & V1
|               |-- prompt-runner.js            # V1/V2/V3 multi-stage prompt orchestrator
|
|-- prompts/                                    # Prompt Engineering Core (Phase 2)
|   |-- README.md                               # Prompt workspace overview
|   |-- prompt-workflow.md                      # Unified JSON schema & stage-by-stage trace
|   |-- versions/
|       |-- baseline-v1.md                      # Preserved Milestone 1 single-pass prompt
|       |-- chained-v2.md                       # 3-stage sequential chained prompt (V2)
|       |-- verified-v3.md                      # 4-stage verified prompt with Auditor (V3)
|
|-- evaluation/                                 # Evaluation Framework & Datasets (Phases 3-4)
|   |-- README.md                               # Evaluation directory index
|   |-- evaluation-rubric.md                    # High-level 7-dimension rubric overview
|   |-- scoring-rubric.md                       # Detailed 10-metric rubric (M1-M10)
|   |-- protocol.md                             # Evaluation protocol & hypothetical example
|   |-- experiment-design.md                    # Pre-registered hypotheses & blank tables
|   |-- score-sheet-template.csv                # Standardized 29-column scoring CSV template
|   |-- calibration/
|   |   |-- calibration-checklist.md            # 4-scorer calibration checklist
|   |   |-- scorer-training-guide.md            # Scorer rules & disagreement resolution
|   |   |-- human-scoring-agreement-sheet.csv   # 10-clause + SYNTH-001 calibration sheet
|   |   |-- experiment-execution-checklist.md   # Reproducible run checklist
|   |-- dataset/
|   |   |-- README.md                           # Dataset schema & local generation guide
|   |   |-- data-quality-report.md              # Verified counts, PDF audit & row-shift report
|   |   |-- annotated-test-cases.csv            # (Local-only, generated by script)
|   |   |-- annotation-comparison.csv           # (Local-only, generated by script)
|   |-- test-cases/
|       |-- synthetic-policy.json               # Fictional NovaNote test policy (SYNTH-001)
|
|-- datasets/                                   # External Research Corpus Workspace
|   |-- README.md                               # Dataset attribution & setup instructions
|   |-- Annotated Privacy Policies of 100.../   # (Local-only, git-ignored for copyright safety)
|
|-- scripts/                                    # Reproducible Setup & Data Scripts
|   |-- setup.ps1                               # One-command Windows PowerShell setup script
|   |-- prepare-evaluation-dataset.py           # Generates evaluation CSVs from Excel/PDFs
|   |-- verify-evaluation-partitions.py         # Verifies disjoint dev (10) & eval (498/570) sets
|
|-- docs/                                       # Project Documentation
|   |-- project-overview.md                     # Problem C18 overview & Responsible AI rules
|   |-- architecture.md                         # Component & security architecture
|   |-- setup-guide.md                          # Detailed Windows PowerShell setup guide
|   |-- development-log.md                      # Phase-by-phase engineering log
|
|-- requirements.txt                            # Python dependencies (pandas, openpyxl)
|-- .gitignore                                  # Comprehensive Git exclusion rules
|-- README.md                                   # Primary project documentation
```

---

## 7. Prerequisites & Software Requirements

| Software | Minimum Version | Tested Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Node.js** | `v18.0.0+` | `v22.19.0` | Running the Express backend server |
| **npm** | `v9.0.0+` | `v10.9.3` | Installing backend dependencies (`npm ci`) |
| **Python** | `3.10+` | `3.14.7` | Running offline dataset preparation & partition scripts |
| **Google Chrome** | Latest stable | Manifest V3 | Loading and testing the unpacked browser extension |
| **Git** | `2.30+` | `2.45.2` | Version control and team collaboration |

---

## 8. Detailed Setup Instructions

### 8.1 Backend Setup (`server/`)
1. Navigate to the backend directory:
   ```powershell
   Set-Location -Path ".\server"
   ```
2. Install exact locked dependencies using `npm ci`:
   ```powershell
   npm ci
   ```
3. Copy the environment variable template:
   ```powershell
   Copy-Item -Path ".\.env.example" -Destination ".\.env"
   ```
4. Start the server:
   - **Standard mode:** `npm start`
   - **Development auto-reload mode (`nodemon`):** `npm run dev`

### 8.2 Python Environment Setup (For Evaluation & Dataset Scripts)
From the repository root:
```powershell
# Create a local virtual environment (.venv is git-ignored)
python -m venv .venv

# Activate virtual environment in Windows PowerShell
.\.venv\Scripts\Activate.ps1

# Install required Python packages (pandas, openpyxl)
python -m pip install -r requirements.txt
```

### 8.3 Chrome Extension Setup & Reloading (`extension/`)
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle switch in the top-right corner).
3. Click **Load unpacked** (top-left button).
4. Select the `<repo-root>\extension` directory.
5. Pin **PrivacyLens** in the Chrome extensions toolbar and click its icon to open the popup.
6. **How to Reload After Code Changes:**
   - If you edit `extension/manifest.json` or `extension/background/service-worker.js`, go to `chrome://extensions/` and click the circular **Reload** icon on the PrivacyLens card.
   - If you edit `extension/popup/popup.html`, `popup.css`, or `popup.js`, simply close and re-open the extension popup.

---

## 9. Prompt Engineering Architecture (V1, V2, and V3)

Prompt engineering is the primary academic contribution of PrivacyLens. All prompt definitions live in [`prompts/`](./prompts/README.md) and map to the canonical `PrivacyLensUnifiedAnalysis` JSON schema ([`prompts/prompt-workflow.md`](./prompts/prompt-workflow.md)):

1. **Prompt V1 — Baseline Single-Prompt ([`prompts/versions/baseline-v1.md`](./prompts/versions/baseline-v1.md)):**
   - Preserves verbatim the single-pass zero-shot prompt submitted in our Milestone 1 proposal.
2. **Prompt V2 — Chained Analysis ([`prompts/versions/chained-v2.md`](./prompts/versions/chained-v2.md)):**
   - A 3-stage sequential pipeline:
     - **Stage 1 (Verbatim Clause Extraction):** Extracts word-for-word policy clauses (`verbatimExcerpt`), assigns `clauseId`s and category tags, and flags `unmentionedCategories`.
     - **Stage 2 (Structured Privacy & Clause Analysis):** Maps collected data to purposes, structures third-party sharing and user rights, and distinguishes `Explicitly Stated Term` from `Potentially Concerning / Broad Wording`.
     - **Stage 3 (Plain-Language Synthesis):** Produces an accessible plain-language report marked explicitly as an **unverified candidate** (`verificationStatus: "unverified_candidate"`, `verified: false`).
3. **Prompt V3 — Verified Analysis ([`prompts/versions/verified-v3.md`](./prompts/versions/verified-v3.md)):**
   - Builds on V2 by adding **Stage 4 (Independent Accuracy & Grounding Auditor)**, which independently checks every factual claim, every `supportingExcerpt`, and every `missingInformation` explanation against `<UNTRUSTED_POLICY_TEXT>`, removing unsupported claims and enforcing the 4-way epistemic distinction (`verificationStatus: "verified_by_stage4"`, `verified: true`).

---

## 10. Evaluation Framework & Dataset Preparation

Our evaluation framework in [`evaluation/`](./evaluation/README.md) is built around the research corpus *"Annotated Privacy Policies of 100 Online Platforms"* (`GenData`, `GenUse`, `NoDist`) and [`synthetic-policy.json`](./evaluation/test-cases/synthetic-policy.json):

- **Verified Dataset Counts ([`evaluation/dataset/data-quality-report.md`](./evaluation/dataset/data-quality-report.md)):**
  - **100** platforms in source spreadsheets (`98` annotated with source PDFs; `2` unannotated/excluded: `iCloud` and `YouTube`).
  - **900** total `(platform, clause_slot)` pairs compared in `annotation-comparison.csv`.
  - **718** usable clause test cases (`580` high-confidence consensus clauses with `requires_human_review = False`, plus `138` single-annotator/divergent clauses flagged for review).
- **Disjoint Benchmark Partitions (`scripts/verify-evaluation-partitions.py`):**
  - **Development / Calibration Partition:** `10` English consensus clauses across `2` platforms (`Telegram` and `Cisco`) + `SYNTH-001`.
  - **Primary Held-Out English Evaluation Subset:** `498` English consensus clauses across `75` held-out English platforms (`0` overlap with calibration platforms).
  - **Full Held-Out Multilingual Consensus Benchmark:** `570` consensus clauses across `85` held-out platforms (`498` English + `72` Polish).
- **10-Metric Scoring System ([`evaluation/scoring-rubric.md`](./evaluation/scoring-rubric.md)):**
  - Evaluates **M1** Clause Identification Accuracy, **M2** Data Collection, **M3** Data Usage, **M4** Third-Party Sharing (`N/A` on isolated clauses lacking disclosure), **M5** User Rights (`N/A` on isolated clauses), **M6** Risk & Vague Wording, **M7** Evidence Grounding (verbatim quotations), **M8** Missing-Information Handling (`N/A` on isolated clauses), **M9** Plain-Language Clarity, and **M10** Hallucination Rate ($\text{HR} = C_{\text{unsupported}} / C_{\text{total}}$ with mutually exclusive thresholds).

---

## 11. Environment Variable Configuration, Persistent History & Known Limitations

`server/.env.example` defines the following variables:

| Variable | Default | Required Now? | Description |
| :--- | :--- | :---: | :--- |
| `PORT` | `3000` | Yes (has default) | Local port for the Express backend server (`http://localhost:3000`). |
| `DEFAULT_AI_PROVIDER` | `ollama` | Yes (has default) | Primary AI provider (`ollama` for local-first execution; `gemini` optional). |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Yes (has default) | Local Ollama server base URL (enforced as `localhost` / `127.0.0.1` only). |
| `OLLAMA_MODEL` | `qwen2.5:3b` | Yes (has default) | Local Ollama model tag used for V1, V2, and V3 analyses. |
| `OLLAMA_CONTEXT_LENGTH` | `8192` | Yes (has default) | Context window (`num_ctx`) tuned for 100% GPU execution on 4 GB VRAM GPUs. |
| `GEMINI_API_KEY` | *(empty)* | No (Optional) | Optional secret API key for manual Google Gemini (`gemini-2.5-flash`) fallback. |
| `OPENAI_API_KEY` | *(empty)* | No (Optional) | Secret API key placeholder for OpenAI (`openai` SDK). |
| `ANTHROPIC_API_KEY` | *(empty)* | No (Optional) | Secret API key placeholder for Anthropic Claude (`@anthropic-ai/sdk`). |

- **Current AI Provider Status:** `ollama` (`qwen2.5:3b` on `http://localhost:11434`) is the active default provider for V1, V2, and V3 analyses. `gemini` (`gemini-2.5-flash`) is preserved strictly as a manually requested fallback (`"provider": "gemini"`). PrivacyLens never automatically switches to Gemini if Ollama is offline.
- **Persistent Results & Local History (`chrome.storage.local`):** Implemented in `extension/popup/storage-manager.js`. Completed V1/V2/V3 results are automatically saved to `chrome.storage.local` (`privacylens_analysis_history`) using normalized URL keys, automatically restored when reopening the popup or returning to an analyzed website (`0` AI calls), and managed through a 20-entry **History (`N`)** view with offline report viewing, individual deletion, confirmed **Clear All**, quota auto-pruning, and interrupted-session handling.
- **Known Technical Limitations:**
  1. Closing the Chrome extension popup while an HTTP `fetch` request is still in progress interrupts that in-flight request (reopening restores any previous completed result and notifies the user).
  2. Local context length is capped at `8,192` tokens (`58,000` characters extracted) to preserve 100% GPU offloading on 4 GB VRAM GPUs.
  3. In Prompt V3, Stage 4 (Independent Accuracy & Grounding Auditor) runs as a fresh verification pass on the same local `qwen2.5:3b` model (`temperature: 0.1`).

---

## 12. Troubleshooting Guide

| Symptom / Issue | Cause | Solution |
| :--- | :--- | :--- |
| Popup badge says **Offline** (`Backend Unreachable`) | Express server in `server/` is not running. | Run `cd server; npm start` and verify `http://localhost:3000/api/health` responds. |
| `Port 3000 is already in use` (`EADDRINUSE`) | Another process or previous node instance is bound to port 3000. | Stop the existing process or change `PORT` in `server/.env`. |
| Popup says `Unsupported Page Type` when clicking **Analyze This Page** | Active tab is a restricted `chrome://` or Chrome Web Store page. | Switch to any standard `http://` or `https://` webpage and click **Analyze This Page** again. |
| `FileNotFoundError: Could not find annotator spreadsheets` when running Python scripts | The local research dataset has not been placed in `datasets/` yet. | Follow [`datasets/README.md`](./datasets/README.md) to extract `"Annotated Privacy Policies of 100 Online Platforms"` into `datasets/`. |
| PowerShell blocks running `.\scripts\setup.ps1` | Windows PowerShell ExecutionPolicy restriction. | Run `powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1`. |

---

## 13. Team Contributions (`Team ladybug`)

**Course:** Prompt Engineering (SCSE4041), Bennett University — **Problem Statement C18**  
**Team Size:** 4 Members (`Scorer_1`, `Scorer_2`, `Scorer_3`, `Scorer_4`)

- **Architecture & Full-Stack Foundation:** Chrome Manifest V3 extension (`extension/`) and Express backend + multi-provider AI service layer (`server/`).
- **Prompt Engineering Core:** Design and specification of Prompt V1 (`baseline-v1`), Prompt V2 (`chained-v2`), Prompt V3 (`verified-v3`), and the `PrivacyLensUnifiedAnalysis` JSON schema (`prompts/`).
- **Dataset Engineering & Quality Audit:** Inspection of the 100-platform corpus, discovery of the `Oktawave`/`OVH` row-shift anomaly, and creation of deterministic data scripts (`scripts/`).
- **Evaluation & Calibration Framework:** 10-metric rubric (**M1–M10**), disjoint dev/eval partitioning, and 4-scorer calibration & agreement workflow (`evaluation/`).

---

## 14. Responsible AI & Legal Disclaimer

1. **Not Legal Advice:** PrivacyLens is an academic and informational transparency companion. It does **not** provide legal advice, legal representation, or automated determinations of whether a policy is legally compliant or safe to accept.
2. **Source-of-Truth Grounding:** The original privacy policy text is the sole source of truth. Prompts are engineered to cite verbatim excerpts, mark omitted topics as `"Not specified"`, and distinguish between **Explicitly Stated Terms**, **Potentially Concerning / Broad Wording**, and **Conditional Implications**.
3. **Prompt Injection Defense & Privacy:** Extracted webpage text is treated strictly as untrusted passive data (`<UNTRUSTED_POLICY_TEXT>`) and is never persisted in a database.

---

## 15. License & Third-Party Dataset Attribution

- **Project Code & Original Documentation License:** ISC License (Copyright © 2026 Team ladybug, Bennett University).
- **Third-Party Research Dataset Attribution:**
  - The Phase 3/4 evaluation design references the academic dataset *"Annotated Privacy Policies of 100 Online Platforms"*, whose research annotations (`GenData`, `GenUse`, `NoDist`) and coding instructions are licensed under **Creative Commons Attribution 4.0 International (CC BY 4.0)**.
  - The underlying privacy policy documents (195 PDFs in `Tagger 1/` and `Tagger 2/`) remain the intellectual property of their respective online platforms. To respect third-party copyright, raw PDF policies, original annotator spreadsheets, and bulk-extracted clause CSVs are excluded from this public repository via `.gitignore` and processed locally via [`scripts/prepare-evaluation-dataset.py`](./scripts/prepare-evaluation-dataset.py). See [`datasets/README.md`](./datasets/README.md) for details.
