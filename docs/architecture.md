# PrivacyLens — System Architecture

## 1. High-Level Architecture

PrivacyLens follows a modular, local-first separation between the **Chrome Extension Frontend (Manifest V3)**, the **Node.js/Express Backend & V1/V2/V3 Prompt Orchestrator**, and the **Local-First AI Service Layer (Ollama `qwen2.5:3b` primary, Gemini `gemini-2.5-flash` optional manual fallback)**.

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

## 2. Component Responsibilities

### 2.1 Browser Extension (`extension/`)
- **Manifest V3 (`manifest.json`):** Version `0.2.0`, requesting minimal permissions (`activeTab`, `scripting`, `storage`) and `host_permissions: ["http://localhost:3000/*"]` (no `<all_urls>`). Webpage access occurs solely after explicit user invocation.
- **Popup Interface (`popup/popup.html`, `popup.css`, `popup.js`):** Displays backend and local Ollama readiness (`GET /api/health`), allows selecting inference provider (`ollama` default or manual `gemini` fallback) and prompt architecture (`v1`, `v2`, `v3`), triggers DOM extraction or manual policy paste, and renders all 9 structured analysis sections safely via `document.createElement` + `textContent` (zero `innerHTML`).
- **Persistent Result & History Manager (`popup/storage-manager.js`):** Persists completed analyses in `chrome.storage.local` (`privacylens_analysis_history`), normalizes URLs (`normalizeUrlKey`), automatically restores saved results on popup reopen/tab switch without redundant AI calls, and enforces a 20-entry local history cap with individual delete, confirmed Clear All, and quota recovery.
- **Content Extractor (`content/extractor.js`):** Injected on-demand via `chrome.scripting.executeScript` to extract readable policy text (`80–58,000` chars), prioritizing `<article>`, `<main>`, and policy containers while stripping navigation, footer, script, style, and cookie-banner clutter.
- **Background Service Worker (`background/service-worker.js`):** Initializes `chrome.storage.local` keys and responds to runtime storage summary messages.

### 2.2 Backend Server (`server/`)
- **Configuration (`src/config/env.js`):** Loads `server/.env` via `dotenv` and validates all environment settings (`PORT`, `AI_PROVIDER`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_CONTEXT_LENGTH`, optional cloud keys) using `zod`.
- **Express Application (`src/app.js` & `src/server.js`):** Configures `helmet` security headers, origin-restricted `cors` for local development and `chrome-extension://` origins, JSON body parsing (`1mb` limit), and centralized error handling.
- **Routes (`src/routes/health.routes.js`, `src/routes/analyze.routes.js`):**
  - `GET /api/health`: Returns server status, default provider (`ollama`), live Ollama daemon reachability, `qwen2.5:3b` model availability, and boolean configuration flags.
  - `POST /api/analyze`: Validates incoming policy analysis requests with `zod`, enforces an in-memory IP rate limit (`15` requests per `10` minutes), invokes the V1/V2/V3 prompt runner, and returns the validated `PrivacyLensUnifiedAnalysis` payload and stage telemetry.
- **Prompt Orchestration & Validation (`src/services/prompt/prompt-runner.js`, `schemas.js`):**
  - Loads unmodified prompt templates from `prompts/versions/baseline-v1.md`, `chained-v2.md`, and `verified-v3.md`.
  - Executes **V1** (`1` call + deterministic normalizer), **V2** (`3` sequential calls), and **V3** (`4` sequential calls with Stage 4 Independent Accuracy & Grounding Auditor) and validates every stage output against strict Zod schemas.
- **Provider-Independent AI Layer (`src/services/ai/`):**
  - `provider-interface.js`: Abstract base class (`BaseAIProvider`) defining a uniform contract across LLMs.
  - `ollama.provider.js`: Primary local-first adapter communicating with `POST http://localhost:11434/api/chat` (`qwen2.5:3b`, `num_ctx: 8192`) with strict loopback-only URL validation.
  - `gemini.provider.js`: Optional manual fallback adapter for Google Gemini (`@google/genai` SDK, `gemini-2.5-flash`).
  - `openai.provider.js` & `claude.provider.js`: SDK adapter foundations for OpenAI and Anthropic Claude.

### 2.3 Prompt Engineering & Evaluation Workspaces (`prompts/`, `evaluation/`, `datasets/`, `scripts/`)
- **`prompts/`:** Houses version-controlled prompt templates (`baseline-v1.md`, `chained-v2.md`, `verified-v3.md`) and the canonical `PrivacyLensUnifiedAnalysis` JSON schema (`prompt-workflow.md`).
- **`evaluation/`:** Contains the 10-metric scoring rubric (**M1–M10**, `scoring-rubric.md`), evaluation protocol (`protocol.md`), pre-registered experiment design (`experiment-design.md`), 4-scorer calibration suite (`calibration/`), and synthetic test policy (`test-cases/synthetic-policy.json`).
- **`scripts/`:** Contains deterministic dataset preparation (`prepare-evaluation-dataset.py`), partition verification (`verify-evaluation-partitions.py`), and Windows setup (`setup.ps1`).

---

## 3. Security & Threat Mitigation Design

1. **Zero Client-Side Secrets:** The Chrome extension never stores or transmits LLM API keys.
2. **Local-First Processing & Zero Silent Cloud Fallback:** All default V1, V2, and V3 analyses execute locally on the user's machine via Ollama (`qwen2.5:3b`). `OllamaProvider.assertLocalUrl()` rejects any non-loopback `OLLAMA_BASE_URL`, and the backend never silently falls back to cloud APIs if Ollama is offline.
3. **Least-Privilege Extension Permissions & XSS-Safe Rendering:** By relying on `activeTab`, `scripting`, and `storage` instead of `<all_urls>`, PrivacyLens cannot read browsing activity in the background. All popup results are rendered exclusively with `document.createElement` and `textContent` (zero `innerHTML`).
4. **Prompt Injection Isolation:** Extracted webpage text is wrapped inside `<UNTRUSTED_POLICY_TEXT>` delimiters with explicit system instructions to treat the policy text strictly as passive untrusted data.
